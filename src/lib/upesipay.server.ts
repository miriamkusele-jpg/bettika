/** UpesiPay collections helpers — server only. */

const INITIATE_URL = "https://upesipay.com/api/v2/collections/initiate/";

const DEFAULT_CALLBACK =
  "https://project--cbb417ce-4b43-413e-88fc-37c7ede9e95d.lovable.app/api/public/upesipay/callback";

/** Short, readable id shared between the user-facing message and server logs. */
export function newCorrelationId(): string {
  return `up_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export interface UpesiErrorDetail {
  /** Safe to show the user. Never contains credentials. */
  message: string;
  correlationId: string;
  stage: "config" | "initiate";
  httpStatus?: number;
  providerCode?: string;
}

export class UpesiError extends Error {
  readonly detail: UpesiErrorDetail;

  constructor(detail: UpesiErrorDetail) {
    super(`${detail.message} (ref ${detail.correlationId})`);
    this.name = "UpesiError";
    this.detail = detail;
  }
}

function fail(
  stage: UpesiErrorDetail["stage"],
  message: string,
  correlationId: string,
  extra: { httpStatus?: number; providerCode?: string } = {},
): never {
  const detail: UpesiErrorDetail = {
    message,
    correlationId,
    stage,
    ...(extra.httpStatus !== undefined ? { httpStatus: extra.httpStatus } : {}),
    ...(extra.providerCode !== undefined ? { providerCode: extra.providerCode } : {}),
  };
  console.error("[upesipay]", JSON.stringify(detail));
  throw new UpesiError(detail);
}

export function callbackUrl(): string {
  return process.env["UPESIPAY_CALLBACK_URL"] ?? DEFAULT_CALLBACK;
}

export interface InitiateResult {
  /** Provider reference we match the callback on. */
  reference: string;
  /** Secondary provider id, when supplied. */
  providerId: string;
  message: string;
  correlationId: string;
}

/** POSTs a collection request to UpesiPay; triggers the M-PESA prompt. */
export async function initiateCollection(args: {
  phone: string;
  amount: number;
  correlationId?: string;
}): Promise<InitiateResult> {
  const correlationId = args.correlationId ?? newCorrelationId();

  const auth = process.env["UPESIPAY_AUTH_HEADER"];
  if (!auth) {
    fail("config", "Payments are not fully configured yet. Please try again later.", correlationId);
  }
  const channelId = Number(process.env["UPESIPAY_CHANNEL_ID"] ?? 143);

  let res: Response;
  try {
    res = await fetch(INITIATE_URL, {
      method: "POST",
      headers: { Authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        channel_id: channelId,
        phone_number: args.phone,
        amount: Math.round(args.amount),
        callback_url: callbackUrl(),
      }),
    });
  } catch {
    fail("initiate", "Could not reach the payment provider. Please try again.", correlationId);
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = body?.[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    const data = body?.["data"];
    if (data && typeof data === "object") {
      for (const k of keys) {
        const v = (data as Record<string, unknown>)[k];
        if (typeof v === "string" && v) return v;
        if (typeof v === "number") return String(v);
      }
    }
    return "";
  };

  const reference = pick(
    "reference",
    "transaction_reference",
    "transaction_id",
    "transactionId",
    "id",
    "checkout_request_id",
    "CheckoutRequestID",
  );

  if (!res.ok || !reference) {
    const raw = pick("message", "detail", "error");
    fail("initiate", raw || "The payment provider rejected this request.", correlationId, {
      httpStatus: res.status,
      ...(pick("code") ? { providerCode: pick("code") } : {}),
    });
  }

  return {
    reference,
    providerId: pick("transaction_id", "transactionId", "id"),
    message: pick("message", "customer_message") || "Enter your M-PESA PIN on your phone.",
    correlationId,
  };
}

export interface DepositPushOutcome {
  depositId: string;
  message: string;
  correlationId: string;
  attempt: number;
}

/**
 * Sends the prompt for an existing deposit intent and records the provider refs.
 * Wallet credits only ever happen in `credit_deposit` from the UpesiPay
 * callback, so repeating this for the same deposit cannot double-credit.
 */
export async function runDepositPush(args: {
  depositId: string;
  phone: string;
  amount: number;
  attempt: number;
}): Promise<DepositPushOutcome> {
  const correlationId = newCorrelationId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("deposits")
    .update({ correlation_id: correlationId, provider: "upesipay" })
    .eq("id", args.depositId);

  try {
    const push = await initiateCollection({
      phone: args.phone,
      amount: args.amount,
      correlationId,
    });
    await supabaseAdmin.rpc("attach_deposit_refs", {
      _deposit_id: args.depositId,
      _checkout: push.reference,
      _merchant: push.providerId,
    });
    return {
      depositId: args.depositId,
      message: push.message,
      correlationId: push.correlationId,
      attempt: args.attempt,
    };
  } catch (e) {
    const detail: UpesiErrorDetail =
      e instanceof UpesiError
        ? e.detail
        : {
            message: e instanceof Error ? e.message : "Payment request failed",
            correlationId,
            stage: "initiate",
          };
    const suffix = `[ref ${detail.correlationId} · attempt ${args.attempt}]`;
    await supabaseAdmin
      .from("deposits")
      .update({ status: "failed", result_desc: `${detail.message} ${suffix}` })
      .eq("id", args.depositId);
    // Plain Error so the detail crosses the RPC boundary as a readable message.
    throw new Error(
      `${detail.message}\nRef ${detail.correlationId} · attempt ${args.attempt}`,
    );
  }
}
