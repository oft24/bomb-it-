// Demo data for the /preview/* design-QA routes ONLY. A real match renders
// exclusively from server-pushed progress — nothing here ever reaches it.
import { RANK_TIERS } from "@sectorzero/shared-types";
import type {
  MatchResultRow,
  PlayerProgress,
  PublicPlayer,
  RankTier,
} from "@sectorzero/shared-types";

// Original callsigns for demo/preview data — never real usernames.
const CALLSIGNS = [
  "Nova", "Vector", "Akira", "Milo", "Sable", "Rook", "Wren", "Kestrel",
  "Onyx", "Halcyon", "Juno", "Static", "Cinder", "Fable", "Delta", "Rune",
  "Vega", "Ember", "Frost", "Lyric", "Nyx", "Orbit", "Piston", "Quartz",
  "Raze", "Slate", "Talon", "Umbra", "Vale", "Wisp",
];

function seededPick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

export function mockPlayers(count: number, localName = "You"): PublicPlayer[] {
  const players: PublicPlayer[] = Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}`,
    username: seededPick(CALLSIGNS, i) + (i >= CALLSIGNS.length ? String(i) : ""),
    isHost: i === 0,
    isReady: i % 4 !== 3,
    rank: seededPick(RANK_TIERS, i * 3 + 1) as RankTier,
    rating: 900 + ((i * 137) % 1100),
    level: 1 + ((i * 7) % 60),
    ping: 12 + ((i * 23) % 90),
    connected: i !== count - 2,
    isGuest: i % 3 === 1,
  }));
  players[Math.min(count - 1, 4)] = {
    ...players[Math.min(count - 1, 4)],
    id: "local-player",
    username: localName,
    isReady: true,
  };
  return players;
}

export function mockProgress(count: number, localName = "You"): PlayerProgress[] {
  return mockPlayers(count, localName)
    .map((p, i) => ({
      id: p.id,
      username: p.username,
      rank: p.rank,
      progressPct: Math.max(0, 92 - i * 3.1 + ((i * 13) % 7)),
      mistakes: i % 5,
      streak: (i * 3) % 20,
      resets: i % 7 === 3 ? 1 : 0,
      state: (i === count - 2 ? "DISCONNECTED" : i % 9 === 0 ? "PENALTY" : "PLAYING") as PlayerProgress["state"],
      finishTimeMs: null,
      placement: null,
    }))
    .sort((a, b) => b.progressPct - a.progressPct);
}

export function mockResults(count: number, localName = "You"): MatchResultRow[] {
  return mockPlayers(count, localName).map((p, i) => ({
    id: p.id,
    username: p.username,
    placement: i + 1,
    finishTimeMs: i < count - 3 ? 62_000 + i * 4300 + ((i * 91) % 900) : null,
    mistakes: i % 4,
    accuracyPct: Math.max(70, 100 - i * 1.4),
    ratingChange: Math.round(28 - i * 2.1),
    xpGained: Math.max(120, 520 - i * 14),
  }));
}
