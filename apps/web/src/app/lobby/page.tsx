"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayerCard } from "@/components/lobby/PlayerCard";
import { RoomCodePanel } from "@/components/lobby/RoomCodePanel";
import { SettingsPanel } from "@/components/lobby/SettingsPanel";
import { CountdownOverlay } from "@/components/lobby/CountdownOverlay";
import { Check, LogOut, Users } from "lucide-react";

export default function LobbyPage() {
  const router = useRouter();
  const {
    roomId,
    hostId,
    localPlayerId,
    players,
    settings,
    gameState,
    countdown,
    setReady,
    updateSettings,
    startMatch,
    leaveRoom,
  } = useGameStore();

  useEffect(() => {
    if (!roomId) router.replace("/play");
  }, [roomId, router]);

  useEffect(() => {
    if (gameState === "PLAYING") router.push("/match");
  }, [gameState, router]);

  if (!roomId) return null;

  const isHost = localPlayerId === hostId;
  const localPlayer = players.find((p) => p.id === localPlayerId);
  const readyCount = players.filter((p) => p.isReady).length;
  const canStart = players.length >= 1;

  return (
    <div className="flex min-h-screen flex-col">
      <CountdownOverlay seconds={gameState === "COUNTDOWN" ? countdown : null} />

      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <Logo />
        <button
          onClick={() => {
            leaveRoom();
            router.push("/play");
          }}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 hover:text-danger"
        >
          <LogOut className="size-3.5" /> Leave Lobby
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <RoomCodePanel roomId={roomId} />

          <Panel className="flex flex-1 flex-col overflow-hidden">
            <PanelHeader>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-ink-500" />
                <PanelTitle>Operatives</PanelTitle>
              </div>
              <span className="font-hud text-xs text-ink-500">
                {players.length} / {settings.maxPlayers}
              </span>
            </PanelHeader>
            <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} isLocal={p.id === localPlayerId} />
              ))}
              {Array.from({ length: Math.max(0, settings.maxPlayers - players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex h-[52px] items-center justify-center rounded-md border border-dashed border-border-subtle text-[10px] uppercase tracking-wide text-ink-900"
                >
                  Open Slot
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-80">
          <SettingsPanel settings={settings} editable={isHost} onChange={updateSettings} />

          <Panel className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-500">Ready</span>
              <span className="font-hud text-ink-300">
                {readyCount} / {players.length}
              </span>
            </div>
            {isHost ? (
              <Button size="lg" onClick={startMatch} disabled={!canStart}>
                Start Match
              </Button>
            ) : (
              <Button
                size="lg"
                variant={localPlayer?.isReady ? "secondary" : "primary"}
                onClick={() => setReady(!localPlayer?.isReady)}
              >
                {localPlayer?.isReady && <Check className="size-4" />}
                {localPlayer?.isReady ? "Ready" : "Mark Ready"}
              </Button>
            )}
            {!isHost && (
              <p className="text-center text-[11px] text-ink-700">Waiting on host to start the match.</p>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
