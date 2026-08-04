# Audio system

The web client owns one `GameAudio` singleton. It uses Web Audio buses for master, music and SFX, so React rerenders and route changes cannot create competing music instances. `audioConfig.ts` is the single source of defaults, persistence key and cooldowns. Preferences are stored as `game_audio_settings` in `localStorage`.

The current soundtrack and effects are original procedural placeholders synthesized in the browser. This avoids downloads, missing-file errors and licensing ambiguity. They can later be replaced behind `GameAudio` with files under `apps/web/public/audio/music` and `apps/web/public/audio/sfx` without changing gameplay components.

## Lifecycle

- First pointer or keyboard interaction unlocks `AudioContext` and starts menu music when enabled.
- Lobby and matchmaking keep the same singleton playing.
- Server `match_countdown` events play 3/2/1/GO impacts alongside the visible overlay.
- `match_started` starts/continues the selected ARCADE or CASINO track.
- Confirmed local `cell_result` and `cell_flagged` events play tile, flag or explosion sounds. Remote tile activity is never reproduced.
- `match_finished` plays victory for first place and loss for everyone else.

The current server countdown is authoritative by tick, but its protocol sends `{seconds}` rather than a future timestamp. For tighter synchronization across high-latency clients, evolve the shared event to `{startAt}` and derive both visual and audio scheduling from `AudioContext.currentTime + (startAt - Date.now()) / 1000`.

## Adding or replacing audio

Add the asset to `public/audio`, register its path/default/cooldown in `audioConfig.ts`, preload/decode it once in `GameAudio`, and expose a semantic method such as `playMatchFound()`. Do not instantiate `Audio` in components. Missing assets should retain the procedural fallback.

Run `npm.cmd run typecheck -w apps/web` and `npm.cmd run build -w apps/web`. Test mute, all three sliders, refresh persistence, rapid tile input, countdown, victory/loss and mobile first-interaction unlock.
