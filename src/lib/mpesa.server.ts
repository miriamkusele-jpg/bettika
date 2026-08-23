/** Safaricom Daraja (M-PESA) helpers — server only. */

export type MpesaEnv = "sandbox" | "production";

/** Daraja has separate hosts for sandbox and live. Credentials only work on their own host. */
export function mpesaEnv(): MpesaEnv {
  const env = (process.env["MPESA_ENV"] ?? "production").toLowerCase();
  return env.startsWith("sand") ? "sandbox" : "production";
}

export function mpesaHost(): string {
  return mpesaEnv() === "sandbox"
    ? "sandbox.safaricom.co.ke"
    : "api.safaricom.co.ke";
}

function base(): string {
  return `https://${mpesaHost()}`;
}

/** Short, readable id shared between the user-facing message and server logs. */
export function newCorrelationId(): string {
  return `mp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export interface MpesaErrorDetail {
  /** Safe to show the user. Never contains credentials. */
  message: string;
  correlationId: string;
  host: string;
  environment: MpesaEnv;
  stage: "config" | "auth" | "stk_push";
  httpStatus?: number;
  providerCode?: string;
}

export class MpesaError extends Error {
  readonly detail: MpesaErrorDetail;

  constructor(detail: MpesaErrorDetail) {
    super(
      `${detail.message} (ref ${detail.correlationId} · ${detail.environment} · ${detail.host})`,
    );
    this.name = "MpesaError";
    this.detail = detail;
  }
}

function fail(
  stage: MpesaErrorDetail["stage"],
  message: string,
  correlationId: string,
  extra: { httpStatus?: number; providerCode?: string } = {},
): never {
  const detail: MpesaErrorDetail = {
    message,
    correlationId,
    host: mpesaHost(),
    environment: mpesaEnv(),
    stage,
    ...(extra.httpStatus !== undefined ? { httpStatus: extra.httpStatus } : {}),
    ...(extra.providerCode !== undefined ? { providerCode: extra.providerCode } : {}),
  };
  console.error("[mpesa]", JSON.stringify(detail));
  throw new MpesaError(detail);
}

function requireEnv(name: string, correlationId: string): string {
  const value = process.env[name];
  if (!value) {
    fail("config", `M-PESA is not fully configured (${name} is missing).`, correlationId);
  }
  return value;
}

export function darajaTimestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

export async function getAccessToken(correlationId: string): Promise<string> {
  const key = requireEnv("MPESA_CONSUMER_KEY", correlationId);
  const secret = requireEnv("MPESA_CONSUMER_SECRET", correlationId);
  const basic = btoa(`${key}:${secret}`);

  let res: Response;
  try {
    res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basic}` },
    });
  } catch {
    fail("auth", "Could not reach M-PESA. Please try again.", correlationId);
  }

  const body = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !body?.access_token) {
    fail(
      "auth",
      res.status === 400 || res.status === 401
        ? "M-PESA rejected our app credentials. The consumer key and secret must belong to a Daraja app in this environment."
        : "Could not reach M-PESA. Please try again.",
      correlationId,
      { httpStatus: res.status },
    );
  }
  return body.access_token;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
  correlationId: string;
}

export async function stkPush(args: {
  phone: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  correlationId?: string;
}): Promise<StkPushResult> {
  const correlationId = args.correlationId ?? newCorrelationId();
  const shortcode = requireEnv("MPESA_SHORTCODE", correlationId);
  const passkey = requireEnv("MPESA_PASSKEY", correlationId);
  const timestamp = darajaTimestamp();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);
  const token = await getAccessToken(correlationId);

  let res: Response;
  try {
    res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(args.amount),
        PartyA: args.phone,
        PartyB: shortcode,
        PhoneNumber: args.phone,
        CallBackURL: args.callbackUrl,
        AccountReference: "BETKAA",
        TransactionDesc: `BETKAA deposit ${args.reference}`,
      }),
    });
  } catch {
    fail("stk_push", "Could not reach M-PESA. Please try again.", correlationId);
  }

  const body = (await res.json().catch(() => null)) as
    | {
        CheckoutRequestID?: string;
        MerchantRequestID?: string;
        CustomerMessage?: string;
        errorMessage?: string;
        errorCode?: string;
        ResponseCode?: string;
      }
    | null;

  if (!res.ok || !body?.CheckoutRequestID) {
    const raw = body?.errorMessage ?? "M-PESA rejected the payment request.";
    const friendly = /invalid access token/i.test(raw)
      ? "M-PESA rejected our credentials. The consumer key, secret, shortcode and passkey must all come from the same Daraja app and environment."
      : raw;
    fail("stk_push", friendly, correlationId, {
      httpStatus: res.status,
      ...(body?.errorCode ? { providerCode: body.errorCode } : {}),
    });
  }

  return {
    checkoutRequestId: body.CheckoutRequestID,
    merchantRequestId: body.MerchantRequestID ?? "",
    customerMessage: body.CustomerMessage ?? "Enter your M-PESA PIN on your phone.",
    correlationId,
  };
}
