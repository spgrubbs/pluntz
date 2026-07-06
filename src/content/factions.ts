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
}

export interface FactionDef {
  id: FactionId;
  name: string;
  /** palettes[0] is the default; extra palettes distinguish same-faction colonies. */
  palettes: FactionColors[];
  /** Static text shown in the inspector's expandable behavior section. */
  behavior: {
    summary: string;
    priorities: { id: IntentId; text: string }[];
  };
  energy: {
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
    coneMax: number; // simultaneous cones
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
  };
}

/** PINOPHYTA — tall, patient, armored spires. The baseline faction. */
export const PINOPHYTA: FactionDef = {
  id: 'pinophyta',
  name: 'Pinophyta',
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
    coneMax: 2,
    coneCost: 8,
    coneEnergy: 30,
    chargeRate: 1.6,
    armedAutoFire: 12,
    aiAutoFire: 2,
    seedSpeed: 95,
    seedRange: 900,
    seedStartEnergy: 35,
    minSpacing: 55,
  },
  energy: {
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
    actionCooldown: 0.6,
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
  },
};

export const FACTIONS: Record<FactionId, FactionDef> = {
  pinophyta: PINOPHYTA,
};
