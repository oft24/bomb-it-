# minesw1pe — Game Audit

Baseline audit of the shipping game. Every "measured" claim below was executed,
not inferred. Items marked **FIXED** were resolved in the same pass that
produced this document; everything else is open work.

Production: <https://sector-zero-blush.vercel.app>
Game server: <https://minesw1pe-game-server.onrender.com>

## 1. Quality gates — measured

| Gate | Command | Result |
|---|---|---|
| Install | `npm install` | Pass (3 high advisories, non-blocking) |
| Lint | `npm run lint -w apps/web` | **Clean** |
| Typecheck | `npm run typecheck` | **Clean** (all 3 workspaces) |
| Unit tests | `npm run test -w packages/game-core` | **20/20 pass** |
| Production build | `npm run build` | **Pass** — 12 static routes |

The codebase is not broken. The gaps are product and architecture gaps, not
build breakage. That is the important framing for prioritisation.

## 2. Architecture

```
apps/web          Next.js 16.2.12 / React 19.2.4, App Router, Tailwind v4, Turbopack
apps/game-server  Express + Socket.IO, authoritative rooms/matches, Prisma (optional)
packages/game-core     Deterministic board + reveal/chord/win + casino table rules
packages/shared-types  WS event contracts, zero runtime deps
```

State lives in three Zustand stores (`gameStore`, `authStore`) plus a `GameAudio`
singleton. The server owns board generation, seeds, reveals, penalties,
placement and match end. Clients render; they do not decide results — with one
documented exception (§5).

## 3. What works

- Guest play with a name only; accounts optional. Validated with two real
  clients in production.
- Deterministic shared board from a server seed — both clients open the identical
  starting cell.
- Real-time progress, live standings, penalties, board wipes, chording.
- The 5-mistake rule: five detonations forgiven with a time penalty, the sixth
  wipes the board back to zero.
- Casino mode (`RANDOM` grid): blackjack / roulette / dice gate each reveal.
- Full match completion → results screen with placement, time, accuracy, XP.
- Audio: Web Audio singleton with master/music/SFX buses, persisted settings,
  procedural ARCADE track, MP3 casino track.

## 4. Fixed in this pass

- **Dead controls.** `Ranked` and `Training` were cards with a click handler that
  called `preventDefault()` on itself — they looked interactive and did nothing.
  Training is now a real solo mode; Ranked was **removed** rather than faked,
  because it needs persisted ratings and the database is not provisioned (§7).
- **No matchmaking.** `Casual` and `Custom Game` both routed to the same
  create/join screen; there was no way to meet a stranger. Added
  `GET /api/rooms/quick-play`, which returns the fullest open public lobby so
  players converge instead of each minting a private room. Verified: three
  consecutive calls return the same code, and two independent clients clicking
  Quick Play land in the same lobby.
- **Match length.** Quick Play and Training now use the 12×12/20 grid rather
  than the 24×24/99 default, which is a multi-minute solo grind and misses the
  45 s–2 min target for casual play.

## 5. Multiplayer risks — open

1. **Casino wagers resolve on the client.** `CasinoTable` decides win/lose and
   only then emits `reveal_cell`. A modified client can skip the table entirely.
   Accepted for a party mode; must move server-side before casino mode is ranked.
2. **Countdown protocol sends `{seconds}`, not `{startAt}`.** Each tick is a
   separate event, so a high-latency client starts fractionally late. Should
   become an absolute timestamp and be scheduled against
   `AudioContext.currentTime`. Fairness bug at competitive level.
3. **Rate limiting is per-process, in memory** (`RATE_LIMIT_ACTIONS_PER_SEC`).
   Correct on one Render instance; silently ineffective the moment the server
   scales horizontally.
4. **No reconnect UX.** The server holds a disconnected player for 25 s and can
   rebuild their board (`syncMatchStateTo`), but the client surfaces only
   `connectionStatus: "error"`. There is no RECONNECTING/SYNCING state, so a
   brief network blip reads as a dead game.
5. **Guest identity is client-supplied** (`guestId` from sessionStorage, format
   validated but not authenticated). Fine for guests; not a competitive identity.

## 6. Performance risks — open

1. **The menu track is a 4.5 MB MP3** (`the-house-learns-your-name.mp3`, 3:51).
   That is by far the largest asset in the product and it gates nothing — the
   procedural fallback covers the gap, but the download still happens on the
   first interaction. Needs a shorter loop, a lower bitrate, or streaming.
2. **The board is plain DOM**: 144 buttons at RECON, 576 at STANDARD, 720 at
   SIEGE. Fine today; not yet profiled under 30 concurrent players with progress
   broadcasts landing continuously. Profile before considering canvas — do not
   rewrite speculatively.
3. **`broadcastProgress` sends every player's row to every client** on each
   reveal. At 30 players that is O(n²) traffic per match. Compact deltas needed
   before large lobbies are real.

## 7. Feature gaps — open

- **Supabase schema is not provisioned.** Verified: `profiles`, `matches` and
  `match_players` all return `PGRST205 — table not found`. Consequences: no
  accounts in practice, Career shows nothing, Leaderboards returns `[]`, no match
  history, no rating. Run `supabase/schema.sql` to unblock.
- **Email confirmation is on** (`mailer_autoconfirm: false`) and there is no
  resend button, so a lost confirmation mail is a dead end.
- **No password reset UI.**
- **No tutorial.** Minesweeper is not self-evident; a new player gets no
  explanation of numbers, flags or chording.
- **Settings cover audio only.** No screen shake, reduced motion, or effects
  controls, despite motion and shake being used.
- **`/preview/*` routes render mock players.** They are design-QA surfaces and
  the real match never touches them, but they are reachable in production and a
  visitor could mistake them for the game having bots.

## 8. Documentation defects

`AUDIO_ASSETS.md` tabulates eight audio files. **One exists.** The other seven
(`match-theme.mp3`, `countdown-*.mp3`, `sfx/*.mp3`) are aspirational rows in a
table that reads as a manifest of shipped assets. Either mark them as planned or
remove them; a manifest that lies is worse than no manifest.

## 9. Steam portability

Nothing blocks it structurally: `game-core` is already framework-free and
`shared-types` has zero runtime deps, so the rules layer ports as-is. The work is
that browser APIs are reached directly from components (`localStorage`,
`sessionStorage`, `AudioContext`, `fetch`) with no platform seam. A
`PlatformService` interface is the prerequisite, not a rewrite.

## 10. Recommended order

1. Run the Supabase schema — it silently disables four features at once.
2. Countdown `{startAt}` — fairness, and it is cheap.
3. Reconnect state in the client — the server half already exists.
4. Trim the menu MP3.
5. Tutorial.
6. Settings: shake / reduced motion.
7. Profile 30-player load, then decide on canvas and progress deltas.
8. Platform seam, then desktop.
