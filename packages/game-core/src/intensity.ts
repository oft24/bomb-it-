/**
 * How tense the current moment is, 0-5. The soundtrack layers off this, so it
 * lives here rather than in the audio engine: it's a statement about the race,
 * not about sound, and any future client should reach the same conclusion.
 */
export type RaceIntensity = 0 | 1 | 2 | 3 | 4 | 5;

export interface RaceSnapshot {
  /** 1 = currently leading. */
  position: number;
  /** How many racers are still in the match. */
  totalPlayers: number;
  /** 0-100. */
  progressPct: number;
}

/**
 * Two different pressures, depending on whether anyone else is there.
 *
 * Solo, position is meaningless — you are always first — so the build comes
 * purely from how close the board is to being cleared. In a real race, standing
 * dominates: being third with a half-open board should feel more dangerous than
 * being tenth with the same board, because it is.
 */
export function raceIntensity({ position, totalPlayers, progressPct }: RaceSnapshot): RaceIntensity {
  const progress = clamp(progressPct, 0, 100);

  if (totalPlayers <= 1) {
    if (progress >= 90) return 5;
    if (progress >= 70) return 4;
    if (progress >= 45) return 3;
    if (progress >= 20) return 2;
    return 1;
  }

  const place = clamp(position, 1, totalPlayers);
  // Leading is only the top of the mix once the lead actually means something;
  // first place ten seconds in is noise, not a position.
  if (place === 1 && progress >= 45) return 5;
  if (progress >= 90) return 5;

  // A podium only means something when there is a field to be on the podium of.
  // In a duel, "second of two" is last place, not a near miss — so in small
  // fields progress carries the build and standing barely registers.
  const PODIUM_NEEDS_A_FIELD = 6;
  if (totalPlayers >= PODIUM_NEEDS_A_FIELD && place <= 3) return 4;
  if (progress >= 70) return 4;

  const fraction = place / totalPlayers;
  if (fraction <= 0.34 || progress >= 45) return 3;
  if (fraction <= 0.67 || progress >= 20) return 2;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
