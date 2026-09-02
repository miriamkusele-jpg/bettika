import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts a deposit intent and pushes an UpesiPay collection (M-PESA prompt). */
export const startDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; phone: string }) => {
    const amount = Math.round(Number(input.amount));
    // Accept 07…, 01…, 254… and +254… for both Safaricom and Airtel lines.
    const digits = String(input.phone).replace(/\D/g, "");
    const local = digits.startsWith("254")
      ? digits.slice(3)
      : digits.startsWith("0")
        ? digits.slice(1)
        : digits;
    if (!Number.isFinite(amount) || amount < 100 || amount > 150000) {
      throw new Error("Deposit must be between KES 100 and KES 150,000");
    }
    if (!/^[17]\d{8}$/.test(local)) {
      throw new Error(
        "Enter a valid Kenyan mobile number (Safaricom or Airtel), e.g. 0712345678 or 0102345678",
      );
    }
    return { amount, phone: `254${local}` };
  })
  .handler(async ({ data, context }) => {
    const { data: deposit, error } = await context.supabase.rpc("create_deposit", {
      _amount: data.amount,
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(deposit) ? deposit[0] : deposit) as { id: string } | null;
    if (!row) throw new Error("Could not start the deposit");

    const { runDepositPush } = await import("./upesipay.server");
    return runDepositPush({
      depositId: row.id,
      phone: data.phone,
      amount: data.amount,
      attempt: 1,
    });
  });

/**
 * Re-sends the prompt for a deposit the player already created.
 * `retry_deposit` refuses deposits that were already paid and refuses while a
 * prompt is still live, and credits only come from the UpesiPay callback — so
 * retrying can never produce a duplicate wallet credit.
 */
export const retryDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { depositId: string }) => {
    const depositId = String(input.depositId);
    if (!/^[0-9a-f-]{36}$/i.test(depositId)) throw new Error("Invalid deposit reference");
    return { depositId };
  })
  .handler(async ({ data, context }) => {
    const { newCorrelationId, runDepositPush } = await import("./upesipay.server");
    const correlationId = newCorrelationId();

    // RLS scopes this to the caller's own deposits.
    const { data: reopened, error } = await context.supabase.rpc("retry_deposit", {
      _deposit_id: data.depositId,
      _correlation: correlationId,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(reopened) ? reopened[0] : reopened) as {
      id: string;
      phone: string;
      amount: number;
      attempts: number;
    } | null;
    if (!row) throw new Error("Could not reopen this deposit");

    return runDepositPush({
      depositId: row.id,
      phone: row.phone,
      amount: Number(row.amount),
      attempt: Number(row.attempts),
    });
  });
