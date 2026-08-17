import { History } from "lucide-react";

import { formatMultiplier, multiplierTone } from "@/lib/betkaa";
import { cn } from "@/lib/utils";

export function HistoryBar({ history }: { history: number[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-chrome px-3 py-2">
      <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {history.map((value, index) => (
          <span
            key={`${index}-${value}`}
            className={cn(
              "shrink-0 rounded-full bg-background/70 px-2.5 py-1 text-xs font-bold tabular-nums",
              multiplierTone(value),
            )}
          >
            {formatMultiplier(value)}
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-xs text-muted-foreground">Loading round history…</span>
        )}
      </div>
      <History className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}
