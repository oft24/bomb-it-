"use client";

import { motion } from "framer-motion";
import { ordinal, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function FinishOverlay({
  placement,
  finishTimeMs,
  onViewResults,
}: {
  placement: number;
  finishTimeMs: number;
  onViewResults: () => void;
}) {
  const isWin = placement === 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-bg-950/85 backdrop-blur-md"
    >
      {isWin && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.5, scale: 2.4 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute size-40 rounded-full bg-cyan/30 blur-3xl"
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="relative flex flex-col items-center gap-2"
      >
        <span
          className={cn(
            "font-hud text-lg font-bold uppercase tracking-[0.3em]",
            isWin ? "text-cyan" : "text-ink-500",
          )}
        >
          {isWin ? "Victory" : "Grid Cleared"}
        </span>
        <span
          className={cn(
            "font-hud text-8xl font-black leading-none",
            isWin
              ? "text-ink-100 drop-shadow-[0_0_50px_rgba(63,224,255,0.5)]"
              : "text-ink-100",
          )}
        >
          {ordinal(placement)}
        </span>
        <span className="mt-2 font-hud text-2xl font-semibold text-ink-300">
          {formatClock(finishTimeMs)}
        </span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Button onClick={onViewResults} size="lg">
          View Results
        </Button>
      </motion.div>
    </motion.div>
  );
}
