import { useMemo, useState } from "react";

import { formatKes, formatMultiplier, type Bet } from "@/lib/betkaa";
import { cn } from "@/lib/utils";

const TABS = ["All Bets", "Previous", "Top"] as const;

interface Props {
  bets: Bet[];
  previous: Bet[];
}

/** Players are shown masked, exactly like the reference feed: 2***4 */
function maskPlayer(name: string): string {
  const digits = name.replace(/\D/g, "");
  if (digits.length >= 4) return `${digits[0]}***${digits[digits.length - 1]}`;
  return `${name.slice(0, 1)}***${name.slice(-1)}`;
}

const AVATARS = [
  "from-amber-400 to-pink-500",
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-600",
  "from-fuchsia-400 to-purple-600",
  "from-orange-400 to-rose-500",
  "from-lime-400 to-green-600",
];

function avatarTone(seed: string): string {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0)) % 997;
  return AVATARS[n % AVATARS.length] as string;
}

function multiplierColor(value: number): string {
  if (value >= 10) return "text-fuchsia-400";
  if (value >= 2) return "text-purple-400";
  return "text-sky-400";
}

export function BetFeed({ bets, previous }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All Bets");

  const rows = useMemo(() => {
    if (tab === "Previous") return previous;
    if (tab === "Top")
      return [...bets, ...previous].sort((a, b) => Number(b.payout) - Number(a.payout)).slice(0, 40);
    return [...bets].sort((a, b) => Number(b.amount) - Number(a.amount));
  }, [tab, bets, previous]);

  const totalStake = bets.reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <section className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-3 rounded-full bg-background/60 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "truncate rounded-full py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{bets.length} bets this round</span>
        <span>{formatKes(totalStake)} KES staked</span>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 border-b border-border/60 pb-1.5 text-[11px] text-muted-foreground">
        <span>Player</span>
        <span className="text-right">Bet KES</span>
        <span className="w-12 text-right">X</span>
        <span className="text-right">Win KES</span>
      </div>

      <ul className="max-h-80 overflow-y-auto">
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">Waiting for bets…</li>
        )}
        {rows.map((bet) => {
          const won = bet.status === "won";
          return (
            <li
              key={bet.id}
              className={cn(
                "my-0.5 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 rounded-lg px-1 py-1.5 text-sm",
                won ? "bg-success/15 ring-1 ring-success/25" : "bg-background/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-7 shrink-0 rounded-full bg-gradient-to-br",
                    avatarTone(bet.username),
                  )}
                />
                <span className="truncate text-muted-foreground">{maskPlayer(bet.username)}</span>
              </span>
              <span className="text-right tabular-nums">{formatKes(Number(bet.amount))}</span>
              <span
                className={cn(
                  "w-12 text-right font-semibold tabular-nums",
                  won ? multiplierColor(Number(bet.cashout_multiplier ?? 0)) : "text-transparent",
                )}
              >
                {won ? formatMultiplier(Number(bet.cashout_multiplier ?? 0)) : "—"}
              </span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  won ? "text-foreground" : "text-transparent",
                )}
              >
                {won ? formatKes(Number(bet.payout)) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
