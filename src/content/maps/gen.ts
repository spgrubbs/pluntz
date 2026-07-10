import type { MapDef } from '../../sim/types';
import { makeRng } from '../../sim/rng';

/**
 * Skirmish generator: a deterministic random map from a seed. Rejection-
 * sampled rock field, two far-apart homes, rich rocks near the middle.
 */
export function generateSkirmish(seed: number): MapDef {
  const rng = makeRng((seed ^ 0x51a7f00d) >>> 0);
  const width = 2400 + rng.int(4) * 250;
  const height = 1600 + rng.int(4) * 200;
  const hw = width / 2 - 180;
  const hh = height / 2 - 160;

  const rocks: { x: number; y: number; r: number; rich?: boolean }[] = [];
  for (let tries = 0; tries < 90 && rocks.length < 12; tries++) {
    const r = rng.range(45, 135);
    const x = rng.range(-hw, hw);
    const y = rng.range(-hh, hh);
    if (rocks.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 170)) {
      rocks.push({ x, y, r });
    }
  }
  // guarantee playability even on hostile seeds
  while (rocks.length < 6) {
    rocks.push({
      x: rng.range(-hw, hw) * 0.5,
      y: rng.range(-hh, hh) * 0.5,
      r: rng.range(60, 100),
    });
  }

  // homes: the farthest-apart pair, fattened to proper homesteads
  let hi = 0;
  let hj = 1;
  let bestD = 0;
  for (let i = 0; i < rocks.length; i++) {
    for (let j = i + 1; j < rocks.length; j++) {
      const d = Math.hypot(rocks[i].x - rocks[j].x, rocks[i].y - rocks[j].y);
      if (d > bestD) {
        bestD = d;
        hi = i;
        hj = j;
      }
    }
  }
  rocks[hi].r = Math.max(rocks[hi].r, 88);
  rocks[hj].r = Math.max(rocks[hj].r, 88);

  // riches gravitate to the contested middle
  const byCenter = rocks
    .map((r, i) => ({ i, d: Math.hypot(r.x, r.y) }))
    .filter(({ i }) => i !== hi && i !== hj)
    .sort((a, b) => a.d - b.d);
  for (const { i } of byCenter.slice(0, 1 + rng.int(2))) rocks[i].rich = true;

  return {
    id: 'skirmish',
    name: `Skirmish ${seed}`,
    width,
    height,
    sun: {
      angleDeg: 190 + rng.int(70),
      cycle: rng.next() < 0.25,
      cyclePeriodSec: 300,
    },
    debris: { perMin: rng.range(1.2, 2.6) },
    fauna: { frugivora: 2, phytophaga: 2, anthophila: 3, scarabaeidae: 1, araneae: 1 },
    roundSec: 600,
    canopyWin: { share: 0.55, holdSec: 45 },
    asteroids: rocks,
    colonies: [
      { name: 'Verdance', faction: 'pinophyta', player: true, palette: 0 },
      { name: 'Rustspire', faction: 'pinophyta', palette: 1 },
    ],
    spawns: [
      { asteroid: hi, anchorDeg: -90, colony: 0 },
      { asteroid: hj, anchorDeg: -90, colony: 1 },
    ],
  };
}
