import type { Plant, World } from './types';
import { FACTIONS, type IntentId } from '../content/factions';
import { leafDeficit, aliveConeCount, trunkTargetFor } from './plant';
import { colonyMods } from './stats';

export interface PlantStatus {
  intent: IntentId;
  /** One-line answer to "what is this plant doing right now?" */
  aim: string;
  /** Non-null when the colony is in trouble. */
  warning: string | null;
  saving: boolean; // true when the current aim is stalled waiting for energy
  trunkSegs: number;
  trunkTarget: number;
  budsActive: number;
  budsDone: number;
  needleSlotsOpen: number;
}

/**
 * Derives the plant's current aim from the same state tryGrow() reads, in the
 * same priority order — the inspector reports what the sim will actually do.
 */
export function plantStatus(world: World, plant: Plant): PlantStatus {
  const f = FACTIONS[plant.faction];
  const g = f.growth;
  const mods = colonyMods(world.colonies.find((c) => c.id === plant.colonyId));
  const trunkTarget = trunkTargetFor(f, mods);
  if (!plant.alive) {
    return {
      intent: 'mature',
      aim: 'a husk — dead wood drifting in the light',
      warning: 'the colony is dead',
      saving: false,
      trunkSegs: plant.trunkSegs,
      trunkTarget,
      budsActive: 0,
      budsDone: plant.buds.length,
      needleSlotsOpen: 0,
    };
  }
  const spendable = plant.energy - f.energy.reserve;
  const deficit = leafDeficit(plant, f);
  const budsActive = plant.buds.filter((b) => b.steps < b.maxSteps).length;
  const budsDone = plant.buds.length - budsActive;

  let intent: IntentId;
  let aim: string;
  let cost: number;
  if (plant.rootCount < g.rootMax) {
    intent = 'anchor';
    aim = `driving anchor roots into the rock (${plant.rootCount}/${g.rootMax})`;
    cost = g.rootCost;
  } else if (deficit > 0) {
    intent = 'needles';
    aim = `sprouting ${f.terms.leaf} — ${deficit} open slot${deficit === 1 ? '' : 's'}`;
    cost = g.leafCost;
  } else if (plant.trunkSegs < trunkTarget) {
    intent = 'trunk';
    aim = `extending the ${FACTIONS[plant.faction].growth.style === 'vine' ? 'runner' : 'trunk'} toward the sun (${plant.trunkSegs}/${trunkTarget})`;
    cost = g.stemCost;
  } else if (budsActive > 0) {
    intent = 'branches';
    aim = `extending ${budsActive} side branch${budsActive === 1 ? '' : 'es'}`;
    cost = g.stemCost;
  } else {
    const cones = plant.parts.filter((p) => !p.dead && p.kind === 'cone');
    const armed = cones.find((p) => p.armedAt >= 0);
    const charging = cones.filter((p) => p.armedAt < 0);
    if (armed) {
      intent = 'cones';
      aim =
        f.repro.style === 'fauna'
          ? 'fruit is ripe — waiting for a Frugivora (or it drops nearby)'
          : `${f.terms.cone} armed — drag from it to aim, or it fires itself`;
      cost = 0;
    } else if (charging.length > 0) {
      intent = 'cones';
      const pct = Math.round(
        (Math.max(...charging.map((p) => p.charge)) / f.repro.coneEnergy) * 100,
      );
      aim = `ripening a ${f.terms.cone} (${pct}%)`;
      cost = 0;
    } else if (aliveConeCount(plant) < f.repro.coneMax) {
      intent = 'cones';
      aim = `budding a ${f.terms.cone}`;
      cost = f.repro.coneCost;
    } else {
      intent = 'mature';
      aim = 'canopy complete — storing energy';
      cost = 0;
    }
  }

  const saving = cost > 0 && spendable < cost;
  if (saving) aim += ` · saving energy (${Math.max(spendable, 0).toFixed(0)}/${cost})`;
  if (world.time < plant.blessedUntil) {
    aim = `✦ blessed ${Math.ceil(plant.blessedUntil - world.time)}s · ${aim}`;
  }

  const net = plant.lastIncome - plant.lastUpkeep;
  let warning: string | null = null;
  if (net < 0) {
    const shadedOut = plant.totalLeaves > 0 && plant.litLeaves === 0;
    warning =
      plant.energy <= 0.5
        ? `starving — growth stalled${shadedOut ? ` (no ${f.terms.leafOne} sees the sun)` : ''}`
        : `upkeep exceeds income — drawing reserves${shadedOut ? ' (fully shaded)' : ''}`;
  }

  return {
    intent,
    aim,
    warning,
    saving,
    trunkSegs: plant.trunkSegs,
    trunkTarget,
    budsActive,
    budsDone,
    needleSlotsOpen: deficit,
  };
}
