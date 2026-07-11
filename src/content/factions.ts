import type { FactionId } from '../sim/types';

/** The growth-policy stages a plant can be in — mirrors tryGrow's priorities. */
export type IntentId = 'anchor' | 'needles' | 'trunk' | 'branches' | 'cones' | 'mature';

export interface FactionColors {
  stem: number;
  stemOld: number;
  leaf: number;
  leafCanopy: number; // under foliage shade (half income)
  leafShaded: number; // in hard rock shadow
  leafStarving: number;
  root: number;
  heart: number;
  heartCore: number;
  cone: number;
  coneArmed: number;
  seed: number;
  litter: number; // the terraformed substrate bed on the rock surface
}

export interface FactionDef {
  id: FactionId;
  name: string;
  /** Drawing styles: how parts read on screen. */
  render: {
    leaf: 'needle' | 'broad' | 'gill';
    heart: 'pinecone' | 'bulb' | 'dome';
    repro: 'cone' | 'flower' | 'dome';
  };
  /** In-fiction names for parts, used across the UI. */
  terms: { leaf: string; leafOne: string; cone: string; trunk: string };
  /** Per-clade verb cooldown multipliers (<1 = faster). Unlisted verbs are 1. */
  verbHaste?: Partial<Record<'ping' | 'lure' | 'bless' | 'prune', number>>;
  /** myco-style factions only: the underground network's economy. */
  myco?: {
    startLen: number; // initial mycelium arc length on sprouting
    spreadLen: number; // arc-length grown per second (energy permitting)
    costPerLen: number; // energy per arc-length unit grown
    upkeepPerLen: number; // energy/s per arc-length unit maintained
    retreatLen: number; // arc-length lost per second while starving
    tricklePerLen: number; // baseline rock-digestion income per arc-length
  };
  /** palettes[0] is the default; extra palettes distinguish same-faction colonies. */
  palettes: FactionColors[];
  /** Static text shown in the inspector's expandable behavior section. */
  behavior: {
    summary: string;
    priorities: { id: IntentId; text: string }[];
  };
  energy: {
    /** photo = sunlight through leaves; decomp = eats husks, ignores the sun. */
    mode: 'photo' | 'decomp';
    /** decomp mode only. */
    decomp?: { huskRate: number; huskYield: number };
    heartInitial: number;
    capBase: number;
    capPerPart: number;
    reserve: number; // growth never spends below this
    /** Seed-reserve trickle. MUST stay below upkeep.heart, or a fully shaded
     * lone heart becomes an immortal dormant seed that never starves out. */
    heartIncome: number;
    leafIncome: number; // energy/sec per fully lit, well-angled leaf
    minAngleEff: number; // efficiency floor vs. bad sun angle
    canopyShade: number; // income multiplier under foliage (own or rival)
    shadeFloor: number; // income multiplier in hard rock shadow (evergreen floor)
    upkeep: { heart: number; root: number; stem: number; leaf: number; cone: number };
  };
  life: {
    hp: { heart: number; root: number; stem: number; leaf: number; cone: number };
    hpVariance: number; // ± fraction rolled per part
    /** Damage/sec while the colony is at zero energy, applied as a cascade:
     * leaves wither first, then stems+roots, the heart last. */
    starveDps: { leaf: number; stem: number; root: number; heart: number; cone: number };
    hardenAge: number; // stems older than this gain bark once
    hardenBonus: number; // extra hp (and maxHp) from bark
    leafLifespan: [number, number]; // natural needle lifespan range, seconds
    pruneRefund: number; // fraction of build cost returned when pruning
  };
  repro: {
    /** ballistic = launched seeds; fauna = ripe fruit carried by Frugivora. */
    style: 'ballistic' | 'fauna';
    sporeFan?: number; // fire this many seeds in a fan (spore cloud)
    infects?: boolean; // seeds hitting living rivals infect instead of bruise
    coneMax: number; // simultaneous cones (or flowers)
    coneCost: number; // energy to bud a cone
    coneEnergy: number; // charge needed to arm
    chargeRate: number; // energy/s diverted into a charging cone
    armedAutoFire: number; // seconds armed before self-firing (player colonies)
    aiAutoFire: number; // AI colonies fire this fast
    seedSpeed: number;
    seedRange: number;
    seedStartEnergy: number; // the new seedling's starting energy
    minSpacing: number; // anchors closer than this on one rock fail to sprout
  };
  growth: {
    /** spire = vertical trunk; vine = surface runners; myco = underground network. */
    style: 'spire' | 'vine' | 'myco';
    actionCooldown: number; // seconds between growth actions
    rootMax: number;
    rootCost: number;
    rootLen: number;
    stemCost: number;
    leafCost: number;
    trunkTarget: number; // trunk segments to aim for
    trunkSegLen: number;
    trunkTaper: number; // length loss per depth
    branchEvery: number; // spawn branch buds every N trunk segs
    branchStartDepth: number;
    branchAngleDeg: number;
    branchSegLen: number;
    branchCurl: number; // upward bias added per branch step
    leafLen: number;
    leafAngleDeg: number;
    leavesPerTrunkStem: number;
    leavesPerBranchStem: number;
    // phototropism blend weights for new trunk segments
    wPrevDir: number;
    wUp: number;
    wSun: number;
    wNoise: number;
    wTangent: number; // vines: bias along the rock surface
  };
}

