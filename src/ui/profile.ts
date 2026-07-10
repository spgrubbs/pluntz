import type { FactionId } from '../sim/types';

/**
 * The metaprogression profile: wins per clade, kept in localStorage across
 * rounds. Each win widens one more draft: after the first win the round's
 * first mutation draft deals a third card, after two wins the second draft
 * does, after three the third. The sim never reads storage; main.ts stamps
 * the unlocked depth onto colonies at world creation (AI colonies mirror
 * the player, so the opposition scales with you).
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

/** Drafts 1..bonusDepth deal a third card: one more per win, up to all three. */
export function bonusDepthFor(faction: FactionId): number {
  return Math.min(winsFor(faction), 3);
}
