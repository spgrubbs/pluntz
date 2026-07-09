import type { Colony, Plant, World } from './types';
import { MUTATION_TIMING } from '../content/mutations';
import { TUNING } from '../content/tuning';
import { emit } from './events';

/** Resolved colony-wide modifiers from mutations + instinct sliders. */
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
  mycoRateMult: number; // mycelium spread speed multiplier
  // mutation mechanics (see content/mutations.ts)
  serotiny: boolean; // debris strikes jolt & fire cones on the struck rock
  thorns: boolean; // grazers take damage per bite
  windborne: boolean; // seeds curve toward nearby rocks
  twinPayload: boolean; // +1 seed per launch
  sweetfruit: boolean; // birds prioritize this colony's fruit
  succulence: boolean; // pruned parts become seeds
  nectarSleep: boolean; // grazers sate 2.5x faster on this colony
  strangler: boolean; // contact damage also siphons rival energy
  nightbloom: boolean; // shaded domes charge 2x
  sporeFanAdd: number; // extra spores per dome burst
  virulent: boolean; // infection rots & spreads faster
  huskRateMult: number; // husk digestion speed
  puppetBloom: boolean; // infection kills burst into this colony's spores
  essenceOnDeathMult: number; // rival-death essence payout multiplier
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
  mycoRateMult: 1,
  serotiny: false,
  thorns: false,
  windborne: false,
  twinPayload: false,
  sweetfruit: false,
  succulence: false,
  nectarSleep: false,
  strangler: false,
  nightbloom: false,
  sporeFanAdd: 0,
  virulent: false,
  huskRateMult: 1,
  puppetBloom: false,
  essenceOnDeathMult: 1,
};

export function colonyMods(colony: Colony | undefined): Mods {
  const m: Mods = { ...DEFAULT_MODS };
  if (!colony) return m;
  const has = (id: string): boolean => colony.mutations.includes(id);
  // pinophyta
  if (has('ironwood')) {
    m.hardenAgeMult *= 0.5;
    m.hardenBonusAdd += 8;
    m.contactTaken *= 0.6;
  }
  if (has('serotiny')) m.serotiny = true;
  if (has('thornneedle') || has('thornvine')) m.thorns = true;
  if (has('windborne')) {
    m.windborne = true;
    m.seedRange *= 1.45;
  }
  if (has('twinpayload')) m.twinPayload = true;
  if (has('evergreen')) {
    m.shadeFloorOverride = 0.3;
    m.canopyShadeOverride = 0.7;
  }
  // anthophyta
  if (has('everbloom')) m.chargeRate *= 1.6;
  if (has('sweetfruit')) m.sweetfruit = true;
  if (has('succulence')) m.succulence = true;
  if (has('nectarsleep')) m.nectarSleep = true;
  if (has('strangler')) {
    m.strangler = true;
    m.contactDealt *= 2.5;
  }
  // basidiomycota
  if (has('deepcords')) m.mycoRateMult *= 1.6;
  if (has('nightbloom')) m.nightbloom = true;
  if (has('sporecloud')) m.sporeFanAdd += 2;
  if (has('virulence')) m.virulent = true;
  if (has('necrosis')) {
    m.huskRateMult *= 2;
    m.essenceOnDeathMult = 2;
  }
  if (has('puppetbloom')) m.puppetBloom = true;

  // instinct sliders: Expand <-> Fortify, Spread <-> Tall
  const e = colony.instincts.expand;
  const v = colony.instincts.vertical;
  m.chargeRate *= 0.6 + 0.8 * e;
  m.partHp *= 1.25 - 0.5 * e;
  m.trunkTargetMult *= 0.75 + 0.5 * v;
  if (v < 0.35) m.branchStepsAdd += 1;
  return m;
}

/**
 * Accept one card from the colony's pending mutation offer. Free — the cost
 * is the road not taken. Rescheduling runs from the moment of choice, so a
 * slow chooser delays their own next offer.
 */
export function chooseMutation(world: World, colonyId: number, mutationId: string): boolean {
  const colony = world.colonies.find((c) => c.id === colonyId);
  if (!colony || !colony.pendingOffer || !colony.pendingOffer.includes(mutationId)) return false;
  colony.mutations.push(mutationId);
  colony.pendingOffer = null;
  colony.nextMutationAt = world.time + MUTATION_TIMING.interval;
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
  emit({
    type: 'bless',
    x: plant.astPos.x + plant.parts[0].base.x,
    y: plant.astPos.y + plant.parts[0].base.y,
  });
  return true;
}
