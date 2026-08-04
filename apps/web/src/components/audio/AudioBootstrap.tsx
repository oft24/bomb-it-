"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getGameAudio } from "@/lib/gameAudio";
import { Volume2 } from "lucide-react";

export function AudioBootstrap() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const audio = getGameAudio();
    if (pathname !== "/match") audio.setTrack("CASINO");
  }, [pathname]);

  useEffect(() => {
    const unlock = async () => {
      const audio = getGameAudio();
      const ready = await audio.unlock();
      if (ready) {
        setReady(true);
        if (audio.getSettings().musicEnabled && !audio.getSettings().muted) audio.startMusic();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  if (ready) return null;
  return <div className="pointer-events-none fixed bottom-5 left-5 z-[70] flex items-center gap-2 rounded-full border border-cyan/25 bg-surface-800/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-300 shadow-xl backdrop-blur-xl"><Volume2 className="size-3.5 text-cyan" /> Tap once to enable audio</div>;
}
