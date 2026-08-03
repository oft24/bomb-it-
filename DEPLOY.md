# Deploying Sector Zero

Two pieces, two hosts — Vercel's serverless model doesn't support the
persistent, stateful WebSocket connections the game-server needs (in-memory
rooms/matches live in the process), so it needs a host that keeps a Node
process running. Vercel is a great fit for the Next.js client.

Deploy the **game-server first** — the web app needs its URL at build time.

## 1. Game server → Render (free tier)

1. [render.com](https://render.com) → **New +** → **Blueprint** → connect
   the `oft24/bomb-it-` repo, branch `claude/multiplayer-minesweeper-game-ibaabn`.
2. Render reads `render.yaml` at the repo root and provisions
   `sector-zero-game-server` automatically (build/start commands are already
   set).
3. Before the first deploy finishes, set the `CLIENT_ORIGIN` env var on that
   service — you'll fill this in with the Vercel URL from step 2 below, so
   deploy once now, come back and set it, then redeploy. It's used for CORS.
4. Note the resulting URL, e.g. `https://sector-zero-game-server.onrender.com`.

(Railway or Fly.io work the same way — any host that runs a long-lived Node
process. The equivalent manual settings: build command
`npm install && npm run build -w packages/shared-types && npm run build -w packages/game-core && npm run build -w apps/game-server`,
start command `node apps/game-server/dist/index.js`.)

Free-tier note: Render's free web services spin down after inactivity and
take ~30s to wake on the next request — fine for testing, not for a real
match with 30 impatient operatives.

## 2. Web client → Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import
   `oft24/bomb-it-`, branch `claude/multiplayer-minesweeper-game-ibaabn`.
2. Set **Root Directory** to `apps/web`. Vercel will pick up
   `apps/web/vercel.json`, which handles the monorepo install/build
   (it builds `shared-types` and `game-core` first, since the web app
   imports their compiled output).
3. Add an environment variable:
   `NEXT_PUBLIC_GAME_SERVER_URL = https://sector-zero-game-server.onrender.com`
   (the URL from step 1 — this gets baked into the client bundle at build
   time, so it must be set before deploying).
4. Deploy. Note the resulting URL, e.g. `https://sector-zero.vercel.app`.

## 3. Close the loop

Back on Render, set `CLIENT_ORIGIN` on the game-server service to the Vercel
URL from step 2 (e.g. `https://sector-zero.vercel.app`), then trigger a
redeploy of just that service. Without this the browser's CORS preflight to
the game-server will fail.

## Verifying it worked

Open the Vercel URL in two browser tabs/devices, create a room in one, join
with the room code in the other, ready up, start — you should see both
players' progress update live in each other's leaderboard.
