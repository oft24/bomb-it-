"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { ResultsView } from "@/components/results/ResultsView";
import { Logo } from "@/components/ui/Logo";

export default function ResultsPage() {
  const router = useRouter();
  const { results, roomId, hostId, localPlayerId, gameState, requestRematch, leaveRoom } = useGameStore();

  useEffect(() => {
    if (!roomId) router.replace("/play");
  }, [roomId, router]);

  useEffect(() => {
    if (gameState === "LOBBY") router.push("/lobby");
  }, [gameState, router]);

  if (!roomId || !results) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-center border-b border-border-subtle px-8 py-4">
        <Logo />
      </header>
      <ResultsView
        results={results}
        localPlayerId={localPlayerId}
        isHost={localPlayerId === hostId}
        onRematch={requestRematch}
        onReturnToLobby={() => { leaveRoom(); router.push("/play"); }}
      />
    </div>
  );
}
