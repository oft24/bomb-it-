// -----------------------------------------------------------------------------
// minesw1pe — shared realtime contracts between web client and game-server.
// This package intentionally has zero runtime deps: pure type + tiny const defs
// so it can be reused unchanged by a future Steam/desktop client.
// -----------------------------------------------------------------------------

export type PlayerId = string;
export type RoomId = string;
export type MatchId = string;

// --- Ranks (Sector Zero clearance tiers) -----------------------------------
export const RANK_TIERS = [
  "RECRUIT",
  "SCOUT",
  "OPERATIVE",
  "SPECIALIST",
  "VETERAN",
  "ELITE",
  "PHANTOM",
] as const;
export type RankTier = (typeof RANK_TIERS)[number];

// --- Modes -------------------------------------------------------------------
export type QueueMode = "QUICK_PLAY" | "RANKED" | "PRIVATE" | "TRAINING";

/** Governs what happens when a player detonates a hazard core. */
export type PenaltyMode = "RACE" | "CLASSIC_ELIMINATION" | "HARDCORE" | "CHAOS";

export interface MatchSettings {
  boardWidth: number;
  boardHeight: number;
  mineCount: number;
  maxPlayers: number;
  penaltyMode: PenaltyMode;
  penaltySeconds: number; // used when penaltyMode === "RACE"
  /**
   * How many detonations a player is forgiven with a time penalty. Exceeding it
   * wipes their board and restarts them from zero on the same grid. 0 disables
   * the rule (penalties stay forgiving forever).
   */
  maxMistakes: number;
  /**
   * Casino mode. Opening a cell first requires beating the house at a randomly
   * drawn table game (blackjack, roulette or dice). Lose and the click is
   * forfeited — the cell stays shut. The grid underneath is an ordinary board.
   */
  casinoMode: boolean;
  timeLimitSeconds: number | null;
  ranked: boolean;
  spectatorsAllowed: boolean;
  countdownSeconds: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  boardWidth: 24,
  boardHeight: 24,
  mineCount: 99,
  maxPlayers: 30,
  penaltyMode: "RACE",
  penaltySeconds: 3,
  maxMistakes: 5,
  casinoMode: false,
  timeLimitSeconds: null,
  ranked: false,
  spectatorsAllowed: true,
  countdownSeconds: 3,
};

// --- Board / cell state -------------------------------------------------------
/** What the server tells a client about a single cell it has interacted with. */
export interface CellResult {
  x: number;
  y: number;
  mine: boolean;
  adjacentMines: number; // meaningful only when mine === false
}

export type ClientCellState =
  | "closed"
  | "flagged"
  | { opened: true; adjacentMines: number }
  | "exploded";

// --- Match / room lifecycle ---------------------------------------------------
export type GameState =
  | "WAITING"
  | "LOBBY"
  | "COUNTDOWN"
  | "PLAYING"
  | "FINISHED"
  | "CANCELLED";

export type PlayerMatchState =
  | "CONNECTED"
  | "READY"
  | "PLAYING"
  | "PENALTY"
  | "FINISHED"
  | "ELIMINATED"
  | "DISCONNECTED";

export interface PublicPlayer {
  id: PlayerId;
  username: string;
  isHost: boolean;
  isReady: boolean;
  rank: RankTier;
  rating: number;
  level: number;
  ping: number;
  connected: boolean;
  /** Name-only player with no account: plays for real, but nothing is persisted. */
  isGuest: boolean;
}

/** What every client sees about every OTHER player during a match — never the board. */
export interface PlayerProgress {
  id: PlayerId;
  username: string;
  rank: RankTier;
  progressPct: number;
  mistakes: number;
  streak: number;
  /** Times this player blew past maxMistakes and got wiped back to zero. */
  resets: number;
  state: PlayerMatchState;
  finishTimeMs: number | null;
  placement: number | null;
}

export interface MatchResultRow {
  id: PlayerId;
  username: string;
  placement: number;
  finishTimeMs: number | null;
  mistakes: number;
  accuracyPct: number;
  ratingChange: number;
  xpGained: number;
}

// --- WebSocket event payloads (client -> server) ------------------------------
export interface ClientToServerEvents {
  /**
   * Two ways in, and exactly one must be supplied:
   *  - `accessToken`: a Supabase session token. The server verifies it and derives
   *    the player's identity (id/username/rating) from the matching profile.
   *  - `guestName`: a display name only. The server mints a throwaway identity;
   *    the match is played for real but nothing about it is persisted.
   *
   * `guestId` is echoed back from a previous `joined_room` so a guest who
   * reloads mid-match reconnects as the same player instead of a new one.
   */
  join_room: (payload: {
    roomId: RoomId;
    accessToken?: string;
    guestName?: string;
    guestId?: string;
  }) => void;
  leave_room: () => void;
  set_ready: (payload: { ready: boolean }) => void;
  update_settings: (payload: Partial<MatchSettings>) => void;
  start_match: () => void;
  reveal_cell: (payload: { x: number; y: number }) => void;
  flag_cell: (payload: { x: number; y: number; flagged: boolean }) => void;
  chord_cell: (payload: { x: number; y: number }) => void;
  request_rematch: () => void;
}

export interface ClientToServerAckEvents {
  /** Server-measured RTT probe; client just acks immediately, no payload needed. */
  ping_check: () => void;
}

// --- WebSocket event payloads (server -> client) ------------------------------
export interface ServerToClientEvents {
  /**
   * Confirms the join and tells the client which player it is. Guests can't know
   * this up front — the id is minted server-side — so nothing that depends on
   * "which row is me" should run before this arrives.
   */
  joined_room: (payload: { roomId: RoomId; playerId: PlayerId; isGuest: boolean }) => void;
  room_state: (payload: {
    roomId: RoomId;
    hostId: PlayerId;
    players: PublicPlayer[];
    settings: MatchSettings;
    state: GameState;
  }) => void;
  player_joined: (payload: { player: PublicPlayer }) => void;
  player_left: (payload: { playerId: PlayerId }) => void;
  match_countdown: (payload: { seconds: number }) => void;
  match_started: (payload: {
    matchId: MatchId;
    width: number;
    height: number;
    mineCount: number;
    startedAt: number;
    safeZone: { x: number; y: number }[];
  }) => void;
  cell_result: (payload: { cells: CellResult[] }) => void;
  cell_flagged: (payload: { x: number; y: number; flagged: boolean; minesRemaining: number }) => void;
  player_penalty: (payload: { playerId: PlayerId; seconds: number; reason: "MINE" }) => void;
  /**
   * Sent to a single player who exceeded maxMistakes: their board is wiped and
   * they restart from zero on the same grid. The client must clear every cell it
   * is showing and re-apply `safeZoneCells`, which the server has already reopened.
   */
  board_reset: (payload: {
    reason: "TOO_MANY_MISTAKES";
    mistakes: number;
    resets: number;
    safeZoneCells: CellResult[];
  }) => void;
  player_progress: (payload: { progress: PlayerProgress[] }) => void;
  player_finished: (payload: { playerId: PlayerId; placement: number; finishTimeMs: number }) => void;
  match_finished: (payload: { results: MatchResultRow[] }) => void;
  error_message: (payload: { code: string; message: string }) => void;
}
