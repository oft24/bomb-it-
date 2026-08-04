# Deploying minesw1pe

Three pieces: Vercel (web client), Render (game-server) and Supabase
(auth + Postgres). Vercel's serverless model doesn't support the persistent,
stateful WebSocket connections the game-server needs (in-memory rooms/matches
live in the process), so it needs a host that keeps a Node process running.

**Only the game-server is strictly required to play.** Guests need no accounts
and no database, so you can deploy step 1 with none of the Supabase env vars
set and have a fully working multiplayer game; add them later to enable
sign-in and saved match history.

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
   the `oft24/bomb-it-` repo, branch `main`.
2. Render reads `render.yaml` at the repo root and provisions
   `sector-zero-game-server` automatically (build/start commands are already
   set).
3. Set these env vars on the service (Render's dashboard → Environment):
   - `CLIENT_ORIGIN` — the Vercel URL from step 2 below (deploy once with a
     placeholder, come back and set this once you have it, then redeploy —
     it's only used for CORS). Accepts a comma-separated list, which is how
     you allow Vercel's per-deploy preview URLs alongside production.
   - `NEXT_PUBLIC_SUPABASE_URL` *(optional — omit for guest-only)*
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` *(optional — omit for guest-only)*
   - `DATABASE_URL` *(optional)* — pooled connection string (port 6543,
     `?pgbouncer=true`), password percent-encoded. Without it the server runs
     with no persistence.
   - `DIRECT_URL` *(optional)* — session-mode connection string (port 5432),
     same password encoding. Used only for schema migrations, not runtime
     queries.

   Omitting a Supabase/database var is a supported configuration, not a
   half-broken one: the server logs which features it's running without and
   serves guests normally.
4. Note the resulting URL, e.g. `https://sector-zero-game-server.onrender.com`.

(Railway or Fly.io work the same way — any host that runs a long-lived Node
process. The equivalent manual settings: build command
`npm install && npm run build -w packages/shared-types && npm run build -w packages/game-core && npm run build -w apps/game-server`,
start command `npm run start -w apps/game-server`.

Note the start command runs the server from source through `tsx` rather than
from `dist/`. Prisma 7's generated client uses extensionless relative imports,
which `tsc` emits verbatim and Node's ESM resolver then refuses to load, so a
`node dist/index.js` start crashes on boot. The build still runs as a
typecheck gate.)

Free-tier note: Render's free web services spin down after inactivity and
take ~30s to wake on the next request — fine for testing, not for a real
match with 30 impatient operatives.

## 2. Web client → Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import
   `oft24/bomb-it-`, branch `main`.
2. Leave **Root Directory** at the repo root. The root `vercel.json` handles
   the monorepo build (it builds `shared-types` and `game-core` first, since
   the web app imports their compiled output, then points the output at
   `apps/web/.next`). Zero-config detection can't work from the root on its
   own — there's no `next` dependency there — which is exactly what that file
   is for. `apps/web/vercel.json` is the equivalent for a root-directory-
   scoped setup; only one of the two applies.
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

Open the Vercel URL, type a name, create a room, then open a second tab, type
a different name and join with the room code. Both players' progress should
update live in each other's leaderboard. This path needs no Supabase at all.

To verify the account path as well: sign up (confirm the email if your
Supabase project requires it — it does by default), sign in, play a match, and
check that it lands in the `matches` / `match_players` tables.

## Credentials note

Never commit real Supabase credentials — `apps/game-server/.env` and
`apps/web/.env.local` are gitignored precisely so local secrets stay local.
Enter them directly into Render's and Vercel's dashboard env var UIs for
deployment.
