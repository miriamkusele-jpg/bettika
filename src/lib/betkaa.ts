/** BETKAA shared game math, formatting and phone helpers (client-safe). */

/** Multiplier curve constant — MUST match public.round_multiplier in the database. */
export const GROWTH = 0.09;

export const QUICK_AMOUNTS = [100, 250, 1000, 25000];
export const MIN_BET = 10;

export type Phase = "waiting" | "running" | "crashed";

export interface Round {
  id: number;
  crash_multiplier: number;
  waiting_at: string;
  running_at: string;
  crashed_at: string;
  ends_at: string;
  settled: boolean;
}

export interface Bet {
  id: string;
  round_id: number;
  user_id: string | null;
  username: string;
  slot: number;
  amount: number;
  auto_cashout: number | null;
  cashout_multiplier: number | null;
  payout: number;
  status: string;
  is_bot: boolean;
  created_at: string;
}

export function multiplierAt(seconds: number): number {
  return Math.exp(GROWTH * Math.max(0, seconds));
}

export function roundState(round: Round | null, nowMs: number) {
  if (!round) {
    return { phase: "waiting" as Phase, multiplier: 1, countdown: 0, elapsed: 0 };
  }
  const running = Date.parse(round.running_at);
  const crashed = Date.parse(round.crashed_at);
  if (nowMs < running) {
    return {
      phase: "waiting" as Phase,
      multiplier: 1,
      countdown: Math.max(0, (running - nowMs) / 1000),
      elapsed: 0,
    };
  }
  if (nowMs < crashed) {
    const elapsed = (nowMs - running) / 1000;
    return {
      phase: "running" as Phase,
      multiplier: Math.min(multiplierAt(elapsed), round.crash_multiplier),
      countdown: 0,
      elapsed,
    };
  }
  return {
    phase: "crashed" as Phase,
    multiplier: round.crash_multiplier,
    countdown: 0,
    elapsed: (crashed - running) / 1000,
  };
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function formatKes(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-KE").format(value);
}

/** 0712345678 / 712345678 / 254712... / +254712... -> +254712345678 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local: string;
  if (digits.startsWith("254")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  if (!/^[17]\d{8}$/.test(local)) return null;
  return `+254${local}`;
}

/** Auth identity derived from the phone number (no OTP, no e-mail collected). */
export function phoneToEmail(phone: string): string {
  return `${phone.replace("+", "")}@betkaa.app`;
}

export function multiplierTone(value: number): string {
  if (value >= 10) return "text-brand-2";
  if (value >= 2) return "text-chart-3";
  return "text-muted-foreground";
}
