export const AUDIO_STORAGE_KEY = "game_audio_settings";

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.6,
  muted: false,
  musicEnabled: true,
  sfxEnabled: true,
};

export const AUDIO_COOLDOWNS = {
  tileReveal: 25,
  flag: 45,
  buttonHover: 75,
  explosion: 100,
} as const;

export function loadAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? "{}") as Partial<AudioSettings>;
    return { ...DEFAULT_AUDIO_SETTINGS, ...saved };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
}
