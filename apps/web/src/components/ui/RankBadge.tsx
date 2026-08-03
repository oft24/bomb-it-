import type { RankTier } from "@sectorzero/shared-types";
import { RANK_COLOR, RANK_LABEL } from "@/lib/rank";
import { cn } from "@/lib/utils";

export function RankBadge({
  rank,
  size = "md",
  showLabel = true,
  className,
}: {
  rank: RankTier;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const color = RANK_COLOR[rank];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide",
        size === "sm" ? "text-[10px]" : "text-xs",
        className,
      )}
      style={{ color }}
    >
      <span
        aria-hidden
        className={cn("inline-block shrink-0 rotate-45", size === "sm" ? "size-1.5" : "size-2")}
        style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
      />
      {showLabel && RANK_LABEL[rank]}
    </span>
  );
}
