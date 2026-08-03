import { create } from "zustand";
import { getSocket } from "@/lib/socket";
import type {
  GameState,
  MatchResultRow,
  MatchSettings,
  PlayerProgress,
  PublicPlayer,
} from "@sectorzero/shared-types";
import { DEFAULT_MATCH_SETTINGS } from "@sectorzero/shared-types";

export type ClientCellStatus = "closed" | "flagged" | "opened" | "exploded";
export interface ClientCell {
  status: ClientCellStatus;
  adjacentMines?: number;
}

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
  username: string;
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

  connectAndJoin: (roomId: string, username: string) => void;
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

    socket.on("reconnect_token", ({ playerId }) => {
      set({ localPlayerId: playerId });
    });

    socket.on("room_state", ({ hostId, players, settings, state }) => {
      set({ hostId, players, settings, gameState: state, connectionStatus: "connected" });
    });

    socket.on("match_countdown", ({ seconds }) => {
      set({ countdown: seconds });
    });

    socket.on("match_started", (payload) => {
      set({
        matchInfo: payload,
        cells: {},
        flaggedCount: 0,
        countdown: null,
        results: null,
        localPenaltySeconds: null,
        gameState: "PLAYING",
      });
    });

    socket.on("cell_result", ({ cells }) => {
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
      set((state) => {
        const next = { ...state.cells };
        const key = cellKey(x, y);
        next[key] = flagged ? { status: "flagged" } : { status: "closed" };
        return { cells: next, flaggedCount: state.matchInfo ? state.matchInfo.mineCount - minesRemaining : 0 };
      });
    });

    socket.on("player_penalty", ({ playerId }) => {
      const { localPlayerId } = get();
      if (playerId === localPlayerId) {
        set((state) => ({ localPenaltySeconds: 3, penaltyTick: state.penaltyTick + 1 }));
      }
    });

    socket.on("player_progress", ({ progress }) => {
      set({ progress });
    });

    socket.on("match_finished", ({ results }) => {
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
    username: "",
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

    connectAndJoin: (roomId, username) => {
      ensureListeners();
      const socket = getSocket();
      set({ connectionStatus: "connecting", roomId: roomId.toUpperCase(), username });
      if (!socket.connected) socket.connect();
      const doJoin = () => socket.emit("join_room", { roomId: roomId.toUpperCase(), username });
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
