import type { SimEvent } from './types';

/**
 * Render-facing event channel. stepWorld() points the sink at the active
 * world's event buffer each tick; UI-invoked sim mutations (prune, aimed
 * fire) reuse the last sink. Events are outputs only — never read by the
 * sim — so this does not affect determinism.
 */
let sink: SimEvent[] | null = null;

export function setEventSink(s: SimEvent[] | null): void {
  sink = s;
}

export function emit(e: SimEvent): void {
  if (sink) sink.push(e);
}
