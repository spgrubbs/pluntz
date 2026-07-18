import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt } from '../world';
import { damagePart } from '../plant';
import { TUNING } from '../../content/tuning';
import { FACTIONS } from '../../content/factions';
import { MUTATIONS } from '../../content/mutations';
import type { MapDef, World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

const lithoMap: MapDef = {
  id: 'lm',
  name: 'lm',
  width: 1600,
  height: 1200,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  asteroids: [
    { x: 0, y: 0, r: 95, rich: true },
    { x: 500, y: 0, r: 70 },
  ],
  colonies: [{ name: 'Crust', faction: 'lichenes', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

const parasiteMap: MapDef = {
  id: 'pm',
  name: 'pm',
  width: 1600,
  height: 1200,
  sun: { angleDeg: 270, cycle: false, cyclePeriodSec: 240 },
  asteroids: [{ x: 0, y: 0, r: 120 }],
  colonies: [
    { name: 'Pine', faction: 'pinophyta', player: true },
    { name: 'Dodder', faction: 'cuscuta', palette: 1 },
  ],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

describe('the fungal-identity split (GDD §13.2): three distinct clades', () => {
  it('every faction has a full mutation set and a coherent energy mode', () => {
    for (const f of Object.values(FACTIONS)) {
      expect(MUTATIONS[f.id]).toBeDefined();
      expect(MUTATIONS[f.id].filter((m) => m.tier === 1 && !m.bonus).length).toBe(2);
      expect(MUTATIONS[f.id].filter((m) => m.bonus).length).toBe(3);
      if (f.energy.mode === 'litho') expect(f.energy.litho).toBeDefined();
      if (f.energy.mode === 'parasite') expect(f.energy.parasite).toBeDefined();
      if (f.energy.mode === 'decomp') expect(f.energy.decomp).toBeDefined();
    }
  });

  it('Lichenes (lithovore) thrives on bare rock, ignoring the dark', () => {
    const w = createWorld(lithoMap, 7);
    w.debrisPerMin = 0;
    w.sunFactor = 0; // total darkness — irrelevant to a stone-eater
    run(w, 2000);
    const crust = w.plants[0];
    expect(crust.alive).toBe(true);
    expect(crust.myco).not.toBeNull();
    expect(crust.myco!.half).toBeGreaterThan(1); // it spread its thallus
    expect(crust.lastIncome).toBeGreaterThan(crust.lastUpkeep); // net positive in the void
  });

  it('Lichenes earns more from mineral-rich rock than from plain stone', () => {
    const rich = createWorld(lithoMap, 7);
    const plain = createWorld({ ...lithoMap, asteroids: [{ x: 0, y: 0, r: 95 }] }, 7);
    for (const w of [rich, plain]) w.debrisPerMin = 0;
    run(rich, 1500);
    run(plain, 1500);
    // same coverage era, but rich rock pays the richMult premium
    expect(rich.plants[0].lastIncome).toBeGreaterThan(plain.plants[0].lastIncome * 1.5);
  });

  it('Cuscuta (parasite) starves alone but flourishes latched to a host', () => {
    // alone: withers to a nub, never spreads
    const solo = createWorld(
      { ...parasiteMap, colonies: [{ name: 'D', faction: 'cuscuta', player: true }] },
      7,
    );
    solo.debrisPerMin = 0;
    run(solo, 2500);
    expect(solo.plants.filter((p) => p.alive).length).toBe(1);
    expect(solo.plants[0].parts.filter((p) => !p.dead).length).toBeLessThan(6); // a starving thread

    // with a host: it drains energy across and reproduces
    const w = createWorld(parasiteMap, 7);
    w.debrisPerMin = 0;
    run(w, 2000); // grow the pine host to maturity
    const host = w.plants[0];
    sproutAt(w, w.colonies[1].id, 'cuscuta', w.asteroids[0], Math.PI / 2);
    const hostE0 = host.energy;
    run(w, 400);
    const cuscuta = w.plants.filter((p) => p.alive && p.faction === 'cuscuta');
    expect(cuscuta.length).toBeGreaterThan(1); // it bred off stolen blood
    expect(host.energy).toBeLessThan(hostE0); // the host is being bled
  });

  it('Basidiomycota remains the detritivore: a fresh husk feeds the web', () => {
    const w = createWorld(
      {
        ...lithoMap,
        asteroids: [{ x: 0, y: 0, r: 95 }],
        colonies: [
          { name: 'Rot', faction: 'basidiomycota', player: true },
          { name: 'Pine', faction: 'pinophyta', palette: 1 },
        ],
      },
      7,
    );
    w.debrisPerMin = 0;
    run(w, 300);
    const fungus = w.plants[0];
    const baseline = fungus.lastIncome;
    // a rival at the far pole grows biomass, then dies into a husk buffet
    const opposite = fungus.anchorAngle + Math.PI;
    expect(sproutAt(w, w.colonies[1].id, 'pinophyta', w.asteroids[0], opposite)).toBe(true);
    const victim = w.plants[w.plants.length - 1];
    run(w, 500);
    damagePart(victim, 0, 9999); // heart death -> the whole plant husks
    run(w, 30);
    expect(fungus.lastIncome).toBeGreaterThan(baseline + 1); // the feast
  });
});
