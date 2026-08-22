import { createFileRoute } from "@tanstack/react-router";

interface CallbackBody {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name?: string; Value?: string | number }[] };
    };
  };
}

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: CallbackBody | null = null;
        try {
          payload = (await request.json()) as CallbackBody;
        } catch {
          return Response.json({ ResultCode: 1, ResultDesc: "Invalid payload" }, { status: 400 });
        }

        const cb = payload?.Body?.stkCallback;
        const checkout = cb?.CheckoutRequestID;
        if (!checkout) {
          return Response.json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const code = Number(cb?.ResultCode ?? 1);

        if (code === 0) {
          const items = cb?.CallbackMetadata?.Item ?? [];
          const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
          const { error } = await supabaseAdmin.rpc("credit_deposit", {
            _checkout: checkout,
            _receipt: receipt ? String(receipt) : null,
          });
          if (error) console.error("[mpesa] credit failed", error.message);
        } else {
          const { error } = await supabaseAdmin.rpc("fail_deposit", {
            _checkout: checkout,
            _reason: cb?.ResultDesc ?? "Payment cancelled",
          });
          if (error) console.error("[mpesa] fail update error", error.message);
        }

        // Daraja expects a 200 acknowledgement.
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
