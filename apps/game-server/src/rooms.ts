import type { Server, Socket } from "socket.io";
import {
  generateBoard,
  defaultSafeZone,
  generateMatchSeed,
  PlayerBoardState,
  type Board,
} from "@sectorzero/game-core";
import {
  DEFAULT_MATCH_SETTINGS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type MatchSettings,
  type GameState,
  type PlayerMatchState,
  type PublicPlayer,
  type PlayerProgress,
  type MatchResultRow,
  type RoomId,
  type PlayerId,
} from "@sectorzero/shared-types";
import { generateMatchId } from "./ids.js";
import { computeRatingDelta, computeXpGained, levelForXp, rankForRating } from "./ranking.js";
import { prisma } from "./db.js";
import type { AuthedProfile } from "./auth.js";

export type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const DISCONNECT_GRACE_MS = 25_000;
const FINISH_GRACE_MS = 25_000;
const RATE_LIMIT_ACTIONS_PER_SEC = 20;

interface PlayerSession {
  /**
   * For an account, equals the Supabase auth user id — identity is proven by the
   * access token, not by this being a secret. For a guest, a random `guest:<uuid>`
   * minted at join time and valid only for the life of this room.
   */
  id: PlayerId;
  username: string;
  isGuest: boolean;
  socketId: string | null;
  connected: boolean;
  isReady: boolean;
  rating: number;
  level: number;
  xp: number;
  ping: number;
  disconnectTimer: NodeJS.Timeout | null;
  actionTimestamps: number[];
}

interface MatchPlayerRuntime {
  boardState: PlayerBoardState;
  state: PlayerMatchState;
  finishTimeMs: number | null;
  placement: number | null;
  penaltyTimer: NodeJS.Timeout | null;
  ratingAtStart: number;
  /** Wipes suffered for exceeding maxMistakes. */
  resets: number;
  /** Mistakes from previous runs — boardState only counts the current one. */
  mistakesBeforeReset: number;
}

interface MatchRuntime {
  id: string;
  board: Board;
  seed: string;
  startedAt: number;
  safeZone: { x: number; y: number }[];
  runtime: Map<PlayerId, MatchPlayerRuntime>;
  finishedCount: number;
  fieldAverageRating: number;
  graceTimer: NodeJS.Timeout | null;
  ended: boolean;
}

export class GameRoom {
  readonly id: RoomId;
  hostId: PlayerId | null = null;
  state: GameState = "LOBBY";
  settings: MatchSettings = { ...DEFAULT_MATCH_SETTINGS };
  players = new Map<PlayerId, PlayerSession>();
  match: MatchRuntime | null = null;

  constructor(
    id: RoomId,
    private readonly io: IOServer,
  ) {
    this.id = id;
  }

  private toPublicPlayer(p: PlayerSession): PublicPlayer {
    return {
      id: p.id,
      username: p.username,
      isHost: p.id === this.hostId,
      isReady: p.isReady,
      rank: rankForRating(p.rating),
      rating: p.rating,
      level: p.level,
      ping: p.ping,
      connected: p.connected,
      isGuest: p.isGuest,
    };
  }

  broadcastRoomState() {
    this.io.to(this.id).emit("room_state", {
      roomId: this.id,
      hostId: this.hostId ?? "",
      players: Array.from(this.players.values()).map((p) => this.toPublicPlayer(p)),
      settings: this.settings,
      state: this.state,
    });
  }

  private sendError(socket: IOSocket, code: string, message: string) {
    socket.emit("error_message", { code, message });
  }

  private checkRateLimit(session: PlayerSession): boolean {
    const now = Date.now();
    session.actionTimestamps = session.actionTimestamps.filter((t) => now - t < 1000);
    if (session.actionTimestamps.length >= RATE_LIMIT_ACTIONS_PER_SEC) return false;
    session.actionTimestamps.push(now);
    return true;
  }

  // --- lifecycle -------------------------------------------------------------

  /** profile.id is a Supabase-verified identity, so reconnecting is just "same id shows back up". */
  addOrReconnectPlayer(socket: IOSocket, profile: AuthedProfile): PlayerSession {
    const existing = this.players.get(profile.id);
    if (existing) {
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
      }
      existing.socketId = socket.id;
      existing.connected = true;
      existing.username = profile.username;
      const runtime = this.match?.runtime.get(existing.id);
      if (runtime && runtime.state === "DISCONNECTED") {
        runtime.state = "PLAYING";
      }
      return existing;
    }

