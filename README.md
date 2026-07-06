# Pluntz

A light-touch colony sim / territorial arcade garden: shepherd a mostly autonomous colony
of geometric space plants competing for directional sunlight across scattered asteroids.

- **Design:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — the living GDD that drives all iterations.
- **Stack:** TypeScript + Vite + PixiJS, deployed to Vercel for testing, wrapped with Capacitor for Android.
- **Status:** M4 — reproduction: seed cones, aimed shots across the void, sprouting,
  colony energy pools, the Ping verb, impact particles, and visible part health.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # headless sim tests (determinism, light, growth)
npm run build    # typecheck + production bundle in dist/
```

**Vercel:** import the repo, framework preset **Vite** (auto-detected). No config needed.

**URL params:** `?seed=123` fixes the world seed (also shown in the debug panel).

## Current test script (M4)

1. **Cones:** let the tree mature (8× helps) — cone buds appear on high tips with a
   charge arc, then pulse gold when armed. Left alone ~12s, an armed cone fires itself
   at a promising rock. The inspector's aim line narrates every stage.
2. **The shot:** drag from a pulsing armed cone — a range ring and aim line appear —
   release to fire across the void. Watch the seed land, puff dust, and sprout.
   Colonies spread rock to rock; crowded landings fizzle.
3. **Ping:** tap **◎ ping**, then tap near a rock — cones now strongly prefer firing
   at it for 60s (the blue pulsing marker).
4. **Health & impacts:** spawn debris at the tree — hits flash sparks, wounded wood
   darkens, shows cracks, and sheds amber motes until it dies or outgrows the damage.
   The inspector has a new "wounds" row.
5. **Colony pool:** young sprouts get fed by thriving elders (watch a fresh seedling's
   energy climb faster than its own needles could manage).

## Earlier scripts (M3)

1. **Prune:** tap **✂ prune** (bottom right), swipe across a mid-trunk segment — the
   whole top falls dead (gray husk), energy is partially refunded, and the spire
   regrows through the wound. Swiping the heartseed does nothing (uncuttable).
2. **Debris:** rocks drift in ambiently (~1.5/min); watch one shatter on a rock or
   clip the canopy. Hit **spawn debris** in the debug panel for an aimed shot at the
   crown. Old bark-hardened trunk shrugs off small hits; needles and young wood die.
3. **Starve-out:** enable **move rocks**, park a big asteroid sunward of the colony,
   and wait: energy drains, then needles wither, then wood, then the heart — a full
   husk. The inspector narrates each stage.
4. **Aging:** needles have lifespans — watch old fans drop and regrow on a mature
   tree; trunk segments darken as they harden.

## Earlier scripts (M0–M2)

1. Open the build. Pan with one finger / mouse drag, pinch or scroll to zoom —
   starfield parallaxes, 60fps in the debug panel.
2. Watch the Pinophyta seedling on the home rock grow roots, a spire trunk, branches,
   and needle fans, leaning toward the sun. Tap it for the inspector: a live "what am I
   doing" aim line, plus expandable **behavior** (faction strategy with the active
   priority highlighted, trunk/branch/needle progress) and **energy detail** sections.
   Needles render in three states — bright (lit), mid (canopy-shaded, half income —
   including the tree's own shade), dark (rock shadow). Use 4×/8× speed to skip ahead.
3. Drag the **sun angle** slider or enable **day cycle** — shadows sweep across the map,
   needles on the dark side dim and income drops.
4. Enable **move rocks**, drag a big asteroid between the sun and the plant — the colony
   is shaded, net energy goes negative, growth stalls. Drag it away and growth resumes.

## Project layout

- `src/sim/` — pure simulation. No Pixi, no DOM; runs headless in Vitest.
- `src/render/` — PixiJS views that read sim state (never mutate it).
- `src/ui/` — camera/touch input, debug panel, inspector.
- `src/content/` — data: tuning constants, faction definitions, maps, art manifest.
