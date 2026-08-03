# Sector Zero

Competitive multiplayer clearance racing. Up to 30 operatives get the exact
same board, generated from a single server-side seed. First to clear it
clean wins.

Gameplay-wise it's inspired by the classic sweep-the-board puzzle, but the
visual identity, board design, iconography, sounds and UI are all original —
see [`AGENTS.md` design notes](./apps/web/AGENTS.md) for how the web app is
built.

## Structure

```
apps/
  web/           Next.js client (App Router, Tailwind, Framer Motion)
  game-server/   Authoritative Socket.IO server (rooms, matches, anti-cheat)
packages/
  game-core/     Deterministic board generation + reveal/chord/win logic
  shared-types/  WS event contracts + entities shared by web and game-server
```

`game-core` has zero framework dependencies, so it's reusable by a future
offline/training client, and eventually a Steam build.

## Running locally

```bash
npm install

# build the shared packages once (and after changing them)
npm run build -w packages/shared-types
npm run build -w packages/game-core

# in one terminal
npm run dev:server   # game-server on :4001

# in another terminal
npm run dev:web       # web app on :3000
```

Then open `http://localhost:3000`. Two browser tabs (or windows) can create
a room and join it with the room code to test a real multiplayer match.

`/preview/lobby`, `/preview/match` and `/preview/results` render the same
components with generated demo data (no server connection needed) — useful
for design QA at scale (24+ simulated players) without spinning up real
clients.

## Tests

```bash
npm run test -w packages/game-core
```

Covers board-generation determinism, the shared safe-zone fairness
guarantee, flood-fill reveal, chording, and win detection.
