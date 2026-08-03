"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useGameStore } from "@/store/gameStore";
import { ArrowLeft, DoorOpen, Plus } from "lucide-react";

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";

export default function PlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { connectAndJoin, roomId, gameState, errorMessage, clearError } = useGameStore();

  useEffect(() => {
    if (roomId && gameState === "LOBBY") router.push("/lobby");
  }, [roomId, gameState, router]);

  async function handleCreate() {
    if (!username.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/new-code`);
      const { code } = await res.json();
      setPendingCode(code);
      connectAndJoin(code, username.trim());
    } catch {
      setSubmitting(false);
    }
  }

  function handleJoin() {
    if (!username.trim() || joinCode.trim().length < 4) return;
    setSubmitting(true);
    connectAndJoin(joinCode.trim(), username.trim());
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

        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Callsign
        </label>
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            clearError();
          }}
          maxLength={20}
          placeholder="Enter your callsign"
          className="mb-5 w-full rounded-md border border-border bg-bg-900 px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-cyan/50"
        />

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
          <Button size="lg" className="w-full" onClick={handleCreate} disabled={!username.trim() || submitting}>
            <Plus className="size-4" /> {submitting ? (pendingCode ?? "Creating…") : "Create Room"}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={handleJoin}
            disabled={!username.trim() || joinCode.trim().length < 4 || submitting}
          >
            <DoorOpen className="size-4" /> {submitting ? "Joining…" : "Join Room"}
          </Button>
        )}
      </Panel>
    </div>
  );
}
