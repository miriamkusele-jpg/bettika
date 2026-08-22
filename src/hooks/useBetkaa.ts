import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Bet, Round } from "@/lib/betkaa";

/** Server-authoritative round sync: the server owns the crash point and timings. */
export function useRoundSync() {
  const [round, setRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const offset = useRef(0);
  const [tick, setTick] = useState(0);

  const now = useCallback(() => Date.now() + offset.current, []);

  useEffect(() => {
    let alive = true;

    const syncClock = async () => {
      const before = Date.now();
      const { data } = await supabase.rpc("server_now");
      if (!alive || !data) return;
      const rtt = (Date.now() - before) / 2;
      offset.current = Date.parse(data as string) + rtt - Date.now();
    };

    const loadHistory = async () => {
      const { data } = await supabase
        .from("rounds")
        .select("crash_multiplier")
        .order("id", { ascending: false })
        .limit(24);
      if (alive && data) setHistory(data.map((r) => Number(r.crash_multiplier)));
    };

    const pull = async () => {
      const { data, error } = await supabase.rpc("ensure_current_round");
      if (!alive) return;
      setConnected(!error);
      const row = Array.isArray(data) ? (data[0] as Round | undefined) : (data as Round | null);
      if (row) {
        setRound((prev) => {
          if (prev && prev.id !== row.id) void loadHistory();
          return { ...row, crash_multiplier: Number(row.crash_multiplier) };
        });
      }
    };

    void syncClock();
    void loadHistory();
    void pull();
    const poll = setInterval(pull, 1200);
    const clock = setInterval(syncClock, 60000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 40) {
        last = t;
        setTick((v) => v + 1);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return { round, history, connected, nowMs: now(), tick };
}

/** Live bets for the current round (real players + demo players). */
export function useRoundBets(roundId: number | null) {
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    if (!roundId) return;
    let alive = true;

    const load = async () => {
      const { data } = await supabase
        .from("bets")
        .select("*")
        .eq("round_id", roundId)
        .order("amount", { ascending: false })
        .limit(80);
      if (alive && data) setBets(data as unknown as Bet[]);
    };

    void load();
    const channel = supabase
      .channel(`bets-round-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `round_id=eq.${roundId}` },
        () => void load(),
      )
      .subscribe();
    const poll = setInterval(load, 2500);

    return () => {
      alive = false;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [roundId]);

  return bets;
}

export interface Account {
  session: Session | null;
  loading: boolean;
  username: string | null;
  phone: string | null;
  cash: number;
  bonus: number;
  isAdmin: boolean;
  refresh: () => void;
}

export function useAccount(): Account {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [cash, setCash] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setUsername(null);
      setPhone(null);
      setCash(0);
      setBonus(0);
      setIsAdmin(false);
      return;
    }
    let alive = true;

    const load = async () => {
      const [profile, wallet, roles] = await Promise.all([
        supabase.from("profiles").select("username, phone").eq("id", userId).maybeSingle(),
        supabase.from("wallets").select("cash_balance, bonus_balance").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!alive) return;
      setUsername(profile.data?.username ?? null);
      setPhone(profile.data?.phone ?? null);
      setCash(Number(wallet.data?.cash_balance ?? 0));
      setBonus(Number(wallet.data?.bonus_balance ?? 0));
      setIsAdmin((roles.data ?? []).some((r) => r.role === "admin"));
    };

    void load();
    const channel = supabase
      .channel(`wallet-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, version]);

  return {
    session,
    loading,
    username,
    phone,
    cash,
    bonus,
    isAdmin,
    refresh: () => setVersion((v) => v + 1),
  };
}
