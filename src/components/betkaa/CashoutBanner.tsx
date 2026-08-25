import { X } from "lucide-react";

import { formatKes, formatMultiplier } from "@/lib/betkaa";

interface Props {
  multiplier: number;
  payout: number;
  onClose: () => void;
}

export function CashoutBanner({ multiplier, payout, onClose }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-[420px] items-center gap-2 rounded-full border border-success/60 bg-[oklch(0.32_0.09_145)] py-1.5 pr-1.5 pl-4 shadow-[var(--shadow-card)]">
        <div className="min-w-0 flex-1 text-center leading-tight">
          <p className="truncate text-xs text-foreground/80">You have cashed out!</p>
          <p className="text-sm font-bold">{formatMultiplier(multiplier)}</p>
        </div>
        <div className="rounded-full bg-success/80 px-4 py-1.5 text-center leading-tight">
          <p className="text-[11px] font-semibold">Win KES</p>
          <p className="text-base font-bold tabular-nums">{formatKes(payout)}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-background/30"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