/** PINOPHYTA — tall, patient, armored spires. The baseline faction. */
export const PINOPHYTA: FactionDef = {
  id: 'pinophyta',
  name: 'Pinophyta',
  render: { leaf: 'needle', heart: 'pinecone', repro: 'cone' },
  terms: { leaf: 'needles', leafOne: 'needle', cone: 'seed cone', trunk: 'trunk' },
  verbHaste: { bless: 0.7 }, // patient wood answers the shepherd's surge readily
  palettes: [
    {
      stem: 0x5d8a5f,
      stemOld: 0x47624a,
      leaf: 0x3ee89c,
      leafCanopy: 0x2aa877,
      leafShaded: 0x1d7a56,
      leafStarving: 0xd8c34a,
      root: 0x8a6d4f,
      heart: 0x2fbf7f,
      heartCore: 0xffd257,
      cone: 0x9a6b3f,
      coneArmed: 0xe8b054,
      seed: 0xd7f59a,
      litter: 0x4e5a3c, // bed of shed needles
    },
    {
      // "Rustspire" — the rival Pinophyta colony palette
      stem: 0x8a5f4a,
      stemOld: 0x62453a,
      leaf: 0xe8863e,
      leafCanopy: 0xb26a34,
      leafShaded: 0x7a4a26,
      leafStarving: 0xd8c34a,
      root: 0x6d5a4f,
      heart: 0xbf5f2f,
      heartCore: 0xffb257,
      cone: 0x7a4b33,
      coneArmed: 0xff9454,
      seed: 0xffd2a0,
      litter: 0x5e4634,
    },
  ],
  behavior: {
    summary:
      'A patient vertical spire. Pinophyta outgrow shade rather than flee it: ' +
      'needles keep a trickle of income even in darkness, and the trunk climbs ' +
      'steadily sunward. Needles under other foliage (even their own) earn half ' +
      'income — the conical silhouette exists to minimize self-shading.',
    priorities: [
      { id: 'anchor', text: 'Anchor: drive roots into the rock' },
      { id: 'needles', text: 'Needle every open slot — income before architecture' },
      { id: 'trunk', text: 'Raise the trunk, leaning toward the sun' },
      { id: 'branches', text: 'Extend side branches, longest near the base' },
      { id: 'cones', text: 'Ripen seed cones; cast seeds at fresh rock' },
      { id: 'mature', text: 'Mature: store energy and endure' },
    ],
  },
  life: {
    hp: { heart: 60, root: 30, stem: 25, leaf: 10, cone: 15 },
    hpVariance: 0.2,
    starveDps: { leaf: 0.8, stem: 0.35, root: 0.35, heart: 0.8, cone: 0.8 },
    hardenAge: 45,
    hardenBonus: 15,
    leafLifespan: [130, 210],
    pruneRefund: 0.4,
  },
  repro: {
    style: 'ballistic',
    coneMax: 2,
    coneCost: 8,
    coneEnergy: 30,
    chargeRate: 2.4,
    armedAutoFire: 8,
    aiAutoFire: 3,
    seedSpeed: 95,
    seedRange: 900,
    seedStartEnergy: 35,
    minSpacing: 55,
  },
  energy: {
    mode: 'photo',
    heartInitial: 45,
    capBase: 60,
    capPerPart: 2,
    reserve: 4,
    heartIncome: 0.1,
    leafIncome: 1.2,
    minAngleEff: 0.35,
    canopyShade: 0.5,
    shadeFloor: 0.15,
    upkeep: { heart: 0.15, root: 0.05, stem: 0.06, leaf: 0.1, cone: 0.08 },
  },
  growth: {
    style: 'spire',
    actionCooldown: 0.45,
    rootMax: 2,
    rootCost: 5,
    rootLen: 14,
    stemCost: 6,
    leafCost: 4,
    trunkTarget: 14,
    trunkSegLen: 9,
    trunkTaper: 0.15,
    branchEvery: 2,
    branchStartDepth: 3,
    branchAngleDeg: 72,
    branchSegLen: 7,
    branchCurl: 0.22,
    leafLen: 6.5,
    leafAngleDeg: 68,
    leavesPerTrunkStem: 1,
    leavesPerBranchStem: 2,
    wPrevDir: 0.52,
    wUp: 0.3,
    wSun: 0.13,
    wNoise: 0.05,
    wTangent: 0,
  },
};

