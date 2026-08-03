# Deploying Sector Zero

Three pieces: Vercel (web client), Render (game-server) and Supabase
(auth + Postgres, already provisioned). Vercel's serverless model doesn't
support the persistent, stateful WebSocket connections the game-server needs
(in-memory rooms/matches live in the process), so it needs a host that keeps
a Node process running.

Do these in order — each step's output feeds the next one's env vars.

## 0. Supabase — one-time schema setup

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of `supabase/schema.sql` and run it. It creates
   `profiles` / `matches` / `match_players`, a trigger that creates a profile
   row when someone signs up, and RLS policies. Safe to re-run.
3. Note your project's URL and publishable key (Settings → API) and the
   pooled/direct Postgres connection strings (Settings → Database) — you'll
   need all four below. The password contains `@`, which **must** be
   percent-encoded as `%40` inside the connection string or it won't parse.

## 1. Game server → Render (free tier)

1. [render.com](https://render.com) → **New +** → **Blueprint** → connect
   the `oft24/bomb-it-` repo, branch `claude/multiplayer-minesweeper-game-ibaabn`.
2. Render reads `render.yaml` at the repo root and provisions
   `sector-zero-game-server` automatically (build/start commands are already
   set).
3. Set these env vars on the service (Render's dashboard → Environment):
   - `CLIENT_ORIGIN` — the Vercel URL from step 2 below (deploy once with a
     placeholder, come back and set this once you have it, then redeploy —
     it's only used for CORS).
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DATABASE_URL` — pooled connection string (port 6543, `?pgbouncer=true`),
     password percent-encoded.
   - `DIRECT_URL` — session-mode connection string (port 5432), same
     password encoding. Used only for schema migrations, not runtime queries.
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
3. Add these environment variables (all get baked into the client bundle at
   build time, so they must be set before deploying):
   - `NEXT_PUBLIC_GAME_SERVER_URL` — the Render URL from step 1.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Note the resulting URL, e.g. `https://sector-zero.vercel.app`.

## 3. Close the loop

Back on Render, set `CLIENT_ORIGIN` on the game-server service to the Vercel
URL from step 2, then trigger a redeploy of just that service. Without this
the browser's CORS preflight to the game-server will fail.

## Verifying it worked

Create an account on the Vercel URL (confirm the email if your Supabase
project requires it), sign in, create a room, and join it from a second
browser/tab under a second account — you should see both players' progress
update live in each other's leaderboard, and the finished match show up in
the `matches` / `match_players` tables in Supabase.

## Credentials note

Never commit real Supabase credentials — `apps/game-server/.env` and
`apps/web/.env.local` are gitignored precisely so local secrets stay local.
Enter them directly into Render's and Vercel's dashboard env var UIs for
deployment.
