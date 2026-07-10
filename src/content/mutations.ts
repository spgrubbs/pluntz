import type { FactionId } from '../sim/types';

/**
 * Mutations: the time-gated evolution draft. Every colony — player and AI —
 * gets exactly three draft opportunities per round. Each draft deals every
 * option for that opportunity (2 baseline); you keep one. Metaprogression
 * widens the drafts: after your first win with a clade, draft #1 gains a
 * third card; after two wins, draft #2 does; after three, draft #3.
 */
export interface MutationDef {
  id: string;
  name: string;
  /** Which draft opportunity this card belongs to (1, 2 or 3). */
  tier: 1 | 2 | 3;
  /** Win-unlocked third card: appears when the colony's bonusDepth >= tier. */
  bonus?: boolean;
  desc: string;
}

export const MUTATION_TIMING = {
  firstAt: 90, // sim seconds until the first draft
  interval: 120, // seconds between drafts (measured from each choice)
  /** Finite "never" — Infinity does not survive JSON save/load. */
  never: 1e9,
};

export const MUTATIONS: Record<FactionId, MutationDef[]> = {
  pinophyta: [
    // draft 1
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
      id: 'volatile',
      name: 'Volatile Seeds',
      tier: 1,
      bonus: true,
      desc: 'Seeds detonate on landing, searing rival growth around the crash site.',
    },
    // draft 2
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
      id: 'greatboughs',
      name: 'Great Boughs',
      tier: 2,
      bonus: true,
      desc: 'Every side branch reaches two segments further — a wider, hungrier crown.',
    },
    // draft 3
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
    {
      id: 'longshot',
      name: 'Longshot Cones',
      tier: 3,
      bonus: true,
      desc: 'Seed range +60% — bombard rocks your rivals thought were safe.',
    },
  ],
  anthophyta: [
    // draft 1
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
      id: 'perfume',
      name: 'Perfume',
      tier: 1,
      bonus: true,
      desc: 'Your Lure recharges in half the time and its scent lasts twice as long.',
    },
    // draft 2
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
      id: 'tuberreserve',
      name: 'Tuber Reserves',
      tier: 2,
      bonus: true,
      desc: 'Every new sprout unpacks a stored tuber: +18 starting energy.',
    },
    // draft 3
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
    {
      id: 'sunleaf',
      name: 'Sunleaf',
      tier: 3,
      bonus: true,
      desc: 'Broad leaves drink deeper: +25% light income.',
    },
  ],
  basidiomycota: [
    // draft 1
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
      id: 'chitincords',
      name: 'Chitin Cords',
      tier: 1,
      bonus: true,
      desc: 'Flesh becomes armor: parts harden at half the age with +8 hp, contact damage taken −40%.',
    },
    // draft 2
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
      id: 'farspore',
      name: 'Far Spores',
      tier: 2,
      bonus: true,
      desc: 'Spore bursts carry 50% farther on the void wind.',
    },
    // draft 3
    {
      id: 'necrosis',
      name: 'Necrosis',
      tier: 3,
      desc: 'The web digests husks twice as fast, and every rival death instantly re-knits your verbs.',
    },
    {
      id: 'puppetbloom',
      name: 'Puppet Bloom',
      tier: 3,
      desc: 'A part your infection kills bursts into your spores where it stood.',
    },
    {
      id: 'undyingknot',
      name: 'Undying Knot',
      tier: 3,
      bonus: true,
      desc: 'The buried heart knits itself back together, regenerating slowly forever.',
    },
  ],
};

/** AI colonies pick the earliest of these present in a draft. */
export const AI_MUTATION_PREF: Record<FactionId, string[]> = {
  pinophyta: [
    'ironwood',
    'volatile',
    'serotiny',
    'windborne',
    'greatboughs',
    'thornneedle',
    'evergreen',
    'longshot',
    'twinpayload',
  ],
  anthophyta: [
    'everbloom',
    'sweetfruit',
    'perfume',
    'nectarsleep',
    'tuberreserve',
    'succulence',
    'strangler',
    'sunleaf',
    'thornvine',
  ],
  basidiomycota: [
    'deepcords',
    'chitincords',
    'nightbloom',
    'virulence',
    'farspore',
    'sporecloud',
    'puppetbloom',
    'undyingknot',
    'necrosis',
  ],
};

export function mutationDef(faction: FactionId, id: string): MutationDef | undefined {
  return MUTATIONS[faction]?.find((m) => m.id === id);
}