/** ANTHOPHYTA — fast sprawling vines, flowers, fruit, and friendly fauna. */
export const ANTHOPHYTA: FactionDef = {
  id: 'anthophyta',
  name: 'Anthophyta',
  render: { leaf: 'broad', heart: 'bulb', repro: 'flower' },
  terms: { leaf: 'leaves', leafOne: 'leaf', cone: 'flower', trunk: 'runner' },
  verbHaste: { lure: 0.6 }, // perfume-makers: scent verbs come easy
  palettes: [
    {
      stem: 0x5f9948,
      stemOld: 0x497539,
      leaf: 0x63e04e,
      leafCanopy: 0x47a83b,
      leafShaded: 0x2d6b2a,
      leafStarving: 0xd8c34a,
      root: 0x8a6d4f,
      heart: 0xd94f8e,
      heartCore: 0xffd257,
      cone: 0xf262a8, // petals
      coneArmed: 0xff9a3e, // ripe fruit
      seed: 0xffe0b0,
      litter: 0x5f5238, // fallen petals and loam
    },
    {
      // alt palette: gilded cultivar
      stem: 0x8f8748,
      stemOld: 0x6b6539,
      leaf: 0xd6d44e,
      leafCanopy: 0xa8a53b,
      leafShaded: 0x6b692a,
      leafStarving: 0xd8c34a,
      root: 0x8a6d4f,
      heart: 0xd9a04f,
      heartCore: 0xfff0a0,
      cone: 0xf2c862,
      coneArmed: 0xff6a3e,
      seed: 0xfff0d0,
      litter: 0x6b5f38,
    },
  ],
  behavior: {
    summary:
      'A greedy sprawling vine. Anthophyta race along the rock surface with ' +
      'broad, delicious leaves, then bloom: flowers ripen into fruit that ' +
      'Frugivora carry across the void — unmatched reach, feathered dice. ' +
      'Anthophila visiting a flower speed its bloom. Poor in shadow, fragile ' +
      'in a fight, and Phytophaga find them delicious.',
    priorities: [
      { id: 'anchor', text: 'Anchor: tubers into the rock' },
      { id: 'needles', text: 'Unfurl broad leaves on every runner' },
      { id: 'trunk', text: 'Race the runner along the surface, sunward' },
      { id: 'branches', text: 'Send short side shoots' },
      { id: 'cones', text: 'Bloom; ripen fruit for the birds' },
      { id: 'mature', text: 'Mature: store sugar and endure' },
    ],
  },
  life: {
    hp: { heart: 55, root: 25, stem: 18, leaf: 8, cone: 12 },
    hpVariance: 0.2,
    starveDps: { leaf: 1.2, stem: 0.5, root: 0.5, heart: 1.0, cone: 1.2 },
    hardenAge: 60,
    hardenBonus: 8,
    leafLifespan: [90, 150],
    pruneRefund: 0.4,
  },
  repro: {
    style: 'fauna',
    coneMax: 2,
    coneCost: 6,
    coneEnergy: 24,
    chargeRate: 2.2,
    armedAutoFire: 10, // fallback self-drop when no bird comes
    aiAutoFire: 6,
    seedSpeed: 80,
    seedRange: 260, // short toss — Frugivora are the long game
    seedStartEnergy: 30,
    minSpacing: 48,
  },
  energy: {
    mode: 'photo',
    heartInitial: 50,
    capBase: 60,
    capPerPart: 2,
    reserve: 4,
    heartIncome: 0.1,
    leafIncome: 1.9,
    minAngleEff: 0.35,
    canopyShade: 0.45,
    shadeFloor: 0.05,
    upkeep: { heart: 0.15, root: 0.05, stem: 0.07, leaf: 0.16, cone: 0.1 },
  },
  growth: {
    style: 'vine',
    actionCooldown: 0.38,
    rootMax: 2,
    rootCost: 4,
    rootLen: 12,
    stemCost: 5,
    leafCost: 5,
    trunkTarget: 20,
    trunkSegLen: 7.5,
    trunkTaper: 0.05,
    branchEvery: 2,
    branchStartDepth: 3,
    branchAngleDeg: 74,
    branchSegLen: 7.5,
    branchCurl: 0.1,
    leafLen: 8.5,
    leafAngleDeg: 75,
    leavesPerTrunkStem: 2,
    leavesPerBranchStem: 2,
    wPrevDir: 0.4,
    wUp: 0.12,
    wSun: 0.1,
    wNoise: 0.03,
    wTangent: 0.35,
  },
};

