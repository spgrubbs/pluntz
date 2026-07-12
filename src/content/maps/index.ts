import type { MapDef } from '../../sim/types';
import { DEV01 } from './dev01';
import { CONTACT01 } from './contact01';
import { C01_FIRST_LIGHT, C03_GLOOMFALL, C04_TERRA_INCOGNITA } from './campaign';
import { R01_SHADOW_CANYON } from './longroad';

export const MAPS: Record<string, MapDef> = {
  c01: C01_FIRST_LIGHT,
  contact01: CONTACT01,
  c03: C03_GLOOMFALL,
  c04: C04_TERRA_INCOGNITA,
  r01: R01_SHADOW_CANYON,
  dev01: DEV01,
};

export const DEFAULT_MAP = 'c01';

/** Menu ordering + display grouping ('skirmish' resolves via the generator). */
export const MAP_CHOICES: { id: string; label: string; group: string }[] = [
  { id: 'c01', label: 'I · First Light', group: 'campaign' },
  { id: 'contact01', label: 'II · First Contact', group: 'campaign' },
  { id: 'c03', label: 'III · Gloomfall', group: 'campaign' },
  { id: 'c04', label: 'IV · Terra Incognita — fog', group: 'campaign' },
  { id: 'r01', label: '⟶ Long Road I · Shadow Canyon', group: 'longroad' },
  { id: 'skirmish', label: '∞ Skirmish (random)', group: 'skirmish' },
  { id: 'dev01', label: 'Seedfall Reach (sandbox)', group: 'sandbox' },
];
