import type { Colony, Plant, World } from './types';
import { MUTATION_TIMING, DRIFT_CATALOG, driftCost } from '../content/mutations';
import { FACTIONS } from '../content/factions';
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
  necrosis: boolean; // rival deaths re-knit this colony's verbs (cooldown reset)
  volatileSeeds: boolean; // seeds detonate on landing, searing rival growth
  lureCdMult: number; // Perfume: lure cooldown multiplier
  lureDurationMult: number; // Perfume: lure scent lifetime multiplier
  heartRegen: number; // hp/s the heart knits back (Undying Knot)
  relentless: boolean; // lichen crust spreads even while starving (Lithosphere)
  siphonMult: number; // Cuscuta: haustoria drink-rate multiplier (Gluttony)
  parasiteRot: boolean; // Cuscuta: latching also infects the host (Virulent Drink)
  // Droseraceae (carnivore traps)
  trapReachAdd: number; // extra trap radius
  trapHoldMult: number; // escape-odds multiplier (<1 holds tighter)
  digestMult: number; // digestion-rate multiplier
  trapScarabs: boolean; // traps can seize the biggest fauna
  killBurst: boolean; // each kill bursts energy + a free seed
  carnivoreLure: boolean; // the plant draws fauna toward it like a lure
  livingSnare: boolean; // traps drag struggling prey inward
  // The Drift (§15) — strand mutations bought with Legacy
  heirSteers: number; // mid-flight steering nudges granted to an Heir Seed
  seedArmor: boolean; // Heir Seeds survive fauna bites & hostile landings
  revealMult: number; // fog-reveal radius multiplier (render-side)
  pioneerRoot: boolean; // Heir Seeds root even inside rival beds
  quickDome: boolean; // new gardens establish faster (extra seedling energy)
  legacyRateMult: number; // retired gardens trickle more Legacy
  twinHeir: boolean; // launch two Heir Seeds; camera follows the lead
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
  necrosis: false,
  volatileSeeds: false,
  lureCdMult: 1,
  lureDurationMult: 1,
  heartRegen: 0,
  relentless: false,
  siphonMult: 1,
  parasiteRot: false,
  trapReachAdd: 0,
  trapHoldMult: 1,
  digestMult: 1,
  trapScarabs: false,
  killBurst: false,
  carnivoreLure: false,
  livingSnare: false,
  heirSteers: 0,
  seedArmor: false,
  revealMult: 1,
  pioneerRoot: false,
  quickDome: false,
  legacyRateMult: 1,
  twinHeir: false,
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
  if (has('volatile')) m.volatileSeeds = true;
  if (has('greatboughs')) m.branchStepsAdd += 2;
  if (has('longshot')) m.seedRange *= 1.6;
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
  if (has('perfume')) {
    m.lureCdMult *= 0.5;
    m.lureDurationMult *= 2;
  }
  if (has('tuberreserve')) m.seedlingEnergyAdd += 18;
  if (has('sunleaf')) m.leafIncome *= 1.25;
  // basidiomycota
  if (has('deepcords')) m.mycoRateMult *= 1.6;
  if (has('nightbloom')) m.nightbloom = true;
  if (has('sporecloud')) m.sporeFanAdd += 2;
  if (has('virulence')) m.virulent = true;
  if (has('necrosis')) {
    m.huskRateMult *= 2;
    m.necrosis = true;
  }
  if (has('puppetbloom')) m.puppetBloom = true;
  if (has('chitincords')) {
    m.hardenAgeMult *= 0.5;
    m.hardenBonusAdd += 8;
    m.contactTaken *= 0.6;
  }
  if (has('farspore')) m.seedRange *= 1.5;
  if (has('undyingknot')) m.heartRegen = 0.6;
  // lichenes (lithovore) — litho income scales with leafIncome
  if (has('crustcreep')) m.mycoRateMult *= 1.6;
  if (has('mineralveins')) m.leafIncome *= 1.3;
  if (has('richveins')) m.leafIncome *= 1.5;
  if (has('pioneercrust')) m.seedlingEnergyAdd += 22;
  if (has('stonehide')) {
    m.hardenAgeMult *= 0.5;
    m.hardenBonusAdd += 12;
    m.contactTaken *= 0.6;
  }
  if (has('soredia') || has('dodderstorm')) m.sporeFanAdd += 2;
  if (has('bedrock')) {
    m.heartRegen = Math.max(m.heartRegen, 0.6);
    m.partHp *= 1.3;
  }
  if (has('lithosphere')) {
    m.relentless = true;
    m.mycoRateMult *= 1.4;
  }
  if (has('everstone')) m.contactTaken *= 0.5;
  // cuscuta (parasite)
  if (has('gluttony')) m.siphonMult *= 1.7;
  if (has('questseed')) {
    m.seedRange *= 1.4;
    m.windborne = true;
  }
  if (has('thornthread')) m.thorns = true;
  if (has('virulentdrink')) m.parasiteRot = true;
  if (has('narcoticsap')) m.nectarSleep = true;
  if (has('perfumepod')) {
    m.lureCdMult *= 0.5;
    m.lureDurationMult *= 2;
  }
  if (has('hemophage')) m.heartRegen = Math.max(m.heartRegen, 0.7);
  // droseraceae (carnivore)
  if (has('sweetmucilage')) {
    m.trapReachAdd += 22;
    m.trapHoldMult *= 0.4;
  }
  if (has('pitcher')) m.trapScarabs = true;
  if (has('fatalnectar')) m.digestMult *= 2;
  if (has('digestivebloom')) m.killBurst = true;
  if (has('snapfast')) m.trapHoldMult *= 0.3;
  if (has('scentglands')) {
    m.carnivoreLure = true;
    m.trapReachAdd += 10;
  }
  if (has('maneater')) m.trapScarabs = true;
  if (has('carrionbloom')) {
    m.trapReachAdd += 26;
    m.digestMult *= 1.4;
  }
  if (has('livingsnare')) {
    m.livingSnare = true;
    m.trapReachAdd += 34;
  }
  // The Drift (§15) — strand mutations
  if (has('drift_longshot')) m.seedRange *= 1.7;
  if (has('drift_vanes')) m.heirSteers += 3;
  if (has('drift_stonecoat')) {
    m.seedArmor = true;
    m.partHp *= 1.15;
  }
  if (has('drift_wideeye')) m.revealMult *= 1.6;
  if (has('drift_pioneer')) m.pioneerRoot = true;
  if (has('drift_quickdome')) {
    m.quickDome = true;
    m.seedlingEnergyAdd += 34;
  }
  if (has('drift_richvein')) m.legacyRateMult *= 1.8;
  if (has('drift_twinheir')) m.twinHeir = true;
  return m;
}

