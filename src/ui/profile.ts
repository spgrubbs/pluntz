import type { FactionId } from '../sim/types';

/**
 * The metaprogression profile: wins per clade, kept in localStorage across
 * rounds. Winning with a clade unlocks its deeper mutation tiers — tier 2
 * after the first win, tier 3 after the second. The sim never reads storage;
 * main.ts stamps the unlocked tier onto colonies at world creation (AI
 * colonies mirror the player, so the opposition scales with you).
 */
const KEY = 'pluntz.profile';

export interface Profile {
  wins: Partial<Record<FactionId, number>>;
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p && typeof p === 'object' && p.wins) return p;
    }
  } catch {
    /* storage unavailable: everyone starts at tier 1 */
  }
  return { wins: {} };
}

export function recordWin(faction: FactionId): void {
  const p = loadProfile();
  p.wins[faction] = (p.wins[faction] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function winsFor(faction: FactionId): number {
  return loadProfile().wins[faction] ?? 0;
}

export function maxTierFor(faction: FactionId): 1 | 2 | 3 {
  const w = winsFor(faction);
  return w >= 2 ? 3 : w >= 1 ? 2 : 1;
}
