import { useMatchClock } from "@/lib/useMatchClock";
import { formatClock } from "@/lib/utils";

/** Isolated so its 60fps tick only re-renders this node, not the whole HUD. */
export function MatchTimer({ startedAt, running }: { startedAt: number | null; running: boolean }) {
  const elapsed = useMatchClock(startedAt, running);
  return <span className="font-hud text-2xl font-bold text-ink-100">{formatClock(elapsed)}</span>;
}
