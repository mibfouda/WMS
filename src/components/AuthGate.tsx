import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { Recycle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/wm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const qc = useQueryClient();

  useEffect(() => {
    const { data } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") qc.clear();
    });
    db.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, [qc]);

  if (session === undefined) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
  };
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Recycle className="h-4 w-4" /></span>
          WasteOps
        </div>
        <h1 className="font-display text-2xl font-bold">Supervisor sign in</h1>
        <p className="mb-5 text-sm text-muted-foreground">Authorized staff only.</p>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </div>
      </form>
    </main>
  );
}

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => db.auth.signOut()} title="Sign out">
      <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
