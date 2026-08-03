"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeft, Mail } from "lucide-react";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/play";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { session, authError, pendingConfirmation, signIn, signUp, clearAuthError } = useAuthStore();

  useEffect(() => {
    if (session) router.replace(redirectTo);
  }, [session, redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "signin") await signIn(email, password);
    else await signUp(email, password, username);
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-14">
      <div className="mb-10 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-100">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <Logo />
        <div className="w-10" />
      </div>

      <Panel className="w-full max-w-md p-6">
        <div className="mb-6 flex rounded-md border border-border-subtle bg-bg-900 p-1">
          <button
            onClick={() => {
              setMode("signin");
              clearAuthError();
            }}
            className={`flex-1 rounded-[5px] py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              mode === "signin" ? "bg-surface-700 text-cyan" : "text-ink-500"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode("signup");
              clearAuthError();
            }}
            className={`flex-1 rounded-[5px] py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              mode === "signup" ? "bg-surface-700 text-cyan" : "text-ink-500"
            }`}
          >
            Create Account
          </button>
        </div>

        {pendingConfirmation ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Mail className="size-8 text-cyan" />
            <p className="text-sm text-ink-300">
              Check <span className="text-ink-100">{email}</span> for a confirmation link, then sign in.
            </p>
            <Button variant="secondary" onClick={() => setMode("signin")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  Callsign
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  required
                  placeholder="How other operatives see you"
                  className="w-full rounded-md border border-border bg-bg-900 px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-cyan/50"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-md border border-border bg-bg-900 px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-cyan/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-bg-900 px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-cyan/50"
              />
            </div>

            {authError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {authError}
              </div>
            )}

            <Button size="lg" type="submit" disabled={submitting} className="mt-1">
              {submitting ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
