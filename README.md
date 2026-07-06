# Pluntz

A light-touch colony sim / territorial arcade garden: shepherd a mostly autonomous colony
of geometric space plants competing for directional sunlight across scattered asteroids.

- **Design:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — the living GDD that drives all iterations.
- **Stack:** TypeScript + Vite + PixiJS, deployed to Vercel for testing, wrapped with Capacitor for Android.
- **Status:** M2 — first autonomous Pinophyta plant growing under directional light.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # headless sim tests (determinism, light, growth)
npm run build    # typecheck + production bundle in dist/
```

**Vercel:** import the repo, framework preset **Vite** (auto-detected). No config needed.

**URL params:** `?seed=123` fixes the world seed (also shown in the debug panel).

## Current test script (M0–M2)

1. Open the build. Pan with one finger / mouse drag, pinch or scroll to zoom —
   starfield parallaxes, 60fps in the debug panel.
2. Watch the Pinophyta seedling on the home rock grow roots, a spire trunk, branches,
   and needle fans, leaning toward the sun. Tap it for the inspector (energy, income
   vs. upkeep, needles lit). Use 4×/8× speed to skip ahead.
3. Drag the **sun angle** slider or enable **day cycle** — shadows sweep across the map,
   needles on the dark side dim and income drops.
4. Enable **move rocks**, drag a big asteroid between the sun and the plant — the colony
   is shaded, net energy goes negative, growth stalls. Drag it away and growth resumes.

## Project layout

- `src/sim/` — pure simulation. No Pixi, no DOM; runs headless in Vitest.
- `src/render/` — PixiJS views that read sim state (never mutate it).
- `src/ui/` — camera/touch input, debug panel, inspector.
- `src/content/` — data: tuning constants, faction definitions, maps, art manifest.
