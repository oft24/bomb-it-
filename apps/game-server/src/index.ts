import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@sectorzero/shared-types";
import { RoomManager, type IOSocket } from "./rooms.js";
import { generateRoomCode } from "./ids.js";

const PORT = Number(process.env.PORT ?? 4001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/rooms/new-code", (_req, res) => res.json({ code: generateRoomCode() }));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

const roomManager = new RoomManager(io);

interface SocketState {
  roomId: string;
  playerId: string;
}
const socketState = new WeakMap<IOSocket, SocketState>();

io.on("connection", (socket: IOSocket) => {
  socket.on("join_room", ({ roomId, username, reconnectToken }) => {
    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!normalizedRoomId || !username?.trim()) {
      socket.emit("error_message", { code: "INVALID_JOIN", message: "Room code and username are required." });
      return;
    }

    const room = roomManager.getOrCreate(normalizedRoomId);
    if (room.state !== "LOBBY" && !reconnectToken) {
      socket.emit("error_message", { code: "MATCH_IN_PROGRESS", message: "This match has already started." });
      return;
    }
    if (room.players.size >= room.settings.maxPlayers && !reconnectToken) {
      socket.emit("error_message", { code: "ROOM_FULL", message: "This room is full." });
      return;
    }

    const session = room.addOrReconnectPlayer(socket, username, reconnectToken);
    socketState.set(socket, { roomId: normalizedRoomId, playerId: session.id });
    socket.join(normalizedRoomId);

    socket.emit("reconnect_token", { token: session.reconnectToken, playerId: session.id });
    room.broadcastRoomState();
    if (room.match && room.state === "PLAYING") room.syncMatchStateTo(socket, session.id);
  });

  socket.on("leave_room", () => {
    const state = socketState.get(socket);
    if (!state) return;
    const room = roomManager.get(state.roomId);
    room?.handleDisconnect(state.playerId);
    socket.leave(state.roomId);
    socketState.delete(socket);
  });

  socket.on("set_ready", ({ ready }) => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.setReady(state.playerId, ready);
  });

  socket.on("update_settings", (settings) => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.updateSettings(state.playerId, settings);
  });

  socket.on("start_match", () => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.startMatch(state.playerId);
  });

  socket.on("reveal_cell", ({ x, y }) => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.handleReveal(socket, state.playerId, x, y);
  });

  socket.on("flag_cell", ({ x, y, flagged }) => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.handleFlag(socket, state.playerId, x, y, flagged);
  });

  socket.on("chord_cell", ({ x, y }) => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.handleChord(socket, state.playerId, x, y);
  });

  socket.on("request_rematch", () => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.requestRematch(state.playerId);
  });

  socket.on("disconnect", () => {
    const state = socketState.get(socket);
    if (!state) return;
    roomManager.get(state.roomId)?.handleDisconnect(state.playerId);
    socketState.delete(socket);
  });

  const pingInterval = setInterval(() => {
    const state = socketState.get(socket);
    if (!state) return;
    const start = Date.now();
    socket.timeout(2000).emit("ping_check" as any, () => {
      const rtt = Date.now() - start;
      roomManager.get(state.roomId)?.updatePing(state.playerId, rtt);
    });
  }, 6000);
  socket.once("disconnect", () => clearInterval(pingInterval));
});

setInterval(() => roomManager.sweepEmptyRooms(), 60_000);

httpServer.listen(PORT, () => {
  console.log(`sector-zero game-server listening on :${PORT}`);
});
