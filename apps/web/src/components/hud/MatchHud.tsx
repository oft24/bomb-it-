import { Logo } from "@/components/ui/Logo";
import { MatchTimer } from "./MatchTimer";
import { HudStat } from "./HudStat";
import { MusicToggle } from "./MusicToggle";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

interface MatchHudProps {
  position: number;
  totalPlayers: number;
  startedAt: number | null;
  running: boolean;
  progressPct: number;
  minesRemaining: number;
  ping: number;
  connected: boolean;
  roomId: string;
  /** Detonations on the current run. */
  mistakes: number;
  /** Budget before the board is wiped; 0 means the rule is off. */
  maxMistakes: number;
}

export function MatchHud({
  position,
  totalPlayers,
  startedAt,
  running,
  progressPct,
  minesRemaining,
  ping,
  connected,
  roomId,
  mistakes,
  maxMistakes,
}: MatchHudProps) {
  const positionColor =
    position === 1 ? "text-cyan" : position <= 3 ? "text-ink-100" : "text-ink-300";
  const livesLeft = Math.max(0, maxMistakes - mistakes);
  const livesColor =
    livesLeft === 0 ? "text-danger" : livesLeft <= 2 ? "text-warning" : "text-ink-100";

  return (
    <header className="flex items-center justify-between gap-6 border-b border-border-subtle bg-surface-800/80 px-5 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Logo markClassName="size-6" className="hidden lg:flex" />
        <div className="hidden h-8 w-px bg-border lg:block" />
        <HudStat
          label="Position"
          value={
            <span className={positionColor}>
              {position}
              <span className="text-sm text-ink-500">/{totalPlayers}</span>
            </span>
          }
        />
      </div>

      <div className="flex items-center gap-8">
        <HudStat label="Time" value={<MatchTimer startedAt={startedAt} running={running} />} />
        <HudStat
          label="Progress"
          value={
            <span>
              {progressPct.toFixed(1)}
              <span className="text-sm text-ink-500">%</span>
            </span>
          }
        />
        <HudStat
          label="Mines"
          value={<span className={minesRemaining < 0 ? "text-danger" : ""}>{minesRemaining}</span>}
        />
        {maxMistakes > 0 && (
          <HudStat
            label="Lives"
            value={
              <span className={livesColor}>
                {livesLeft}
                <span className="text-sm text-ink-500">/{maxMistakes}</span>
              </span>
            }
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right text-xs text-ink-500 sm:block">
          <div className="font-hud text-ink-300">{roomId}</div>
        </div>
        <MusicToggle />
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-hud",
            connected ? "border-success/30 text-success" : "border-danger/30 text-danger",
          )}
        >
          {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {connected ? `${ping}ms` : "OFFLINE"}
        </div>
      </div>
    </header>
  );
}