/** BASIDIOMYCOTA — the anti-sun faction: web, spores, decomposition, dread. */
export const BASIDIOMYCOTA: FactionDef = {
  id: 'basidiomycota',
  name: 'Basidiomycota',
  render: { leaf: 'gill', heart: 'dome', repro: 'dome' },
  terms: { leaf: 'gills', leafOne: 'gill', cone: 'fruiting dome', trunk: 'mycelium' },
  verbHaste: { ping: 0.5 }, // the web echoes: attention verbs come back fast
  myco: {
    startLen: 34,
    spreadLen: 1.15, // wraps a mid-size rock in ~4 min, not 90s
    costPerLen: 0.45,
    upkeepPerLen: 0.02,
    retreatLen: 2.5,
    tricklePerLen: 0.035,
  },
  palettes: [
    {
      stem: 0xcfc8dc, // pale lace
      stemOld: 0xa89fc0,
      leaf: 0x9a7ab8,
      leafCanopy: 0x8a6aa8,
      leafShaded: 0x7a5a98,
      leafStarving: 0xd8c34a,
      root: 0x8a80a0,
      heart: 0x8a5fb0,
      heartCore: 0x7ae2ff, // bioluminescent
      cone: 0xb88ad2,
      coneArmed: 0x7ae2ff,
      seed: 0xc9a4ff,
      litter: 0x4a3a5e, // the creeping web-stain
    },
    {
      // bone-pale rival strain
      stem: 0xd8d4c4,
      stemOld: 0xb0ac9a,
      leaf: 0xb8b090,
      leafCanopy: 0xa89f80,
      leafShaded: 0x8a8268,
      leafStarving: 0xd8c34a,
      root: 0x9a9280,
      heart: 0xb0a880,
      heartCore: 0xa8ffd2,
      cone: 0xc8bf9a,
      coneArmed: 0xa8ffd2,
      seed: 0xe8e0c0,
      litter: 0x4a4638,
    },
  ],
  behavior: {
    summary:
      'The anti-sun clade lives underground. The mycelium creeps unseen through ' +
      'the rock — given time it wraps the far side, and no rival seed can root ' +
      'in claimed ground. Only soft fruiting domes surface (they prefer shade), ' +
      'digesting every husk on the rock and bursting spores; a spore landing on ' +
      'living rivals seeds an infection that spreads part to part — prune it ' +
      'off. When the sun fades at round\u2019s end, they accelerate.',
    priorities: [
      { id: 'anchor', text: 'Bury the heart; take root in the stone' },
      { id: 'trunk', text: 'Spread the mycelium through the rock, both ways' },
      { id: 'cones', text: 'Raise fruiting domes on claimed ground (shade preferred)' },
      { id: 'needles', text: 'Digest husks and stone through the network' },
      { id: 'branches', text: 'Starve rivals of rootable ground' },
      { id: 'mature', text: 'Mature: drain, spore, endure the dark' },
    ],
  },
  life: {
    hp: { heart: 40, root: 25, stem: 28, leaf: 8, cone: 12 },
    hpVariance: 0.2,
    starveDps: { leaf: 1.0, stem: 0.4, root: 0.4, heart: 1.0, cone: 1.0 },
    hardenAge: 70,
    hardenBonus: 6,
    leafLifespan: [160, 240],
    pruneRefund: 0.4,
  },
  repro: {
    style: 'ballistic',
    sporeFan: 2, // spores land now; three per burst was a flood
    infects: true,
    coneMax: 2, // spores WORK now — three domes at once was a firehose
    coneCost: 6,
    coneEnergy: 26,
    chargeRate: 2.0,
    armedAutoFire: 7,
    aiAutoFire: 3,
    seedSpeed: 60,
    seedRange: 540,
    seedStartEnergy: 30,
    minSpacing: 55, // webs need elbow room — fewer plants per rock
  },
  energy: {
    mode: 'decomp',
    decomp: { huskRate: 4, huskYield: 0.9 },
    heartInitial: 45,
    capBase: 70,
    capPerPart: 2,
    reserve: 4,
    heartIncome: 0.1,
    leafIncome: 1, // unused in decomp mode
    minAngleEff: 0.35,
    canopyShade: 1, // shade means nothing to them
    shadeFloor: 1,
    upkeep: { heart: 0.15, root: 0.04, stem: 0.05, leaf: 0.08, cone: 0.1 },
  },
  growth: {
    style: 'myco',
    actionCooldown: 0.6,
    rootMax: 0, // the buried heart IS the anchor
    rootCost: 4,
    rootLen: 11,
    stemCost: 4,
    leafCost: 4,
    trunkTarget: 0, // no above-ground architecture
    trunkSegLen: 6.5,
    trunkTaper: 0.03,
    branchEvery: 3,
    branchStartDepth: 3,
    branchAngleDeg: 60,
    branchSegLen: 5.5,
    branchCurl: 0.05,
    leafLen: 6,
    leafAngleDeg: 80,
    leavesPerTrunkStem: 0,
    leavesPerBranchStem: 0,
    wPrevDir: 0.35,
    wUp: 0.06,
    wSun: 0,
    wNoise: 0.06,
    wTangent: 0.45,
  },
};

export const FACTIONS: Record<FactionId, FactionDef> = {
  pinophyta: PINOPHYTA,
  anthophyta: ANTHOPHYTA,
  basidiomycota: BASIDIOMYCOTA,
};
