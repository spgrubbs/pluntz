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
  lichenes: [
    // draft 1
    {
      id: 'crustcreep',
      name: 'Crust Creep',
      tier: 1,
      desc: 'The thallus creeps over the rock 60% faster.',
    },
    {
      id: 'mineralveins',
      name: 'Mineral Veins',
      tier: 1,
      desc: 'Every claimed inch of stone yields 30% more energy.',
    },
    {
      id: 'pioneercrust',
      name: 'Pioneer Crust',
      tier: 1,
      bonus: true,
      desc: 'New crusts wake with a deep mineral reserve (+22 starting energy).',
    },
    // draft 2
    {
      id: 'stonehide',
      name: 'Stonehide',
      tier: 2,
      desc: 'Fused to armor: parts harden at half the age with +12 hp, contact damage taken −40%.',
    },
    {
      id: 'soredia',
      name: 'Soredia',
      tier: 2,
      desc: 'Each soralium bursts with two extra soredia in a wider fan.',
    },
    {
      id: 'richveins',
      name: 'Rich Veins',
      tier: 2,
      bonus: true,
      desc: 'The crust floods with energy: +50% income from all claimed rock.',
    },
    // draft 3
    {
      id: 'bedrock',
      name: 'Bedrock',
      tier: 3,
      desc: 'The heart re-fuses to the stone forever, healing itself; all parts +30% hp.',
    },
    {
      id: 'lithosphere',
      name: 'Lithosphere',
      tier: 3,
      desc: 'The crust never retreats and keeps spreading even while starving (+40% pace).',
    },
    {
      id: 'everstone',
      name: 'Everstone',
      tier: 3,
      bonus: true,
      desc: 'Nothing chips the crust: contact damage taken cut in half again.',
    },
  ],
  cuscuta: [
    // draft 1
    {
      id: 'gluttony',
      name: 'Gluttony',
      tier: 1,
      desc: 'Haustoria drink 70% faster — bleed a host dry in moments.',
    },
    {
      id: 'questseed',
      name: 'Questing Seed',
      tier: 1,
      desc: 'Seeds fly 40% farther and curve toward occupied rock — toward hosts.',
    },
    {
      id: 'thornthread',
      name: 'Thorn Thread',
      tier: 1,
      bonus: true,
      desc: 'Grazers that bite the runners bleed — enough bites kill.',
    },
    // draft 2
    {
      id: 'virulentdrink',
      name: 'Virulent Drink',
      tier: 2,
      desc: 'Latching also rots the host: the wound festers and spreads part to part.',
    },
    {
      id: 'narcoticsap',
      name: 'Narcotic Sap',
      tier: 2,
      desc: 'Drugged threads: grazers tire and wander off 2.5× faster.',
    },
    {
      id: 'perfumepod',
      name: 'Perfume Pod',
      tier: 2,
      bonus: true,
      desc: 'Your Lure recharges in half the time and its scent lingers twice as long.',
    },
    // draft 3
    {
      id: 'strangler',
      name: 'Strangler',
      tier: 3,
      desc: 'Runners crush the host: overgrowth contact deals 2.5× damage and siphons energy.',
    },
    {
      id: 'hemophage',
      name: 'Hemophage',
      tier: 3,
      desc: 'Stolen blood knits your own wounds shut — the heart regenerates as you drink.',
    },
    {
      id: 'dodderstorm',
      name: 'Dodder Storm',
      tier: 3,
      bonus: true,
      desc: 'Pods burst in a fan — fling seeds across a whole empire at once.',
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
  lichenes: [
    'mineralveins',
    'crustcreep',
    'pioneercrust',
    'stonehide',
    'richveins',
    'soredia',
    'bedrock',
    'everstone',
    'lithosphere',
  ],
  cuscuta: [
    'gluttony',
    'questseed',
    'thornthread',
    'virulentdrink',
    'perfumepod',
    'narcoticsap',
    'strangler',
    'hemophage',
    'dodderstorm',
  ],
};

export function mutationDef(faction: FactionId, id: string): MutationDef | undefined {
  return MUTATIONS[faction]?.find((m) => m.id === id);
}
