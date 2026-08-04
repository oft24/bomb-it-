"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { AudioSettings } from "./AudioSettings";

export function AudioMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface-800/80 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300 transition hover:border-cyan/50 hover:text-cyan" aria-expanded={open} aria-label="Open audio settings">
        <SlidersHorizontal className="size-3.5" /> Audio
      </button>
        {open && <motion.div animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-surface-800/95 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="font-hud text-sm font-black uppercase text-ink-100">Sound console</p><p className="text-[10px] text-ink-500">Music and game feedback</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close audio settings"><X className="size-4 text-ink-500" /></button></div>
          <AudioSettings />
        </motion.div>}
    </div>
  );
}
