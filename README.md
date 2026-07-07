# Pluntz

A light-touch colony sim / territorial arcade garden: shepherd a mostly autonomous colony
of geometric space plants competing for directional sunlight across scattered asteroids.

- **Design:** [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — the living GDD that drives all iterations.
- **Stack:** TypeScript + Vite + PixiJS, deployed to Vercel for testing, wrapped with Capacitor for Android.
- **Status:** M7.1 — start menu with faction/map/seed select, surface-anchored
  plants and territory, tappable fauna riding orbits, verb particle bursts, and
  a general juice pass. Two factions, strategy layer, living fauna.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # headless sim tests (determinism, light, growth)
npm run build    # typecheck + production bundle in dist/
```

**Vercel:** import the repo, framework preset **Vite** (auto-detected). No config needed.

**URL params:** `?seed=123` fixes the world seed (also shown in the debug panel).

## Current test script (M7.1)

1. **Menu:** the game opens on a start menu — pick map, your clade, the rival's
   clade, and a seed, then GROW. (Reopen via the debug panel's *menu* button or
   the end-of-round banner.) The URL updates for shareable setups.
2. **Surface fidelity:** zoom into any plant — heartseeds sit exactly on the
   drawn rock surface and the litter bed follows the rock's actual contour.
   The bed is also the rule: no seed (yours or theirs) can root inside one, so
   territory, energy sharing, and seedling spacing are all the same visible thing.
3. **Fauna:** tap any critter for its card — name, neutral tag, current
   objective, health. Idle fauna ride orbits around rocks and hop between them.
4. **Verbs & juice:** ping/lure/bless all burst particles at the target; a
   blessed plant rains gold motes and shows "✦ blessed Ns" on its card; growth
   sparkles; seeds leave contrails. An armed cone never self-fires while you're
   dragging its aim.

## Earlier scripts (M6-M7)

1. **Strategy:** the round chip shows your essence (⬡). Open **⬡ evolve** for the
   trait tree and the two instinct sliders (fortify↔expand, spread↔tall). Essence
   comes from surviving, colonizing fresh rocks, and rival deaths. **✦ bless** a
   plant for a 25s growth surge. The AI buys traits too.
2. **Canopy win:** hold 55% of all lit rock surface (your substrate beds are your
   territory) for 45s — the chip narrates any active hold. Domination still works.
3. **Anthophyta:** open `?faction=anthophyta` — you now play sprawling vines with
   broad leaves and flowers. Flowers bloom (faster when an Anthophila mote visits),
   ripen into fruit, and Frugivora birds carry your seeds map-distances. Phytophaga
   grazers find your leaves delicious — **✿ lure** (2⬡) drops a scent that pulls
   grazers anywhere (aim it at the rival) and steers your birds' deliveries.
4. **Matchups:** `?ai=anthophyta` for vine-vs-vine or spire-vs-vine either way.
5. Balance flag for playtest: bird delivery may be too strong vs ballistic cones.

## Earlier scripts (M5)

1. Open the default map (**First Contact**): you're the green Verdance colony (west);
   the rust-orange **Rustspire** AI starts east and fires its cones fast. The chip at
   top right tracks living plants per colony and the sun-fade countdown.
2. Race for the rich middle rock (purple-veined). Ping it to prioritize it; aim armed
   cones by hand for precision shots. Seeds that strike rival growth bruise it.
3. Where canopies meet, **overgrowth warfare**: soft needles die fast at contact,
   hardened trunks grind slowly. Shade their canopy; prune your losses.
4. Win by extinguishing every Rustspire heartseed (**OVERGROWTH**), lose by losing all
   of yours (**EXTINCTION**). At 15:00 the sun fades over 3 minutes — photosynthesis
   collapses and the round resolves by starvation.
5. Sandbox without a rival: add `?map=dev01` to the URL. `?seed=N` for reproducible maps.

## Earlier scripts (M4)

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
