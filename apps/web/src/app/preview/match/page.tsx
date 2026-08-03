"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateBoard, defaultSafeZone, PlayerBoardState } from "@sectorzero/game-core";
import { Board } from "@/components/board/Board";
import { MatchHud } from "@/components/hud/MatchHud";
import { LiveLeaderboard } from "@/components/hud/LiveLeaderboard";
import { PenaltyOverlay } from "@/components/hud/PenaltyOverlay";
import { FinishOverlay } from "@/components/hud/FinishOverlay";
import type { ClientCell } from "@/store/gameStore";
import { mockProgress } from "@/lib/mock";

const WIDTH = 24;
const HEIGHT = 24;
const MINE_COUNT = 99;

/** Fully playable single-client demo of the match screen, driven by game-core directly. */
export default function MatchPreviewPage() {
  const safeZone = useMemo(() => defaultSafeZone(WIDTH, HEIGHT), []);
  const board = useMemo(
    () => generateBoard({ width: WIDTH, height: HEIGHT, mineCount: MINE_COUNT, seed: "preview-seed", safeZone }),
    [safeZone],
  );
  const stateRef = useRef<PlayerBoardState | null>(null);
  if (stateRef.current === null) stateRef.current = new PlayerBoardState(board);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cells, setCells] = useState<Record<string, ClientCell>>({});
  const [progressPct, setProgressPct] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [penaltyTick, setPenaltyTick] = useState(0);
  const [finished, setFinished] = useState<{ placement: number; finishTimeMs: number } | null>(null);

  useEffect(() => {
    // One-time demo bootstrap (mirrors the real match_started handshake) — not a
    // render-triggered sync, so the synchronous setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartedAt(Date.now());
    const state = stateRef.current!;
    const { cells: revealed } = state.reveal(safeZone[0].x, safeZone[0].y);
    setCells((prev) => mergeRevealed(prev, revealed));
    setProgressPct(state.progressPct());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyOutcome(revealed: ReturnType<PlayerBoardState["reveal"]>["cells"], hitMine: boolean) {
    const state = stateRef.current!;
    if (revealed.length > 0) setCells((prev) => mergeRevealed(prev, revealed));
    setProgressPct(state.progressPct());
    if (hitMine) setPenaltyTick((t) => t + 1);
    else if (state.hasWon() && startedAt != null) {
      setFinished({ placement: 1, finishTimeMs: Date.now() - startedAt });
    }
  }

  function handleReveal(x: number, y: number) {
    if (finished) return;
    const { cells: revealed, hitMine } = stateRef.current!.reveal(x, y);
    if (revealed.length === 0) return;
    applyOutcome(revealed, hitMine);
  }

  function handleFlag(x: number, y: number, flagged: boolean) {
    const state = stateRef.current!;
    if (!state.setFlag(x, y, flagged)) return;
    setCells((prev) => ({ ...prev, [`${x},${y}`]: { status: flagged ? "flagged" : "closed" } }));
    setFlaggedCount(state.flagCount());
  }

  function handleChord(x: number, y: number) {
    const { cells: revealed, hitMine } = stateRef.current!.chord(x, y);
    if (revealed.length === 0) return;
    applyOutcome(revealed, hitMine);
  }

  const progress = mockProgress(24, "You");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <MatchHud
        position={1}
        totalPlayers={24}
        startedAt={startedAt}
        running={!finished && startedAt != null}
        progressPct={progressPct}
        minesRemaining={MINE_COUNT - flaggedCount}
        ping={31}
        connected
        roomId="7KQ9XZ"
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-5 overflow-hidden p-5">
        <div className="relative flex flex-[3] items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-800/40 p-4">
          <div className="w-full max-w-[min(85vh,100%)]">
            <Board
              width={WIDTH}
              height={HEIGHT}
              cells={cells}
              safeZone={safeZone}
              interactive={!finished}
              onReveal={handleReveal}
              onFlag={handleFlag}
              onChord={handleChord}
            />
          </div>

          <PenaltyOverlay seconds={3} tick={penaltyTick} />

          {finished && (
            <FinishOverlay
              placement={finished.placement}
              finishTimeMs={finished.finishTimeMs}
              onViewResults={() => {}}
            />
          )}
        </div>

        <LiveLeaderboard progress={progress} localPlayerId="local-player" className="hidden w-72 lg:flex" />
      </div>
    </div>
  );
}

function mergeRevealed(
  prev: Record<string, ClientCell>,
  revealed: { x: number; y: number; mine: boolean; adjacentMines: number }[],
): Record<string, ClientCell> {
  const next = { ...prev };
  for (const c of revealed) {
    next[`${c.x},${c.y}`] = c.mine ? { status: "exploded" } : { status: "opened", adjacentMines: c.adjacentMines };
  }
  return next;
}
