/**
 * Central soundtrack + stingers transport built on Web Audio.
 *
 * The casino track upgrades from an instant procedural fallback to the original
 * full-length score once it has downloaded and decoded. Both paths share the
 * same master/music buses, so route changes never create competing players.
 */

import {
  AUDIO_ASSETS,
  AUDIO_COOLDOWNS,
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from "./audio/audioConfig";

export type MusicTrack = "ARCADE" | "CASINO";

const BAR_SIXTEENTHS = 16;
const LOOP_SIXTEENTHS = BAR_SIXTEENTHS * 4;

// The casino lounge runs slower and swings, so it gets its own clock.
const CASINO_BPM = 108;
const CASINO_SIXTEENTH = 60 / CASINO_BPM / 4;

// Scheduler: queue a little ahead of the clock so timing survives a busy main
// thread, and re-check often enough that the queue never runs dry.
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

// --- ARCADE: the competitive score ------------------------------------------
//
// Eight bars in A natural minor at 168bpm. The progression ends on a major V,
// which refuses to resolve — the loop always wants to start again, which is the
// feeling a race wants. Everything is layered rather than through-composed, so
// the arrangement can thicken as the player climbs the standings without any
// track ever restarting.

const ARCADE_BPM = 168;
const ARCADE_SIXTEENTH = 60 / ARCADE_BPM / 4;
const ARCADE_BARS = 8;
const ARCADE_LOOP_STEPS = BAR_SIXTEENTHS * ARCADE_BARS;

/** Am - F - C - G - Am - F - Dm - E. One chord per bar. */
const ARCADE_PROGRESSION = [
  { bass: 110.0, triad: [220.0, 261.63, 329.63] }, // Am
  { bass: 87.31, triad: [174.61, 220.0, 261.63] }, // F
  { bass: 130.81, triad: [261.63, 329.63, 392.0] }, // C
  { bass: 98.0, triad: [196.0, 246.94, 293.66] }, // G
  { bass: 110.0, triad: [220.0, 261.63, 329.63] }, // Am
  { bass: 87.31, triad: [174.61, 220.0, 261.63] }, // F
  { bass: 146.83, triad: [293.66, 349.23, 440.0] }, // Dm
  { bass: 164.81, triad: [329.63, 415.3, 493.88] }, // E major — the leading tone
];

/**
 * The hook. Deliberately syncopated — it lands off the beat more often than on
 * it, so it pulls against the arpeggio instead of doubling it. This is the
 * thing that should still be in your head after you close the tab.
 */
const ARCADE_MOTIF: { step: number; freq: number; steps: number }[] = [
  // Phrase A — states the idea
  { step: 0, freq: 440.0, steps: 3 }, // A4
  { step: 4, freq: 523.25, steps: 2 }, // C5
  { step: 6, freq: 659.25, steps: 4 }, // E5
  { step: 12, freq: 587.33, steps: 3 }, // D5
  { step: 16, freq: 523.25, steps: 6 }, // C5
  { step: 24, freq: 440.0, steps: 3 }, // A4
  { step: 28, freq: 659.25, steps: 3 }, // E5
  // Phrase B — answers it a step lower
  { step: 32, freq: 392.0, steps: 3 }, // G4
  { step: 36, freq: 493.88, steps: 2 }, // B4
  { step: 38, freq: 587.33, steps: 4 }, // D5
  { step: 44, freq: 523.25, steps: 3 }, // C5
  { step: 48, freq: 493.88, steps: 6 }, // B4
  { step: 56, freq: 392.0, steps: 4 }, // G4
  // Phrase A again, so the hook repeats before it turns
  { step: 64, freq: 440.0, steps: 3 },
  { step: 68, freq: 523.25, steps: 2 },
  { step: 70, freq: 659.25, steps: 4 },
  { step: 76, freq: 587.33, steps: 3 },
  { step: 80, freq: 523.25, steps: 6 },
  { step: 88, freq: 440.0, steps: 3 },
  { step: 92, freq: 698.46, steps: 3 }, // F5 — lifts higher than before
  // Phrase C — climbs and hangs on the unresolved E
  { step: 96, freq: 698.46, steps: 3 }, // F5
  { step: 100, freq: 659.25, steps: 2 }, // E5
  { step: 102, freq: 587.33, steps: 4 }, // D5
  { step: 108, freq: 440.0, steps: 4 }, // A4
  { step: 112, freq: 659.25, steps: 8 }, // E5, held
  { step: 124, freq: 493.88, steps: 4 }, // B4
];

/** Kick pattern: four-on-the-floor with a pushed pickup into the next bar. */
const ARCADE_KICK_STEPS = [0, 4, 8, 12, 14];
/** Backbeat, so the grid has something to lean on. */
const ARCADE_SNARE_STEPS = [4, 12];

/**
 * How thick the arrangement is, 0-5. Driven by race position, not by time, so
 * the music tells you how you're doing before the leaderboard does.
 */
export type MusicIntensity = 0 | 1 | 2 | 3 | 4 | 5;

// Lounge turnaround: Dm7 - G7 - Cmaj7 - A7. Bass walks the four quarter notes of
// each bar; the chord is stabbed on the off-beats behind it.
const CASINO_PROGRESSION = [
  { walk: [146.83, 174.61, 220.0, 261.63], chord: [293.66, 349.23, 440.0] }, // Dm7
  { walk: [196.0, 246.94, 293.66, 349.23], chord: [246.94, 293.66, 349.23] }, // G7
  { walk: [130.81, 164.81, 196.0, 246.94], chord: [261.63, 329.63, 392.0] }, // Cmaj7
  { walk: [220.0, 277.18, 329.63, 392.0], chord: [277.18, 329.63, 392.0] }, // A7
];

/** Off-beat comp stabs, giving the lounge feel its lilt. */
const CASINO_STAB_STEPS = [3, 7, 11, 15];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private settings: AudioSettings = loadAudioSettings();
  private cooldowns = new Map<string, number>();
  private startingMusic = false;
  private settingsListeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStep = 0;
  private nextNoteTime = 0;
  private noiseBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicSourceGain: GainNode | null = null;
  private casinoBuffer: AudioBuffer | null = null;
  private casinoBufferPromise: Promise<AudioBuffer | null> | null = null;
  private transportRevision = 0;

  private track: MusicTrack = "CASINO";
  private intensity: MusicIntensity = 1;

  private _musicOn = false;
  get musicOn() {
    return this._musicOn;
  }

  /**
   * Swaps the soundtrack without interrupting playback. The step cursor resets
   * so the new pattern starts on its own downbeat instead of halfway through a
   * bar it never played.
   */
  setTrack(track: MusicTrack) {
    if (this.track === track) return;
    this.track = track;
    this.nextStep = 0;
    if (this.ctx && this._musicOn) {
      const revision = ++this.transportRevision;
      this.stopTransport();
      this.startTrackTransport(this.ctx, revision);
    }
  }

  private stepSeconds(): number {
    return this.track === "CASINO" ? CASINO_SIXTEENTH : ARCADE_SIXTEENTH;
  }

  /** The two tracks are different lengths, so the loop point differs too. */
  private loopSteps(): number {
    return this.track === "CASINO" ? LOOP_SIXTEENTHS : ARCADE_LOOP_STEPS;
  }

  /**
   * Thickens or thins the arrangement without restarting anything. Called from
   * the match screen as the player's standing changes.
   */
  setIntensity(level: MusicIntensity) {
    this.intensity = level;
  }

  get currentIntensity(): MusicIntensity {
    return this.intensity;
  }

  /** Must be called from a user gesture — browsers won't start audio otherwise. */
  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const safariWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? safariWindow.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicEnabled ? this.settings.music * 0.8 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxEnabled ? this.settings.sfx : 0;
      this.sfxGain.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    return this.ctx;
  }

  getSettings = () => this.settings;
  subscribeSettings = (listener: () => void) => {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  };

  setSettings(next: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...next };
    saveAudioSettings(this.settings);
    this.settingsListeners.forEach((listener) => listener());
    if (this.ctx && this.master && this.musicGain && this.sfxGain) {
      const at = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, at, 0.02);
      this.musicGain.gain.setTargetAtTime(this.settings.musicEnabled ? this.settings.music * 0.8 : 0, at, 0.02);
      this.sfxGain.gain.setTargetAtTime(this.settings.sfxEnabled ? this.settings.sfx : 0, at, 0.02);
    }
    if (!this.settings.musicEnabled || this.settings.muted) this.stopMusic();
    else this.startMusic();
    return this.getSettings();
  }

  async unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { return false; }
    }
    return ctx.state === "running";
  }

  private allowed(name: string, cooldownMs: number) {
    if (!this.settings.sfxEnabled || this.settings.muted) return false;
    const now = performance.now();
    if (now - (this.cooldowns.get(name) ?? -Infinity) < cooldownMs) return false;
    this.cooldowns.set(name, now);
    return true;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  startMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this._musicOn || this.startingMusic || !this.settings.musicEnabled || this.settings.muted) return;
    if (ctx.state !== "running") {
      this.startingMusic = true;
      void ctx.resume().then(() => {
        this.startingMusic = false;
        if (ctx.state === "running") this.beginMusic(ctx);
      }).catch(() => { this.startingMusic = false; });
      return;
    }
    this.beginMusic(ctx);
  }

  private beginMusic(ctx: AudioContext) {
    if (this._musicOn) return;
    this._musicOn = true;
    const revision = ++this.transportRevision;
    this.startTrackTransport(ctx, revision);
  }

  private startTrackTransport(ctx: AudioContext, revision: number) {
    if (this.track === "CASINO" && this.casinoBuffer) {
      this.startCasinoAsset(ctx, this.casinoBuffer, revision);
      return;
    }

    this.startProceduralTransport(ctx);
    if (this.track === "CASINO") {
      void this.loadCasinoBuffer(ctx).then((buffer) => {
        if (buffer) this.startCasinoAsset(ctx, buffer, revision);
      });
    }
  }

  private startProceduralTransport(ctx: AudioContext) {
    this.nextStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.03;
    this.timer = setInterval(() => this.scheduler(), TICK_MS);
  }

  private loadCasinoBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.casinoBuffer) return Promise.resolve(this.casinoBuffer);
    if (this.casinoBufferPromise) return this.casinoBufferPromise;

    this.casinoBufferPromise = fetch(AUDIO_ASSETS.music.casino, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Casino soundtrack returned ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.casinoBuffer = buffer;
        return buffer;
      })
      .catch(() => {
        // Keep the procedural lounge playing and allow a future retry.
        this.casinoBufferPromise = null;
        return null;
      });

    return this.casinoBufferPromise;
  }

  private startCasinoAsset(ctx: AudioContext, buffer: AudioBuffer, revision: number) {
    if (
      !this._musicOn
      || this.track !== "CASINO"
      || revision !== this.transportRevision
      || ctx !== this.ctx
    ) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const at = ctx.currentTime + LOOKAHEAD_S;
    const source = ctx.createBufferSource();
    const sourceGain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    sourceGain.gain.setValueAtTime(0.0001, at);
    sourceGain.gain.exponentialRampToValueAtTime(1, at + 0.38);
    source.connect(sourceGain).connect(this.musicGain!);
    source.start(at);
    source.onended = () => {
      source.disconnect();
      sourceGain.disconnect();
      if (this.musicSource === source) {
        this.musicSource = null;
        this.musicSourceGain = null;
      }
    };
    this.musicSource = source;
    this.musicSourceGain = sourceGain;
  }

  private stopTransport() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.musicSource) {
      const source = this.musicSource;
      const sourceGain = this.musicSourceGain;
      this.musicSource = null;
      this.musicSourceGain = null;
      if (this.ctx && sourceGain) {
        const at = this.ctx.currentTime;
        sourceGain.gain.cancelScheduledValues(at);
        sourceGain.gain.setValueAtTime(Math.max(0.0001, sourceGain.gain.value), at);
        sourceGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
        try { source.stop(at + 0.03); } catch { source.disconnect(); }
      } else {
        try { source.stop(); } catch { source.disconnect(); }
      }
    }
  }

  stopMusic() {
    this._musicOn = false;
    this.transportRevision++;
    this.stopTransport();
  }

  toggleMusic(): boolean {
    if (this._musicOn) this.stopMusic();
    else this.startMusic();
    return this._musicOn;
  }

  private scheduler() {
    const ctx = this.ctx;
    if (!ctx || !this._musicOn) return;
    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_S) {
      if (this.track === "CASINO") this.scheduleCasinoStep(this.nextStep, this.nextNoteTime);
      else this.scheduleStep(this.nextStep, this.nextNoteTime);
      this.nextStep = (this.nextStep + 1) % this.loopSteps();
      this.nextNoteTime += this.stepSeconds();
    }
  }

  private scheduleCasinoStep(step: number, time: number) {
    const bar = Math.floor(step / BAR_SIXTEENTHS);
    const inBar = step % BAR_SIXTEENTHS;
    const { walk, chord } = CASINO_PROGRESSION[bar];

    // Upright-ish walking bass on every quarter note.
    if (inBar % 4 === 0) {
      this.blip(walk[inBar / 4], time, 0.3, "triangle", 0.15);
    }

    // Chord stabs answering the bass on the off-beats.
    if (CASINO_STAB_STEPS.includes(inBar)) {
      for (const note of chord) this.blip(note, time, 0.16, "sawtooth", 0.035);
    }

    // Ride pattern with a swung second stroke.
    if (inBar % 4 === 0) this.hat(time, 0.016);
    if (inBar % 4 === 2) this.hat(time + this.stepSeconds() * 0.4, 0.011);
  }

  /**
   * The adaptive arrangement. Each layer is gated on `intensity`, so climbing
   * the standings adds instruments to a loop that never restarts — the music
   * thickens under you rather than cutting to a different track.
   */
  private scheduleStep(step: number, time: number) {
    const bar = Math.floor(step / BAR_SIXTEENTHS);
    const inBar = step % BAR_SIXTEENTHS;
    const chord = ARCADE_PROGRESSION[bar];
    const level = this.intensity;
    const sixteenth = ARCADE_SIXTEENTH;

    // L0 — sub pulse. Always present; this is the floor of the mix.
    if (inBar === 0 || inBar === 6 || inBar === 11) {
      this.blip(chord.bass, time, inBar === 0 ? 0.34 : 0.2, "triangle", 0.17);
    }

    // L1 — kit. Kick, backbeat and hats give the grid its pulse.
    if (ARCADE_KICK_STEPS.includes(inBar)) this.kick(time, inBar === 0 ? 0.4 : 0.28);
    if (ARCADE_SNARE_STEPS.includes(inBar)) this.snare(time, 0.16);
    if (inBar % 2 === 1) this.hat(time, level >= 2 ? 0.02 : 0.013);

    // L2 — the drive. A rolling 8th arpeggio that never lets up.
    if (level >= 1 && inBar % 2 === 0) {
      const note = chord.triad[(inBar / 2) % chord.triad.length];
      this.blip(note, time, 0.1, "square", 0.05);
    }

    // L3 — the hook. Everything above exists to carry this.
    if (level >= 2) {
      for (const note of ARCADE_MOTIF) {
        if (note.step !== step) continue;
        this.blip(note.freq, time, note.steps * sixteenth * 0.9, "sawtooth", 0.075);
      }
    }

    // L4 — counter-line an octave down, shadowing the hook a beat late.
    if (level >= 3) {
      for (const note of ARCADE_MOTIF) {
        if ((note.step + 2) % ARCADE_LOOP_STEPS !== step) continue;
        this.blip(note.freq / 2, time, note.steps * sixteenth * 0.6, "square", 0.028);
      }
    }

    // L5 — chaos. 32nd flurries between the arpeggio notes; this is the layer
    // that makes the last thirty seconds feel like the walls are closing in.
    if (level >= 4 && inBar % 2 === 0) {
      const note = chord.triad[(inBar / 2) % chord.triad.length];
      this.blip(note * 2, time + sixteenth * 0.5, 0.05, "square", 0.022);
      if (level >= 5) {
        this.blip(note * 2, time + sixteenth * 0.75, 0.04, "square", 0.02);
        this.blip(note * 3, time + sixteenth * 1.5, 0.04, "square", 0.014);
      }
    }

    // Turnaround fill: a rising sweep across the last bar so the loop point
    // lands as an arrival instead of a seam.
    if (level >= 3 && bar === ARCADE_BARS - 1 && inBar >= 12) {
      this.hat(time, 0.03);
      this.blip(chord.triad[0] * (1 + (inBar - 12) * 0.25), time, 0.07, "sawtooth", 0.03);
    }
  }

  /** Short pitched thump — body from a fast downward sweep, not a sample. */
  private kick(time: number, gainValue: number) {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.09);
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  /** Band-passed noise burst with a little tone under it. */
  private snare(time: number, gainValue: number) {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    src.connect(filter).connect(gain).connect(dest);
    src.start(time);
    src.stop(time + 0.14);
  }

  private blip(
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ) {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    // Percussive envelope: near-instant attack, exponential tail. Ramping to a
    // tiny value rather than 0 because exponentialRamp can't reach zero.
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private hat(time: number, gainValue: number) {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(filter).connect(gain).connect(dest);
    src.start(time);
    src.stop(time + 0.06);
  }

  // --- one-shot stingers (always audible, independent of the music toggle) ---

  private sfxTime(): { ctx: AudioContext; at: number } | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.settings.sfxEnabled || this.settings.muted) return null;
    return { ctx, at: ctx.currentTime };
  }

  /** Short downward noise burst — a mine went off. */
  explosion() {
    const t = this.sfxTime();
    if (!this.allowed("explosion", AUDIO_COOLDOWNS.explosion) || !t || !this.noiseBuffer || !this.sfxGain) return;
    const { ctx, at } = t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, at);
    filter.frequency.exponentialRampToValueAtTime(120, at + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(at);
    src.stop(at + 0.42);
  }

  tileReveal() {
    if (!this.allowed("tileReveal", AUDIO_COOLDOWNS.tileReveal)) return;
    const t = this.sfxTime(); if (!t || !this.sfxGain) return;
    this.blipTo(this.sfxGain, 920, t.at, 0.045, "sine", 0.055);
  }

  tileClick() {
    if (!this.allowed("tileClick", 18)) return;
    const t = this.sfxTime(); if (!t || !this.sfxGain) return;
    this.blipTo(this.sfxGain, 560, t.at, 0.035, "triangle", 0.08);
  }

  flag(placed = true) {
    if (!this.allowed("flag", AUDIO_COOLDOWNS.flag)) return;
    const t = this.sfxTime(); if (!t || !this.sfxGain) return;
    this.blipTo(this.sfxGain, placed ? 1320 : 720, t.at, 0.07, "triangle", 0.09);
  }

  countdown(value: number) {
    const t = this.sfxTime(); if (!t || !this.sfxGain) return;
    this.blipTo(this.sfxGain, value > 0 ? 330 + (3 - value) * 90 : 880, t.at, value > 0 ? 0.18 : 0.35, "square", value > 0 ? 0.16 : 0.22);
  }

  lose() {
    const t = this.sfxTime(); if (!t || !this.sfxGain) return;
    [330, 277, 220].forEach((f, i) => this.blipTo(this.sfxGain!, f, t.at + i * 0.12, 0.22, "triangle", 0.12));
  }

  /** Descending tone: your board just got wiped. Deliberately bleak. */
  wipe() {
    const t = this.sfxTime();
    if (!t || !this.sfxGain) return;
    const { ctx, at } = t;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, at);
    osc.frequency.exponentialRampToValueAtTime(55, at + 0.7);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.75);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(at);
    osc.stop(at + 0.78);
  }

  /** Bright rising two-note flourish for finishing the board. */
  victory() {
    const t = this.sfxTime();
    if (!t) return;
    const { at } = t;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.blipTo(this.sfxGain!, f, at + i * 0.09, 0.16, "square", 0.16);
    });
  }

  // --- casino stingers -------------------------------------------------------

  /** Dry noise tick — a card sliding off the shoe. */
  cardDeal() {
    const t = this.sfxTime();
    if (!t || !this.noiseBuffer || !this.sfxGain) return;
    const { ctx, at } = t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2600;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(at);
    src.stop(at + 0.1);
  }

  /** Ticking wheel that slows as it settles. */
  spin() {
    const t = this.sfxTime();
    if (!t || !this.sfxGain) return;
    const { at } = t;
    // Ticks spaced by a widening gap — the wheel losing momentum.
    let offset = 0;
    for (let i = 0; i < 16; i++) {
      this.blipTo(this.sfxGain, 1800 - i * 40, at + offset, 0.03, "square", 0.05);
      offset += 0.035 + i * 0.006;
    }
  }

  /** Two knocks and a scatter — dice hitting the felt. */
  diceRoll() {
    const t = this.sfxTime();
    if (!t || !this.noiseBuffer || !this.sfxGain) return;
    const { ctx, at } = t;
    for (const delay of [0, 0.13, 0.26, 0.34]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900 + Math.random() * 700;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, at + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + delay + 0.07);
      src.connect(filter).connect(gain).connect(this.sfxGain);
      src.start(at + delay);
      src.stop(at + delay + 0.08);
    }
  }

  /** Bright major arpeggio — the house just paid out. */
  casinoWin() {
    const t = this.sfxTime();
    if (!t || !this.sfxGain) return;
    const { at } = t;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.blipTo(this.sfxGain!, f, at + i * 0.07, 0.14, "square", 0.13);
    });
  }

  /** Flat minor drop — the house keeps it. */
  casinoLose() {
    const t = this.sfxTime();
    if (!t || !this.sfxGain) return;
    const { at } = t;
    [392.0, 349.23, 293.66].forEach((f, i) => {
      this.blipTo(this.sfxGain!, f, at + i * 0.11, 0.2, "sawtooth", 0.11);
    });
  }

  private blipTo(
    dest: AudioNode,
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }
}

let instance: GameAudio | null = null;

export function getGameAudio(): GameAudio {
  if (!instance) instance = new GameAudio();
  return instance;
}
