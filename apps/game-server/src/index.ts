import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@sectorzero/shared-types";
import { RoomManager, type IOSocket } from "./rooms.js";
import { generateRoomCode } from "./ids.js";
import { verifyAccessToken, createGuestProfile, accountsEnabled } from "./auth.js";
import { prisma } from "./db.js";
import { rankForRating } from "./ranking.js";

const PORT = Number(process.env.PORT ?? 4001);
// Comma-separated so one server can serve the production domain and Vercel's
// per-deploy preview URLs without a redeploy for each one.
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/rooms/new-code", (_req, res) => res.json({ code: generateRoomCode() }));

/** Lets the client know which sign-in affordances this server can actually honour. */
app.get("/api/config", (_req, res) =>
  res.json({ accountsEnabled, persistenceEnabled: Boolean(prisma) }),
);

app.get("/api/profile/me", async (req, res) => {
  const authHeader = req.header("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const profile = await verifyAccessToken(accessToken);
  if (!profile) {
    res.status(401).json({ error: "Sign in to view your profile." });
    return;
  }
  if (!prisma) {
    res.json({ ...profile, rank: rankForRating(profile.rating), stats: null });
    return;
  }

  const [matchesPlayed, wins, top3, avg, best] = await Promise.all([
    prisma.matchPlayer.count({ where: { profileId: profile.id } }),
    prisma.matchPlayer.count({ where: { profileId: profile.id, placement: 1 } }),
    prisma.matchPlayer.count({ where: { profileId: profile.id, placement: { lte: 3 } } }),
    prisma.matchPlayer.aggregate({ where: { profileId: profile.id }, _avg: { placement: true } }),
    prisma.matchPlayer.aggregate({
      where: { profileId: profile.id, finishTimeMs: { not: null } },
      _min: { finishTimeMs: true },
    }),
  ]);

  res.json({
    ...profile,
    rank: rankForRating(profile.rating),
    stats: {
      matchesPlayed,
      wins,
      top3Finishes: top3,
      winRatePct: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0,
      avgPlacement: avg._avg.placement != null ? Math.round(avg._avg.placement * 10) / 10 : null,
      bestTimeMs: best._min.finishTimeMs ?? null,
    },
  });
});

app.get("/api/leaderboard", async (req, res) => {
  if (!prisma) {
    res.json({ profiles: [] });
    return;
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const profiles = await prisma.profile.findMany({
    orderBy: { rating: "desc" },
    take: limit,
    select: { id: true, username: true, rating: true, level: true },
  });
  res.json({
    profiles: profiles.map((p) => ({ ...p, rank: rankForRating(p.rating) })),
  });
});

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
  socket.on("join_room", async ({ roomId, accessToken, guestName, guestId }) => {
    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!normalizedRoomId) {
      socket.emit("error_message", { code: "INVALID_JOIN", message: "Room code is required." });
      return;
    }

    // A token always wins over a name: if someone is signed in, they play as
    // themselves and their match is recorded, even if a stale name is sent too.
    const profile = accessToken
      ? await verifyAccessToken(accessToken)
      : guestName
        ? createGuestProfile(guestName, guestId)
        : null;

    if (!profile) {
      socket.emit("error_message", {
        code: "UNAUTHORIZED",
        message: accessToken
          ? "Your session expired. Sign in again."
          : "Enter a name of at least 2 characters to play.",
      });
      return;
    }

    const room = roomManager.getOrCreate(normalizedRoomId);
    const isReturningPlayer = room.players.has(profile.id);

    if (!isReturningPlayer) {
      if (room.state !== "LOBBY") {
        socket.emit("error_message", { code: "MATCH_IN_PROGRESS", message: "This match has already started." });
        return;
      }
      if (room.players.size >= room.settings.maxPlayers) {
        socket.emit("error_message", { code: "ROOM_FULL", message: "This room is full." });
        return;
      }
    }

    const session = room.addOrReconnectPlayer(socket, profile);
    socketState.set(socket, { roomId: normalizedRoomId, playerId: session.id });
    socket.join(normalizedRoomId);

    socket.emit("joined_room", {
      roomId: normalizedRoomId,
      playerId: session.id,
      isGuest: profile.isGuest,
    });
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
  console.log(`minesw1pe game-server listening on :${PORT}`);
});
