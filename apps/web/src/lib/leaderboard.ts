import type { PlayerProgress } from "@sectorzero/shared-types";

const STATE_TIER: Partial<Record<PlayerProgress["state"], number>> = {
  FINISHED: 0,
  PLAYING: 1,
  PENALTY: 1,
  DISCONNECTED: 2,
  ELIMINATED: 3,
};

/** Ranks the live field: finishers by placement, everyone else by progress. */
export function rankPlayers(progress: PlayerProgress[]): PlayerProgress[] {
  return [...progress].sort((a, b) => {
    const tierA = STATE_TIER[a.state] ?? 1;
    const tierB = STATE_TIER[b.state] ?? 1;
    if (tierA !== tierB) return tierA - tierB;
    if (a.state === "FINISHED" && b.state === "FINISHED") {
      return (a.placement ?? 0) - (b.placement ?? 0);
    }
    if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
    return a.mistakes - b.mistakes;
  });
}
