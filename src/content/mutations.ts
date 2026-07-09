import type { FactionId } from '../sim/types';

/**
 * Mutations: the time-gated evolution draft. Every colony — player and AI —
 * is offered a choice of two every ~2 minutes; each changes a *mechanic*,
 * not just a number. Deeper tiers are gated by the metaprogression profile
 * (win rounds with a clade to unlock its stranger biology).
 */
export interface MutationDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  desc: string;
}

export const MUTATION_TIMING = {
  firstAt: 90, // sim seconds until the first offer
  interval: 120, // seconds between offers (measured from each choice)
  /** Finite "never" — Infinity does not survive JSON save/load. */
  never: 1e9,
};

export const MUTATIONS: Record<FactionId, MutationDef[]> = {
  pinophyta: [
    {
      id: 'ironwood',
      name: 'Ironwood',
      tier: 1,
      desc: 'Bark hardens at half the age with +8 bonus hp, and contact damage taken drops 40%.',
    },
    {
      id: 'serotiny',
      name: 'Serotiny',
      tier: 1,
      desc: 'Catastrophe is a signal: a debris strike on your rock jolts every cone with charge, and armed cones fire on the spot.',
    },
    {
      id: 'thornneedle',
      name: 'Thorn Needles',
      tier: 2,
      desc: 'Grazing fauna are stabbed with every bite — enough bites kill.',
    },
    {
      id: 'windborne',
      name: 'Windborne Seeds',
      tier: 2,
      desc: 'Seeds fly 45% farther and curve toward the pull of nearby rocks.',
    },
    {
      id: 'twinpayload',
      name: 'Twin Payload',
      tier: 3,
      desc: 'Every cone launches two seeds.',
    },
    {
      id: 'evergreen',
      name: 'Evergreen Patience',
      tier: 3,
      desc: 'Needles thrive in gloom: rock-shadow income 15% → 30%, canopy shade 50% → 70%.',
    },
  ],
  anthophyta: [
    {
      id: 'everbloom',
      name: 'Everbloom',
      tier: 1,
      desc: 'Flowers ripen 60% faster.',
    },
    {
      id: 'sweetfruit',
      name: 'Sweetfruit',
      tier: 1,
      desc: 'Irresistible: Frugivora cross the map for your fruit before anyone else’s.',
    },
    {
      id: 'succulence',
      name: 'Succulence',
      tier: 2,
      desc: 'Pruned flesh lives on: every part you cut becomes a seed. The knife is a sower.',
    },
    {
      id: 'nectarsleep',
      name: 'Narcotic Nectar',
      tier: 2,
      desc: 'Your sap drugs grazers: bites sate them 2.5× faster, so they eat far less of you.',
    },
    {
      id: 'strangler',
      name: 'Strangler Runner',
      tier: 3,
      desc: 'Overgrowth contact deals 2.5× damage and siphons the victim’s stored energy into you.',
    },
    {
      id: 'thornvine',
      name: 'Thorned Vines',
      tier: 3,
      desc: 'Grazing fauna are stabbed with every bite — enough bites kill.',
    },
  ],
  basidiomycota: [
    {
      id: 'deepcords',
      name: 'Deep Cords',
      tier: 1,
      desc: 'The mycelium threads through the rock 60% faster.',
    },
    {
      id: 'nightbloom',
      name: 'Nightbloom',
      tier: 1,
      desc: 'Fruiting domes standing in rock shadow ripen twice as fast.',
    },
    {
      id: 'sporecloud',
      name: 'Sporecloud',
      tier: 2,
      desc: 'Every dome bursts with two extra spores in a wider fan.',
    },
    {
      id: 'virulence',
      name: 'Virulence',
      tier: 2,
      desc: 'Your infection rots flesh twice as fast and creeps to a neighboring part every 2.5s (was 5s).',
    },
    {
      id: 'necrosis',
      name: 'Necrosis',
      tier: 3,
      desc: 'The web digests husks twice as fast, and rival deaths pay you double essence.',
    },
    {
      id: 'puppetbloom',
      name: 'Puppet Bloom',
      tier: 3,
      desc: 'A part your infection kills bursts into your spores where it stood.',
    },
  ],
};

/** AI colonies pick the earliest of these present in an offer. */
export const AI_MUTATION_PREF: Record<FactionId, string[]> = {
  pinophyta: ['ironwood', 'serotiny', 'windborne', 'thornneedle', 'evergreen', 'twinpayload'],
  anthophyta: ['everbloom', 'sweetfruit', 'nectarsleep', 'succulence', 'strangler', 'thornvine'],
  basidiomycota: ['deepcords', 'nightbloom', 'virulence', 'sporecloud', 'puppetbloom', 'necrosis'],
};

export function mutationDef(faction: FactionId, id: string): MutationDef | undefined {
  return MUTATIONS[faction]?.find((m) => m.id === id);
}
