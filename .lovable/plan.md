# UpesiPay as the primary deposit collector

Switch player deposits from Safaricom Daraja to UpesiPay collections, keep the existing
deposit/wallet records and the 100% bonus rule, and retire the Daraja code path cleanly.

## What changes for players

- The "Deposit via M-PESA" modal stays exactly the same (phone + amount).
- Tapping Deposit now sends the request to UpesiPay, which triggers the M-PESA STK prompt.
- When UpesiPay confirms payment, the wallet is credited automatically (cash + 100% bonus
  on deposits of KES 500 or more), exactly as today.
- Failed or cancelled prompts mark the deposit as failed with a readable reason, and the
  existing retry flow re-sends a fresh prompt without ever double-crediting.

## Callback URL (the one open question answered)

You do not need anything new from UpesiPay's side beyond pasting a URL. The app can host
the callback itself on a stable, publicly reachable path:

```text
https://project--cbb417ce-4b43-413e-88fc-37c7ede9e95d.lovable.app/api/public/upesipay/callback
```

This URL is immutable (survives renames) and always serves the latest published build, so
it is the value to put in `callback_url`. For preview testing there is a `-dev` twin. I will
send this URL with every initiate request, so no dashboard configuration is required.

## Technical plan

1. **Secrets** — store UpesiPay credentials as backend secrets: `UPESIPAY_AUTH_HEADER`
   (or key/secret pair), `UPESIPAY_CHANNEL_ID` (143), optional `UPESIPAY_CALLBACK_URL`
   override. Nothing hardcoded in the repo.
2. **`src/lib/upesipay.server.ts`** — server-only client: builds the JSON payload
   (`channel_id`, `phone_number` in `254…` form, `amount`, `callback_url`), POSTs to
   `https://upesipay.com/api/v2/collections/initiate/`, and returns a normalised result
   with the provider reference plus a correlation id. Reuses the existing safe-error
   pattern (user-safe message + correlation id, full detail only in server logs).
3. **`src/lib/payments.functions.ts`** — authenticated server functions
   `startDeposit` / `retryDeposit` that create or reopen the deposit row via the existing
   `create_deposit` / `retry_deposit` RPCs, then push through UpesiPay.
4. **Database migration** — add a `provider` column to `deposits` (default `upesipay`) and
   generalise the reference columns so UpesiPay's transaction/reference id is stored and
   matched on callback. `credit_deposit` / `fail_deposit` gain a provider-agnostic lookup;
   crediting stays idempotent (a repeated callback is a no-op).
5. **`src/routes/api/public/upesipay/callback.ts`** — public POST endpoint that validates
   the payload shape, looks up the deposit by provider reference, and calls
   `credit_deposit` or `fail_deposit`. It accepts only known references and returns 200 to
   the provider so it stops retrying. If UpesiPay supports a signature or shared secret, I
   will verify it; otherwise the endpoint trusts nothing from the body except the reference
   and re-reads the amount from our own record.
6. **UI** — `MoneySheet` and the wallet page call the new function instead of
   `startMpesaDeposit`. Wording changes from "M-PESA prompt via Daraja" to a neutral
   "M-PESA prompt"; the player experience is unchanged.

## Daraja clean-up advice

- Delete `src/lib/mpesa.functions.ts`, `src/lib/mpesa.server.ts` and
  `src/routes/api/public/mpesa/callback.ts` once UpesiPay deposits are verified working.
- Keep them until the first successful live UpesiPay deposit, then remove in one commit —
  the `deposits` / `wallet_ledger` tables and all history stay untouched.
- Historical Daraja rows keep `provider = 'daraja'` and remain readable in the wallet ledger.
- After removal, the `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` and
  `MPESA_SHORTCODE` secrets can be deleted (I will list them for you to confirm).
- Withdrawals are unaffected: they stay on the admin approval queue.

## Notes before I build

- The sample header reads `Authorization: Bearer Bearer Basic <base64>` — likely a copy
  paste artefact. I will store the exact header value you want sent as a single secret so
  whatever UpesiPay expects goes out verbatim.
- The base64 value in your message is a live credential, so it goes into a backend secret,
  not into the code.
