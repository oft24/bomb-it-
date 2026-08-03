import { memo } from "react";
import { cn } from "@/lib/utils";
import { NUMBER_COLOR } from "./cellColors";
import type { ClientCellStatus } from "@/store/gameStore";

interface CellProps {
  x: number;
  y: number;
  status: ClientCellStatus;
  adjacentMines?: number;
  isSafeZone?: boolean;
}

function CellImpl({ x, y, status, adjacentMines, isSafeZone }: CellProps) {
  const isOpened = status === "opened";
  const isBlank = isOpened && !adjacentMines;
  const isNumbered = isOpened && !!adjacentMines;

  return (
    <button
      type="button"
      data-x={x}
      data-y={y}
      data-cell
      tabIndex={-1}
      aria-label={
        status === "opened"
          ? adjacentMines
            ? `Cell ${x},${y}: ${adjacentMines} adjacent hazards`
            : `Cell ${x},${y}: clear`
          : status === "flagged"
            ? `Cell ${x},${y}: marked`
            : status === "exploded"
              ? `Cell ${x},${y}: hazard core`
              : `Cell ${x},${y}: closed`
      }
      className={cn(
        "relative flex items-center justify-center select-none",
        "text-[clamp(9px,1.6vw,15px)] font-bold font-hud leading-none",
        "border transition-colors duration-100",
        status === "closed" &&
          "bg-surface-700 border-border-subtle hover:bg-surface-600 hover:border-border-strong active:bg-surface-500 cursor-pointer",
        status === "closed" && isSafeZone && "ring-1 ring-inset ring-cyan/25",
        status === "flagged" &&
          "bg-surface-700 border-border-subtle cursor-pointer animate-cell-flag",
        isBlank && "bg-bg-900 border-border-subtle/60 cursor-default",
        isNumbered && "bg-bg-900 border-border-subtle/60 cursor-pointer animate-cell-reveal",
        status === "exploded" &&
          "bg-danger-dim border-danger/70 cursor-default animate-cell-explode z-10",
      )}
      style={isNumbered ? { color: NUMBER_COLOR[adjacentMines!] } : undefined}
    >
      {status === "flagged" && (
        <svg viewBox="0 0 16 16" className="size-[62%] text-cyan" fill="none">
          <path d="M4 1.5v13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M4 2.2h7.2c.8 0 1.1.8.5 1.3L9.4 5.4l2.3 1.9c.6.5.3 1.3-.5 1.3H4" fill="currentColor" opacity="0.9" />
        </svg>
      )}
      {status === "exploded" && (
        <svg viewBox="0 0 16 16" className="size-[64%]" fill="none">
          <polygon
            points="8,1 10.2,5.4 15,6 11.3,9.2 12.2,14 8,11.6 3.8,14 4.7,9.2 1,6 5.8,5.4"
            fill="var(--color-danger)"
          />
          <circle cx="8" cy="7.6" r="1.6" fill="#180705" />
        </svg>
      )}
      {isNumbered && adjacentMines}
    </button>
  );
}

function areEqual(prev: CellProps, next: CellProps) {
  return (
    prev.status === next.status &&
    prev.adjacentMines === next.adjacentMines &&
    prev.isSafeZone === next.isSafeZone
  );
}

export const Cell = memo(CellImpl, areEqual);
