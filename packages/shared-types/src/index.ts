// -----------------------------------------------------------------------------
// SECTOR ZERO — shared realtime contracts between web client and game-server.
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
}

/** What every client sees about every OTHER player during a match — never the board. */
export interface PlayerProgress {
  id: PlayerId;
  username: string;
  rank: RankTier;
  progressPct: number;
  mistakes: number;
  streak: number;
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
  join_room: (payload: { roomId: RoomId; username: string; reconnectToken?: string }) => void;
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
  room_state: (payload: {
    roomId: RoomId;
    hostId: PlayerId;
    players: PublicPlayer[];
    settings: MatchSettings;
    state: GameState;
  }) => void;
  reconnect_token: (payload: { token: string }) => void;
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
  player_progress: (payload: { progress: PlayerProgress[] }) => void;
  player_finished: (payload: { playerId: PlayerId; placement: number; finishTimeMs: number }) => void;
  match_finished: (payload: { results: MatchResultRow[] }) => void;
  error_message: (payload: { code: string; message: string }) => void;
}
