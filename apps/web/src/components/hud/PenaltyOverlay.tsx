"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function PenaltyOverlay({ seconds, tick }: { seconds: number | null; tick: number }) {
  const [prevTick, setPrevTick] = useState(tick);
  const [visible, setVisible] = useState(false);

  // Adjusting state during render (React-endorsed pattern) instead of an effect,
  // so a new penalty tick shows the overlay in the same render pass.
  if (tick !== prevTick) {
    setPrevTick(tick);
    if (tick !== 0) setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence>
        {visible && seconds != null && (
          <motion.div
            key={tick}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-1"
          >
            <span className="font-hud text-5xl font-black text-danger drop-shadow-[0_0_18px_rgba(255,82,64,0.6)]">
              +{seconds.toFixed(1)}s
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-danger/80">
              Hazard Detonated
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
