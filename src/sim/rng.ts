/** Deterministic seeded RNG (mulberry32). The sim must never call Math.random(). */
export interface RNG {
  next(): number;
  range(a: number, b: number): number;
  int(n: number): number;
  state(): number;
}

export function makeRng(seed: number): RNG {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (n) => Math.floor(next() * n),
    state: () => s >>> 0,
  };
}
