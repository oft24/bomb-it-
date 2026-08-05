import { test } from "node:test";
import assert from "node:assert/strict";
import { raceIntensity } from "./intensity.js";

test("solo runs build from progress, never from standing", () => {
  // Alone you are always first, so position must not drive the mix.
  const solo = (progressPct: number) => raceIntensity({ position: 1, totalPlayers: 1, progressPct });
  assert.equal(solo(0), 1);
  assert.equal(solo(25), 2);
  assert.equal(solo(50), 3);
  assert.equal(solo(75), 4);
  assert.equal(solo(95), 5);
});

test("leading early is not treated as a lead", () => {
  // First place ten seconds in is noise; the score should not peak there.
  const early = raceIntensity({ position: 1, totalPlayers: 8, progressPct: 5 });
  assert.ok(early < 5, `expected a calm opening, got ${early}`);
  const earned = raceIntensity({ position: 1, totalPlayers: 8, progressPct: 60 });
  assert.equal(earned, 5);
});

test("standing dominates once the field is real", () => {
  const podium = raceIntensity({ position: 3, totalPlayers: 30, progressPct: 20 });
  const midfield = raceIntensity({ position: 15, totalPlayers: 30, progressPct: 20 });
  const backmarker = raceIntensity({ position: 29, totalPlayers: 30, progressPct: 5 });
  assert.ok(podium > midfield, "third should feel tenser than fifteenth");
  assert.ok(midfield >= backmarker, "midfield should not be calmer than last");
  assert.equal(podium, 4);
});

test("a two-player duel opens calm — leading half a field of two means nothing", () => {
  // Measured in production before this was weighted: leading a duel at 0.8%
  // produced the same arrangement density as being at 82% of the board.
  const opening = raceIntensity({ position: 1, totalPlayers: 2, progressPct: 0.8 });
  assert.ok(opening <= 2, `duel opening should be sparse, got ${opening}`);
  // And it must still build as the board actually gets cleared.
  assert.ok(raceIntensity({ position: 1, totalPlayers: 2, progressPct: 60 }) > opening);
});

test("a podium only counts when there is a field to be on the podium of", () => {
  const inACrowd = raceIntensity({ position: 3, totalPlayers: 30, progressPct: 10 });
  const inADuel = raceIntensity({ position: 2, totalPlayers: 2, progressPct: 10 });
  assert.equal(inACrowd, 4, "third of thirty is a real position");
  assert.ok(inADuel < inACrowd, "second of two is last, not a podium");
});

test("a nearly finished board always peaks, wherever you are", () => {
  assert.equal(raceIntensity({ position: 20, totalPlayers: 30, progressPct: 95 }), 5);
});

test("output stays in range for hostile input", () => {
  const cases: { position: number; totalPlayers: number; progressPct: number }[] = [
    { position: 0, totalPlayers: 0, progressPct: -50 },
    { position: 99, totalPlayers: 4, progressPct: 400 },
    { position: -3, totalPlayers: 10, progressPct: Number.NaN },
  ];
  for (const snapshot of cases) {
    const level = raceIntensity(snapshot);
    assert.ok(
      Number.isInteger(level) && level >= 0 && level <= 5,
      `intensity out of range for ${JSON.stringify(snapshot)}: ${level}`,
    );
  }
});
