import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Maximize, MessageCircle, Menu } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatKes } from "@/lib/betkaa";

interface Props {
  balance: number;
  username: string | null;
  signedIn: boolean;
  isAdmin: boolean;
  onOpenChat: () => void;
  onSignOut: () => void;
}

export function TopBar({ balance, username, signedIn, isAdmin, onOpenChat, onSignOut }: Props) {
  const router = useRouter();

  const goFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

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
          <span className="bk-brand-text text-2xl font-black tracking-tight italic">BETKAA</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-base font-bold text-money tabular-nums">
            {formatKes(balance)} <span className="font-normal text-muted-foreground">KES</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Menu" className="p-1 text-foreground">
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate">{username ?? "Guest player"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
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
