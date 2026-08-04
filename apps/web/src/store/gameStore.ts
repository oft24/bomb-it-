import { create } from "zustand";
import { getSocket } from "@/lib/socket";
import { getGuestId } from "@/lib/guestIdentity";
import type {
  GameState,
  MatchResultRow,
  MatchSettings,
  PlayerProgress,
  PublicPlayer,
} from "@sectorzero/shared-types";
import { DEFAULT_MATCH_SETTINGS } from "@sectorzero/shared-types";
import { getGameAudio } from "@/lib/gameAudio";

export type ClientCellStatus = "closed" | "flagged" | "opened" | "exploded";
export interface ClientCell {
  status: ClientCellStatus;
  adjacentMines?: number;
}

/** Either a signed-in session token or a guest display name — never both. */
export type JoinIdentity =
  | { kind: "account"; accessToken: string; playerId: string }
  | { kind: "guest"; guestName: string };

export interface MatchInfo {
  matchId: string;
  width: number;
  height: number;
  mineCount: number;
  startedAt: number;
  safeZone: { x: number; y: number }[];
}

interface GameStoreState {
  connectionStatus: "idle" | "connecting" | "connected" | "error";
  roomId: string | null;
  hostId: string | null;
  localPlayerId: string | null;
  players: PublicPlayer[];
  settings: MatchSettings;
  gameState: GameState;
  countdown: number | null;

  matchInfo: MatchInfo | null;
  cells: Record<string, ClientCell>;
  flaggedCount: number;
  progress: PlayerProgress[];
  localPenaltySeconds: number | null;
  penaltyTick: number;
  results: MatchResultRow[] | null;
  errorMessage: string | null;
  /** Detonations on the current run — resets to 0 every time the board is wiped. */
  mistakes: number;
  resets: number;
  /** Bumped on every wipe so the UI can fire a one-shot "you got wiped" overlay. */
  resetTick: number;

  connectAndJoin: (roomId: string, identity: JoinIdentity) => void;
  setReady: (ready: boolean) => void;
  updateSettings: (partial: Partial<MatchSettings>) => void;
  startMatch: () => void;
  reveal: (x: number, y: number) => void;
  flag: (x: number, y: number, flagged: boolean) => void;
  chord: (x: number, y: number) => void;
  requestRematch: () => void;
  leaveRoom: () => void;
  clearError: () => void;
}

let listenersAttached = false;

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  function ensureListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    const socket = getSocket();

    socket.on("joined_room", ({ roomId, playerId }) => {
      set({ roomId, localPlayerId: playerId, connectionStatus: "connected" });
    });

    socket.on("room_state", ({ hostId, players, settings, state }) => {
      set({ hostId, players, settings, gameState: state, connectionStatus: "connected" });
    });

    socket.on("match_countdown", ({ seconds }) => {
      getGameAudio().countdown(seconds);
      set({ countdown: seconds });
    });

    socket.on("match_started", (payload) => {
      getGameAudio().startMusic();
      set({
        matchInfo: payload,
        cells: {},
        flaggedCount: 0,
        countdown: null,
        results: null,
        localPenaltySeconds: null,
        mistakes: 0,
        resets: 0,
        gameState: "PLAYING",
      });
    });

    socket.on("cell_result", ({ cells }) => {
      if (cells.some((cell) => cell.mine)) getGameAudio().explosion();
      else if (cells.length > 0) getGameAudio().tileReveal();
      set((state) => {
        const next = { ...state.cells };
        for (const c of cells) {
          next[cellKey(c.x, c.y)] = c.mine
            ? { status: "exploded" }
            : { status: "opened", adjacentMines: c.adjacentMines };
        }
        return { cells: next };
      });
    });

    socket.on("cell_flagged", ({ x, y, flagged, minesRemaining }) => {
      getGameAudio().flag(flagged);
      set((state) => {
        const next = { ...state.cells };
        const key = cellKey(x, y);
        next[key] = flagged ? { status: "flagged" } : { status: "closed" };
        return { cells: next, flaggedCount: state.matchInfo ? state.matchInfo.mineCount - minesRemaining : 0 };
      });
    });

    socket.on("player_penalty", ({ playerId, seconds }) => {
      const { localPlayerId } = get();
      if (playerId === localPlayerId) {
        set((state) => ({
          localPenaltySeconds: seconds,
          penaltyTick: state.penaltyTick + 1,
          mistakes: state.mistakes + 1,
        }));
      }
    });

    socket.on("board_reset", ({ resets, safeZoneCells }) => {
      // The server already threw this player's board away — mirror that exactly
      // rather than merging, or stale opened cells would linger on the grid.
      const cells: Record<string, ClientCell> = {};
      for (const c of safeZoneCells) {
        cells[cellKey(c.x, c.y)] = { status: "opened", adjacentMines: c.adjacentMines };
      }
      set((state) => ({
        cells,
        flaggedCount: 0,
        mistakes: 0,
        resets,
        resetTick: state.resetTick + 1,
        localPenaltySeconds: null,
      }));
    });

    socket.on("player_progress", ({ progress }) => {
      set({ progress });
    });

    socket.on("match_finished", ({ results }) => {
      const local = results.find((result) => result.id === get().localPlayerId);
      if (local?.placement === 1) getGameAudio().victory(); else getGameAudio().lose();
      set({ results, gameState: "FINISHED" });
    });

    socket.on("error_message", ({ message }) => {
      set({ errorMessage: message });
    });

    socket.on("connect", () => set({ connectionStatus: "connected" }));
    socket.on("disconnect", () => set({ connectionStatus: "error" }));
  }

  return {
    connectionStatus: "idle",
    roomId: null,
    hostId: null,
    localPlayerId: null,
    players: [],
    settings: DEFAULT_MATCH_SETTINGS,
    gameState: "LOBBY",
    countdown: null,

    matchInfo: null,
    cells: {},
    flaggedCount: 0,
    progress: [],
    localPenaltySeconds: null,
    penaltyTick: 0,
    results: null,
    errorMessage: null,
    mistakes: 0,
    resets: 0,
    resetTick: 0,

    connectAndJoin: (roomId, identity) => {
      ensureListeners();
      const socket = getSocket();
      const code = roomId.toUpperCase();
      set({
        connectionStatus: "connecting",
        roomId: code,
        // A guest's id is minted server-side; `joined_room` fills it in.
        localPlayerId: identity.kind === "account" ? identity.playerId : null,
        errorMessage: null,
      });
      if (!socket.connected) socket.connect();

      const doJoin = () =>
        socket.emit(
          "join_room",
          identity.kind === "account"
            ? { roomId: code, accessToken: identity.accessToken }
            : { roomId: code, guestName: identity.guestName, guestId: getGuestId() },
        );
      if (socket.connected) doJoin();
      else socket.once("connect", doJoin);
    },

    setReady: (ready) => getSocket().emit("set_ready", { ready }),
    updateSettings: (partial) => getSocket().emit("update_settings", partial),
    startMatch: () => getSocket().emit("start_match"),
    reveal: (x, y) => getSocket().emit("reveal_cell", { x, y }),
    flag: (x, y, flagged) => getSocket().emit("flag_cell", { x, y, flagged }),
    chord: (x, y) => getSocket().emit("chord_cell", { x, y }),
    requestRematch: () => getSocket().emit("request_rematch"),
    leaveRoom: () => {
      getSocket().emit("leave_room");
      set({
        roomId: null,
        players: [],
        matchInfo: null,
        cells: {},
        progress: [],
        results: null,
        gameState: "LOBBY",
      });
    },
    clearError: () => set({ errorMessage: null }),
  };
});
