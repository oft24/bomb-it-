"use client";

import { motion } from "framer-motion";
import type { MatchResultRow } from "@sectorzero/shared-types";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ordinal, formatClock, cn } from "@/lib/utils";
import { Trophy, Target, AlertTriangle, Zap, RotateCcw, ArrowRight, FileBarChart } from "lucide-react";

export function ResultsView({
  results,
  localPlayerId,
  isHost,
  onRematch,
  onReturnToLobby,
}: {
  results: MatchResultRow[];
  localPlayerId: string | null;
  isHost: boolean;
  onRematch: () => void;
  onReturnToLobby: () => void;
}) {
  const local = results.find((r) => r.id === localPlayerId) ?? results[0];
  const xpPct = local ? Math.min(100, (local.xpGained % 1000) / 10) : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-ink-500">
          Match Results
        </span>
        <span
          className={cn(
            "font-hud text-8xl font-black leading-none",
            local?.placement === 1 ? "text-cyan drop-shadow-[0_0_40px_rgba(63,224,255,0.5)]" : "text-ink-100",
          )}
        >
          {local ? ordinal(local.placement) : "—"}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatCard icon={Trophy} label="Time" value={local?.finishTimeMs != null ? formatClock(local.finishTimeMs) : "—"} />
        <StatCard icon={Target} label="Accuracy" value={local ? `${local.accuracyPct.toFixed(0)}%` : "—"} />
        <StatCard icon={AlertTriangle} label="Mistakes" value={local ? String(local.mistakes) : "—"} />
        <StatCard
          icon={Zap}
          label="Rating"
          value={local ? `${local.ratingChange >= 0 ? "+" : ""}${local.ratingChange}` : "—"}
          accent={local && local.ratingChange >= 0 ? "text-success" : "text-danger"}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <Panel className="flex items-center gap-4 px-5 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">XP</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-600">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-cyan to-blue"
            />
          </div>
          <span className="font-hud text-sm font-bold text-cyan">
            +{local?.xpGained ?? 0} XP
          </span>
        </Panel>
      </motion.div>

      <Panel className="overflow-hidden">
        <PanelHeader>
          <PanelTitle>Final Standings</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-ink-700">
                <th className="px-4 py-2 font-medium">Pos</th>
                <th className="px-4 py-2 font-medium">Operative</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Mistakes</th>
                <th className="px-4 py-2 font-medium">Accuracy</th>
                <th className="px-4 py-2 font-medium text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-border-subtle",
                    r.id === localPlayerId && "bg-cyan/[0.06]",
                  )}
                >
                  <td className="px-4 py-2.5 font-hud font-bold text-ink-300">{r.placement}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-100">{r.username}</td>
                  <td className="px-4 py-2.5 font-hud text-ink-300">
                    {r.finishTimeMs != null ? formatClock(r.finishTimeMs) : "DNF"}
                  </td>
                  <td className="px-4 py-2.5 font-hud text-ink-300">{r.mistakes}</td>
                  <td className="px-4 py-2.5 font-hud text-ink-300">{r.accuracyPct.toFixed(0)}%</td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-hud font-semibold",
                      r.ratingChange >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {r.ratingChange >= 0 ? "+" : ""}
                    {r.ratingChange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isHost ? (
          <Button size="lg" onClick={onRematch}>
            <RotateCcw className="size-4" /> Rematch
          </Button>
        ) : (
          <span className="text-xs text-ink-700">Waiting for host to start a rematch…</span>
        )}
        <Button size="lg" variant="secondary" onClick={onReturnToLobby}>
          <ArrowRight className="size-4" /> Return to Lobby
        </Button>
        <Button size="lg" variant="ghost" disabled>
          <FileBarChart className="size-4" /> Match Details
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Panel className="flex flex-col gap-2 p-4">
      <Icon className="size-4 text-ink-500" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={cn("font-hud text-2xl font-bold text-ink-100", accent)}>{value}</span>
    </Panel>
  );
}
