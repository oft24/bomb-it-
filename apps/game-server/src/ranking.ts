import { RANK_TIERS, type RankTier } from "@sectorzero/shared-types";

const RANK_THRESHOLDS: Array<{ tier: RankTier; min: number }> = [
  { tier: "RECRUIT", min: 0 },
  { tier: "SCOUT", min: 800 },
  { tier: "OPERATIVE", min: 1000 },
  { tier: "SPECIALIST", min: 1200 },
  { tier: "VETERAN", min: 1400 },
  { tier: "ELITE", min: 1600 },
  { tier: "PHANTOM", min: 1800 },
];

export function rankForRating(rating: number): RankTier {
  let tier: RankTier = RANK_TIERS[0];
  for (const entry of RANK_THRESHOLDS) {
    if (rating >= entry.min) tier = entry.tier;
  }
  return tier;
}

/**
 * Multiplayer-adapted Elo for N-player races (no naive 1v1 pairing).
 * - `score` is the player's normalized finishing position: 1 for 1st, 0 for last.
 * - `expected` is a logistic function of the player's rating vs the field average,
 *   the same shape as classic Elo's expected-score curve.
 * - K scales the swing; unranked/casual matches don't call this at all.
 */
export function computeRatingDelta(params: {
  placement: number;
  totalPlayers: number;
  playerRating: number;
  fieldAverageRating: number;
  didFinish: boolean;
}): number {
  const { placement, totalPlayers, playerRating, fieldAverageRating, didFinish } = params;
  if (totalPlayers <= 1) return 0;

  const K = 32;
  const score = didFinish ? 1 - (placement - 1) / (totalPlayers - 1) : 0;
  const expected = 1 / (1 + Math.pow(10, (fieldAverageRating - playerRating) / 400));
  const delta = K * (score - expected);
  return Math.round(delta);
}

/** Flat 1000 XP per level — simple and predictable, tune later once real match data exists. */
export function levelForXp(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

export function computeXpGained(params: {
  placement: number;
  totalPlayers: number;
  accuracyPct: number;
  didFinish: boolean;
}): number {
  const { placement, totalPlayers, accuracyPct, didFinish } = params;
  const base = 100;
  const placementBonus = didFinish
    ? Math.round(400 * (1 - (placement - 1) / Math.max(1, totalPlayers - 1)))
    : 0;
  const accuracyBonus = Math.round((accuracyPct / 100) * 150);
  return base + placementBonus + accuracyBonus;
}
