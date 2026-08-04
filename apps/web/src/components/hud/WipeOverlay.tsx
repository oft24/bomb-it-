"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Fires when the mistake budget runs out and the server wipes your board. Held
 * longer than the penalty popup because it's a much worse thing to miss: the
 * grid silently emptying with no explanation would just read as a bug.
 */
export function WipeOverlay({ tick, resets }: { tick: number; resets: number }) {
  const [prevTick, setPrevTick] = useState(tick);
  const [visible, setVisible] = useState(false);

  // Adjusting state during render (React-endorsed pattern) instead of an effect,
  // so a new wipe shows the overlay in the same render pass.
  if (tick !== prevTick) {
    setPrevTick(tick);
    if (tick !== 0) setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={tick}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-2 rounded-xl border border-danger/40 bg-bg-950/85 px-10 py-7 backdrop-blur-md"
          >
            <span className="font-hud text-4xl font-black text-danger drop-shadow-[0_0_20px_rgba(255,82,64,0.65)]">
              BOARD WIPED
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink-300">
              Too many mines — starting over
            </span>
            <span className="font-hud text-[11px] text-ink-500">
              Restart #{resets} · same grid, back to zero
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