    const session: PlayerSession = {
      id: profile.id,
      username: profile.username,
      isGuest: profile.isGuest,
      socketId: socket.id,
      connected: true,
      isReady: false,
      rating: profile.rating,
      level: profile.level,
      xp: profile.xp,
      ping: 0,
      disconnectTimer: null,
      actionTimestamps: [],
    };
    this.players.set(session.id, session);
    if (!this.hostId) this.hostId = session.id;
    return session;
  }

  handleDisconnect(playerId: PlayerId) {
    const session = this.players.get(playerId);
    if (!session) return;
    session.connected = false;

    const runtime = this.match?.runtime.get(playerId);
    if (runtime && (runtime.state === "PLAYING" || runtime.state === "PENALTY")) {
      runtime.state = "DISCONNECTED";
    }
    this.broadcastRoomState();
    if (this.match) this.broadcastProgress();

    session.disconnectTimer = setTimeout(() => {
      if (session.connected) return;
      this.players.delete(playerId);
      if (this.hostId === playerId) {
        const next = Array.from(this.players.values())[0];
        this.hostId = next ? next.id : null;
      }
      this.broadcastRoomState();
    }, DISCONNECT_GRACE_MS);
  }

  setReady(playerId: PlayerId, ready: boolean) {
    const session = this.players.get(playerId);
    if (!session || this.state !== "LOBBY") return;
    session.isReady = ready;
    this.broadcastRoomState();
  }

  updateSettings(playerId: PlayerId, partial: Partial<MatchSettings>) {
    if (playerId !== this.hostId || this.state !== "LOBBY") return;
    const width = clamp(partial.boardWidth ?? this.settings.boardWidth, 9, 40);
    const height = clamp(partial.boardHeight ?? this.settings.boardHeight, 9, 40);
    const maxMines = width * height - 9; // 3x3 safe zone always reserved
    this.settings = {
      ...this.settings,
      ...partial,
      boardWidth: width,
      boardHeight: height,
      mineCount: clamp(partial.mineCount ?? this.settings.mineCount, 1, maxMines),
      maxMistakes: clamp(partial.maxMistakes ?? this.settings.maxMistakes, 0, 50),
      casinoMode: Boolean(partial.casinoMode ?? this.settings.casinoMode),
      maxPlayers: clamp(partial.maxPlayers ?? this.settings.maxPlayers, 1, 30),
      countdownSeconds: clamp(partial.countdownSeconds ?? this.settings.countdownSeconds, 0, 10),
    };
    this.broadcastRoomState();
  }

  // --- match lifecycle ---------------------------------------------------------

  startMatch(playerId: PlayerId) {
    if (playerId !== this.hostId || this.state !== "LOBBY") return;
    if (this.players.size < 1) return;

    this.state = "COUNTDOWN";
    this.broadcastRoomState();

    let remaining = this.settings.countdownSeconds;
    const tick = () => {
      this.io.to(this.id).emit("match_countdown", { seconds: remaining });
      if (remaining <= 0) {
        this.beginMatch();
        return;
      }
      remaining -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }

  private beginMatch() {
    const seed = generateMatchSeed();
    const safeZone = defaultSafeZone(this.settings.boardWidth, this.settings.boardHeight);
    const board = generateBoard({
      width: this.settings.boardWidth,
      height: this.settings.boardHeight,
      mineCount: this.settings.mineCount,
      seed,
      safeZone,
    });

    const connectedPlayers = Array.from(this.players.values()).filter((p) => p.connected);
    const fieldAverageRating =
      connectedPlayers.reduce((sum, p) => sum + p.rating, 0) / Math.max(1, connectedPlayers.length);

    const runtime = new Map<PlayerId, MatchPlayerRuntime>();
    for (const p of connectedPlayers) {
      runtime.set(p.id, {
        boardState: new PlayerBoardState(board),
        state: "PLAYING",
        finishTimeMs: null,
        placement: null,
        penaltyTimer: null,
        ratingAtStart: p.rating,
        resets: 0,
        mistakesBeforeReset: 0,
      });
    }

    this.match = {
      id: generateMatchId(),
      board,
      seed,
      startedAt: Date.now(),
      safeZone,
      runtime,
      finishedCount: 0,
      fieldAverageRating,
      graceTimer: null,
      ended: false,
    };
    this.state = "PLAYING";

    this.io.to(this.id).emit("match_started", {
      matchId: this.match.id,
      width: board.width,
      height: board.height,
      mineCount: board.mineCount,
      startedAt: this.match.startedAt,
      safeZone,
    });

    // The shared safe zone is guaranteed mine-free — open it for everyone immediately.
    for (const [playerId, rt] of runtime) {
      const cells = this.openSafeZoneFor(playerId, rt);
      const socket = this.socketFor(playerId);
      if (socket && cells.length > 0) socket.emit("cell_result", { cells });
    }

    this.broadcastProgress();
  }

  private socketFor(playerId: PlayerId): IOSocket | undefined {
    const session = this.players.get(playerId);
    if (!session?.socketId) return undefined;
    return this.io.sockets.sockets.get(session.socketId) as IOSocket | undefined;
  }

  handleReveal(socket: IOSocket, playerId: PlayerId, x: number, y: number) {
    const session = this.players.get(playerId);
    const match = this.match;
    if (!session || !match || this.state !== "PLAYING") return;
    if (!this.checkRateLimit(session)) return;
    const rt = match.runtime.get(playerId);
    if (!rt || rt.state !== "PLAYING") return;
    if (!inBounds(match.board, x, y)) return;

    const { cells, hitMine } = rt.boardState.reveal(x, y);
    if (cells.length === 0) return;
    socket.emit("cell_result", { cells });

    if (hitMine) {
      this.applyMinePenalty(playerId, rt);
    } else if (rt.boardState.hasWon()) {
      this.finishPlayer(playerId, rt);
    }
    this.broadcastProgress();
  }

  handleChord(socket: IOSocket, playerId: PlayerId, x: number, y: number) {
    const session = this.players.get(playerId);
    const match = this.match;
    if (!session || !match || this.state !== "PLAYING") return;
    if (!this.checkRateLimit(session)) return;
    const rt = match.runtime.get(playerId);
    if (!rt || rt.state !== "PLAYING") return;
    if (!inBounds(match.board, x, y)) return;

    const { cells, hitMine } = rt.boardState.chord(x, y);
    if (cells.length === 0) return;
    socket.emit("cell_result", { cells });

    if (hitMine) {
      this.applyMinePenalty(playerId, rt);
    } else if (rt.boardState.hasWon()) {
      this.finishPlayer(playerId, rt);
    }
    this.broadcastProgress();
  }

  handleFlag(socket: IOSocket, playerId: PlayerId, x: number, y: number, flagged: boolean) {
    const session = this.players.get(playerId);
    const match = this.match;
    if (!session || !match || this.state !== "PLAYING") return;
    if (!this.checkRateLimit(session)) return;
    const rt = match.runtime.get(playerId);
    if (!rt || rt.state !== "PLAYING") return;
    if (!inBounds(match.board, x, y)) return;

    const changed = rt.boardState.setFlag(x, y, flagged);
    if (!changed) return;
    const minesRemaining = match.board.mineCount - rt.boardState.flagCount();
    socket.emit("cell_flagged", { x, y, flagged, minesRemaining });
  }

  private applyMinePenalty(playerId: PlayerId, rt: MatchPlayerRuntime) {
    const mode = this.settings.penaltyMode;

    if (mode === "CLASSIC_ELIMINATION" || mode === "HARDCORE") {
      rt.state = "ELIMINATED";
      this.io.to(this.id).emit("player_penalty", { playerId, seconds: 0, reason: "MINE" });
      this.maybeFinishMatch();
      return;
    }

    // Past the forgiveness budget there's no time penalty to serve — the run is
    // wiped and they start the same grid over from nothing.
    const { maxMistakes } = this.settings;
    if (maxMistakes > 0 && rt.boardState.mistakes > maxMistakes) {
      this.resetPlayerBoard(playerId, rt);
      return;
    }

    const seconds = mode === "CHAOS" ? 1 : this.settings.penaltySeconds;
    rt.state = "PENALTY";
    this.io.to(this.id).emit("player_penalty", { playerId, seconds, reason: "MINE" });

    if (rt.penaltyTimer) clearTimeout(rt.penaltyTimer);
    rt.penaltyTimer = setTimeout(() => {
      if (rt.state === "PENALTY") rt.state = "PLAYING";
      this.broadcastProgress();
    }, seconds * 1000);
  }

  /** Opens the guaranteed mine-free starting pocket and pushes it to the player. */
  private openSafeZoneFor(playerId: PlayerId, rt: MatchPlayerRuntime) {
    const match = this.match;
    if (!match) return [];
    const { cells } = rt.boardState.reveal(match.safeZone[0].x, match.safeZone[0].y);
    return cells;
  }

  /**
   * Wipes a player's progress after they burn through the mistake budget. The
   * grid itself is untouched — every racer must stay on the same board — so only
   * this player's revealed/flagged state is thrown away and rebuilt.
   */
  private resetPlayerBoard(playerId: PlayerId, rt: MatchPlayerRuntime) {
    const match = this.match;
    if (!match) return;

    if (rt.penaltyTimer) {
      clearTimeout(rt.penaltyTimer);
      rt.penaltyTimer = null;
    }
    rt.mistakesBeforeReset += rt.boardState.mistakes;
    rt.resets += 1;
    rt.boardState = new PlayerBoardState(match.board);
    rt.state = "PLAYING";

    const safeZoneCells = this.openSafeZoneFor(playerId, rt);
    this.socketFor(playerId)?.emit("board_reset", {
      reason: "TOO_MANY_MISTAKES",
      mistakes: rt.mistakesBeforeReset,
      resets: rt.resets,
      safeZoneCells,
    });
    // Deliberately no `player_penalty` here: a wipe is not a timed penalty, and
    // the rest of the room learns about it from the progress broadcast instead.
    this.broadcastProgress();
  }

  private finishPlayer(playerId: PlayerId, rt: MatchPlayerRuntime) {
    const match = this.match;
    if (!match || rt.state === "FINISHED") return;
    rt.state = "FINISHED";
    rt.finishTimeMs = Date.now() - match.startedAt;
    rt.placement = ++match.finishedCount;

    this.io.to(this.id).emit("player_finished", {
      playerId,
      placement: rt.placement,
      finishTimeMs: rt.finishTimeMs,
    });

    if (rt.placement === 1 && !match.graceTimer) {
      match.graceTimer = setTimeout(() => this.endMatch(), FINISH_GRACE_MS);
    }
    this.maybeFinishMatch();
  }

  private maybeFinishMatch() {
    const match = this.match;
    if (!match || match.ended) return;
    const stillActive = Array.from(match.runtime.values()).some(
      (rt) => rt.state === "PLAYING" || rt.state === "PENALTY",
    );
    if (!stillActive) this.endMatch();
  }

  private endMatch() {
    const match = this.match;
    if (!match || match.ended) return;
    match.ended = true;
    if (match.graceTimer) clearTimeout(match.graceTimer);

    const entries = Array.from(match.runtime.entries());
    const totalPlayers = entries.length;

    // Anyone still mid-race when the match closes is ranked by progress, after all finishers.
    const unfinished = entries
      .filter(([, rt]) => rt.state !== "FINISHED")
      .sort((a, b) => b[1].boardState.progressPct() - a[1].boardState.progressPct());
    let nextPlacement = match.finishedCount + 1;
    for (const [, rt] of unfinished) {
      rt.placement = nextPlacement++;
    }

    const results: MatchResultRow[] = entries
      .sort((a, b) => (a[1].placement ?? Infinity) - (b[1].placement ?? Infinity))
      .map(([playerId, rt]) => {
        const session = this.players.get(playerId);
        const opened = rt.boardState.revealedNonMineCount();
        const totalMistakes = rt.mistakesBeforeReset + rt.boardState.mistakes;
        const accuracyPct = opened + totalMistakes > 0
          ? (opened / (opened + totalMistakes)) * 100
          : 100;
        const didFinish = rt.state === "FINISHED";
        const ratingChange = this.settings.ranked
          ? computeRatingDelta({
              placement: rt.placement ?? totalPlayers,
              totalPlayers,
              playerRating: rt.ratingAtStart,
              fieldAverageRating: match.fieldAverageRating,
              didFinish,
            })
          : 0;
        const xpGained = computeXpGained({
          placement: rt.placement ?? totalPlayers,
          totalPlayers,
          accuracyPct,
          didFinish,
        });
        if (session) {
          session.rating += ratingChange;
          session.xp += xpGained;
          session.level = levelForXp(session.xp);
        }

        return {
          id: playerId,
          username: session?.username ?? "UNKNOWN",
          placement: rt.placement ?? totalPlayers,
          finishTimeMs: rt.finishTimeMs,
          mistakes: totalMistakes,
          accuracyPct: Math.round(accuracyPct * 10) / 10,
          ratingChange,
          xpGained,
        } satisfies MatchResultRow;
      });

    this.state = "FINISHED";
    this.io.to(this.id).emit("match_finished", { results });

    // Fire-and-forget: players already have their results, a DB hiccup shouldn't block them.
    this.persistMatch(match, results).catch((err) => {
      console.error(`[room ${this.id}] failed to persist match ${match.id}:`, err);
    });
  }

  private async persistMatch(match: MatchRuntime, results: MatchResultRow[]) {
    if (!prisma) return;

    // Guests have no `profiles` row to point a foreign key at, and by design
    // leave no trace. Their results were already delivered over the socket.
    const persistable = results.filter((r) => !this.players.get(r.id)?.isGuest);
    if (persistable.length === 0) return;

    await prisma.match.create({
      data: {
        id: match.id,
        seed: match.seed,
        width: match.board.width,
        height: match.board.height,
        mineCount: match.board.mineCount,
        penaltyMode: this.settings.penaltyMode,
        ranked: this.settings.ranked,
        startedAt: new Date(match.startedAt),
        finishedAt: new Date(),
        players: {
          create: persistable.map((r) => ({
            profileId: r.id,
            username: r.username,
            placement: r.placement,
            finishTimeMs: r.finishTimeMs,
            mistakes: r.mistakes,
            accuracyPct: r.accuracyPct,
            ratingChange: r.ratingChange,
            xpGained: r.xpGained,
          })),
        },
      },
    });

    await Promise.all(
      persistable.map((r) => {
        const session = this.players.get(r.id);
        if (!session) return Promise.resolve();
        return prisma!.profile.update({
          where: { id: r.id },
          data: { rating: session.rating, xp: session.xp, level: session.level },
        });
      }),
    );
  }

  broadcastProgress() {
    const match = this.match;
    if (!match) return;
    const progress: PlayerProgress[] = Array.from(match.runtime.entries()).map(([playerId, rt]) => {
      const session = this.players.get(playerId);
      return {
        id: playerId,
        username: session?.username ?? "UNKNOWN",
        rank: rankForRating(session?.rating ?? 1000),
        progressPct: Math.round(rt.boardState.progressPct() * 10) / 10,
        mistakes: rt.mistakesBeforeReset + rt.boardState.mistakes,
        streak: rt.boardState.streak,
        resets: rt.resets,
        state: rt.state,
        finishTimeMs: rt.finishTimeMs,
        placement: rt.placement,
      };
    });
    this.io.to(this.id).emit("player_progress", { progress });
  }

  requestRematch(playerId: PlayerId) {
    if (playerId !== this.hostId || this.state !== "FINISHED") return;
    this.match = null;
    this.state = "LOBBY";
    for (const p of this.players.values()) p.isReady = false;
    this.broadcastRoomState();
  }

  /** Rebuilds a reconnecting client's board view from server-held state. */
  syncMatchStateTo(socket: IOSocket, playerId: PlayerId) {
    const match = this.match;
    const rt = match?.runtime.get(playerId);
    if (!match || !rt) return;

    socket.emit("match_started", {
      matchId: match.id,
      width: match.board.width,
      height: match.board.height,
      mineCount: match.board.mineCount,
      startedAt: match.startedAt,
      safeZone: match.safeZone,
    });

    const cells: { x: number; y: number; mine: boolean; adjacentMines: number }[] = [];
    for (let y = 0; y < match.board.height; y++) {
      for (let x = 0; x < match.board.width; x++) {
        if (rt.boardState.isRevealed(x, y)) {
          const value = match.board.cells[y * match.board.width + x];
          cells.push({ x, y, mine: value === -1, adjacentMines: Math.max(0, value) });
        }
      }
    }
    if (cells.length > 0) socket.emit("cell_result", { cells });

    for (let y = 0; y < match.board.height; y++) {
      for (let x = 0; x < match.board.width; x++) {
        if (rt.boardState.isFlagged(x, y)) {
          socket.emit("cell_flagged", {
            x,
            y,
            flagged: true,
            minesRemaining: match.board.mineCount - rt.boardState.flagCount(),
          });
        }
      }
    }

    this.broadcastProgress();
  }

  updatePing(playerId: PlayerId, rtt: number) {
    const session = this.players.get(playerId);
    if (session) session.ping = rtt;
  }

  isEmpty(): boolean {
    return Array.from(this.players.values()).every((p) => !p.connected);
  }
}

function inBounds(board: Board, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < board.width && y >= 0 && y < board.height;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class RoomManager {
  private rooms = new Map<RoomId, GameRoom>();

  constructor(private readonly io: IOServer) {}

  get(roomId: RoomId): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getOrCreate(roomId: RoomId): GameRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new GameRoom(roomId, this.io);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  sweepEmptyRooms() {
    for (const [id, room] of this.rooms) {
      if (room.isEmpty() && room.players.size === 0) this.rooms.delete(id);
    }
  }
}
