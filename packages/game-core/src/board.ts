import { createSeededRng, randInt } from "./rng.js";

export const MINE = -1;

export interface BoardConfig {
  width: number;
  height: number;
  mineCount: number;
  seed: string;
  /** Cells guaranteed mine-free for every player — see docs/fairness.md. */
  safeZone: readonly Point[];
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Authoritative board: `cells[y*width+x]` is MINE (-1) or the count of
 * adjacent mines (0-8). Never serialize this whole structure to a client —
 * it must only ever learn about cells it has actually revealed.
 */
export interface Board {
  width: number;
  height: number;
  mineCount: number;
  cells: Int8Array;
}

function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function neighbors(width: number, height: number, x: number, y: number): Point[] {
  const out: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(width, height, nx, ny)) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

/**
 * Fisher-Yates over every non-safe-zone cell, seeded, so all clients that
 * generate a board from the same seed + config get an identical layout.
 */
export function generateBoard(config: BoardConfig): Board {
  const { width, height, mineCount, seed, safeZone } = config;
  const total = width * height;
  if (mineCount >= total) {
    throw new Error("mineCount must be less than total cell count");
  }

  const rng = createSeededRng(seed);
  const safeSet = new Set(safeZone.map((p) => p.y * width + p.x));

  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!safeSet.has(i)) candidates.push(i);
  }
  if (candidates.length < mineCount) {
    throw new Error("not enough non-safe cells to place mines");
  }

  // Partial Fisher-Yates: shuffle only as far as we need.
  for (let i = 0; i < mineCount; i++) {
    const j = i + randInt(rng, candidates.length - i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mineIndices = new Set(candidates.slice(0, mineCount));

  const cells = new Int8Array(total);
  for (const idx of mineIndices) cells[idx] = MINE;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (cells[idx] === MINE) continue;
      let count = 0;
      for (const n of neighbors(width, height, x, y)) {
        if (cells[n.y * width + n.x] === MINE) count++;
      }
      cells[idx] = count;
    }
  }

  return { width, height, mineCount, cells };
}

export function cellAt(board: Board, x: number, y: number): number {
  return board.cells[y * board.width + x];
}

export function isMine(board: Board, x: number, y: number): boolean {
  return cellAt(board, x, y) === MINE;
}

export function cellNeighbors(board: Board, x: number, y: number): Point[] {
  return neighbors(board.width, board.height, x, y);
}

/** Default shared-safe starting zone: centered 3x3, clamped to the board. */
export function defaultSafeZone(width: number, height: number): Point[] {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const pts: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (inBounds(width, height, x, y)) pts.push({ x, y });
    }
  }
  return pts;
}
