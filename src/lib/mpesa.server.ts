/** Safaricom Daraja (M-PESA) helpers — server only. */

/** Daraja has separate hosts for sandbox and live. Credentials only work on their own host. */
function base(): string {
  const env = (process.env["MPESA_ENV"] ?? "production").toLowerCase();
  return env.startsWith("sand")
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it in backend secrets.`);
  return value;
}

export function darajaTimestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

export async function getAccessToken(): Promise<string> {
  const key = requireEnv("MPESA_CONSUMER_KEY");
  const secret = requireEnv("MPESA_CONSUMER_SECRET");
  const basic = btoa(`${key}:${secret}`);
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !body?.access_token) {
    console.error("[mpesa] token error", res.status);
    throw new Error("Could not reach M-PESA. Please try again.");
  }
  return body.access_token;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

export async function stkPush(args: {
  phone: string;
  amount: number;
  reference: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  const shortcode = requireEnv("MPESA_SHORTCODE");
  const passkey = requireEnv("MPESA_PASSKEY");
  const timestamp = darajaTimestamp();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);
  const token = await getAccessToken();

  const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
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

  const body = (await res.json().catch(() => null)) as
    | {
        CheckoutRequestID?: string;
        MerchantRequestID?: string;
        CustomerMessage?: string;
        errorMessage?: string;
        ResponseCode?: string;
      }
    | null;

  if (!res.ok || !body?.CheckoutRequestID) {
    console.error("[mpesa] stk push failed", res.status, body?.errorMessage);
    throw new Error(body?.errorMessage ?? "M-PESA rejected the payment request.");
  }

  return {
    checkoutRequestId: body.CheckoutRequestID,
    merchantRequestId: body.MerchantRequestID ?? "",
    customerMessage: body.CustomerMessage ?? "Enter your M-PESA PIN on your phone.",
  };
}
