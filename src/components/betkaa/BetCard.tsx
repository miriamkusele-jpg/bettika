import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MIN_BET,
  QUICK_AMOUNTS,
  formatAmount,
  formatKes,
  type Bet,
  type Phase,
} from "@/lib/betkaa";
import { cn } from "@/lib/utils";

interface Props {
  slot: 1 | 2;
  phase: Phase;
  multiplier: number;
  bet: Bet | undefined;
  busy: boolean;
  signedIn: boolean;
  onPlace: (slot: 1 | 2, amount: number, autoCashout: number | null) => void;
  onCashOut: (betId: string) => void;
  onCancel: (betId: string) => void;
  onRequireAuth: () => void;
}

export function BetCard({
  slot,
  phase,
  multiplier,
  bet,
  busy,
  signedIn,
  onPlace,
  onCashOut,
  onCancel,
  onRequireAuth,
}: Props) {
  const [mode, setMode] = useState<"bet" | "auto">(slot === 1 ? "bet" : "bet");
  const [amount, setAmount] = useState(10);
  const [autoBet, setAutoBet] = useState(false);
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [cashOutAt, setCashOutAt] = useState("1.10");
  const [rounds, setRounds] = useState("10");
  const [autoLeft, setAutoLeft] = useState(0);

  const active = bet?.status === "active";
  const target = Number(cashOutAt) || 0;

  // Auto bet: place a stake automatically while the round is open.
  useEffect(() => {
    if (!autoBet || !signedIn || phase !== "waiting" || bet || busy || autoLeft <= 0) return;
    onPlace(slot, amount, autoCashOut && target > 1 ? target : null);
    setAutoLeft((n) => n - 1);
  }, [autoBet, signedIn, phase, bet, busy, autoLeft, amount, autoCashOut, target, onPlace, slot]);

  useEffect(() => {
    if (autoBet) setAutoLeft(Math.max(1, Number(rounds) || 1));
    else setAutoLeft(0);
  }, [autoBet, rounds]);

  const step = (delta: number) => setAmount((a) => Math.max(MIN_BET, Math.round((a + delta) * 100) / 100));

  const handleMain = () => {
    if (!signedIn) return onRequireAuth();
    if (active && phase === "running") return onCashOut(bet.id);
    if (active && phase === "waiting") return onCancel(bet.id);
    if (!bet && phase === "waiting") {
      onPlace(slot, amount, mode === "auto" && autoCashOut && target > 1 ? target : null);
    }
  };

  let label = "Bet";
  let sub = `${formatAmount(amount)} KES`;
  let variant: "bet" | "cashout" | "cancel" | "waiting" = "bet";

  if (active && phase === "running") {
    label = "Cash Out";
    sub = `${formatKes(bet.amount * multiplier)} KES`;
    variant = "cashout";
  } else if (active && phase === "waiting") {
    label = "Cancel";
    sub = "";
    variant = "cancel";
  } else if (bet && bet.status === "won") {
    label = "Cashed Out";
    sub = `+${formatKes(bet.payout)} KES`;
    variant = "waiting";
  } else if (bet && bet.status === "lost") {
    label = "Lost";
    sub = `${formatAmount(bet.amount)} KES`;
    variant = "waiting";
  } else if (phase !== "waiting") {
    label = "Bet";
    sub = "Next round";
    variant = "waiting";
  }

  const disabled = busy || variant === "waiting";

  return (
    <section className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="mx-auto grid w-full max-w-[280px] grid-cols-2 rounded-full bg-background/60 p-1">
        {(["bet", "auto"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full py-1.5 text-sm font-medium capitalize transition-colors",
              mode === m ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-full bg-background/60 px-1.5 py-1.5">
            <button
              type="button"
              aria-label="Decrease bet"
              onClick={() => step(-10)}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              <Minus className="size-4" />
            </button>
            <input
              value={amount}
              inputMode="decimal"
              aria-label="Bet amount"
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))}
              className="min-w-0 flex-1 bg-transparent text-center text-base font-bold outline-none"
            />
            <button
              type="button"
              aria-label="Increase bet"
              onClick={() => step(10)}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className="rounded-full bg-background/60 py-1.5 text-sm text-muted-foreground"
              >
                {formatAmount(q)}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant={
            variant === "cashout"
              ? "cashout"
              : variant === "cancel"
                ? "destructive"
                : variant === "waiting"
                  ? "muted"
                  : "bet"
          }
          size="bet"
          disabled={disabled}
          onClick={handleMain}
        >
          <span className="text-xl leading-tight font-medium">{label}</span>
          {sub && <span className="text-lg leading-tight font-semibold">{sub}</span>}
        </Button>
      </div>

      {mode === "auto" && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Auto bet</span>
            <div className="flex items-center gap-2">
              <Input
                value={rounds}
                inputMode="numeric"
                aria-label="Number of rounds"
                onChange={(e) => setRounds(e.target.value.replace(/\D/g, ""))}
                className="h-8 w-16 rounded-full border-0 bg-background/60 text-center text-sm"
              />
              <Switch checked={autoBet} onCheckedChange={setAutoBet} aria-label="Toggle auto bet" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Auto Cash Out</span>
            <div className="flex items-center gap-2">
              <Input
                value={cashOutAt}
                inputMode="decimal"
                aria-label="Auto cash out multiplier"
                onChange={(e) => setCashOutAt(e.target.value.replace(/[^\d.]/g, ""))}
                className="h-8 w-16 rounded-full border-0 bg-background/60 text-center text-sm"
              />
              <Switch checked={autoCashOut} onCheckedChange={setAutoCashOut} aria-label="Toggle auto cash out" />
            </div>
          </div>
          {autoBet && (
            <p className="text-xs text-muted-foreground">{autoLeft} auto round(s) remaining</p>
          )}
        </div>
      )}
    </section>
  );
}
