import type { MapDef } from '../../sim/types';

/** Campaign I — a gentle first round: open light, a sleepy rival, no weather. */
export const C01_FIRST_LIGHT: MapDef = {
  id: 'c01',
  name: 'I · First Light',
  width: 2200,
  height: 1500,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 300 },
  debris: { perMin: 2 },
  fauna: { frugivora: 1, phytophaga: 1, anthophila: 2, scarabaeidae: 1, lampyridae: 1 },
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

/** Campaign IV — Terra Incognita: a huge fogged frontier. You see only what
 * your colony, your seeds and your couriers are near; the rest of the map is
 * rumor. A rival grows unseen, scarabs quietly redraw the rocks, and Ping and
 * Lure double as scouting flares. */
export const C04_TERRA_INCOGNITA: MapDef = {
  id: 'c04',
  name: 'IV · Terra Incognita',
  width: 2600,
  height: 2000,
  sun: { angleDeg: 210, cycle: true, cyclePeriodSec: 340 },
  debris: { perMin: 5 },
  fog: true,
  fauna: { frugivora: 2, phytophaga: 2, anthophila: 3, scarabaeidae: 2, araneae: 1, lampyridae: 2 },
  roundSec: 780,
  canopyWin: { share: 0.6, holdSec: 75 },
  asteroids: [
    { x: -1050, y: 620, r: 100 }, // home, tucked in a dark corner
    { x: -620, y: 260, r: 80 },
    { x: -780, y: -420, r: 70, rich: true },
    { x: -260, y: -140, r: 95 },
    { x: -100, y: 720, r: 75 },
    { x: 350, y: 350, r: 85 },
    { x: 420, y: -560, r: 110, rich: true },
    { x: 150, y: -820, r: 60 },
    { x: 900, y: -250, r: 90 },
    { x: 1080, y: 480, r: 100 }, // somewhere out there, the rival
    { x: 700, y: 800, r: 65 },
  ],
  colonies: [
    { name: 'Verdance', faction: 'pinophyta', player: true, palette: 0 },
    { name: 'The Unseen', faction: 'anthophyta', palette: 1 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 9, anchorDeg: -90, colony: 1 },
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
  debris: { perMin: 4 },
  fauna: { frugivora: 2, phytophaga: 2, anthophila: 3, scarabaeidae: 1, lampyridae: 1 },
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
