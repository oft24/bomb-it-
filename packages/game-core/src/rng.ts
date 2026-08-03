/**
 * Deterministic seeded RNG. Given the same string seed, every call site
 * (server, or a client replaying for verification) produces the exact same
 * sequence — this is what lets every player in a match receive a
 * byte-identical board without the server shipping the mine layout up front.
 */
export type Rng = () => number;

// cyrb128: string -> 4x 32-bit hash state, used to seed mulberry32.
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function mulberry32(a: number): Rng {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed: string): Rng {
  const [a] = cyrb128(seed);
  return mulberry32(a);
}

/** Random integer in [0, max). */
export function randInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

export function generateMatchSeed(): string {
  // crypto.randomUUID is available in Node 19+ and all modern browsers.
  return crypto.randomUUID();
}
