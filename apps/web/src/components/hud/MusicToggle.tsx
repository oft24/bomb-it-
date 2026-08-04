"use client";

import { useSyncExternalStore } from "react";
import { Music, VolumeX } from "lucide-react";
import { getGameAudio } from "@/lib/gameAudio";
import { cn } from "@/lib/utils";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/audio/audioConfig";

/**
 * Starts the soundtrack on the first click rather than on mount: browsers block
 * an AudioContext that wasn't opened from a user gesture, so autoplaying here
 * would just fail silently and leave the button lying about its state.
 */
export function MusicToggle({ className }: { className?: string }) {
  const audio = getGameAudio();
  const settings = useSyncExternalStore(audio.subscribeSettings, audio.getSettings, () => DEFAULT_AUDIO_SETTINGS);
  const on = settings.musicEnabled;

  function handleToggle() {
    const next = !on;
    audio.setSettings({ musicEnabled: next });
    if (next) audio.startMusic();
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={on}
      aria-label={on ? "Turn music off" : "Turn music on"}
      title={on ? "Music on" : "Music off"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-hud transition-colors",
        on
          ? "border-cyan/40 text-cyan hover:border-cyan/70"
          : "border-border text-ink-500 hover:text-ink-300",
        className,
      )}
    >
      {on ? <Music className="size-3.5" /> : <VolumeX className="size-3.5" />}
    </button>
  );
}
