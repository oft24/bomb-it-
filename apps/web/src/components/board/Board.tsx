import { useCallback, useMemo, useRef } from "react";
import { Cell } from "./Cell";
import type { ClientCell } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import { getGameAudio } from "@/lib/gameAudio";

interface BoardProps {
  width: number;
  height: number;
  cells: Record<string, ClientCell>;
  safeZone?: { x: number; y: number }[];
  interactive: boolean;
  onReveal: (x: number, y: number) => void;
  onFlag: (x: number, y: number, flagged: boolean) => void;
  onChord: (x: number, y: number) => void;
  className?: string;
}

export function Board({
  width,
  height,
  cells,
  safeZone,
  interactive,
  onReveal,
  onFlag,
  onChord,
  className,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const safeSet = useMemo(() => new Set((safeZone ?? []).map((p) => `${p.x},${p.y}`)), [safeZone]);

  const resolveTarget = useCallback((e: { target: EventTarget | null }) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!el) return null;
    const x = Number(el.dataset.x);
    const y = Number(el.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y, el };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive) return;
      const target = resolveTarget(e);
      if (!target) return;
      const key = `${target.x},${target.y}`;
      const cell = cells[key];
      if (!cell || cell.status === "closed") {
        getGameAudio().tileClick();
        onReveal(target.x, target.y);
      } else if (cell.status === "opened" && cell.adjacentMines) {
        getGameAudio().tileClick();
        onChord(target.x, target.y);
      }
    },
    [interactive, cells, onReveal, onChord, resolveTarget],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!interactive) return;
      const target = resolveTarget(e);
      if (!target) return;
      const key = `${target.x},${target.y}`;
      const cell = cells[key];
      if (!cell || cell.status === "closed") {
        getGameAudio().tileClick();
        onFlag(target.x, target.y, true);
      } else if (cell.status === "flagged") {
        getGameAudio().tileClick();
        onFlag(target.x, target.y, false);
      }
    },
    [interactive, cells, onFlag, resolveTarget],
  );

  const handleAuxClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      if (!interactive) return;
      const target = resolveTarget(e);
      if (!target) return;
      const cell = cells[`${target.x},${target.y}`];
      if (cell?.status === "opened" && cell.adjacentMines) onChord(target.x, target.y);
    },
    [interactive, cells, onChord, resolveTarget],
  );

  const rows = useMemo(() => {
    const out: { x: number; y: number; key: string }[][] = [];
    for (let y = 0; y < height; y++) {
      const row: { x: number; y: number; key: string }[] = [];
      for (let x = 0; x < width; x++) row.push({ x, y, key: `${x},${y}` });
      out.push(row);
    }
    return out;
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleAuxClick}
      className={cn(
        "grid gap-[2px] rounded-md bg-bg-950 p-[2px] select-none",
        !interactive && "pointer-events-none opacity-70 saturate-50",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        aspectRatio: `${width} / ${height}`,
      }}
    >
      {rows.map((row) =>
        row.map(({ x, y, key }) => {
          const cell = cells[key];
          return (
            <Cell
              key={key}
              x={x}
              y={y}
              status={cell?.status ?? "closed"}
              adjacentMines={cell?.adjacentMines}
              isSafeZone={safeSet.has(key)}
            />
          );
        }),
      )}
    </div>
  );
}
