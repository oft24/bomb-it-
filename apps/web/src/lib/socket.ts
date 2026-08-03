import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@sectorzero/shared-types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";

let socket: GameSocket | null = null;

/** Lazily creates the single Socket.IO connection reused across route changes. */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: false, transports: ["websocket"] });
  }
  return socket;
}
