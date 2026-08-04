"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { useGameStore, type JoinIdentity } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import { loadGuestName, saveGuestName } from "@/lib/guestIdentity";
import { ArrowLeft, DoorOpen, Plus, LogOut, UserRound } from "lucide-react";

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";
const MIN_NAME_LENGTH = 2;

export default function PlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { connectAndJoin, roomId, gameState, errorMessage, clearError } = useGameStore();
  const { session, user, profile, signOut } = useAuthStore();

  // Remembered per tab, so a reload doesn't make you retype it.
  useEffect(() => {
    setName(loadGuestName());
  }, []);

  useEffect(() => {
    if (roomId && gameState === "LOBBY") router.push("/lobby");
  }, [roomId, gameState, router]);

  // A failed join leaves the button stuck in its pending state otherwise.
  useEffect(() => {
    if (errorMessage) setSubmitting(false);
  }, [errorMessage]);

  const trimmedName = name.trim();
  const canPlayAsGuest = trimmedName.length >= MIN_NAME_LENGTH;
  const ready = Boolean(session) || canPlayAsGuest;

  function identity(): JoinIdentity | null {
    if (session && user) {
      return { kind: "account", accessToken: session.access_token, playerId: user.id };
    }
    if (!canPlayAsGuest) return null;
    saveGuestName(trimmedName);
    return { kind: "guest", guestName: trimmedName };
  }

  async function handleCreate() {
    const id = identity();
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/new-code`);
      const { code } = await res.json();
      setPendingCode(code);
      connectAndJoin(code, id);
    } catch {
      setSubmitting(false);
    }
  }

  function handleJoin() {
    const id = identity();
    if (!id || joinCode.trim().length < 4) return;
    setSubmitting(true);
    connectAndJoin(joinCode.trim(), id);
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-14">
      <div className="mb-10 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-100">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <Logo />
        {session ? (
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-danger"
          >
            <LogOut className="size-3.5" />
          </button>
        ) : (
          <span className="w-3.5" />
        )}
      </div>

      {session ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-800/60 px-4 py-2.5">
          <span className="text-sm font-semibold text-ink-100">{profile?.username ?? "…"}</span>
          {profile && (
            <>
              <span className="h-3 w-px bg-border" />
              <RankBadge rank={profile.rank} size="sm" />
            </>
          )}
        </div>
      ) : (
        <Panel className="mb-4 w-full max-w-md p-6">
          <label
            htmlFor="guest-name"
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500"
          >
            Your name
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-bg-900 px-3 focus-within:border-cyan/50">
            <UserRound className="size-4 shrink-0 text-ink-700" />
            <input
              id="guest-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError();
              }}
              maxLength={20}
              placeholder="Type a name and play"
              autoComplete="nickname"
              className="w-full bg-transparent py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-700"
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-500">
            No account needed. Sign in only if you want your matches and rating saved —{" "}
            <Link href="/auth?redirect=/play" className="font-semibold text-cyan hover:underline">
              sign in
            </Link>
            .
          </p>
        </Panel>
      )}

      <Panel className="w-full max-w-md p-6">
        <div className="mb-6 flex rounded-md border border-border-subtle bg-bg-900 p-1">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 rounded-[5px] py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              mode === "create" ? "bg-surface-700 text-cyan" : "text-ink-500"
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setMode("join")}
            className={`flex-1 rounded-[5px] py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              mode === "join" ? "bg-surface-700 text-cyan" : "text-ink-500"
            }`}
          >
            Join Room
          </button>
        </div>

        {mode === "join" && (
          <>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Room Code
            </label>
            <input
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                clearError();
              }}
              maxLength={6}
              placeholder="7KQ9XZ"
              className="mb-5 w-full rounded-md border border-border bg-bg-900 px-3 py-2.5 font-hud text-lg tracking-[0.2em] text-ink-100 outline-none placeholder:text-ink-700 focus:border-cyan/50"
            />
          </>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {errorMessage}
          </div>
        )}

        {mode === "create" ? (
          <Button size="lg" className="w-full" onClick={handleCreate} disabled={!ready || submitting}>
            <Plus className="size-4" /> {submitting ? (pendingCode ?? "Creating…") : "Create Room"}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={handleJoin}
            disabled={!ready || joinCode.trim().length < 4 || submitting}
          >
            <DoorOpen className="size-4" /> {submitting ? "Joining…" : "Join Room"}
          </Button>
        )}

        {!ready && (
          <p className="mt-3 text-center text-[11px] text-ink-500">
            Enter a name of at least {MIN_NAME_LENGTH} characters to continue.
          </p>
        )}
      </Panel>
    </div>
  );
}
