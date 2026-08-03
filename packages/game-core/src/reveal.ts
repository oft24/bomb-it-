import { type Board, cellAt, cellNeighbors, isMine, MINE } from "./board.js";

export interface RevealedCell {
  x: number;
  y: number;
  mine: boolean;
  adjacentMines: number;
}

/**
 * Per-player mutable progress against a shared, immutable Board. Kept
 * separate from Board so one authoritative board serves every racer.
 */
export class PlayerBoardState {
  readonly revealed: Uint8Array;
  readonly flagged: Uint8Array;
  mistakes = 0;
  streak = 0;
  finished = false;

  constructor(private readonly board: Board) {
    this.revealed = new Uint8Array(board.width * board.height);
    this.flagged = new Uint8Array(board.width * board.height);
  }

  private idx(x: number, y: number): number {
    return y * this.board.width + x;
  }

  isRevealed(x: number, y: number): boolean {
    return this.revealed[this.idx(x, y)] === 1;
  }

  isFlagged(x: number, y: number): boolean {
    return this.flagged[this.idx(x, y)] === 1;
  }

  setFlag(x: number, y: number, flagged: boolean): boolean {
    if (this.isRevealed(x, y)) return false;
    this.flagged[this.idx(x, y)] = flagged ? 1 : 0;
    return true;
  }

  flagCount(): number {
    let n = 0;
    for (let i = 0; i < this.flagged.length; i++) n += this.flagged[i];
    return n;
  }

  /** Reveals (x,y). If it's 0 adjacent mines, flood-fills outward. Returns every newly revealed cell. */
  reveal(x: number, y: number): { cells: RevealedCell[]; hitMine: boolean } {
    if (this.isRevealed(x, y) || this.isFlagged(x, y)) return { cells: [], hitMine: false };

    if (isMine(this.board, x, y)) {
      this.revealed[this.idx(x, y)] = 1;
      this.mistakes++;
      this.streak = 0;
      return { cells: [{ x, y, mine: true, adjacentMines: 0 }], hitMine: true };
    }

    const out: RevealedCell[] = [];
    const stack: Array<{ x: number; y: number }> = [{ x, y }];

    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (this.isRevealed(cur.x, cur.y) || this.isFlagged(cur.x, cur.y)) continue;
      const value = cellAt(this.board, cur.x, cur.y);
      if (value === MINE) continue; // flood fill never crosses into mines

      this.revealed[this.idx(cur.x, cur.y)] = 1;
      out.push({ x: cur.x, y: cur.y, mine: false, adjacentMines: value });

      if (value === 0) {
        for (const n of cellNeighbors(this.board, cur.x, cur.y)) {
          if (!this.isRevealed(n.x, n.y) && !this.isFlagged(n.x, n.y)) stack.push(n);
        }
      }
    }

    this.streak += out.length;
    return { cells: out, hitMine: false };
  }

  /**
   * Chord: if the number of flags around an already-opened numbered cell
   * matches its number, reveal every remaining unflagged neighbor at once.
   */
  chord(x: number, y: number): { cells: RevealedCell[]; hitMine: boolean } {
    if (!this.isRevealed(x, y)) return { cells: [], hitMine: false };
    const value = cellAt(this.board, x, y);
    if (value <= 0) return { cells: [], hitMine: false };

    const neighbors = cellNeighbors(this.board, x, y);
    const flagCount = neighbors.filter((n) => this.isFlagged(n.x, n.y)).length;
    if (flagCount !== value) return { cells: [], hitMine: false };

    const cells: RevealedCell[] = [];
    let hitMine = false;
    for (const n of neighbors) {
      if (this.isFlagged(n.x, n.y) || this.isRevealed(n.x, n.y)) continue;
      const result = this.reveal(n.x, n.y);
      cells.push(...result.cells);
      if (result.hitMine) hitMine = true;
    }
    return { cells, hitMine };
  }

  revealedNonMineCount(): number {
    let n = 0;
    for (let i = 0; i < this.revealed.length; i++) {
      if (this.revealed[i] === 1 && this.board.cells[i] !== MINE) n++;
    }
    return n;
  }

  progressPct(): number {
    const totalSafe = this.board.width * this.board.height - this.board.mineCount;
    return totalSafe === 0 ? 100 : (this.revealedNonMineCount() / totalSafe) * 100;
  }

  hasWon(): boolean {
    return this.revealedNonMineCount() === this.board.width * this.board.height - this.board.mineCount;
  }
}
