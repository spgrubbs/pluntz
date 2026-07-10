import type { MapDef } from '../../sim/types';

/**
 * Development map for M0–M2: a scatter of rocks around one home asteroid,
 * sun fixed to the upper-left (angleDeg 225 in y-down screen coords).
 */
export const DEV01: MapDef = {
  id: 'dev01',
  name: 'Seedfall Reach',
  width: 2400,
  height: 1600,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  debris: { perMin: 1.5 },
  fauna: { frugivora: 1, phytophaga: 1, anthophila: 2, scarabaeidae: 1, araneae: 1, lampyridae: 1 },
  asteroids: [
    { x: 0, y: 120, r: 95, rich: false }, // home rock
    { x: -520, y: -260, r: 70 },
    { x: 480, y: -340, r: 130, rich: true },
    { x: 720, y: 260, r: 55 },
    { x: -780, y: 320, r: 105 },
    { x: 160, y: -640, r: 45 },
    { x: -260, y: 560, r: 60 },
  ],
  colonies: [{ name: 'Verdance', faction: 'pinophyta', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};
