import type { MapDef } from '../../sim/types';
import { DEV01 } from './dev01';
import { CONTACT01 } from './contact01';

export const MAPS: Record<string, MapDef> = {
  dev01: DEV01,
  contact01: CONTACT01,
};

export const DEFAULT_MAP = 'contact01';
