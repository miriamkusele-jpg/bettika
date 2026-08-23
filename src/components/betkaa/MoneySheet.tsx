import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatKes, normalizeKenyanPhone } from "@/lib/betkaa";
import { startMpesaDeposit } from "@/lib/mpesa.functions";

const DEPOSIT_PRESETS = [100, 500, 1000, 5000];
const WITHDRAW_PRESETS = [200, 1000, 5000];

interface Props {
  mode: "deposit" | "withdraw" | null;
  onClose: () => void;
  defaultPhone: string;
  cash: number;
  onDone: () => void;
}

export function MoneySheet({ mode, onClose, defaultPhone, cash, onDone }: Props) {
  const deposit = useServerFn(startMpesaDeposit);
  const [amount, setAmount] = useState("500");
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);

  const isDeposit = mode === "deposit";
  const value = Number(amount) || 0;
  const bonus = isDeposit && value >= 500 ? value : 0;

  const submit = async () => {
    const normalized = normalizeKenyanPhone(phone);
    if (!normalized) {
      toast.error("Enter a valid Safaricom number, e.g. 0712345678");
      return;
    }
    setBusy(true);
    try {
      if (isDeposit) {
        const res = await deposit({ data: { amount: value, phone: normalized } });
        toast.success(res.message || "Check your phone and enter your M-PESA PIN");
      } else {
        const { error } = await supabase.rpc("request_withdrawal", {
          _amount: value,
          _phone: normalized,
        });
        if (error) throw new Error(error.message);
        toast.success("Withdrawal requested — our team will pay it out shortly");
      }
      onDone();
      onClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong";
      const [headline, ...rest] = raw.split("\n");
      toast.error(headline || "Something went wrong", {
        ...(rest.length ? { description: rest.join(" ") } : {}),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[22rem] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isDeposit ? "Deposit via M-PESA" : "Withdraw to M-PESA"}</DialogTitle>
          <DialogDescription>
            {isDeposit
              ? "We'll send an M-PESA prompt to your phone. Approve it with your PIN and your balance updates automatically."
              : `Cash available: ${formatKes(cash)} KES. Bonus funds cannot be withdrawn.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="money-phone">
              Safaricom number
            </label>
            <Input
              id="money-phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712345678"
              className="mt-1 h-11"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="money-amount">
              Amount (KES)
            </label>
            <Input
              id="money-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 h-11 text-lg font-bold tabular-nums"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(isDeposit ? DEPOSIT_PRESETS : WITHDRAW_PRESETS).map((p) => (
              <Button
                key={p}
                variant="muted"
                className="h-9 flex-1"
                onClick={() => setAmount(String(p))}
              >
                {formatKes(p)}
              </Button>
            ))}
          </div>

          {isDeposit && (
            <p className="rounded-xl bg-surface p-3 text-xs text-muted-foreground">
              {bonus > 0 ? (
                <>
                  You get a <span className="font-semibold text-money">100% bonus</span> — play with{" "}
                  {formatKes(value + bonus)} KES.
                </>
              ) : (
                <>Deposit KES 500 or more to unlock the 100% welcome bonus.</>
              )}
            </p>
          )}

          <Button
            variant={isDeposit ? "bet" : "brand"}
            className="h-12 w-full"
            disabled={busy || value <= 0}
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="animate-spin" />}
            {isDeposit ? `DEPOSIT ${formatKes(value)}` : `REQUEST ${formatKes(value)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
