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
