import type { FactionId } from '../sim/types';

export interface TraitDef {
  id: string;
  name: string;
  cost: number; // essence
  tier: 1 | 2 | 3;
  desc: string;
}

/** Per-round mutation tree. Traits apply colony-wide to future growth. */
export const TRAITS: Record<FactionId, TraitDef[]> = {
  basidiomycota: [
    { id: 'broadneedle', name: 'Dense Gills', cost: 3, tier: 1, desc: 'Gills digest +20% faster.' },
    { id: 'taproots', name: 'Spore Reserves', cost: 3, tier: 1, desc: 'New webs sprout with +15 energy.' },
    { id: 'ironbark', name: 'Chitin Cords', cost: 3, tier: 1, desc: 'Cords toughen at half the age, +5 extra hp.' },
    { id: 'tallcrown', name: 'Far Web', cost: 4, tier: 2, desc: 'The web creeps 4 segments further.' },
    { id: 'swiftcones', name: 'Quick Sporing', cost: 4, tier: 2, desc: 'Fruiting domes swell 50% faster.' },
    { id: 'resin', name: 'Acrid Flesh', cost: 4, tier: 2, desc: 'Overgrowth contact deals +50% damage.' },
    { id: 'longshot', name: 'Tall Sporocarps', cost: 4, tier: 2, desc: 'Spore bursts reach 35% further.' },
    { id: 'greatboughs', name: 'Lacework', cost: 5, tier: 3, desc: 'Every side cord extends one segment further.' },
    { id: 'martial', name: 'Rubbery Flesh', cost: 5, tier: 3, desc: 'Contact damage taken −40%.' },
    { id: 'volatile', name: 'Caustic Spores', cost: 5, tier: 3, desc: 'Spores sear rival growth where they land.' },
  ],
  anthophyta: [
    { id: 'broadneedle', name: 'Sunleaf', cost: 3, tier: 1, desc: 'Leaves earn +20% light income.' },
    { id: 'taproots', name: 'Tuber Reserves', cost: 3, tier: 1, desc: 'New seedlings sprout with +15 energy.' },
    { id: 'ironbark', name: 'Woody Stems', cost: 3, tier: 1, desc: 'Runners lignify at half the age, +5 extra hp.' },
    { id: 'cuticle', name: 'Waxy Cuticle', cost: 3, tier: 1, desc: 'Canopy-shaded leaves keep 65% income (was 45%).' },
    { id: 'tallcrown', name: 'Long Runners', cost: 4, tier: 2, desc: 'Runners race 4 segments further.' },
    { id: 'swiftcones', name: 'Quick Blooms', cost: 4, tier: 2, desc: 'Flowers ripen 50% faster.' },
    { id: 'resin', name: 'Bitter Sap', cost: 4, tier: 2, desc: 'Overgrowth contact deals +50% damage.' },
    { id: 'longshot', name: 'Pulp Sling', cost: 4, tier: 2, desc: 'Self-dropped fruit tosses 35% further.' },
    { id: 'greatboughs', name: 'Lush Shoots', cost: 5, tier: 3, desc: 'Every side shoot extends one segment further.' },
    { id: 'martial', name: 'Thorned Vines', cost: 5, tier: 3, desc: 'Contact damage taken −40%.' },
  ],
  pinophyta: [
    { id: 'broadneedle', name: 'Broadneedle', cost: 3, tier: 1, desc: 'Needles earn +20% light income.' },
    { id: 'taproots', name: 'Deep Taproots', cost: 3, tier: 1, desc: 'New seedlings sprout with +15 energy.' },
    { id: 'ironbark', name: 'Ironbark', cost: 3, tier: 1, desc: 'Bark hardens at half the age, +5 extra hp.' },
    { id: 'cuticle', name: 'Thick Cuticle', cost: 3, tier: 1, desc: 'Canopy-shaded needles keep 65% income (was 50%).' },
    { id: 'tallcrown', name: 'Tall Crown', cost: 4, tier: 2, desc: 'Trunks grow 4 segments higher.' },
    { id: 'volatile', name: 'Volatile Seeds', cost: 4, tier: 2, desc: 'Seeds detonate on landing, searing nearby rival growth.' },
    { id: 'resin', name: 'Resin Ducts', cost: 4, tier: 2, desc: 'Overgrowth contact deals +50% damage.' },
    { id: 'swiftcones', name: 'Swift Cones', cost: 4, tier: 2, desc: 'Cones charge 50% faster.' },
    { id: 'greatboughs', name: 'Great Boughs', cost: 5, tier: 3, desc: 'Every branch extends one segment further.' },
    { id: 'longshot', name: 'Longshot Cones', cost: 5, tier: 3, desc: 'Seed range +35%.' },
    { id: 'evergreen', name: 'Evergreen Patience', cost: 5, tier: 3, desc: 'Rock-shadow income floor 15% → 28%.' },
    { id: 'martial', name: 'Martial Canopy', cost: 5, tier: 3, desc: 'Contact damage taken −40%.' },
  ],
};

/** Scripted purchase order for AI colonies. */
export const AI_TRAIT_ORDER: Record<FactionId, string[]> = {
  basidiomycota: [
    'swiftcones',
    'broadneedle',
    'ironbark',
    'tallcrown',
    'resin',
    'martial',
    'longshot',
    'taproots',
    'volatile',
    'greatboughs',
  ],
  anthophyta: [
    'swiftcones',
    'broadneedle',
    'ironbark',
    'tallcrown',
    'resin',
    'martial',
    'taproots',
    'longshot',
    'greatboughs',
    'cuticle',
  ],
  pinophyta: [
    'swiftcones',
    'ironbark',
    'broadneedle',
    'longshot',
    'resin',
    'tallcrown',
    'martial',
    'evergreen',
    'taproots',
    'volatile',
    'cuticle',
    'greatboughs',
  ],
};
