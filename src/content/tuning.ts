/**
 * All global tuning constants live here — never inline magic numbers in the sim.
 * Faction-specific numbers live in factions.ts.
 */
export const TUNING = {
  /** Sim ticks per second. Render interpolates nothing yet; growth is slow. */
  simHz: 10,
  simDt: 0.1,

  /** Max sim-seconds consumed per rendered frame (spiral-of-death guard). */
  maxFrameCatchup: 0.5,

  camera: {
    minZoom: 0.25,
    maxZoom: 3.0,
    panMargin: 500, // how far past map bounds the camera may drift
    tapMaxPx: 10, // movement under this = a tap, not a drag
    tapMaxMs: 350,
  },

  world: {
    asteroidVerts: [10, 15] as [number, number], // min/max polygon vertices
    asteroidRoughness: 0.16, // radial jitter fraction
  },
} as const;
