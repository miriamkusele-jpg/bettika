import { createFileRoute } from "@tanstack/react-router";

/**
 * UpesiPay collection callback. We trust only the provider reference from the
 * body: the amount and bonus come from our own deposit record, and
 * `credit_deposit` is idempotent, so repeated callbacks are a no-op.
 */
export const Route = createFileRoute("/api/public/upesipay/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> | null = null;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, message: "Invalid payload" });
        }

        const nested =
          body && typeof body["data"] === "object" && body["data"] !== null
            ? (body["data"] as Record<string, unknown>)
            : {};
        const pick = (...keys: string[]): string => {
          for (const k of keys) {
            for (const src of [body, nested]) {
              const v = src?.[k];
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
        );
        if (!reference) {
          console.error("[upesipay] callback without a reference");
          return Response.json({ ok: false, message: "Missing reference" });
        }

        const status = pick("status", "state", "result", "transaction_status").toLowerCase();
        const code = pick("result_code", "code");
        const success =
          /success|complete|completed|paid|confirmed/.test(status) || code === "0";
        const receipt = pick("mpesa_receipt", "mpesa_receipt_number", "receipt", "receipt_number");
        const reason = pick("message", "detail", "result_desc", "description");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (success) {
          const { error } = await supabaseAdmin.rpc("credit_deposit", {
            _checkout: reference,
            _receipt: receipt,
          });
          if (error) console.error("[upesipay] credit failed", error.message);
        } else {
          const { error } = await supabaseAdmin.rpc("fail_deposit", {
            _checkout: reference,
            _reason: reason || "Payment was not completed",
          });
          if (error) console.error("[upesipay] fail update error", error.message);
        }

        // Always 200 so the provider stops retrying.
        return Response.json({ ok: true });
      },
    },
  },
});
