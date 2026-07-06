import type { FactionId } from '../sim/types';

export interface FactionDef {
  id: FactionId;
  name: string;
  colors: {
    stem: number;
    stemOld: number;
    leaf: number;
    leafShaded: number;
    leafStarving: number;
    root: number;
    heart: number;
    heartCore: number;
  };
  energy: {
    heartInitial: number;
    capBase: number;
    capPerPart: number;
    reserve: number; // growth never spends below this
    heartIncome: number; // baseline trickle so a colony can't hard-stall at zero
    leafIncome: number; // energy/sec per fully lit, well-angled leaf
    minAngleEff: number; // efficiency floor vs. bad sun angle
    shadeFloor: number; // income multiplier when occluded (evergreen floor)
    upkeep: { heart: number; root: number; stem: number; leaf: number };
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
  colors: {
    stem: 0x5d8a5f,
    stemOld: 0x47624a,
    leaf: 0x3ee89c,
    leafShaded: 0x1d7a56,
    leafStarving: 0xd8c34a,
    root: 0x8a6d4f,
    heart: 0x2fbf7f,
    heartCore: 0xffd257,
  },
  energy: {
    heartInitial: 45,
    capBase: 60,
    capPerPart: 2,
    reserve: 4,
    heartIncome: 0.2,
    leafIncome: 1.2,
    minAngleEff: 0.35,
    shadeFloor: 0.15,
    upkeep: { heart: 0.15, root: 0.05, stem: 0.06, leaf: 0.1 },
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
