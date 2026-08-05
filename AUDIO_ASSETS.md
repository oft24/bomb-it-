# Audio asset manifest

The menu and casino mode use an original full-length score. The Web Audio
procedural music remains as the instant-loading fallback and as the competitive
ARCADE track.

### Shipped

| File | Use | Loop | Length | Default |
|---|---|---:|---:|---:|
| `music/the-house-learns-your-name.mp3` | Menu/lobby and RANDOM casino mode | yes | 3:51.8 | 40% |

Everything else currently audible — the ARCADE match track, countdown impacts,
tile, flag, explosion, wipe, victory and casino stingers — is **synthesised at
runtime** by `GameAudio`. There are no other audio files in `public/audio`.

### Planned — not yet authored

These are targets, not assets. Nothing references them yet; adding a row here
does not make a file exist.

| File | Use | Loop | Length | Default |
|---|---|---:|---:|---:|
| `music/match-theme.mp3` | Competitive match | yes | 90–120 s | 40% |
| `music/countdown-intro.mp3` | Optional combined countdown | no | 3–5 s | 75% |
| `sfx/countdown-{3,2,1,go}.mp3` | Server countdown | no | <1 s | 75–80% |
| `sfx/tile-reveal.mp3` | Confirmed local reveal | no | 50–150 ms | 25% |
| `sfx/flag-{place,remove}.mp3` | Confirmed local flag | no | 50–150 ms | 30% |
| `sfx/bomb-explosion.mp3` | Local mine | no | <500 ms | 65% |
| `sfx/match-{win,lose}.mp3` | Local result | no | 1–3 s | 75% |

Note: the shipped track is 4.5 MB, by far the largest asset in the product. It
should be shortened or re-encoded before more audio is added — see
`docs/GAME_AUDIT.md` §6.

`The House Learns Your Name` is a deterministic, sample-free original composed
for Sector Zero. Its source renderer is in `tools/audio`; no third-party melody,
recording or sample is used.

Only use original, commercially licensed royalty-free, or AI-generated assets whose commercial terms have been verified and recorded.
