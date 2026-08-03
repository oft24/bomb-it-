"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { useGameStore } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeft, DoorOpen, Plus, LogOut } from "lucide-react";

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";

export default function PlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { connectAndJoin, roomId, gameState, errorMessage, clearError } = useGameStore();
  const { initialized, session, user, profile, signOut } = useAuthStore();

  useEffect(() => {
    if (initialized && !session) router.replace("/auth?redirect=/play");
  }, [initialized, session, router]);

  useEffect(() => {
    if (roomId && gameState === "LOBBY") router.push("/lobby");
  }, [roomId, gameState, router]);

  async function handleCreate() {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/new-code`);
      const { code } = await res.json();
      setPendingCode(code);
      connectAndJoin(code, session.access_token, user!.id);
    } catch {
      setSubmitting(false);
    }
  }

  function handleJoin() {
    if (!session || joinCode.trim().length < 4) return;
    setSubmitting(true);
    connectAndJoin(joinCode.trim(), session.access_token, user!.id);
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-14">
      <div className="mb-10 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-100">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <Logo />
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-danger"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-800/60 px-4 py-2.5">
        <span className="text-sm font-semibold text-ink-100">{profile?.username ?? "…"}</span>
        {profile && (
          <>
            <span className="h-3 w-px bg-border" />
            <RankBadge rank={profile.rank} size="sm" />
          </>
        )}
      </div>

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
          <Button size="lg" className="w-full" onClick={handleCreate} disabled={submitting}>
            <Plus className="size-4" /> {submitting ? (pendingCode ?? "Creating…") : "Create Room"}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={handleJoin}
            disabled={joinCode.trim().length < 4 || submitting}
          >
            <DoorOpen className="size-4" /> {submitting ? "Joining…" : "Join Room"}
          </Button>
        )}
      </Panel>
    </div>
  );
}
