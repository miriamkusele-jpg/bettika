import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useBetkaa";
import { formatKes, formatMultiplier } from "@/lib/betkaa";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Aviator" },
      {
        name: "description",
        content:
          "Aviator operator dashboard: players, staked volume, payouts, gross gaming revenue and recent round outcomes.",
      },
      { property: "og:title", content: "Admin dashboard — Aviator" },
      { property: "og:description", content: "Operator analytics for the Aviator crash game." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

interface Stats {
  players: number;
  rounds: number;
  staked: number;
  paid: number;
}

interface RoundRow {
  id: number;
  crash_multiplier: number;
  settled: boolean;
  running_at: string;
}


function AdminPage() {
  const { isAdmin, loading } = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const load = async () => {
      const [players, roundCount, bets, recent] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("rounds").select("id", { count: "exact", head: true }),
        supabase.from("bets").select("amount, payout").limit(5000),
        supabase
          .from("rounds")
          .select("id, crash_multiplier, settled, running_at")
          .order("id", { ascending: false })
          .limit(20),

      ]);
      if (!alive) return;
      const rows = (bets.data ?? []) as { amount: number; payout: number }[];
      setStats({
        players: players.count ?? 0,
        rounds: roundCount.count ?? 0,
        staked: rows.reduce((s, r) => s + Number(r.amount), 0),
        paid: rows.reduce((s, r) => s + Number(r.payout ?? 0), 0),
      });
      setRounds((recent.data ?? []) as RoundRow[]);
    };
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAdmin]);

  if (loading) return <main className="p-6 text-sm text-muted-foreground">Loading…</main>;

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Operators only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This dashboard is restricted to accounts with the admin role.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-brand-2">
          Back to game
        </Link>
      </main>
    );
  }

  const ggr = (stats?.staked ?? 0) - (stats?.paid ?? 0);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back to game
      </Link>
      <h1 className="text-xl font-black tracking-tight">Admin dashboard</h1>

      <section className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Players", value: String(stats?.players ?? 0) },
          { label: "Rounds played", value: String(stats?.rounds ?? 0) },
          { label: "Total staked", value: `${formatKes(stats?.staked ?? 0)} KES` },
          { label: "Total paid out", value: `${formatKes(stats?.paid ?? 0)} KES` },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{card.value}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-2xl bg-surface p-3">
          <p className="text-xs text-muted-foreground">Gross gaming revenue</p>
          <p
            className={
              ggr >= 0
                ? "text-2xl font-black text-money tabular-nums"
                : "text-2xl font-black text-primary tabular-nums"
            }
          >
            {formatKes(ggr)} KES
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Recent rounds</h2>
        <ul className="divide-y divide-border/40">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block">Round #{r.id}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.settled ? "settled" : "in play"} ·{" "}
                  {new Date(r.running_at).toLocaleTimeString()}
                </span>
              </span>

              <span className="shrink-0 font-bold tabular-nums">
                {r.crash_multiplier ? formatMultiplier(Number(r.crash_multiplier)) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        Crash points are generated server-side with a provably consistent house edge; players can
        never see or influence a round result before it settles.
      </p>
    </main>
  );
}
