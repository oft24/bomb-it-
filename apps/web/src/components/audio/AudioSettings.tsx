"use client";

import { useSyncExternalStore } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { getGameAudio } from "@/lib/gameAudio";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings as Settings } from "@/lib/audio/audioConfig";

export function AudioSettings() {
  const audio = getGameAudio();
  const settings = useSyncExternalStore(audio.subscribeSettings, audio.getSettings, () => DEFAULT_AUDIO_SETTINGS);
  const update = (next: Partial<Settings>) => {
    const updated = audio.setSettings(next);
    if (updated.musicEnabled && !updated.muted) audio.startMusic();
  };
  return (
    <section className="flex flex-col gap-3 border-t border-border-subtle pt-4" aria-label="Audio settings">
      <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">Audio</span><button type="button" onClick={() => update({ muted: !settings.muted })} aria-label="Mute all">{settings.muted ? <VolumeX className="size-4 text-danger" /> : <Volume2 className="size-4 text-cyan" />}</button></div>
      {(["master", "music", "sfx"] as const).map((key) => <label key={key} className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2 text-[10px] uppercase text-ink-500"><span>{key}</span><input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={(e) => update({ [key]: Number(e.target.value) })} className="accent-cyan"/><span className="text-right font-hud">{Math.round(settings[key] * 100)}%</span></label>)}
      <div className="flex gap-2"><button type="button" onClick={() => update({ musicEnabled: !settings.musicEnabled })} className="flex items-center gap-1 text-[10px] uppercase text-ink-400"><Music className="size-3"/> Music {settings.musicEnabled ? "On" : "Off"}</button><button type="button" onClick={() => update({ sfxEnabled: !settings.sfxEnabled })} className="text-[10px] uppercase text-ink-400">SFX {settings.sfxEnabled ? "On" : "Off"}</button></div>
    </section>
  );
}
