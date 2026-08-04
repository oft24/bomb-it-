"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickCasinoGame, type CasinoGameKind } from "@sectorzero/game-core";
import { useGameStore } from "@/store/gameStore";
import { CasinoTable } from "@/components/casino/CasinoTable";
import { Board } from "@/components/board/Board";
import { MatchHud } from "@/components/hud/MatchHud";
import { LiveLeaderboard } from "@/components/hud/LiveLeaderboard";
import { PenaltyOverlay } from "@/components/hud/PenaltyOverlay";
import { WipeOverlay } from "@/components/hud/WipeOverlay";
import { FinishOverlay } from "@/components/hud/FinishOverlay";
import { rankPlayers } from "@/lib/leaderboard";
import { getGameAudio } from "@/lib/gameAudio";

export default function MatchPage() {
  const router = useRouter();
  const {
    roomId,
    matchInfo,
    cells,
    flaggedCount,
    progress,
    localPlayerId,
    localPenaltySeconds,
    penaltyTick,
    gameState,
    connectionStatus,
    players,
    settings,
    mistakes,
    resets,
    resetTick,
    reveal,
    flag,
    chord,
  } = useGameStore();

  useEffect(() => {
    if (!roomId || !matchInfo) router.replace(roomId ? "/lobby" : "/play");
  }, [roomId, matchInfo, router]);

  useEffect(() => {
    if (gameState === "FINISHED") {
      const id = setTimeout(() => router.push("/results"), 1600);
      return () => clearTimeout(id);
    }
  }, [gameState, router]);

  // Stingers are keyed off the tick counters so each event fires exactly once,
  // even though the surrounding state updates many times a second.
  useEffect(() => {
    if (resetTick > 0) getGameAudio().wipe();
  }, [resetTick]);

  useEffect(() => {
    getGameAudio().setTrack(settings.casinoMode ? "CASINO" : "ARCADE");
  }, [settings.casinoMode]);

  // Casino mode puts a table game between the click and the reveal. The wager is
  // held here rather than in the store because it's purely local ceremony — the
  // server only ever hears about the reveal that a win produces.
  type WagerAction =
    | { kind: "REVEAL"; x: number; y: number; game: CasinoGameKind }
    | { kind: "FLAG"; x: number; y: number; flagged: boolean; game: CasinoGameKind };
  const [wager, setWager] = useState<WagerAction | null>(null);

  function handleReveal(x: number, y: number) {
    if (!settings.casinoMode) {
      reveal(x, y);
      return;
    }
    setWager({ kind: "REVEAL", x, y, game: pickCasinoGame() });
  }

  function handleFlag(x: number, y: number, flagged: boolean) {
    if (!settings.casinoMode) {
      flag(x, y, flagged);
      return;
    }
    setWager({ kind: "FLAG", x, y, flagged, game: pickCasinoGame() });
  }

  function resolveWager(won: boolean) {
    const pending = wager;
    setWager(null);
    if (!won || !pending) return;
    if (pending.kind === "REVEAL") reveal(pending.x, pending.y);
    else flag(pending.x, pending.y, pending.flagged);
  }

  const ranked = useMemo(() => rankPlayers(progress), [progress]);
  const localProgress = progress.find((p) => p.id === localPlayerId);
  const position = Math.max(1, ranked.findIndex((p) => p.id === localPlayerId) + 1);
  const totalPlayers = progress.length || players.length;
  const localPing = players.find((p) => p.id === localPlayerId)?.ping ?? 0;

  if (!roomId || !matchInfo) return null;

  const interactive = localProgress?.state === "PLAYING";
  const showFinish = localProgress?.state === "FINISHED";
  const matchEndedWithoutLocalFinish = gameState === "FINISHED" && localProgress?.state !== "FINISHED";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <MatchHud
        position={position}
        totalPlayers={totalPlayers}
        startedAt={matchInfo.startedAt}
        running={gameState === "PLAYING"}
        progressPct={localProgress?.progressPct ?? 0}
        minesRemaining={matchInfo.mineCount - flaggedCount}
        ping={localPing}
        connected={connectionStatus === "connected"}
        roomId={roomId}
        mistakes={mistakes}
        maxMistakes={settings.maxMistakes}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-5 overflow-hidden p-5">
        <div className="relative flex flex-[3] items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-800/40 p-4">
          <div className="w-full max-w-[min(85vh,100%)]">
            <Board
              width={matchInfo.width}
              height={matchInfo.height}
              cells={cells}
              safeZone={matchInfo.safeZone}
              interactive={interactive && !wager}
              onReveal={handleReveal}
              onFlag={handleFlag}
              onChord={chord}
            />
          </div>

          <PenaltyOverlay seconds={localPenaltySeconds} tick={penaltyTick} />
          <WipeOverlay tick={resetTick} resets={resets} />

          {showFinish && localProgress?.finishTimeMs != null && (
            <FinishOverlay
              placement={localProgress.placement ?? position}
              finishTimeMs={localProgress.finishTimeMs}
              onViewResults={() => router.push("/results")}
            />
          )}

          {matchEndedWithoutLocalFinish && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-bg-950/85 backdrop-blur-md">
              <span className="font-hud text-sm uppercase tracking-[0.25em] text-ink-500">
                Match Complete
              </span>
              <span className="text-xs text-ink-700">Compiling results…</span>
            </div>
          )}
        </div>

        <LiveLeaderboard progress={progress} localPlayerId={localPlayerId} className="hidden w-72 lg:flex" />
      </div>

      {wager && (
        <CasinoTable
          key={`${wager.x},${wager.y}-${wager.game}`}
          game={wager.game}
          cell={{ x: wager.x, y: wager.y }}
          action={wager.kind === "REVEAL" ? "OPEN" : wager.flagged ? "PLACE FLAG" : "REMOVE FLAG"}
          onResolved={resolveWager}
        />
      )}
    </div>
  );
}
