import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BetCard } from "@/components/betkaa/BetCard";
import { BetFeed } from "@/components/betkaa/BetFeed";
import { ChatPanel } from "@/components/betkaa/ChatPanel";
import { GameCanvas } from "@/components/betkaa/GameCanvas";
import { LiveBanner } from "@/components/betkaa/LiveBanner";
import { HistoryBar } from "@/components/betkaa/HistoryBar";
import { TopBar } from "@/components/betkaa/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useRoundBets, useRoundSync } from "@/hooks/useBetkaa";
import { roundState, type Bet } from "@/lib/betkaa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aviator — Live crash game in Kenyan shillings" },
      {
        name: "description",
        content:
          "Fly with Aviator: a real-time, server-authoritative crash game. Place two bets a round, cash out before the plane leaves, and track every player live.",
      },
      { property: "og:title", content: "Aviator — Live crash game in Kenyan shillings" },
      {
        property: "og:description",
        content:
          "Real-time crash game with dual bet slips, auto cash-out, a live bet feed and instant KES balances.",
      },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const navigate = useNavigate();
  const { round, history, connected, nowMs } = useRoundSync();
  const bets = useRoundBets(round?.id ?? null);
  const { session, username, cash, bonus, isAdmin } = useAccount();
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [previous, setPrevious] = useState<Bet[]>([]);

  const { phase, multiplier, countdown, elapsed } = roundState(round, nowMs);
  const userId = session?.user.id ?? null;

  // Keep the last completed round for the "Previous" feed tab.
  useEffect(() => {
    if (phase === "crashed" && bets.length) setPrevious(bets);
  }, [phase, bets]);

  const myBets = userId ? bets.filter((bet) => bet.user_id === userId && !bet.is_bot) : [];
  const betForSlot = (slot: 1 | 2) => myBets.find((bet) => bet.slot === slot);


  const requireAuth = useCallback(() => {
    toast.info("Create an account to place bets");
    void navigate({ to: "/auth" });
  }, [navigate]);

  const place = useCallback(
    async (slot: 1 | 2, amount: number, autoCashout: number | null) => {
      if (!userId) return requireAuth();
      setBusy(true);
      const { error } = await supabase.rpc("place_bet", {
        _slot: slot,
        _amount: amount,
        _auto_cashout: autoCashout as unknown as number,
      });
      setBusy(false);

      if (error) toast.error(error.message.replace(/^.*?:\s*/, ""));
    },
    [userId, requireAuth],
  );

  const cashOut = useCallback(async (betId: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("cash_out", { _bet_id: betId });
    setBusy(false);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as Bet | undefined;
    if (row) toast.success(`Cashed out at ${Number(row.cashout_multiplier).toFixed(2)}x`);
  }, []);

  const cancel = useCallback(async (betId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_bet", { _bet_id: betId });
    setBusy(false);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    toast.success("Bet cancelled — stake refunded");
  }, []);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-10">
      <TopBar
        balance={cash + bonus}
        username={username}
        signedIn={Boolean(userId)}
        isAdmin={isAdmin}
        onOpenChat={() => setChatOpen(true)}
        onSignOut={() => {
          void supabase.auth.signOut();
          toast.success("Signed out");
        }}
      />

      <LiveBanner />

      <HistoryBar history={history} />

      <main className="space-y-3 px-3 pt-3">
        <GameCanvas
          phase={phase}
          multiplier={multiplier}
          countdown={countdown}
          elapsed={elapsed}
        />

        <p className="text-center text-xs text-muted-foreground">
          {connected
            ? `Round #${round?.id ?? "—"} · server-authoritative · ${bets.length} players in`
            : "Reconnecting to the game server…"}
        </p>

        <div className="space-y-3">
          {([1, 2] as const).map((slot) => (
            <BetCard
              key={slot}
              slot={slot}
              phase={phase}
              multiplier={multiplier}
              bet={betForSlot(slot)}
              busy={busy}
              signedIn={Boolean(userId)}
              onPlace={(s, amount, auto) => void place(s, amount, auto)}
              onCashOut={(id) => void cashOut(id)}
              onCancel={(id) => void cancel(id)}
              onRequireAuth={requireAuth}
            />
          ))}
        </div>

        <BetFeed bets={bets} previous={previous} />

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          18+ only. Aviator uses original artwork and its own game engine. Crash points are generated
          on the server before each round starts and cannot be influenced by any player.
        </p>
      </main>

      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        userId={userId}
        username={username}
        isAdmin={isAdmin}
      />
    </div>
  );
}
