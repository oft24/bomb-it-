/**
 * Chiptune soundtrack + stingers, synthesised in the browser with Web Audio.
 *
 * No audio files: every note is an oscillator, so this adds nothing to the
 * bundle and never blocks a match on a network fetch. The loop is a four-bar
 * i–VI–III–VII progression in A minor at 150bpm — fast enough to push you, short
 * enough to sit under a two-minute race without becoming the main event.
 */

const BPM = 150;
const SIXTEENTH = 60 / BPM / 4;
const BAR_SIXTEENTHS = 16;
const LOOP_SIXTEENTHS = BAR_SIXTEENTHS * 4;

// Scheduler: queue a little ahead of the clock so timing survives a busy main
// thread, and re-check often enough that the queue never runs dry.
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

const A_MINOR_PROGRESSION = [
  { root: 220.0, triad: [220.0, 261.63, 329.63] }, // Am
  { root: 174.61, triad: [174.61, 220.0, 261.63] }, // F
  { root: 261.63, triad: [261.63, 329.63, 392.0] }, // C
  { root: 196.0, triad: [196.0, 246.94, 293.66] }, // G
];

/** Which 16ths of a bar the hats land on — off-beats, for forward drive. */
const HAT_STEPS = [2, 6, 10, 14];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStep = 0;
  private nextNoteTime = 0;
  private noiseBuffer: AudioBuffer | null = null;

  private _musicOn = false;
  get musicOn() {
    return this._musicOn;
  }

  /** Must be called from a user gesture — browsers won't start audio otherwise. */
  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
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
    if (!ctx || this._musicOn) return;
    this._musicOn = true;
    this.nextStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.scheduler(), TICK_MS);
  }

  stopMusic() {
    this._musicOn = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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
      this.scheduleStep(this.nextStep, this.nextNoteTime);
      this.nextStep = (this.nextStep + 1) % LOOP_SIXTEENTHS;
      this.nextNoteTime += SIXTEENTH;
    }
  }

  private scheduleStep(step: number, time: number) {
    const bar = Math.floor(step / BAR_SIXTEENTHS);
    const inBar = step % BAR_SIXTEENTHS;
    const chord = A_MINOR_PROGRESSION[bar];

    // Lead: a rolling triad arpeggio on every other 16th, jumping an octave in
    // the back half of the bar so the four bars don't feel identical.
    if (inBar % 2 === 0) {
      const note = chord.triad[(inBar / 2) % chord.triad.length];
      const octave = inBar >= 8 ? 2 : 1;
      this.blip(note * octave, time, 0.11, "square", 0.055);
    }

    // Bass: root on the downbeat and the "and" of 3, the classic driving pulse.
    if (inBar === 0 || inBar === 10) {
      this.blip(chord.root / 2, time, 0.18, "triangle", 0.13);
    }

    if (HAT_STEPS.includes(inBar)) this.hat(time, 0.02);
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
    if (!ctx || !this.master) return null;
    return { ctx, at: ctx.currentTime };
  }

  /** Short downward noise burst — a mine went off. */
  explosion() {
    const t = this.sfxTime();
    if (!t || !this.noiseBuffer || !this.master) return;
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
    src.connect(filter).connect(gain).connect(this.master);
    src.start(at);
    src.stop(at + 0.42);
  }

  /** Descending tone: your board just got wiped. Deliberately bleak. */
  wipe() {
    const t = this.sfxTime();
    if (!t || !this.master) return;
    const { ctx, at } = t;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, at);
    osc.frequency.exponentialRampToValueAtTime(55, at + 0.7);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.75);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.78);
  }

  /** Bright rising two-note flourish for finishing the board. */
  victory() {
    const t = this.sfxTime();
    if (!t) return;
    const { at } = t;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.blipTo(this.master!, f, at + i * 0.09, 0.16, "square", 0.16);
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
