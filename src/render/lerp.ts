import type { World } from '../sim/types';

export interface LerpPos {
  x: number;
  y: number;
}

/**
 * The butter. The sim ticks at 10 Hz; drawing entities at their raw sim
 * positions snaps them 10 times a second. The Lerper keeps the previous and
 * current tick's positions for everything that moves (fauna, seeds, debris,
 * asteroids) and the views blend between them by the render accumulator's
 * fraction — classic fixed-timestep interpolation, sim untouched.
 */
export class Lerper {
  private prev = new Map<number, LerpPos>();
  private curr = new Map<number, LerpPos>();
  /** Fraction of a sim tick the render clock sits past the last tick. */
  alpha = 1;

  /** Call once right after every stepWorld. */
  snapshot(world: World): void {
    const old = this.prev;
    this.prev = this.curr;
    this.curr = old;
    this.curr.clear();
    for (const f of world.fauna) this.curr.set(f.id, { x: f.pos.x, y: f.pos.y });
    for (const s of world.seeds) this.curr.set(s.id, { x: s.pos.x, y: s.pos.y });
    for (const d of world.debris) this.curr.set(d.id, { x: d.pos.x, y: d.pos.y });
    for (const a of world.asteroids) this.curr.set(a.id, { x: a.pos.x, y: a.pos.y });
  }

  /** Forget everything (world swapped — ids may recur with new meanings). */
  reset(): void {
    this.prev.clear();
    this.curr.clear();
  }

  /** The draw position for entity `id`, falling back to its live sim pos. */
  pos(id: number, live: LerpPos): LerpPos {
    const p = this.prev.get(id);
    const c = this.curr.get(id);
    if (!p || !c) return live;
    const t = Math.min(Math.max(this.alpha, 0), 1);
    return { x: p.x + (c.x - p.x) * t, y: p.y + (c.y - p.y) * t };
  }
}
