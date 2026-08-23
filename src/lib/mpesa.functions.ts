import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stable published URL — M-PESA must be able to reach the callback from the internet. */
const DEFAULT_CALLBACK =
  "https://project--cbb417ce-4b43-413e-88fc-37c7ede9e95d.lovable.app/api/public/mpesa/callback";

export const startMpesaDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; phone: string }) => {
    const amount = Math.round(Number(input.amount));
    const phone = String(input.phone).replace(/\D/g, "");
    if (!Number.isFinite(amount) || amount < 10 || amount > 150000) {
      throw new Error("Deposit must be between KES 10 and KES 150,000");
    }
    if (!/^254[17]\d{8}$/.test(phone)) throw new Error("Enter a valid Safaricom number");
    return { amount, phone };
  })
  .handler(async ({ data, context }) => {
    const { data: deposit, error } = await context.supabase.rpc("create_deposit", {
      _amount: data.amount,
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(deposit) ? deposit[0] : deposit) as { id: string } | null;
    if (!row) throw new Error("Could not start the deposit");

    const { stkPush, MpesaError, newCorrelationId, mpesaHost, mpesaEnv } = await import(
      "./mpesa.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const correlationId = newCorrelationId();

    try {
      const push = await stkPush({
        phone: data.phone,
        amount: data.amount,
        reference: row.id,
        callbackUrl: process.env["MPESA_CALLBACK_URL"] ?? DEFAULT_CALLBACK,
        correlationId,
      });
      await supabaseAdmin.rpc("attach_deposit_refs", {
        _deposit_id: row.id,
        _checkout: push.checkoutRequestId,
        _merchant: push.merchantRequestId,
      });
      return {
        depositId: row.id,
        message: push.customerMessage,
        correlationId: push.correlationId,
      };
    } catch (e) {
      const detail =
        e instanceof MpesaError
          ? e.detail
          : {
              message: e instanceof Error ? e.message : "M-PESA request failed",
              correlationId,
              host: mpesaHost(),
              environment: mpesaEnv(),
              stage: "stk_push" as const,
            };
      await supabaseAdmin
        .from("deposits")
        .update({
          status: "failed",
          result_desc: `${detail.message} [ref ${detail.correlationId} · ${detail.environment} · ${detail.host}]`,
        })
        .eq("id", row.id);
      // Plain Error so the detail crosses the RPC boundary as a readable message.
      throw new Error(
        `${detail.message}\nRef ${detail.correlationId} · ${detail.environment} · ${detail.host}`,
      );
    }
  });
