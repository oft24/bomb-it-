import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handValue,
  isBlackjack,
  isBust,
  playDealer,
  settleBlackjack,
  colorForNumber,
  spinRoulette,
  settleRoulette,
  rollDice,
  isPair,
  settleDice,
  drawCard,
  pickCasinoGame,
  ROULETTE_POCKETS,
  type PlayingCard,
} from "./casino.js";

const card = (rank: string, value: number): PlayingCard => ({ rank, suit: "♠", value });

/** Deterministic rng that walks a fixed list of values, looping. */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("aces demote from 11 to 1 only as far as needed to avoid busting", () => {
  assert.equal(handValue([card("A", 11), card("9", 9)]), 20);
  // Two aces: one stays 11, the other drops to 1.
  assert.equal(handValue([card("A", 11), card("A", 11)]), 12);
  // Would bust at 11, so the ace drops.
  assert.equal(handValue([card("A", 11), card("K", 10), card("5", 5)]), 16);
  // Three aces plus a nine: only one ace can stay high.
  assert.equal(handValue([card("A", 11), card("A", 11), card("A", 11), card("9", 9)]), 12);
});

test("blackjack is exactly two cards totalling 21", () => {
  assert.equal(isBlackjack([card("A", 11), card("K", 10)]), true);
  assert.equal(isBlackjack([card("7", 7), card("7", 7), card("7", 7)]), false, "21 on three cards is not blackjack");
});

test("dealer draws below 17 and stands on any 17", () => {
  // Dealer sits on 16 and must draw; the forced card is a 2 -> 18, then stands.
  const rng = seq([1 / 13]); // index 1 in RANKS => "2"
  const hand = playDealer([card("10", 10), card("6", 6)], rng);
  assert.equal(handValue(hand), 18);
  assert.equal(hand.length, 3);

  // A soft 17 still stands: no extra card is drawn.
  const stand = playDealer([card("A", 11), card("6", 6)], () => {
    throw new Error("dealer must not draw on 17");
  });
  assert.equal(stand.length, 2);
});

test("settlement: bust loses, higher hand wins, equal pushes", () => {
  const bustHand = [card("K", 10), card("Q", 10), card("5", 5)];
  assert.equal(settleBlackjack(bustHand, [card("6", 6)]), "DEALER", "player bust loses even if dealer is low");
  assert.equal(settleBlackjack([card("9", 9)], bustHand), "PLAYER", "dealer bust loses");
  assert.equal(settleBlackjack([card("K", 10), card("9", 9)], [card("K", 10), card("8", 8)]), "PLAYER");
  assert.equal(settleBlackjack([card("K", 10), card("8", 8)], [card("K", 10), card("9", 9)]), "DEALER");
  assert.equal(settleBlackjack([card("K", 10), card("9", 9)], [card("10", 10), card("9", 9)]), "PUSH");
});

test("a bust hand is a loss even against a dealer bust", () => {
  const playerBust = [card("K", 10), card("Q", 10), card("4", 4)];
  const dealerBust = [card("K", 10), card("Q", 10), card("3", 3)];
  assert.equal(isBust(playerBust), true);
  assert.equal(settleBlackjack(playerBust, dealerBust), "DEALER");
});

test("roulette wheel has 37 pockets with a single green zero", () => {
  assert.equal(colorForNumber(0), "GREEN");
  let red = 0;
  let black = 0;
  let green = 0;
  for (let n = 0; n < ROULETTE_POCKETS; n++) {
    const c = colorForNumber(n);
    if (c === "RED") red++;
    else if (c === "BLACK") black++;
    else green++;
  }
  assert.equal(green, 1);
  assert.equal(red, 18);
  assert.equal(black, 18);
});

test("green zero loses both colour bets — that is the house edge", () => {
  const zero = spinRoulette(() => 0);
  assert.equal(zero.number, 0);
  assert.equal(settleRoulette("RED", zero), false);
  assert.equal(settleRoulette("BLACK", zero), false);
});

test("roulette pays a matching colour bet", () => {
  const result = { number: 1, color: colorForNumber(1) };
  assert.equal(result.color, "RED");
  assert.equal(settleRoulette("RED", result), true);
  assert.equal(settleRoulette("BLACK", result), false);
});

test("dice settle pair and no-pair bets symmetrically", () => {
  assert.equal(isPair([4, 4]), true);
  assert.equal(isPair([4, 5]), false);
  assert.equal(settleDice("PAIR", [4, 4]), true);
  assert.equal(settleDice("NO_PAIR", [4, 4]), false);
  assert.equal(settleDice("PAIR", [2, 6]), false);
  assert.equal(settleDice("NO_PAIR", [2, 6]), true);
});

test("dice stay within 1-6 and a pair really is 6 in 36", () => {
  let pairs = 0;
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) {
      const roll = rollDice(seq([a / 6, b / 6]));
      assert.ok(roll[0] >= 1 && roll[0] <= 6, `die out of range: ${roll[0]}`);
      assert.ok(roll[1] >= 1 && roll[1] <= 6, `die out of range: ${roll[1]}`);
      if (isPair(roll)) pairs++;
    }
  }
  assert.equal(pairs, 6, "exactly the six doubles across all 36 outcomes");
});

test("cards and game picks stay inside their domains at the rng boundaries", () => {
  // rng() can return values arbitrarily close to 1; nothing may fall off the end.
  for (const r of [0, 0.5, 0.999999]) {
    const c = drawCard(() => r);
    assert.ok(c.rank && c.suit, "card must be fully formed");
    assert.ok(c.value >= 2 && c.value <= 11);
    assert.ok(["BLACKJACK", "ROULETTE", "DICE"].includes(pickCasinoGame(() => r)));
    const spin = spinRoulette(() => r);
    assert.ok(spin.number >= 0 && spin.number < ROULETTE_POCKETS);
  }
});
