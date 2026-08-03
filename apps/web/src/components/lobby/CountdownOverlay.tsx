"use client";

import { AnimatePresence, motion } from "framer-motion";

export function CountdownOverlay({ seconds }: { seconds: number | null }) {
  if (seconds == null) return null;
  const label = seconds > 0 ? String(seconds) : "CLEAR!";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-950/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: seconds > 0 ? 1.4 : 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3"
        >
          <span
            className={
              seconds > 0
                ? "font-hud text-[9rem] font-black leading-none text-ink-100"
                : "font-hud text-7xl font-black leading-none text-cyan drop-shadow-[0_0_40px_rgba(63,224,255,0.55)]"
            }
          >
            {label}
          </span>
          {seconds > 0 && (
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-500">
              Grid Live In
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