export type VerbId = 'ping' | 'lure' | 'bless' | 'prune';

/** A verb's full cooldown for this colony (base × clade haste × mutations). */
export function verbCooldown(colony: Colony, verb: VerbId): number {
  let cd = TUNING.verbs.cooldown[verb] * (FACTIONS[colony.faction].verbHaste?.[verb] ?? 1);
  if (verb === 'lure') cd *= colonyMods(colony).lureCdMult;
  return cd;
}

export function verbReady(world: World, colony: Colony, verb: VerbId): boolean {
  return world.time >= colony.verbReadyAt[verb];
}

/** Start a verb's cooldown. Call only after the verb actually did something. */
export function useVerb(world: World, colony: Colony, verb: VerbId): void {
  colony.verbReadyAt[verb] = world.time + verbCooldown(colony, verb);
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

/** The number of Drift shop cards a colony already owns (drives cost scaling). */
export function driftOwnedCount(colony: Colony): number {
  return colony.mutations.filter((id) => id.startsWith('drift_')).length;
}

/** The current Legacy price of a Drift shop card for this colony. */
export function driftCardCost(colony: Colony, cardId: string): number {
  const card = DRIFT_CATALOG.find((c) => c.id === cardId);
  if (!card) return Infinity;
  return driftCost(card.cost, driftOwnedCount(colony));
}

/**
 * The Drift shop: spend Legacy on a strand mutation at any time. The whole
 * loadout rides the lineage — the plants stay behind, the biology comes with
 * you. Returns false if unaffordable or already owned.
 */
export function buyDriftMutation(world: World, colonyId: number, cardId: string): boolean {
  const colony = world.colonies.find((c) => c.id === colonyId);
  if (!colony || colony.mutations.includes(cardId)) return false;
  const card = DRIFT_CATALOG.find((c) => c.id === cardId);
  if (!card) return false;
  const cost = driftCost(card.cost, driftOwnedCount(colony));
  if (colony.legacy < cost) return false;
  colony.legacy -= cost;
  colony.mutations.push(cardId);
  return true;
}

/** Bless: a growth surge on one plant. On cooldown; refuses the dead. */
export function bless(world: World, plant: Plant): boolean {
  const V = TUNING.verbs;
  const colony = world.colonies.find((c) => c.id === plant.colonyId);
  if (!colony || !plant.alive || !verbReady(world, colony, 'bless')) return false;
  if (world.time < plant.blessedUntil) return false; // already surging
  useVerb(world, colony, 'bless');
  plant.blessedUntil = world.time + V.blessDuration;
  plant.version++;
  emit({
    type: 'bless',
    x: plant.astPos.x + plant.parts[0].base.x,
    y: plant.astPos.y + plant.parts[0].base.y,
  });
  return true;
}
