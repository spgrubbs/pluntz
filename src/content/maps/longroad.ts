import type { MapDef } from '../../sim/types';

/**
 * THE LONG ROAD I — Shadow Canyon. The campaign's first region (GDD §14).
 *
 * A corridor map. Behind you the Dimming advances — a wave of permanent
 * darkness where photosynthesis simply ends (decomposers stroll through it).
 * Ahead, a canyon: huge northern wall-rocks keep its floor stones in
 * perpetual rock-shadow; Lampyridae lanterns drift here, and chaining them
 * with Lures is the intended crossing. A southern detour is sunlit but long,
 * and rival pilgrims are racing you down it. First colony to hold the
 * eastern threshold rock for 30s crosses — and wins the region.
 */
export const R01_SHADOW_CANYON: MapDef = {
  id: 'r01',
  name: 'LR·I · Shadow Canyon',
  width: 3400,
  height: 1300,
  sun: { angleDeg: -90, cycle: false, cyclePeriodSec: 300 }, // sun due north
  debris: { perMin: 3 },
  dimming: { startX: -1900, speed: 2.6 },
  vanguard: { asteroid: 14, holdSec: 30 },
  fauna: {
    frugivora: 2,
    phytophaga: 1,
    anthophila: 2,
    scarabaeidae: 1,
    araneae: 1,
    lampyridae: 3,
  },
  asteroids: [
    { x: -1450, y: 250, r: 90 }, // 0 home — the Dimming reaches it first
    { x: -1050, y: 380, r: 60 }, // 1
    { x: -1150, y: -150, r: 70, rich: true }, // 2
    { x: -950, y: 560, r: 65 }, // 3 rival home, southern route (clear of wall shadows)
    { x: -600, y: -320, r: 170 }, // 4 canyon wall
    { x: -580, y: 160, r: 48 }, // 5 canyon floor (in the walls' shadow)
    { x: -40, y: -380, r: 190 }, // 6 canyon wall
    { x: -60, y: 200, r: 55 }, // 7 canyon floor
    { x: 520, y: -300, r: 160 }, // 8 canyon wall
    { x: 480, y: 140, r: 50 }, // 9 canyon floor
    { x: -330, y: 590, r: 75 }, // 10 southern detour (in the shadow gap)
    { x: 255, y: 560, r: 65 }, // 11 southern detour (in the shadow gap)
    { x: 760, y: 620, r: 55 }, // 12 southern detour, last stone
    { x: 1100, y: 150, r: 80, rich: true }, // 13 the exit steps
    { x: 1500, y: -50, r: 110 }, // 14 THE THRESHOLD
  ],
  colonies: [
    { name: 'Verdance', faction: 'pinophyta', player: true, palette: 0 },
    { name: 'Pilgrims', faction: 'anthophyta', palette: 1 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 3, anchorDeg: -90, colony: 1 },
  ],
};
