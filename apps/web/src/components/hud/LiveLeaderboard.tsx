"use client";

import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import type { PlayerProgress } from "@sectorzero/shared-types";
import { rankPlayers } from "@/lib/leaderboard";
import { RANK_COLOR } from "@/lib/rank";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/Panel";

const STATUS_LABEL: Record<PlayerProgress["state"], string | null> = {
  PLAYING: null,
  PENALTY: "PENALTY",
  FINISHED: "FINISHED",
  ELIMINATED: "OUT",
  DISCONNECTED: "DC",
  CONNECTED: null,
  READY: null,
};

const STATUS_CLASS: Record<string, string> = {
  PENALTY: "text-danger bg-danger/10 border-danger/30",
  FINISHED: "text-cyan bg-cyan/10 border-cyan/30",
  OUT: "text-ink-700 bg-surface-700 border-border",
  DC: "text-ink-700 bg-surface-700 border-border",
};

export function LiveLeaderboard({
  progress,
  localPlayerId,
  className,
}: {
  progress: PlayerProgress[];
  localPlayerId: string | null;
  className?: string;
}) {
  const ranked = rankPlayers(progress);

  return (
    <Panel className={cn("flex flex-col overflow-hidden", className)}>
      <PanelHeader>
        <PanelTitle>Live Standings</PanelTitle>
        <span className="text-[10px] font-hud text-ink-700">{ranked.length} racing</span>
      </PanelHeader>
      <LayoutGroup>
        <div className="flex flex-col gap-1 overflow-y-auto p-2">
          <AnimatePresence initial={false}>
            {ranked.map((p, i) => {
              const isLocal = p.id === localPlayerId;
              const statusLabel = STATUS_LABEL[p.state];
              return (
                <motion.div
                  key={p.id}
                  layout
                  layoutId={p.id}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-2.5 py-1.5",
                    isLocal
                      ? "border-cyan/40 bg-cyan/[0.06]"
                      : "border-transparent hover:bg-surface-700/60",
                  )}
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center font-hud text-xs font-bold",
                      i === 0 ? "text-cyan" : "text-ink-500",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: RANK_COLOR[p.rank] }}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate text-xs font-medium",
                      isLocal ? "text-ink-100" : "text-ink-300",
                    )}
                  >
                    {p.username}
                    {isLocal && <span className="ml-1 text-cyan">•</span>}
                  </span>
                  {statusLabel ? (
                    <span
                      className={cn(
                        "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide font-hud",
                        STATUS_CLASS[statusLabel],
                      )}
                    >
                      {statusLabel}
                    </span>
                  ) : (
                    <span className="shrink-0 font-hud text-xs font-semibold text-ink-300">
                      {p.progressPct.toFixed(0)}%
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </Panel>
  );
}
