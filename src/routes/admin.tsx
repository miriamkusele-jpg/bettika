import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneySheet } from "@/components/betkaa/MoneySheet";
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
          "Aviator operator dashboard: operator float, next round fly-away point, players, staked volume, payouts and gross gaming revenue.",
      },
      { property: "og:title", content: "Admin dashboard — Aviator" },
      { property: "og:description", content: "Operator analytics for the Aviator crash game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

interface NextCrash {
  id: number;
  crash_multiplier: number;
  running_at: string;
}

interface QueueRow {
  slot: number;
  crash_multiplier: number;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

function AdminPage() {
  const { isAdmin, loading, phone, cash, refresh } = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [next, setNext] = useState<NextCrash | null>(null);
  const [float, setFloat] = useState<number | null>(null);
  const [transfer, setTransfer] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [money, setMoney] = useState<"deposit" | "withdraw" | null>(null);

  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingSlot, setSavingSlot] = useState<number | null>(null);

  const loadFloat = useCallback(async () => {
    const { data } = await supabase.rpc("ensure_admin_wallet");
    setFloat(data === null || data === undefined ? null : Number(data));
  }, []);

  const loadQueue = useCallback(async () => {
    const { data } = await supabase.rpc("admin_crash_queue");
    const rows = ((data ?? []) as QueueRow[]).map((r) => ({
      slot: Number(r.slot),
      crash_multiplier: Number(r.crash_multiplier),
    }));
    setQueue(rows);
    setDrafts((prev) => {
      const nextDrafts = { ...prev };
      for (const row of rows) {
        const value = row.crash_multiplier.toFixed(2);
        // Re-sync whenever the server value changed (e.g. the queue shifted up).
        if (serverValues.current[row.slot] !== value) nextDrafts[row.slot] = value;
        serverValues.current[row.slot] = value;
      }
      return nextDrafts;
    });
  }, []);

  const saveSlot = async (slot: number) => {
    const value = Number(drafts[slot]);
    if (!Number.isFinite(value) || value < 1 || value > 1000) {
      toast.error("Fly-away point must be between 1.00 and 1000.00");
      return;
    }
    setSavingSlot(slot);
    try {
      const { error } = await supabase.rpc("admin_set_crash_queue", {
        _slot: slot,
        _multiplier: value,
      });
      if (error) throw new Error(error.message);
      await loadQueue();
      toast.success(`Upcoming round #${slot} set to ${formatMultiplier(value)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the fly-away point");
    } finally {
      setSavingSlot(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const load = async () => {
      const [players, roundCount, bets, recent, nextCrash] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("rounds").select("id", { count: "exact", head: true }),
        supabase.from("bets").select("amount, payout").limit(5000),
        supabase.rpc("admin_recent_rounds", { _limit: 20 }),
        supabase.rpc("admin_next_crash"),
      ]);
      if (!alive) return;
      const rows = (bets.data ?? []) as { amount: number; payout: number }[];
      setStats({
        players: players.count ?? 0,
        rounds: roundCount.count ?? 0,
        staked: rows.reduce((s, r) => s + Number(r.amount), 0),
        paid: rows.reduce((s, r) => s + Number(r.payout ?? 0), 0),
      });
      setRounds(
        ((recent.data ?? []) as RoundRow[]).map((r) => ({
          ...r,
          crash_multiplier: Number(r.crash_multiplier),
        })),
      );
      const upcoming = (nextCrash.data ?? [])[0] as NextCrash | undefined;
      setNext(
        upcoming
          ? { ...upcoming, crash_multiplier: Number(upcoming.crash_multiplier) }
          : null,
      );
    };
    void load();
    void loadFloat();
    void loadQueue();
    const timer = setInterval(() => {
      void load();
      void loadQueue();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAdmin, loadFloat, loadQueue]);

  const doTransfer = async () => {
    const amount = Number(transfer) || 0;
    if (amount <= 0) {
      toast.error("Enter an amount to transfer");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_wallet_transfer", { _amount: amount });
      if (error) throw new Error(error.message);
      setFloat(data === null || data === undefined ? null : Number(data));
      refresh();
      toast.success(`Moved ${formatKes(amount)} KES into your playing wallet`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

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

      {/* Operator wallet */}
      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-muted-foreground">Operator wallet (float)</p>
          <p className="text-xs text-muted-foreground">
            Playing wallet: <span className="font-semibold text-foreground">{formatKes(cash)}</span>
          </p>
        </div>
        <p className="mt-1 text-3xl font-black tabular-nums text-money">
          {float === null ? "—" : `${formatKes(float)} KES`}
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            inputMode="numeric"
            value={transfer}
            onChange={(e) => setTransfer(e.target.value.replace(/[^0-9]/g, ""))}
            className="h-11 flex-1 text-base font-bold tabular-nums"
            aria-label="Transfer amount"
          />
          <Button variant="brand" className="h-11" disabled={busy} onClick={() => void doTransfer()}>
            {busy && <Loader2 className="animate-spin" />}
            Transfer to wallet
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="deposit" className="h-11" onClick={() => setMoney("deposit")}>
            <ArrowDownToLine className="size-4" /> Deposit
          </Button>
          <Button variant="withdraw" className="h-11" onClick={() => setMoney("withdraw")}>
            <ArrowUpFromLine className="size-4" /> Withdraw
          </Button>
        </div>
      </section>

      {/* Next round fly-away point — admin only */}
      <section className="mt-4 rounded-2xl border border-brand-2/40 bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Next round fly-away point (admin only)</p>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
        {next ? (
          <>
            <p className="mt-1 text-3xl font-black tabular-nums text-brand-2">
              {revealed ? formatMultiplier(next.crash_multiplier) : "•••••"}
            </p>
            <p className="text-xs text-muted-foreground">
              Round #{next.id} · takes off {new Date(next.running_at).toLocaleTimeString()}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Waiting for the next round…</p>
        )}
      </section>

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
        Crash points are generated server-side with a provably consistent house edge. Players only
        see a round's fly-away point after the plane flies away — this dashboard is the only place
        the upcoming point is visible.
      </p>

      <MoneySheet
        mode={money}
        onClose={() => setMoney(null)}
        defaultPhone={phone ?? ""}
        cash={cash}
        onDone={() => {
          refresh();
          void loadFloat();
        }}
      />
    </main>
  );
}
