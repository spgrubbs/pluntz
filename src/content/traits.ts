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
