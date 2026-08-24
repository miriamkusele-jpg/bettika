import planeSrc from "@/assets/betkaa-plane.png";
import { formatMultiplier, type Phase } from "@/lib/betkaa";
import { cn } from "@/lib/utils";

interface Props {
  phase: Phase;
  multiplier: number;
  countdown: number;
  elapsed: number;
}

export function GameCanvas({ phase, multiplier, countdown, elapsed }: Props) {
  // Asymptotic climb so the plane never leaves the card.
  const progress = 1 - 1 / (1 + elapsed * 0.42);
  const x = 6 + progress * 66;
  const y = 78 - progress * 56;

  return (
    <div className="relative aspect-[10/9] w-full overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[var(--shadow-card)]">
      <div
        className={cn(
          "absolute inset-[-40%] bk-rays opacity-70",
          phase === "running" && "bk-rays-spin",
        )}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 45% 40%, color-mix(in oklab, var(--chart-3) 28%, transparent), transparent 62%)",
        }}
        aria-hidden
      />

      {phase !== "waiting" && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="bk-trail" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.62 0.24 12 / 0.15)" />
              <stop offset="100%" stopColor="oklch(0.68 0.26 350 / 0.85)" />
            </linearGradient>
          </defs>
          <path
            d={`M 0 100 Q ${x * 0.55} 100 ${x} ${y + 6} L ${x} 100 Z`}
            fill="var(--brand)"
            opacity={phase === "crashed" ? 0.4 : 0.95}
          />
          <path
            d={`M 0 100 Q ${x * 0.55} 100 ${x} ${y + 6}`}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        {phase === "waiting" ? (
          <>
            <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Next round in
            </p>
            <p className="mt-1 text-6xl font-black tabular-nums">{countdown.toFixed(1)}</p>
            <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (1 - countdown / 7) * 100)}%`,
                  background: "var(--gradient-brand)",
                }}
              />
            </div>
          </>
        ) : (
          <>
            <p
              className={cn(
                "text-6xl leading-none font-black tracking-tight drop-shadow-[0_2px_24px_oklch(0_0_0/60%)] sm:text-7xl",
                phase === "crashed" ? "text-primary" : "text-foreground",
              )}
            >
              {formatMultiplier(multiplier)}
            </p>
            {phase === "crashed" && (
              <p className="mt-3 rounded-full bg-primary/15 px-4 py-1 text-sm font-bold tracking-wide text-primary uppercase">
                Flew away
              </p>
            )}
          </>
        )}
      </div>

      {phase !== "waiting" && (
        <img
          src={planeSrc}
          alt="BETKAA aircraft climbing along the multiplier curve"
          width={1024}
          height={640}
          className={cn(
            "pointer-events-none absolute w-[38%] -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_6px_18px_oklch(0_0_0/60%)]",
            phase === "running" ? "bk-plane-hover" : "bk-plane-crash",
          )}
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      )}
    </div>
  );
}
