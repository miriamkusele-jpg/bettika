import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  user_id: string | null;
  username: string;
  body: string;
  hidden: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  username: string | null;
  isAdmin: boolean;
}

export function ChatPanel({ open, onOpenChange, userId, username, isAdmin }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (alive && data) setMessages((data as Message[]).slice().reverse());
    };

    void load();
    const channel = supabase
      .channel("chat-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [open]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (!userId) {
      toast.error("Sign in to join the chat");
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, username: username ?? "player", body });
    setSending(false);
    if (error) toast.error(error.message);
    else setDraft("");
  };

  const hide = async (id: string) => {
    const { error } = await supabase.from("chat_messages").update({ hidden: true }).eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-sm flex-col bg-surface p-0">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <SheetTitle>Aviator Chat</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-brand-2">{m.username}</p>
                <p className="text-sm break-words text-foreground/90">
                  {m.hidden ? <em className="text-muted-foreground">Message removed</em> : m.body}
                </p>
              </div>
              {isAdmin && !m.hidden && (
                <Button size="sm" variant="ghost" onClick={() => void hide(m.id)}>
                  Hide
                </Button>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <Input
            value={draft}
            maxLength={300}
            placeholder={userId ? "Message…" : "Sign in to chat"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <Button size="icon" variant="brand" disabled={sending} onClick={() => void send()}>
            <Send />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
