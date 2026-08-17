import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKenyanPhone, phoneToEmail } from "@/lib/betkaa";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or register — BETKAA" },
      {
        name: "description",
        content:
          "Create your BETKAA account with just a mobile number and password — no OTP needed — and join the live crash game.",
      },
      { property: "og:title", content: "Sign in or register — BETKAA" },
      {
        property: "og:description",
        content: "Mobile-number registration for the BETKAA live crash game.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeKenyanPhone(phone);
    if (!normalized) {
      toast.error("Enter a valid Kenyan mobile number, e.g. 0712345678");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    const email = phoneToEmail(normalized);

    if (mode === "register") {
      if (username.trim().length < 3) {
        setBusy(false);
        toast.error("Username must be at least 3 characters");
        return;
      }
      if (password !== confirm) {
        setBusy(false);
        toast.error("Passwords do not match");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim(), phone: normalized } },
      });
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      const { error: bootstrapError } = await supabase.rpc("bootstrap_account", {
        _username: username.trim(),
        _phone: normalized,
      });
      setBusy(false);
      if (bootstrapError) {
        toast.error(bootstrapError.message);
        return;
      }
      toast.success("Welcome to BETKAA!");
      void navigate({ to: "/" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("Wrong mobile number or password");
    else {
      toast.success("Signed in");
      void navigate({ to: "/" });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-6 text-center">
        <span className="bk-brand-text text-4xl font-black tracking-tight italic">BETKAA</span>
      </Link>

      <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-2 rounded-full bg-background/60 p-1">
          {(["register", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-full bg-secondary py-2 text-sm font-semibold capitalize"
                  : "rounded-full py-2 text-sm font-medium text-muted-foreground capitalize"
              }
            >
              {m === "register" ? "Register" : "Login"}
            </button>
          ))}
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Saved as {normalizeKenyanPhone(phone) ?? "+254…"}
            </p>
          </div>

          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          <Button type="submit" variant="brand" className="h-11 w-full text-base" disabled={busy}>
            {mode === "register" ? "Create account" : "Login"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        18+. Play responsibly. BETKAA is an original demo platform — balances are play money until
        M-PESA deposits are enabled.
      </p>
    </main>
  );
}
