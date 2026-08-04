# minesw1pe

Competitive multiplayer minesweeper racing. Up to 30 players get the exact
same board, generated from a single server-side seed. First to clear it
clean wins.

Hitting a mine costs you a time penalty — but only five times. The sixth
detonation wipes your board and you restart the same grid from zero
(`maxMistakes` in the match settings; set it to 0 to disable the rule).

## Casino mode

The `RANDOM` grid preset turns every click into a wager. Before a cell opens
you have to beat the house at a randomly drawn table game — blackjack (dealer
draws to 16, stands on 17), single-zero roulette (red/black, green takes all),
or two dice called pair/no pair. Win and the cell opens; lose and it stays
shut; a blackjack push returns the stake and costs you nothing but time.

It rides on the small `RECON` grid on purpose — a full-size board with a card
game in front of every cell would take all night. The soundtrack switches to a
lounge track while it's active.

The rules live in `packages/game-core/src/casino.ts` and are unit-tested; the
wager itself is resolved client-side, so a modified client could bypass the
table. That's an accepted trade for a party mode — making it cheat-proof means
moving the deal onto the game-server and into the WS contract.

Chording is deliberately *not* gated: it's a move you earn by flagging
correctly, so it stays free.

Gameplay-wise it's inspired by the classic sweep-the-board puzzle, but the
visual identity, board design, iconography, sounds and UI are all original —
see [`AGENTS.md` design notes](./apps/web/AGENTS.md) for how the web app is
built.

## Structure

```
apps/
  web/           Next.js client (App Router, Tailwind, Framer Motion)
  game-server/   Authoritative Socket.IO server (rooms, matches, anti-cheat, Prisma)
packages/
  game-core/     Deterministic board generation + reveal/chord/win logic
  shared-types/  WS event contracts + entities shared by web and game-server
supabase/
  schema.sql     Postgres schema + signup trigger + RLS, run once in the SQL Editor
```

`game-core` has zero framework dependencies, so it's reusable by a future
offline/training client, and eventually a Steam build.

Playing requires nothing but a name. Guests get a throwaway server-side
identity and play a fully real match; the only thing they give up is
persistence — nothing about a guest match is written to the database.

Accounts are the optional upgrade, backed by Supabase: Auth on the web client,
Postgres (via Prisma) from the game-server, which verifies the access token on
`join_room` and records the match against the player's profile. Both Supabase
and the database are optional at the server level: with neither configured the
game-server boots fine and runs guest-only.

Guest identity lives in `sessionStorage`, so two tabs are two separate
players — which is all you need to test a real multiplayer match locally.

## Running locally

```bash
npm install

# build the shared packages once (and after changing them)
npm run build -w packages/shared-types
npm run build -w packages/game-core

# apps/game-server/.env needs: DATABASE_URL, DIRECT_URL,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, CLIENT_ORIGIN
# apps/web/.env.local needs: NEXT_PUBLIC_GAME_SERVER_URL,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# (run supabase/schema.sql in the Supabase SQL Editor once first — see DEPLOY.md)
cd apps/game-server && npx prisma generate && cd ../..

# in one terminal
npm run dev:server   # game-server on :4001

# in another terminal
npm run dev:web       # web app on :3000
```

Then open `http://localhost:3000`. Type a name, create a room, and open a
second tab with a different name to join by room code — that's a real
multiplayer match, no accounts and no database needed. Sign-in is only
required if you want the result saved.

`/preview/lobby`, `/preview/match` and `/preview/results` render the same
components with generated demo data (no server connection needed) — useful
for design QA at scale (24+ simulated players) without spinning up real
clients.

## Tests

```bash
npm run test -w packages/game-core
```

Covers board-generation determinism, the shared safe-zone fairness
guarantee, flood-fill reveal, chording (both that a fully-flagged number
opens its remaining neighbors, and that a mis-flagged one still detonates),
and win detection.
