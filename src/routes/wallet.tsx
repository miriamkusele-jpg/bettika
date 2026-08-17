import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useBetkaa";
import { formatKes } from "@/lib/betkaa";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — BETKAA" },
      {
        name: "description",
        content:
          "Your BETKAA wallet: cash balance, bonus balance, total balance and a full ledger of every movement.",
      },
      { property: "og:title", content: "Wallet — BETKAA" },
      { property: "og:description", content: "Cash, bonus and total balance with a full ledger." },
    ],
  }),
  component: WalletPage,
});

interface Entry {
  id: string;
  entry_type: string;
  cash_delta: number;
  bonus_delta: number;
  cash_after: number;
  reference: string | null;
  created_at: string;
}

function WalletPage() {
  const { session, cash, bonus, loading } = useAccount();
  const [entries, setEntries] = useState<Entry[]>([]);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("wallet_ledger")
        .select("id, entry_type, cash_delta, bonus_delta, cash_after, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive && data) setEntries(data as unknown as Entry[]);
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Back to game
      </Link>

      {!loading && !userId ? (
        <div className="rounded-2xl bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign in to view your wallet.</p>
          <Button asChild variant="brand" className="mt-4">
            <Link to="/auth">Sign in / Register</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Total balance</p>
            <p className="text-4xl font-black text-money tabular-nums">
              {formatKes(cash + bonus)} <span className="text-lg text-muted-foreground">KES</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Cash balance</p>
                <p className="text-lg font-bold tabular-nums">{formatKes(cash)}</p>
              </div>
              <div className="rounded-xl bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Bonus balance</p>
                <p className="text-lg font-bold tabular-nums">{formatKes(bonus)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button
                variant="bet"
                className="h-11"
                onClick={() => toast.info("M-PESA deposits arrive in the next phase")}
              >
                <ArrowDownToLine /> DEPOSIT
              </Button>
              <Button
                variant="secondary"
                className="h-11"
                onClick={() => toast.info("Withdrawals arrive in the next phase")}
              >
                <ArrowUpFromLine /> WITHDRAW
              </Button>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-4">
            <h2 className="text-sm font-semibold">100% deposit bonus</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deposit KES 500 or more and get a 100% bonus — KES 500 in becomes KES 1,000 to play
              with. Cash and bonus balances stay separate and the bonus is only credited after a
              confirmed payment.
            </p>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">Wallet ledger</h2>
            <ul className="divide-y divide-border/40">
              {entries.length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">No movements yet.</li>
              )}
              {entries.map((e) => {
                const delta = Number(e.cash_delta) + Number(e.bonus_delta);
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate capitalize">
                        {e.entry_type.replace(/_/g, " ")}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()} {e.reference ? `· ${e.reference}` : ""}
                      </span>
                    </span>
                    <span
                      className={
                        delta >= 0
                          ? "shrink-0 font-semibold text-money tabular-nums"
                          : "shrink-0 font-semibold text-primary tabular-nums"
                      }
                    >
                      {delta >= 0 ? "+" : ""}
                      {formatKes(delta)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
