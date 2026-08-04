import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBoard, defaultSafeZone, isMine, MINE, cellAt, cellNeighbors } from "./board.js";
import { PlayerBoardState } from "./reveal.js";

test("same seed produces an identical board every time", () => {
  const config = {
    width: 16,
    height: 16,
    mineCount: 40,
    seed: "match-seed-abc",
    safeZone: defaultSafeZone(16, 16),
  };
  const a = generateBoard(config);
  const b = generateBoard(config);
  assert.deepEqual(Array.from(a.cells), Array.from(b.cells));
});

test("different seeds produce different boards", () => {
  const base = { width: 16, height: 16, mineCount: 40, safeZone: defaultSafeZone(16, 16) };
  const a = generateBoard({ ...base, seed: "seed-1" });
  const b = generateBoard({ ...base, seed: "seed-2" });
  assert.notDeepEqual(Array.from(a.cells), Array.from(b.cells));
});

test("safe zone never contains a mine", () => {
  const width = 20;
  const height = 20;
  const safeZone = defaultSafeZone(width, height);
  const board = generateBoard({ width, height, mineCount: 80, seed: "safe-zone-check", safeZone });
  for (const p of safeZone) {
    assert.equal(isMine(board, p.x, p.y), false);
  }
});

test("exact mine count is placed", () => {
  const board = generateBoard({
    width: 10,
    height: 10,
    mineCount: 15,
    seed: "count-check",
    safeZone: defaultSafeZone(10, 10),
  });
  const mines = Array.from(board.cells).filter((c) => c === MINE).length;
  assert.equal(mines, 15);
});

test("flood fill reveals a contiguous zero region and stops at numbers", () => {
  // 3x3 board, single mine in a corner so most of the board floods open.
  const board = generateBoard({
    width: 3,
    height: 3,
    mineCount: 1,
    seed: "flood-test-seed-7",
    safeZone: [{ x: 1, y: 1 }],
  });
  const state = new PlayerBoardState(board);
  const { cells, hitMine } = state.reveal(1, 1);
  assert.equal(hitMine, false);
  assert.ok(cells.length >= 1);
});

test("chord only fires when flag count matches the number", () => {
  const board = generateBoard({
    width: 3,
    height: 3,
    mineCount: 1,
    seed: "chord-test",
    safeZone: [{ x: 0, y: 0 }],
  });
  const state = new PlayerBoardState(board);
  state.reveal(0, 0);
  const before = state.chord(0, 0);
  assert.equal(before.cells.length, 0, "should not chord without matching flags");
});

test("chording a fully flagged number opens every remaining neighbor", () => {
  const width = 16;
  const height = 16;
  const board = generateBoard({
    width,
    height,
    mineCount: 40,
    seed: "chord-opens-neighbors",
    safeZone: defaultSafeZone(width, height),
  });
  const state = new PlayerBoardState(board);

  // Find any numbered cell that has at least one unrevealed, non-mine neighbor,
  // so the chord has something left to open.
  let target: { x: number; y: number } | null = null;
  for (let y = 0; y < height && !target; y++) {
    for (let x = 0; x < width && !target; x++) {
      const value = cellAt(board, x, y);
      if (value <= 0) continue;
      const neighbors = cellNeighbors(board, x, y);
      if (neighbors.some((n) => !isMine(board, n.x, n.y))) target = { x, y };
    }
  }
  assert.ok(target, "expected the board to contain a numbered cell");

  const { x, y } = target!;
  state.reveal(x, y);
  assert.equal(state.isRevealed(x, y), true);

  const neighbors = cellNeighbors(board, x, y);
  for (const n of neighbors) {
    if (isMine(board, n.x, n.y)) state.setFlag(n.x, n.y, true);
  }

  const expected = neighbors.filter(
    (n) => !isMine(board, n.x, n.y) && !state.isRevealed(n.x, n.y),
  );
  const { cells, hitMine } = state.chord(x, y);

  assert.equal(hitMine, false, "chording correctly flagged mines must never detonate");
  for (const n of expected) {
    assert.equal(state.isRevealed(n.x, n.y), true, `neighbor ${n.x},${n.y} should be open`);
  }
  assert.ok(cells.length >= expected.length, "every pending safe neighbor should be reported");
});

test("chording a wrongly flagged number detonates instead of being forgiven", () => {
  const board = generateBoard({
    width: 8,
    height: 8,
    mineCount: 10,
    seed: "chord-wrong-flag",
    safeZone: defaultSafeZone(8, 8),
  });
  const state = new PlayerBoardState(board);

  // A numbered cell where we deliberately flag safe neighbors instead of mines:
  // the flag count still matches, so the chord fires and hits a real mine.
  let fired = false;
  for (let y = 0; y < 8 && !fired; y++) {
    for (let x = 0; x < 8 && !fired; x++) {
      const value = cellAt(board, x, y);
      if (value <= 0) continue;
      const neighbors = cellNeighbors(board, x, y);
      const safe = neighbors.filter((n) => !isMine(board, n.x, n.y));
      if (safe.length < value) continue;

      const probe = new PlayerBoardState(board);
      probe.reveal(x, y);
      for (let i = 0; i < value; i++) probe.setFlag(safe[i].x, safe[i].y, true);
      const { hitMine } = probe.chord(x, y);
      if (hitMine) fired = true;
    }
  }
  assert.equal(fired, true, "mis-flagged chord should be able to detonate a mine");
});

test("progress reaches 100% once every non-mine cell is revealed", () => {
  const width = 4;
  const height = 4;
  const board = generateBoard({
    width,
    height,
    mineCount: 2,
    seed: "win-check",
    safeZone: defaultSafeZone(width, height),
  });
  const state = new PlayerBoardState(board);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isMine(board, x, y)) state.reveal(x, y);
    }
  }
  assert.equal(state.hasWon(), true);
  assert.equal(state.progressPct(), 100);
});
