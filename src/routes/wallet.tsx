import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MoneySheet } from "@/components/betkaa/MoneySheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useBetkaa";
import { formatKes } from "@/lib/betkaa";
import { retryDeposit } from "@/lib/payments.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Aviator" },
      {
        name: "description",
        content:
          "Your Aviator wallet: M-PESA deposits with a 100% bonus, withdrawals, cash and bonus balances and a full ledger.",
      },
      { property: "og:title", content: "Wallet — Aviator" },
      {
        property: "og:description",
        content: "M-PESA deposits, withdrawals and a full ledger of every movement.",
      },
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

interface DepositRow {
  id: string;
  amount: number;
  bonus_amount: number;
  status: string;
  mpesa_receipt: string | null;
  result_desc: string | null;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const statusTone: Record<string, string> = {
  success: "text-money",
  paid: "text-money",
  pending: "text-amber-400",
  failed: "text-primary",
  rejected: "text-primary",
};

function WalletPage() {
  const { session, phone, cash, bonus, loading, refresh } = useAccount();
  const retryPrompt = useServerFn(retryDeposit);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const userId = session?.user.id ?? null;



  const load = useCallback(async () => {
    if (!userId) return;
    const [ledger, dep, wd] = await Promise.all([
      supabase
        .from("wallet_ledger")
        .select("id, entry_type, cash_delta, bonus_delta, cash_after, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("deposits")
        .select("id, amount, bonus_amount, status, mpesa_receipt, result_desc, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("withdrawals")
        .select("id, amount, status, admin_note, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setEntries((ledger.data ?? []) as unknown as Entry[]);
    setDeposits((dep.data ?? []) as unknown as DepositRow[]);
    setWithdrawals((wd.data ?? []) as unknown as WithdrawalRow[]);
  }, [userId]);

  const retry = useCallback(
    async (depositId: string) => {
      setRetrying(depositId);
      try {
        const res = await retryPrompt({ data: { depositId } });
        toast.success(res.message || "Check your phone and enter your M-PESA PIN");
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Could not resend the prompt";
        const [headline, ...rest] = raw.split("\n");
        toast.error(headline || "Could not resend the prompt", {
          ...(rest.length ? { description: rest.join(" ") } : {}),
        });
      } finally {
        setRetrying(null);
        void load();
      }
    },
    [retryPrompt, load],
  );

  useEffect(() => {
    if (!userId) return;
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [userId, load]);

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
            <h1 className="text-xs tracking-wide text-muted-foreground uppercase">Total balance</h1>
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
              <Button variant="deposit" className="h-11" onClick={() => setMode("deposit")}>
                <ArrowDownToLine /> DEPOSIT
              </Button>
              <Button variant="withdraw" className="h-11" onClick={() => setMode("withdraw")}>
                <ArrowUpFromLine /> WITHDRAW
              </Button>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-4">
            <h2 className="text-sm font-semibold">100% deposit bonus</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deposit KES 500 or more and get a 100% bonus — KES 500 in becomes KES 1,000 to play
              with. Bonus funds are used only after cash and can't be withdrawn.
            </p>
          </section>

          {deposits.length > 0 && (
            <section className="mt-4 rounded-2xl bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">M-PESA deposits</h2>
              <ul className="divide-y divide-border/40">
                {deposits.map((d) => (
                  <li
                    key={d.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold tabular-nums">
                        {formatKes(Number(d.amount))} KES
                        {Number(d.bonus_amount) > 0 && (
                          <span className="ml-1 text-xs text-money">
                            +{formatKes(Number(d.bonus_amount))} bonus
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                        {d.mpesa_receipt ? ` · ${d.mpesa_receipt}` : ""}
                        {d.status === "failed" && d.result_desc ? ` · ${d.result_desc}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {d.status === "failed" && (
                        <Button
                          variant="muted"
                          className="h-8 px-3 text-xs"
                          disabled={retrying === d.id}
                          onClick={() => void retry(d.id)}
                        >
                          Retry prompt
                        </Button>
                      )}
                      <span
                        className={`text-xs font-semibold uppercase ${statusTone[d.status] ?? "text-muted-foreground"}`}
                      >
                        {d.status}
                      </span>
                    </span>

                  </li>
                ))}
              </ul>
            </section>
          )}

          {withdrawals.length > 0 && (
            <section className="mt-4 rounded-2xl bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Withdrawal requests</h2>
              <ul className="divide-y divide-border/40">
                {withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold tabular-nums">
                        {formatKes(Number(w.amount))} KES
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleString()}
                        {w.admin_note ? ` · ${w.admin_note}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold uppercase ${statusTone[w.status] ?? "text-muted-foreground"}`}
                    >
                      {w.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                        {new Date(e.created_at).toLocaleString()}{" "}
                        {e.reference ? `· ${e.reference}` : ""}
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

          <MoneySheet
            mode={mode}
            onClose={() => setMode(null)}
            defaultPhone={phone ?? ""}
            cash={cash}
            onDone={() => {
              refresh();
              void load();
            }}
          />
        </>
      )}
    </main>
  );
}
