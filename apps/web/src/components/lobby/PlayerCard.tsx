import type { PublicPlayer } from "@sectorzero/shared-types";
import { RankBadge } from "@/components/ui/RankBadge";
import { cn } from "@/lib/utils";
import { Crown, Check, WifiOff } from "lucide-react";

export function PlayerCard({ player, isLocal }: { player: PublicPlayer; isLocal: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors",
        isLocal ? "border-cyan/40 bg-cyan/[0.06]" : "border-border-subtle bg-surface-800",
        !player.connected && "opacity-45",
      )}
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold uppercase"
        style={{
          background: "var(--color-surface-600)",
          color: "var(--color-ink-300)",
        }}
      >
        {player.username.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-xs font-semibold text-ink-100">
          <span className="truncate">{player.username}</span>
          {player.isHost && <Crown className="size-3 shrink-0 text-warning" />}
          {!player.connected && <WifiOff className="size-3 shrink-0 text-danger" />}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
          <RankBadge rank={player.rank} size="sm" />
          <span>Lv.{player.level}</span>
        </div>
      </div>
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          player.isReady ? "border-success bg-success/15 text-success" : "border-border text-ink-700",
        )}
      >
        {player.isReady && <Check className="size-3" strokeWidth={3} />}
      </div>
    </div>
  );
}
