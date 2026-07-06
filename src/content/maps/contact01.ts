import type { MapDef } from '../../sim/types';

/**
 * First contested map: Verdance (player, west) vs Rustspire (AI, east),
 * a rich prize rock in the middle, 15-minute round then the sun fades.
 */
export const CONTACT01: MapDef = {
  id: 'contact01',
  name: 'First Contact',
  width: 2600,
  height: 1800,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 300 },
  debris: { perMin: 2 },
  roundSec: 900,
  asteroids: [
    { x: -820, y: 200, r: 90 }, // player home
    { x: 820, y: -200, r: 90 }, // rival home
    { x: 0, y: 0, r: 140, rich: true }, // the prize
    { x: -350, y: -450, r: 70 },
    { x: 350, y: 450, r: 70 },
    { x: 0, y: -700, r: 55 },
    { x: -480, y: 620, r: 80 },
    // keep clear of the sun ray through the rival spawn (820,-200 anchor -90):
    // a rock near that line half-shades their seedling and strangles the AI at birth
    { x: 500, y: -780, r: 60 },
    { x: -1050, y: -300, r: 65 },
    { x: 1050, y: 350, r: 65 },
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
