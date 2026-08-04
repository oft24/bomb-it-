"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  drawCard,
  handValue,
  isBust,
  playDealer,
  settleBlackjack,
  spinRoulette,
  settleRoulette,
  rollDice,
  settleDice,
  colorForNumber,
  type CasinoGameKind,
  type PlayingCard,
  type RouletteResult,
  type DiceRoll,
} from "@sectorzero/game-core";
import { getGameAudio } from "@/lib/gameAudio";
import { cn } from "@/lib/utils";

type Phase = "BET" | "RESOLVING" | "RESULT";
type Outcome = "WIN" | "LOSE" | "PUSH";

interface CasinoTableProps {
  game: CasinoGameKind;
  /** Board coordinates of the cell being wagered on, for context in the header. */
  cell: { x: number; y: number };
  action?: "OPEN" | "PLACE FLAG" | "REMOVE FLAG";
  onResolved: (won: boolean) => void;
}

const TITLES: Record<CasinoGameKind, string> = {
  BLACKJACK: "Blackjack",
  ROULETTE: "Roulette",
  DICE: "Pair or No Pair",
};

/**
 * The wager that gates a single cell in casino mode. Resolves to win/lose and
 * hands the answer back up; the caller decides what that means for the board.
 * A push returns the stake — the cell stays shut but nothing is lost, so the
 * player can simply click again.
 */
export function CasinoTable({ game, cell, action = "OPEN", onResolved }: CasinoTableProps) {
  const [phase, setPhase] = useState<Phase>("BET");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const finish = useCallback(
    (result: Outcome) => {
      setOutcome(result);
      setPhase("RESULT");
      const audio = getGameAudio();
      if (result === "WIN") audio.casinoWin();
      else if (result === "LOSE") audio.casinoLose();
      // Let the result land before the board takes over again.
      setTimeout(() => onResolved(result === "WIN"), 650);
    },
    [onResolved],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-950/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-xl border border-warning/40 bg-surface-800 p-6 shadow-[0_0_60px_rgba(255,176,32,0.15)]"
        role="dialog"
        aria-modal="true"
        aria-label={`${TITLES[game]} — wager for cell ${cell.x},${cell.y}`}
      >
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-hud text-xl font-black uppercase tracking-[0.12em] text-warning">
            {TITLES[game]}
          </h2>
          <span className="font-hud text-[11px] text-ink-500">
            {action} · CELL {cell.x},{cell.y}
          </span>
        </div>

        {game === "BLACKJACK" && <Blackjack phase={phase} setPhase={setPhase} onFinish={finish} />}
        {game === "ROULETTE" && <Roulette phase={phase} setPhase={setPhase} onFinish={finish} />}
        {game === "DICE" && <Dice phase={phase} setPhase={setPhase} onFinish={finish} />}

        <AnimatePresence>
          {outcome && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-5 rounded-lg border px-4 py-3 text-center",
                outcome === "WIN"
                  ? "border-success/40 bg-success/10"
                  : outcome === "PUSH"
                    ? "border-border bg-surface-700"
                    : "border-danger/40 bg-danger/10",
              )}
            >
              <div
                className={cn(
                  "font-hud text-lg font-black uppercase tracking-[0.15em]",
                  outcome === "WIN"
                    ? "text-success"
                    : outcome === "PUSH"
                      ? "text-ink-300"
                      : "text-danger",
                )}
              >
                {outcome === "WIN" ? (action === "OPEN" ? "Cell Opened" : "Action Won") : outcome === "PUSH" ? "Push" : "House Wins"}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-500">
                {outcome === "WIN"
                  ? action === "OPEN" ? "The square is yours." : `${action.toLowerCase()} confirmed.`
                  : outcome === "PUSH"
                    ? "Stake returned — the cell stays shut."
                    : "The square stays shut."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// --- shared bits -------------------------------------------------------------

interface GameProps {
  phase: Phase;
  setPhase: (p: Phase) => void;
  onFinish: (o: Outcome) => void;
}

function BetButton({
  children,
  onClick,
  disabled,
  tone = "warning",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "warning" | "red" | "black";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 rounded-md border px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-40",
        tone === "warning" && "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20",
        tone === "red" && "border-danger/50 bg-danger/15 text-danger hover:bg-danger/25",
        tone === "black" && "border-border-strong bg-bg-950 text-ink-200 hover:bg-surface-700",
      )}
    >
      {children}
    </button>
  );
}

