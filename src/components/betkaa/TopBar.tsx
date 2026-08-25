import { Link, useRouter } from "@tanstack/react-router";
import {
  ChevronLeft,
  Fan,
  Maximize,
  MessageCircle,
  Menu,
  Music,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { formatKes } from "@/lib/betkaa";

interface Props {
  balance: number;
  username: string | null;
  signedIn: boolean;
  isAdmin: boolean;
  onOpenChat: () => void;
  onSignOut: () => void;
}

/** 254722123910 -> 254722XXX910 */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9) return value;
  return `${digits.slice(0, 6)}XXX${digits.slice(-3)}`;
}

const PREFS = ["sound", "music", "animation"] as const;
type Pref = (typeof PREFS)[number];

function usePrefs() {
  const [prefs, setPrefs] = useState<Record<Pref, boolean>>({
    sound: false,
    music: false,
    animation: true,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aviator:prefs");
      if (raw) setPrefs((p) => ({ ...p, ...(JSON.parse(raw) as Record<Pref, boolean>) }));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (key: Pref, value: boolean) =>
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem("aviator:prefs", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  return { prefs, toggle };
}

export function TopBar({ balance, username, signedIn, isAdmin, onOpenChat, onSignOut }: Props) {
  const router = useRouter();
  const { prefs, toggle } = usePrefs();

  const goFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const rows: { key: Pref; label: string; icon: typeof Volume2 }[] = [
    { key: "sound", label: "Sound", icon: Volume2 },
    { key: "music", label: "Music", icon: Music },
    { key: "animation", label: "Animation", icon: Fan },
  ];

  return (
    <header className="sticky top-0 z-30 bg-chrome/95 backdrop-blur">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="flex min-w-0 items-center gap-1 text-base font-medium text-foreground"
        >
          <ChevronLeft className="size-5 shrink-0" />
          <span className="truncate">Go Back</span>
        </button>
        <button
          type="button"
          onClick={goFullscreen}
          className="flex shrink-0 items-center gap-2 text-base font-medium text-foreground"
        >
          View Fullscreen
          <Maximize className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-background px-3 py-2.5">
        <Link to="/" className="min-w-0">
          <span className="bk-brand-text text-2xl font-black tracking-tight italic">Aviator</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-base font-bold text-money tabular-nums">
            {formatKes(balance)} <span className="font-normal text-muted-foreground">KES</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Menu" className="p-1 text-foreground">
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              <div className="flex items-center gap-3 bg-surface-2 p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500">
                  <UserRound className="size-5 text-background" />
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-bold">
                  {username ? maskPhone(username) : "Guest player"}
                </span>
              </div>

              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center gap-3 border-t border-border/50 px-3 py-2.5"
                >
                  <row.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{row.label}</span>
                  <Switch
                    checked={prefs[row.key]}
                    onCheckedChange={(v) => toggle(row.key, v)}
                    aria-label={`Toggle ${row.label}`}
                  />
                </div>
              ))}

              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem asChild>
                <Link to="/wallet">Wallet</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin dashboard</Link>
                </DropdownMenuItem>
              )}
              {signedIn ? (
                <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth">Sign in / Register</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" aria-label="Open chat" onClick={onOpenChat} className="p-1">
            <MessageCircle className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
