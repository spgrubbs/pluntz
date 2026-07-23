import type { MapDef } from '../../sim/types';

/**
 * THE DRIFT — the follow-the-propagule sandbox (GDD §15, Phases A+B). One
 * lineage, one camera: the player follows an Heir across a wide field of
 * rocks, launching Heir Seeds to found new gardens while the old ones retire
 * into autonomous Legacy gardens that trickle the Legacy spent in the shop.
 *
 * A single colony (no rival win/lose — the Drift is a sandbox first). Feral
 * colonies and a fully-fogged Deep Field are Phase C+. Fauna are plentiful:
 * ferries to ride, grazers to fear, and — for Droseraceae — dinner.
 */
export const DRIFT01_THE_DRIFT: MapDef = {
  id: 'drift01',
  name: 'The Drift',
  width: 4200,
  height: 3000,
  sun: { angleDeg: 210, cycle: true, cyclePeriodSec: 340 },
  debris: { perMin: 3.4 }, // debris currents to ride
  fauna: { frugivora: 3, phytophaga: 3, anthophila: 3, scarabaeidae: 2, araneae: 2, lampyridae: 2 },
  drift: true,
  asteroids: [
    { x: -1700, y: 900, r: 96 }, // home
    { x: -1150, y: 300, r: 74 },
    { x: -700, y: 820, r: 62 },
    { x: -300, y: 120, r: 88, rich: true },
    { x: 180, y: 640, r: 70 },
    { x: 420, y: -240, r: 96 },
    { x: 900, y: 340, r: 64 },
    { x: 1180, y: -420, r: 110, rich: true },
    { x: 1550, y: 500, r: 72 },
    { x: -200, y: -720, r: 80 },
    { x: 700, y: -820, r: 66 },
    { x: 1700, y: -180, r: 84 },
    { x: -900, y: -400, r: 68 },
  ],
  colonies: [{ name: 'Wayfarer', faction: 'pinophyta', player: true, palette: 0 }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};
