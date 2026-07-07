import type { Colony, Plant, World } from './types';
import { TRAITS } from '../content/traits';
import { TUNING } from '../content/tuning';

/** Resolved colony-wide modifiers from traits + instinct sliders. */
export interface Mods {
  leafIncome: number;
  chargeRate: number;
  trunkTargetMult: number;
  trunkTargetAdd: number;
  branchStepsAdd: number;
  hardenAgeMult: number;
  hardenBonusAdd: number;
  partHp: number;
  seedRange: number;
  seedlingEnergyAdd: number;
  shadeFloorOverride: number | null;
  canopyShadeOverride: number | null;
  contactDealt: number;
  contactTaken: number;
  volatileSeeds: boolean;
}

export const DEFAULT_MODS: Mods = {
  leafIncome: 1,
  chargeRate: 1,
  trunkTargetMult: 1,
  trunkTargetAdd: 0,
  branchStepsAdd: 0,
  hardenAgeMult: 1,
  hardenBonusAdd: 0,
  partHp: 1,
  seedRange: 1,
  seedlingEnergyAdd: 0,
  shadeFloorOverride: null,
  canopyShadeOverride: null,
  contactDealt: 1,
  contactTaken: 1,
  volatileSeeds: false,
};

export function colonyMods(colony: Colony | undefined): Mods {
  const m: Mods = { ...DEFAULT_MODS };
  if (!colony) return m;
  const has = (id: string): boolean => colony.traits.includes(id);
  if (has('broadneedle')) m.leafIncome *= 1.2;
  if (has('taproots')) m.seedlingEnergyAdd += 15;
  if (has('ironbark')) {
    m.hardenAgeMult *= 0.55;
    m.hardenBonusAdd += 5;
  }
  if (has('cuticle')) m.canopyShadeOverride = 0.65;
  if (has('tallcrown')) m.trunkTargetAdd += 4;
  if (has('volatile')) m.volatileSeeds = true;
  if (has('resin')) m.contactDealt *= 1.5;
  if (has('swiftcones')) m.chargeRate *= 1.5;
  if (has('greatboughs')) m.branchStepsAdd += 1;
  if (has('longshot')) m.seedRange *= 1.35;
  if (has('evergreen')) m.shadeFloorOverride = 0.28;
  if (has('martial')) m.contactTaken *= 0.6;

  // instinct sliders: Expand <-> Fortify, Spread <-> Tall
  const e = colony.instincts.expand;
  const v = colony.instincts.vertical;
  m.chargeRate *= 0.6 + 0.8 * e;
  m.partHp *= 1.25 - 0.5 * e;
  m.trunkTargetMult *= 0.75 + 0.5 * v;
  if (v < 0.35) m.branchStepsAdd += 1;
  return m;
}

export function buyTrait(world: World, colonyId: number, traitId: string): boolean {
  const colony = world.colonies.find((c) => c.id === colonyId);
  if (!colony || colony.traits.includes(traitId)) return false;
  const def = TRAITS[colony.faction]?.find((t) => t.id === traitId);
  if (!def || colony.essence < def.cost) return false;
  colony.essence -= def.cost;
  colony.traits.push(traitId);
  return true;
}

/** Bless: a growth surge on one plant. Costs essence; refuses the dead. */
export function bless(world: World, plant: Plant): boolean {
  const V = TUNING.verbs;
  const colony = world.colonies.find((c) => c.id === plant.colonyId);
  if (!colony || !plant.alive || colony.essence < V.blessCost) return false;
  if (world.time < plant.blessedUntil) return false; // already surging
  colony.essence -= V.blessCost;
  plant.blessedUntil = world.time + V.blessDuration;
  plant.version++;
  return true;
}
