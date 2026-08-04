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
export function CasinoTable({ game, cell, onResolved }: CasinoTableProps) {
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
      setTimeout(() => onResolved(result === "WIN"), 1500);
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
            CELL {cell.x},{cell.y}
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
                {outcome === "WIN" ? "Cell Opened" : outcome === "PUSH" ? "Push" : "House Wins"}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-500">
                {outcome === "WIN"
                  ? "The square is yours."
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

  function bet(choice: "RED" | "BLACK") {
    setPhase("RESOLVING");
    getGameAudio().spin();
    const spun = spinRoulette();
    // Let the wheel "run" before showing the pocket.
    setTimeout(() => {
      setResult(spun);
      onFinish(settleRoulette(choice, spun) ? "WIN" : "LOSE");
    }, 900);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-24 items-center justify-center rounded-lg border border-border-subtle bg-bg-900">
        {result ? (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "flex size-16 items-center justify-center rounded-full font-hud text-2xl font-black",
              result.color === "RED" && "bg-danger text-ink-100",
              result.color === "BLACK" && "bg-bg-950 text-ink-100 ring-1 ring-border-strong",
              result.color === "GREEN" && "bg-success text-bg-950",
            )}
          >
            {result.number}
          </motion.div>
        ) : phase === "RESOLVING" ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
            className="size-12 rounded-full border-4 border-warning border-t-transparent"
          />
        ) : (
          <span className="font-hud text-xs uppercase tracking-[0.2em] text-ink-700">
            Place your bet
          </span>
        )}
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
