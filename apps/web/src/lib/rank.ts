import type { RankTier } from "@sectorzero/shared-types";

export const RANK_COLOR: Record<RankTier, string> = {
  RECRUIT: "var(--color-rank-recruit)",
  SCOUT: "var(--color-rank-scout)",
  OPERATIVE: "var(--color-rank-operative)",
  SPECIALIST: "var(--color-rank-specialist)",
  VETERAN: "var(--color-rank-veteran)",
  ELITE: "var(--color-rank-elite)",
  PHANTOM: "var(--color-rank-phantom)",
};

export const RANK_LABEL: Record<RankTier, string> = {
  RECRUIT: "Recruit",
  SCOUT: "Scout",
  OPERATIVE: "Operative",
  SPECIALIST: "Specialist",
  VETERAN: "Veteran",
  ELITE: "Elite",
  PHANTOM: "Phantom",
};
