import { ArrowRight, Play } from "lucide-react";

/** Promo strip shown above the round history, matching the reference layout. */
export function LiveBanner() {
  return (
    <div className="px-3 pt-2">
      <div
        className="rounded-full p-[2px]"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.72 0.19 45), oklch(0.68 0.26 350), oklch(0.7 0.18 250), oklch(0.78 0.18 190), oklch(0.8 0.17 120), oklch(0.85 0.17 95))",
        }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-full bg-chrome px-2 py-2">
          <span className="flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <Play className="size-3.5 fill-money text-money" />
            Live
          </span>
          <p className="min-w-0 text-sm leading-tight font-bold">
            Mfalme Wa Anga KES 400,000 Daily Crown
          </p>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-400 text-background">
            <ArrowRight className="size-5" />
          </span>
        </div>
      </div>
    </div>
  );
}
