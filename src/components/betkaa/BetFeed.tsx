import { useMemo, useState } from "react";

import { formatKes, formatMultiplier, type Bet } from "@/lib/betkaa";
import { cn } from "@/lib/utils";

const TABS = ["All Bets", "Previous", "Top"] as const;

interface Props {
  bets: Bet[];
  previous: Bet[];
}

export function BetFeed({ bets, previous }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All Bets");

  const rows = useMemo(() => {
    if (tab === "Previous") return previous;
    if (tab === "Top")
      return [...bets, ...previous].sort((a, b) => Number(b.payout) - Number(a.payout)).slice(0, 40);
    return bets;
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

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-border/60 pb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
        <span>Player</span>
        <span className="text-right">Bet</span>
        <span className="w-20 text-right">Cash out</span>
      </div>

      <ul className="max-h-72 divide-y divide-border/40 overflow-y-auto">
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">Waiting for bets…</li>
        )}
        {rows.map((bet) => (
          <li
            key={bet.id}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2 text-sm",
              bet.status === "won" && "bg-success/10",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                {bet.username.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate text-muted-foreground">{bet.username}</span>
            </span>
            <span className="text-right tabular-nums">{formatKes(Number(bet.amount))}</span>
            <span className="w-20 text-right tabular-nums">
              {bet.status === "won" ? (
                <span className="font-semibold text-money">
                  {formatMultiplier(Number(bet.cashout_multiplier ?? 0))}
                  <span className="block text-[11px] font-normal">
                    +{formatKes(Number(bet.payout))}
                  </span>
                </span>
              ) : bet.status === "lost" ? (
                <span className="text-primary">—</span>
              ) : (
                <span className="text-muted-foreground">…</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
