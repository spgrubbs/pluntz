import type { MapDef } from '../../sim/types';

/** Campaign I — a gentle first round: open light, a sleepy rival, no weather. */
export const C01_FIRST_LIGHT: MapDef = {
  id: 'c01',
  name: 'I · First Light',
  width: 2200,
  height: 1500,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 300 },
  debris: { perMin: 0.5 },
  fauna: { frugivora: 1, phytophaga: 1, anthophila: 2 },
  roundSec: 480,
  canopyWin: { share: 0.6, holdSec: 45 },
  asteroids: [
    { x: -650, y: 150, r: 100 }, // a generous sunlit home
    { x: 700, y: -250, r: 60 }, // the rival makes do with less
    { x: 0, y: -80, r: 110, rich: true },
    { x: -150, y: -550, r: 55 },
    { x: 300, y: 420, r: 70 },
    { x: -700, y: -400, r: 60 },
  ],
  colonies: [
    { name: 'Verdance', faction: 'pinophyta', player: true, palette: 0 },
    { name: 'Rustspire', faction: 'pinophyta', palette: 1 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 1, anchorDeg: -90, colony: 1 },
  ],
};

/** Campaign III — the Gloom: a clustered crescent of rocks where a fungal
 * empire is already established. Their spores hop; your seeds must arc. */
export const C03_GLOOMFALL: MapDef = {
  id: 'c03',
  name: 'III · Gloomfall',
  width: 2600,
  height: 1800,
  sun: { angleDeg: 235, cycle: false, cyclePeriodSec: 300 },
  debris: { perMin: 2.5 },
  fauna: { frugivora: 2, phytophaga: 2, anthophila: 3 },
  roundSec: 600,
  canopyWin: { share: 0.55, holdSec: 45 },
  asteroids: [
    { x: -900, y: 300, r: 95 }, // your lonely home
    { x: -350, y: -100, r: 75, rich: true },
    { x: 100, y: -350, r: 85 },
    { x: 450, y: -520, r: 70 }, // the crescent begins
    { x: 780, y: -430, r: 80 },
    { x: 980, y: -120, r: 90 }, // fungal seat
    { x: 900, y: 260, r: 70 },
    { x: 580, y: 500, r: 65 },
    { x: -200, y: 620, r: 60 },
  ],
  colonies: [
    { name: 'Verdance', faction: 'pinophyta', player: true, palette: 0 },
    { name: 'The Gloom', faction: 'basidiomycota', lockFaction: true, palette: 0 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 5, anchorDeg: -90, colony: 1 },
    { asteroid: 4, anchorDeg: 90, colony: 1 }, // the web has a head start
  ],
};
