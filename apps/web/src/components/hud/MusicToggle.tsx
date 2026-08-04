"use client";

import { useEffect, useState } from "react";
import { Music, VolumeX } from "lucide-react";
import { getGameAudio } from "@/lib/gameAudio";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "minesw1pe:music";

/**
 * Starts the soundtrack on the first click rather than on mount: browsers block
 * an AudioContext that wasn't opened from a user gesture, so autoplaying here
 * would just fail silently and leave the button lying about its state.
 */
export function MusicToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // Respect the last choice, but only re-arm it once the user interacts.
    if (localStorage.getItem(STORAGE_KEY) !== "on") return;
    const resume = () => {
      setOn(getGameAudio().toggleMusic());
      window.removeEventListener("pointerdown", resume);
    };
    window.addEventListener("pointerdown", resume, { once: true });
    return () => window.removeEventListener("pointerdown", resume);
  }, []);

  function handleToggle() {
    const next = getGameAudio().toggleMusic();
    setOn(next);
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
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