function CardFace({ card }: { card: PlayingCard }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-16 w-12 flex-col items-center justify-center rounded-md border border-border-strong bg-ink-100 font-bold text-bg-950"
    >
      <span className="text-sm leading-none">{card.rank}</span>
      <span className={cn("text-lg leading-none", red ? "text-danger" : "text-bg-950")}>
        {card.suit}
      </span>
    </motion.div>
  );
}

function Hand({ label, cards, total }: { label: string; cards: PlayingCard[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          {label}
        </span>
        <span className="font-hud text-sm text-ink-100">{total}</span>
      </div>
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <CardFace key={`${c.rank}${c.suit}${i}`} card={c} />
        ))}
      </div>
    </div>
  );
}

// --- Blackjack ---------------------------------------------------------------

function Blackjack({ phase, setPhase, onFinish }: GameProps) {
  // Dealt once on mount; regenerating on re-render would reshuffle mid-hand.
  const initial = useMemo(
    () => ({ player: [drawCard(), drawCard()], dealer: [drawCard()] }),
    [],
  );
  const [player, setPlayer] = useState<PlayingCard[]>(initial.player);
  const [dealer, setDealer] = useState<PlayingCard[]>(initial.dealer);

  const playerTotal = handValue(player);

  useEffect(() => {
    getGameAudio().cardDeal();
  }, []);

  function hit() {
    const next = [...player, drawCard()];
    setPlayer(next);
    getGameAudio().cardDeal();
    if (isBust(next)) {
      setPhase("RESOLVING");
      setTimeout(() => onFinish("LOSE"), 500);
    }
  }

  function stand() {
    setPhase("RESOLVING");
    const finalDealer = playDealer(dealer);
    setDealer(finalDealer);
    getGameAudio().cardDeal();
    const settled = settleBlackjack(player, finalDealer);
    setTimeout(
      () => onFinish(settled === "PLAYER" ? "WIN" : settled === "PUSH" ? "PUSH" : "LOSE"),
      600,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Hand label="House" cards={dealer} total={handValue(dealer)} />
      <Hand label="You" cards={player} total={playerTotal} />
      <p className="text-[11px] text-ink-500">
        Beat the house without going over 21. It draws to 16 and stands on 17.
      </p>
      <div className="flex gap-2">
        <BetButton onClick={hit} disabled={phase !== "BET"}>
          Hit
        </BetButton>
        <BetButton onClick={stand} disabled={phase !== "BET"}>
          Stand
        </BetButton>
      </div>
    </div>
  );
}

// --- Roulette ----------------------------------------------------------------

function Roulette({ phase, setPhase, onFinish }: GameProps) {
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [rotation, setRotation] = useState(0);

  function bet(choice: "RED" | "BLACK") {
    setPhase("RESOLVING");
    getGameAudio().spin();
    const spun = spinRoulette();
    setRotation((current) => current + 1440 + (36 - spun.number) * (360 / 37));
    // Fast tournament pacing: wheel and tick sequence land together.
    setTimeout(() => {
      setResult(spun);
      onFinish(settleRoulette(choice, spun) ? "WIN" : "LOSE");
    }, 1050);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-xl border border-warning/20 bg-[radial-gradient(circle_at_center,#201810_0,#08090b_68%)] shadow-inner">
        <div className="absolute top-2 z-20 h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-warning drop-shadow-[0_0_8px_rgba(255,176,32,.8)]" />
        <motion.div animate={{ rotate: rotation }} transition={{ duration: 1.05, ease: [0.12, 0.72, 0.12, 1] }} className="relative size-40 rounded-full border-[6px] border-[#b98a3f] bg-[repeating-conic-gradient(#c9342f_0deg_9.73deg,#111318_9.73deg_19.46deg)] shadow-[0_0_0_3px_#3c2914,0_10px_35px_#000]">
          <div className="absolute inset-[18%] rounded-full border-2 border-[#d6ad65] bg-[radial-gradient(circle,#9d722f_0_16%,#18120b_17%_44%,#bd8e43_45%_49%,#090a0c_50%)]" />
          {ROULETTE_LABELS.map((number, index) => {
            const angle = index * (360 / ROULETTE_LABELS.length);
            return <span key={number} className="absolute left-1/2 top-1/2 font-hud text-[7px] font-black text-white" style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-67px) rotate(${-angle}deg)` }}>{number}</span>;
          })}
        </motion.div>
        <motion.div animate={phase === "RESOLVING" ? { rotate: -1080 } : { rotate: 0 }} transition={{ duration: 1.05, ease: [0.12, 0.72, 0.12, 1] }} className="pointer-events-none absolute size-[174px] rounded-full border border-white/10">
          <span className="absolute left-1/2 top-1 size-2.5 -translate-x-1/2 rounded-full bg-ink-100 shadow-[0_0_8px_white]" />
        </motion.div>
        <AnimatePresence>{result && <motion.div initial={{ opacity: 0, scale: .5 }} animate={{ opacity: 1, scale: 1 }} className={cn("absolute bottom-2 z-20 rounded-full px-3 py-1 font-hud text-sm font-black shadow-xl", result.color === "RED" && "bg-danger text-white", result.color === "BLACK" && "bg-bg-950 text-white ring-1 ring-border-strong", result.color === "GREEN" && "bg-success text-bg-950")}>{result.number}</motion.div>}</AnimatePresence>
      </div>
      <p className="text-[11px] text-ink-500">
        Single-zero wheel: 18 red, 18 black, one green. Green takes everything.
      </p>
      <div className="flex gap-2">
        <BetButton tone="red" onClick={() => bet("RED")} disabled={phase !== "BET"}>
          Red
        </BetButton>
        <BetButton tone="black" onClick={() => bet("BLACK")} disabled={phase !== "BET"}>
          Black
        </BetButton>
      </div>
    </div>
  );
}

const ROULETTE_LABELS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

// --- Dice --------------------------------------------------------------------

const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function Dice({ phase, setPhase, onFinish }: GameProps) {
  const [roll, setRoll] = useState<DiceRoll | null>(null);

  function bet(choice: "PAIR" | "NO_PAIR") {
    setPhase("RESOLVING");
    getGameAudio().diceRoll();
    const rolled = rollDice();
    setTimeout(() => {
      setRoll(rolled);
      onFinish(settleDice(choice, rolled) ? "WIN" : "LOSE");
    }, 800);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-24 items-center justify-center gap-4 rounded-lg border border-border-subtle bg-bg-900">
        {roll ? (
          roll.map((d, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.5, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="text-6xl leading-none text-ink-100"
            >
              {PIPS[d]}
            </motion.span>
          ))
        ) : phase === "RESOLVING" ? (
          <motion.span
            animate={{ rotate: [0, -20, 20, 0] }}
            transition={{ repeat: Infinity, duration: 0.3 }}
            className="text-6xl leading-none text-warning"
          >
            🎲
          </motion.span>
        ) : (
          <span className="font-hud text-xs uppercase tracking-[0.2em] text-ink-700">
            Call it
          </span>
        )}
      </div>
      <p className="text-[11px] text-ink-500">
        Two dice. A pair lands 6 times in 36 — the long shot pays, the safe call
        is no pair.
      </p>
      <div className="flex gap-2">
        <BetButton onClick={() => bet("PAIR")} disabled={phase !== "BET"}>
          Pair
        </BetButton>
        <BetButton onClick={() => bet("NO_PAIR")} disabled={phase !== "BET"}>
          No Pair
        </BetButton>
      </div>
    </div>
  );
}

export { colorForNumber };
