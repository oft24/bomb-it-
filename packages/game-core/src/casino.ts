/**
 * Table games for casino mode. Pure rules, no framework and no I/O: every
 * function takes its randomness as an injectable `rng` so the outcomes can be
 * pinned in tests instead of being hoped at.
 *
 * These deliberately use real casino rules rather than coin flips, because the
 * whole point of the mode is that the house edge is doing something to you.
 */

import type { Rng } from "./rng.js";

export type CasinoGameKind = "BLACKJACK" | "ROULETTE" | "DICE";
export const CASINO_GAMES: CasinoGameKind[] = ["BLACKJACK", "ROULETTE", "DICE"];

export function pickCasinoGame(rng: Rng = Math.random): CasinoGameKind {
  return CASINO_GAMES[Math.floor(rng() * CASINO_GAMES.length)];
}

// --- Blackjack ---------------------------------------------------------------

export interface PlayingCard {
  rank: string;
  suit: string;
  /** Face value; aces enter as 11 and are demoted by `handValue` when needed. */
  value: number;
}

const RANKS: { rank: string; value: number }[] = [
  { rank: "A", value: 11 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
];

const SUITS = ["♠", "♥", "♦", "♣"];

/** Drawn from an infinite shoe — no depletion, so card counting can't help. */
export function drawCard(rng: Rng = Math.random): PlayingCard {
  const { rank, value } = RANKS[Math.floor(rng() * RANKS.length)];
  return { rank, suit: SUITS[Math.floor(rng() * SUITS.length)], value };
}

/** Aces are worth 11 until that would bust the hand, then 1 each as needed. */
export function handValue(cards: PlayingCard[]): number {
  let total = cards.reduce((sum, c) => sum + c.value, 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBust(cards: PlayingCard[]): boolean {
  return handValue(cards) > 21;
}

export function isBlackjack(cards: PlayingCard[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

/** House rules: dealer draws to 16 and stands on all 17s, soft or hard. */
export function playDealer(cards: PlayingCard[], rng: Rng = Math.random): PlayingCard[] {
  const hand = [...cards];
  while (handValue(hand) < 17) hand.push(drawCard(rng));
  return hand;
}

export type Settlement = "PLAYER" | "DEALER" | "PUSH";

export function settleBlackjack(player: PlayingCard[], dealer: PlayingCard[]): Settlement {
  if (isBust(player)) return "DEALER";
  if (isBust(dealer)) return "PLAYER";
  const p = handValue(player);
  const d = handValue(dealer);
  if (p === d) return "PUSH";
  return p > d ? "PLAYER" : "DEALER";
}

// --- Roulette ----------------------------------------------------------------

export type RouletteColor = "RED" | "BLACK" | "GREEN";

// European single-zero wheel: 37 pockets, one green. Red/black therefore pays
// even money on an 18/37 chance — the green zero is the house edge.
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export const ROULETTE_POCKETS = 37;

export function colorForNumber(n: number): RouletteColor {
  if (n === 0) return "GREEN";
  return RED_NUMBERS.has(n) ? "RED" : "BLACK";
}

export interface RouletteResult {
  number: number;
  color: RouletteColor;
}

export function spinRoulette(rng: Rng = Math.random): RouletteResult {
  const number = Math.floor(rng() * ROULETTE_POCKETS);
  return { number, color: colorForNumber(number) };
}

/** Green always loses an even-money colour bet — that's the whole edge. */
export function settleRoulette(bet: "RED" | "BLACK", result: RouletteResult): boolean {
  return result.color === bet;
}

// --- Dice: pair or no pair ---------------------------------------------------

export type DiceRoll = [number, number];
export type DiceBet = "PAIR" | "NO_PAIR";

export function rollDice(rng: Rng = Math.random): DiceRoll {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

export function isPair(roll: DiceRoll): boolean {
  return roll[0] === roll[1];
}

/**
 * A pair lands 6 times in 36, so betting PAIR is the long shot and NO_PAIR is
 * the safe one. Casino mode leans on that asymmetry rather than hiding it: the
 * table you're dealt is random, so sometimes you're handed good odds.
 */
export function settleDice(bet: DiceBet, roll: DiceRoll): boolean {
  return isPair(roll) === (bet === "PAIR");
}
