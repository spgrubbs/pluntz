# PLUNTZ — Game Design Document

**Version 0.1 — Living document.** This GDD instructs iterative development. Every milestone
ends in a build that is deployable to Vercel and testable by hand. Nothing in this document
is real biology; factions are videogame fantasy loosely themed on plant clades, the way
RTS races are themed on insects or machines.

---

## 1. Vision

You are a small, vulnerable sapling in a large dynamic void. Through luck and audacity you
spread a plant empire across scattered asteroids until you overgrow the competition.

**One-line pitch:** A light-touch colony sim / territorial arcade garden — *Reassembly*'s
geometric, faction-colored aesthetic, but instead of piloting a ship you shepherd a mostly
autonomous colony of space plants competing for sunlight.

### Design pillars

1. **The garden grows itself.** Plants are autonomous. The player nudges, they don't drive.
   If the player puts the phone down for 60 seconds, the colony should still be doing
   something interesting (and possibly dying).
2. **Sunlight is real estate.** Light is directional. Position, height, and shade are the
   core competition. Every faction relates to light differently (including ignoring it).
3. **Readable geometry.** Every part's silhouette communicates its function at a glance.
   Faction identity comes from color + shape language, not detail.
4. **Small rounds, big feelings.** A round is 10–30 minutes and has a dramatic arc:
   fragile start → first foothold → contested middle → overgrowth or extinction.
5. **Indirect power.** Player tools cost energy the colony could have used to grow. Every
   intervention is a trade against autonomy.

---

## 2. Platform & Technical Direction

### Targets

- **Primary deployment:** Android (Google Play), portrait *and* landscape, touch-first.
- **Development/testing:** Web build deployed to Vercel after every iteration. The web
  build is the daily test harness; Android is wrapped from the same code.

### Stack (decided — do not relitigate per-milestone)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Safety across many iterations with an AI pair |
| Build | Vite | Instant dev server, trivial Vercel deploys |
| Rendering | PixiJS (WebGL, Canvas fallback) | Thousands of simple geometric sprites at 60fps on mid Android |
| Android wrapper | Capacitor | Wraps the exact web build; adds native APIs (haptics, save files) later |
| Sim architecture | Fixed-timestep deterministic simulation, decoupled from render | Replays, debugging, consistent behavior across frame rates |
| State | Plain TS module store (no framework) for sim; minimal DOM/Pixi UI | Keep the sim portable and testable headless |
| Tests | Vitest for sim logic (headless — no renderer needed) | The sim must be verifiable without eyeballs |

### Performance budget (mid-range Android, ~2021 phone)

- 60 fps target, 30 fps floor during spore storms.
- ≤ ~3,000 live plant nodes on screen; sim tick 10 Hz (interpolated render), heavy
  systems (shade recompute, AI planning) staggered across ticks.
- Zero per-frame allocations in the sim hot loop (object pools).

### Project conventions

- `src/sim/` — pure simulation, **no Pixi imports, no DOM**. Runs headless in tests.
- `src/render/` — Pixi scene that reads sim state. Never mutates sim.
- `src/ui/` — HUD, menus, touch input → intents fed into sim.
- `src/content/` — data-driven definitions: parts, factions, maps, as JSON/TS data.
- All tuning constants in `src/content/tuning.ts`, never inline magic numbers.

---

## 3. Core Fantasy & Round Structure

### The round (10–30 min)

1. **Seedfall (0–2 min).** Your single seed drifts in; you choose (or are given) an
   anchor asteroid. You sprout. You are tiny and the map is huge and indifferent.
2. **Rooting (2–8 min).** Grow your first canopy, survive early hazards (debris, a rival's
   scout spores, a shadow passing over). Earn your first Essence and buy your first trait.
3. **Contest (8–20 min).** Colonies collide at the borders: shading wars, spore raids,
   strangler vines, fauna lured back and forth. Points of interest get claimed.
4. **Overgrowth (endgame).** One colony hits the win condition or the round timer forces
   sudden-death (sunlight slowly dims everywhere; last photosynthesizing colony wins —
   parasites/fungals get an inverted sudden-death, see §7).

### Win conditions (map-configurable; campaign varies them)

- **Domination:** eliminate all rival colonies (kill every *heart*, see §5).
- **Canopy:** control X% of total lit surface for Y continuous seconds.
- **Bloom:** be first to complete a *Great Bloom* (expensive terminal reproductive
  structure — a victory monument you must grow and defend while it charges).

### Loss

Your colony dies when your last **Heartseed** (see §5) is destroyed. Defeat should feel
like a storm that was survivable in hindsight — always show a one-line epitaph
("Shaded out by the Basidiomycota, minute 14").

---

## 4. The World

A 2D top-down void, one screen-to-several-screens across (maps have fixed bounds), scattered with:

- **Asteroids** — anchorable rock. The fundamental land. Sizes from pebble (1 plant) to
  massive (whole colony). Some rotate slowly, dragging their gardens through light and shadow.
- **Rich rock** — mineral-veined asteroids; roots there extract bonus **Minerals** (§5).
- **Derelicts / husks** — dead megaflora and wrecked structures. Decomposer factions eat
  them; others can only anchor on them as scaffolding.
- **Ice pockets** — meltable water reserves; contested utility resource in later content.
- **Drift debris** — slow ambient rocks that damage what they hit (shatterable by grown
  defenses). The main "weather."
- **Fauna** (neutral critters, geometric like everything else; named with real ecological Latin):
  - **Anthophila** — pollinator motes; visit flowers, enable cross-colony trait-stealing (later content).
  - **Phytophaga** — grazers that nibble leaves; a pest to canopy factions, a weapon if lured to a rival.
  - **Frugivora** — fruit-eaters that then drop your seeds far away. The long-range expansion vector.

### Sunlight

- Each map has 1+ **suns** at map edge or as free bodies. Light is **directional and
  parallel** per sun (like Reassembly's clean vector look — long soft rays across the map).
- Opaque objects (asteroids, plants) cast **hard shadows** — shade is the core territorial
  mechanic. A leaf in shade earns nothing; a leaf shading a rival's leaf is a weapon.
- Maps may feature a **slow day cycle** (sun orbits map over ~5 min), so prime real estate
  migrates and no position is safe forever. Campaign map 1 uses a fixed sun for learnability.

---

## 5. The Plant Model (the heart of the sim)

Plants are **node-graphs of parts**, grown organically over time — not player-assembled
like Reassembly ships. The part-picker DNA of Reassembly instead lives in **traits** (§6):
the player shapes *what the colony tends to grow*, not each placement.

### Parts (universal vocabulary; factions reskin and remix)

| Part | Geometry language | Function |
|---|---|---|
| **Heartseed** | Fat circle w/ inner core | Colony life. Stores energy. Losing all = defeat. New ones are expensive. |
| **Root / Holdfast** | Angular taproot wedges into rock | Anchors plant to asteroid; extracts Minerals from rich rock |
| **Stem** | Segmented strut | Structure; raises parts toward light; has HP, can be severed |
| **Leaf / Frond** | Flat quad/triangle fans | Photosynthesis: energy ∝ lit area × angle to sun |
| **Storage bulb** | Swollen node | Energy battery; smooths day cycles and sieges |
| **Reproductive structure** | Varies wildly per faction (§7) | Makes new plants: launched seeds, spore clouds, runners, fruit |
| **Defense** | Spikes, bark plating, stinger polyps | Blocks grazers, damages encroaching rival growth |
| **Special** | Per-faction | Faction mechanics live here |

### Growth (autonomous)

- Each plant runs a simple behavior policy: allocate incoming energy between
  *maintenance → growth → storage → reproduction*, with weights set by faction defaults
  and player-purchased traits.
- Growth is **phototropic**: new stems bias toward light and away from occlusion, with
  faction-flavored branching patterns (conifer spire vs. sprawling vine vs. creeping mat).
  This is where visual identity emerges *for free* from mechanics.
- Plants age. Old growth hardens (more HP, less efficient). Dead plants become husk
  material — food for decomposers, scaffolding for epiphytes.

### Resources

| Resource | Source | Used for |
|---|---|---|
| **Energy** (per-plant, flows colony-wide slowly) | Light on leaves; decomposition; parasitism | Growth, reproduction, defenses, player abilities |
| **Minerals** (colony pool) | Roots in rich rock; recycled husks | Hard parts: bark, spikes, Heartseeds, Great Bloom |
| **Essence** (colony pool, the "meta" currency) | Milestones: first bloom, kills, surviving hazards, round timeline | Traits (§6) and the strongest player interventions |

### Damage & competition (no gunfire — this is botany noir)

- **Shading:** the passive kill, in two tiers. **Canopy shade** (any foliage in the way —
  a rival's or your own) halves a leaf's income, so overgrowing an enemy works but bushy
  architecture taxes itself; needles on the same branch never shade each other (foliage
  arranges itself in a plane). **Hard rock shadow** is near-total. Shaded parts starve
  slowly; most deaths are shade deaths.
- **Overgrowth:** growing into/around a rival crushes or strangles at contact points
  (slow, mesmerizing, and readable — vines visibly wrap).
- **Chemical:** toxin auras, acid drips from parasites, spore infections — DoT fields
  rendered as tinted particle hazes.
- **Physical:** drift debris impacts, launched hardened seeds (a *seed* can be a slow
  cannonball), grazer bites.

---

## 6. The Player's Hands (light touch by design)

The player never places parts directly. All tools are **indirect**, cost resources, and
have visible cooldowns. Proposed toolset — build in this order, keep each one testable solo:

### Tier 1 — attention (free, always available)

- **Pan/pinch camera**; tap any plant/part for an inspector card.
- **Ping:** tap-hold a location to bias the colony's *interest* — nearby plants weight
  growth and reproduction toward the ping. Free but one active ping only. This is the
  bread-and-butter "shepherd's crook" verb.

### Tier 2 — cultivation (Energy costs)

- **Bless:** tap a plant → temporary growth surge (visual: bright pulse up its stems).
- **Prune:** swipe across your own stems to cut them. Refunds some energy; used to redirect
  growth, drop shaded dead weight, or amputate infections.
- **Aim reproduction:** when a launcher-type reproductive structure is charged, the player
  may drag from it to aim the shot (otherwise it auto-fires sensibly). *The* moment of
  audacity: firing a seed across the void at a distant sunlit rock.

### Tier 3 — evolution (Essence costs; the strategic layer)

- **Traits:** a compact per-round mutation tree (~12–18 nodes/faction, pick ~5–7 per
  round). Examples: *Broadleaf* (+leaf area, +grazer appeal), *Ironbark*, *Volatile Seeds*
  (seeds explode on landing, clearing a landing zone), *Deep Taproots*, *Sweet Nectar*
  (Anthophila prioritize you). Traits apply colony-wide to future growth — old growth keeps
  old traits, so colonies visibly show their history in rings of style.
- **Instincts:** sliders/toggles for the autonomous policy — Expand ↔ Fortify,
  Spread thin ↔ Grow tall. Two sliders max; this must not become a spreadsheet.

### Tier 4 — rare dramatic acts (Essence, once-or-twice a round)

- **Lure:** drop a scent at a location — pulls fauna (send Phytophaga at a rival; call a
  Frugivora to your fruit).
- **Martyr Bloom:** sacrifice a mature plant to instantly fire *all* its stored energy as
  reproduction (panic button / all-in expansion).
- **Great Bloom:** the victory monument (see §3).

Everything above is a suggestion set to iterate on in playtests; Ping + Prune + Aim
reproduction + Traits are the load-bearing four and get built first.

---

## 7. Factions (launch three; roster grows later)

Faction = color + shape language + growth pattern + reproduction style + 1–2 rule-breaking
mechanics + trait tree flavor. Faction names are real clade names used as sci-fi flavor;
the mechanics are pure videogame fantasy.

### 7.1 PINOPHYTA — conifer theme
- **Color/shape:** deep greens/teals; tall triangular spires, radial needle fans, armored
  cone geometry. Vertical, symmetric, cathedral-like.
- **Playstyle:** the tall, tough, patient baseline faction. Best tutorial faction.
- **Growth:** strongly vertical — outgrow the shade rather than flee it. Old growth gains
  bark armor automatically.
- **Reproduction:** **cone launchers** — ballistic hardened seeds, longest natural range,
  player-aimable. Seeds survive harsh landing spots.
- **Rule-breakers:** needles are low-value food (Phytophaga mostly ignore them); tolerates
  partial shade better than anyone (evergreen efficiency floor).
- **Weakness:** slow everything; loses a fair race for open ground.

### 7.2 ANTHOPHYTA — flowering-plant theme
- **Color/shape:** hot magentas/corals/golds on green; asymmetric sprawl, big showy
  radial flowers, round fruit. Curvy, exuberant, a little vulgar.
- **Playstyle:** fast, greedy, diplomatic-with-wildlife tempo faction.
- **Growth:** rapid sprawling vines; can grow *along* surfaces and (with trait) over rival
  husks as an epiphyte-lite.
- **Reproduction:** **flowers + fruit + fauna.** Anthophila boost seed quality; fruit lures
  Frugivora who deliver seeds map-distances away — unmatched reach but RNG-flavored (you
  influence, not command, the birds… unless you spend on Lure).
- **Rule-breakers:** wildlife synergy (fauna actively serve you); nectar can *bribe*
  Phytophaga away from your leaves.
- **Weakness:** delicious and flammable-fragile; poor in low light; fauna can be stolen.

### 7.3 BASIDIOMYCOTA — fungal theme (the anti-sun faction)
- **Color/shape:** bruise purples/bone whites, bioluminescent dots; domes, gills, creeping
  root-web filaments rendered as faint lace across rock surfaces.
- **Playstyle:** ignores the entire sunlight game — feeds on death. Terrifying midgame.
- **Growth:** surface web (a creeping territorial stain across asteroids) + fruiting domes
  at web nodes. The web is near-invisible until it fruits — scouting them is a mechanic.
- **Energy:** **decomposition** — consumes husks, dead plants, drift debris; slow trickle
  from bare rock. Every kill anywhere on the map is Gloomcap food. Long games favor them.
- **Reproduction:** **spore bursts** — short-range area clouds; any spore landing on web,
  husk, or shaded rock takes hold. Shade, everyone else's poison, is their garden.
- **Rule-breakers:** immune to shading; **infection** — spores landing on living rivals
  seed a parasitic drain (counterable by Prune — a direct player-verb interaction);
  inverted sudden-death (in the endgame dimming, they *accelerate*).
- **Weakness:** hopeless at long range; slow on clean, husk-free maps; fruiting domes are
  soft and their only vital organs (web without domes starves).

### Future roster (design later, name now for the campaign's world-building)
Fern-themed spore artillery (**Pteridophyta**); moss swarm that terraforms bare rock for
everyone (**Bryophyta**); lichen symbiote that must fuse with another colony
(**Lichenes**); succulent siege-battery hoarders (**Crassulaceae**); carnivorous
fauna-eaters (**Droseraceae**); strangler parasite that wins *inside* a host colony
(**Cuscuta**).

**AI colonies** use the same faction kits with the same rules, driven by simple utility
policies (expand toward best unclaimed light / respond to threats / spend essence on a
scripted trait order per difficulty). No cheating on resources at normal difficulty.

---

## 8. Metagame

- **Campaign: 10 authored maps**, one new mechanic or faction matchup introduced per map,
  escalating from "fixed sun, one passive rival" to "twin orbiting suns, three rivals,
  debris storms." Campaign maps are hand-placed JSON — same format the generator emits.
- **Skirmish: seeded random maps** — pick faction, rivals, map size, sun behavior.
  Seed shown/shareable (deterministic sim makes seeds reproducible bug reports too).
- **Progression:** cosmetic + roster only (unlock factions/maps). No power meta-progression
  — every round is winnable on skill from round one.

---

## 9. Art Direction & Asset Pipeline

### Direction

- Reassembly-inspired: flat-shaded simple geometry, glowing accents on dark void,
  faction-saturated colors, additive bloom on lights/spores. Function must be readable
  from silhouette alone at phone-screen sizes.
- Background: near-black blue/purple gradient, faint parallax starfield, god-rays from suns.

### Placeholder → handmade handoff (important for this project's workflow)

1. **Every drawable is registered in a single manifest** (`src/content/art-manifest.ts`):
   id, expected size, anchor point, tint behavior (faction-colorable or fixed).
2. Placeholders are **procedurally drawn Pixi Graphics** (polygons/circles) generated from
   the manifest — no binary placeholder files cluttering the repo.
3. When you hand-make an asset, you drop a PNG/SVG into `public/art/<id>.png` — the loader
   checks the manifest, prefers your file over the procedural placeholder, no code change.
4. Faction coloring is done by tinting grayscale/white art, so one handmade asset serves
   all factions unless flagged `fixedColor`.
5. A hidden `/gallery` debug route renders every manifest entry (placeholder or replaced)
   on one screen for review on-device.

### Audio (later milestone, same pattern)
Ambient drone + generative plinks on growth events; audio manifest mirrors art manifest.

---

## 10. UX & Mobile

- **Touch-first:** all verbs are tap, tap-hold, drag, swipe, pinch. No hover, ever.
  Web build maps mouse to the same gestures for Vercel testing.
- **One-hand portrait play** is the golden path; landscape supported.
- **HUD:** minimal — resource strip (Energy/Minerals/Essence), pause/speed (1×/2×/4×),
  trait button with badge when affordable, inspector card on tap. Everything else earns
  its place or dies.
- **Sim speed controls** are also the developer's testing tool from milestone 1.
- **Interruptibility:** app pause/resume must be lossless (Android lifecycle);
  auto-save every 10 s of sim time.
- **Color-blindness:** faction shape-language must carry identity without color; add
  pattern overlays option later.

---

## 11. Development Plan — Milestones

**Rules of the road:**
- Each milestone ends with: pushed to git → deployed on Vercel → a written 3-line test
  script in the PR/commit description ("open build, do X, expect Y").
- Sim logic lands with Vitest coverage where it's cheap (energy math, shade math,
  determinism check: same seed → same state hash after 1,000 ticks).
- A debug panel (FPS, tick time, entity counts, god-tools like "grant essence",
  "spawn debris") ships in milestone 1 and never gets removed, only hidden behind
  a triple-tap on the version number.

| # | Milestone | What's playable / testable on Vercel |
|---|---|---|
| **M0** | Scaffold: Vite+TS+Pixi, fixed-timestep loop, camera pan/pinch/zoom, starfield, debug panel. Vercel deploy pipeline live. | Pan around a starfield at 60fps on your phone browser. |
| **M1** | World: asteroids from a map JSON, one sun, **directional light + hard shadows** rendered as lit/shaded surface shading. | See shadows sweep as you toggle the debug day-cycle. |
| **M2** | First life: one hand-authored Pinophyta plant grows autonomously — roots, stems, leaves, phototropism, energy income visible in inspector. | Watch a plant grow toward light; shade it (debug: drag asteroid) and watch it struggle. |
| **M3** | Life & death: HP, aging, starvation, debris impacts, husks. Prune verb. | Prune your plant; ram it with debug debris; watch it die and leave a husk. |
| **M4** | Reproduction: cone launchers, aimed + auto seed shots, seed landing/sprouting. Ping verb. Colony = multiple plants, shared pools. | Spread from one rock to three. Feel the "audacious shot across the void." |
| **M5** | Competition: second Pinophyta colony w/ basic AI, shading warfare, overgrowth contact damage, win/lose (Domination) + round timer + epitaph. **First real round of Pluntz.** | Beat a dumb AI. Lose to it on purpose. 10-min round arc exists. |
| **M6** | Strategy layer: Essence, trait tree (Pinophyta, ~12 nodes), Bless, instinct sliders, Canopy win condition. | Full Pinophyta-vs-Pinophyta round with meaningful choices. Balance pass #1. |
| **M7** | Faction 2: Anthophyta + fauna (Anthophila, Frugivora, Phytophaga) + Lure. | Asymmetric matchup. Fauna visibly alive. |
| **M8** | Faction 3: Basidiomycota — decomposition, web, spores, infection, inverted sudden-death. | All three matchups playable; rock-paper-scissors texture check. |
| **M9** | Meta shell: menus, faction select, skirmish generator w/ seeds, campaign maps 1–3, save/resume, settings. | The game has a front door. Strangers can be handed the link. |
| **M10** | Android: Capacitor wrap, lifecycle/save hardening, haptics, performance pass on real device, Play internal testing track. | APK on your phone. |
| **M11+** | Campaign 4–10, audio, art-swap support polish, more factions, juice pass (particles, screen-shake-free botanical drama). | Iterate with your handmade art via the manifest pipeline. |

**Iteration protocol per session:** you playtest the latest Vercel deploy → give notes →
we adjust `tuning.ts`/mechanics → new deploy. Tuning-only changes should never require
touching sim architecture; if they do, that's an architecture bug.

---

## 12. Open Questions (decide via playtesting, not upfront)

1. Does the player pick the first anchor asteroid, or does drama demand a random seedfall?
   (Campaign: authored. Skirmish: probably pick from 3 candidates.)
2. Day-cycle speed: is migrating sunlight delightful or anxiety-inducing on a phone? M1's
   debug toggle exists to answer this early.
3. Energy as colony-wide pool vs. per-plant with slow flow: start per-plant-with-flow
   (more organic, more readable local death), fall back to pooled if it confuses.
4. Should Prune work on *rivals* at high cost (herbicide fantasy) or stay self-only
   (purity of indirect play)? Start self-only.
5. Round length pressure: is the dimming sudden-death enough, or do we need escalating
   debris storms as a timer? Test at M5.

---

## 13. Post-M9 Design Directions (playtest-driven; sequencing TBD with the player)

M0–M9 are built and playable. These are the substantial directions raised after the M9
playtest, recorded here so we can prioritize them one at a time (each is a milestone-sized
change, not a quick tweak). **Android wrap (M10) is intentionally deferred** — Capacitor
wraps whatever web build exists, so nothing is lost by polishing first.

### 13.1 Basidiomycota redesign — mycelium first, fruit second *(shipped)*
Today the fungus draws like a plant. It should live mostly **underground**: an unseen
mycelium that slowly spreads through the *whole* rock (and, given time, wraps to the far
side, opening flanking play). Only **fruiting bodies** rise from claimed territory — and
perhaps only in **shade**, which needs care so it isn't degenerate (a fungus that can only
fruit in the dark vs. a game where light is currency is interesting but easy to break).
Implementation sketch: model fungal territory as a per-rock **surface-coverage value**
that creeps outward over time (cheap: an arc that grows), decoupled from the visible part
graph; fruiting domes spawn at coverage nodes. This also fixes reach (the web crosses the
rock instead of needing to shoot across the void).

**As shipped:** `Plant.myco.half` is the coverage arc (radians around the anchor; π = the
whole rock, ~4 min for a mid rock). The arc *is* the territory: it blocks rival rooting,
counts for canopy control, and drives income (`tricklePerLen` per claimed arc-length,
boosted in the dying sun) plus husk digestion (`huskRate`/`huskYield`). Domes surface
anywhere on the claimed arc, *preferring* shade (not requiring it — dodges the degenerate
case). Renders as a web-stain + woven lace threaded under the rock surface with glowing
questing tips at the edges; the heart is a buried knot, not a cap. Infection can no longer
creep into a heart, so Prune always remains a full cure.

### 13.2 Split the fungal identity into real niches *(shipped)*
"One clade that does detritivore + lithovore + parasite" is muddy. Break it into distinct
factions/sub-clades, each a clean fantasy:
- **Detritivore** (saprotroph): eats husks/dead matter; thrives in the aftermath of war.
- **Lithovore** (rock-eater): mines minerals straight from bare stone; slow, relentless,
  independent of both light and death.
- **Parasite** (e.g. *Cuscuta*-style): cannot stand alone — must infect and drain a living
  host colony; wins from *inside* someone else's empire.
Current Basidiomycota becomes the **detritivore** anchor; the other two are future factions.

**As shipped:** three distinct clades, five factions total. Basidiomycota stays the
**detritivore** (mycelium web, husk-eating, dark-boosted, spore infection — unchanged).
**Lichenes** is the new **lithovore**: a `mode: 'litho'` crust that reuses the coverage-arc
(`myco`) growth but earns from claimed *bare rock* — `litho{rockRate, richMult}`, double on
rich rock, wholly independent of light, the Dimming, and death. Slow (half the fungus's
spread), stone-tough, near-unkillable; wins by claiming and denying ground. **Cuscuta** is
the new **parasite**: a `mode: 'parasite'` leafless vine that all but cannot photosynthesize
(leafIncome 0.08) and starves to a nub alone. Its economy is `stepHaustoria` — any rival
sharing its rock is drained (`parasite{siphonRate, reach, drainDamage}`), energy flowing
victim→parasite while the wound festers. It stays a minimal thread and flings cheap seed
pods to colonize the next occupied rock: it wins from *inside* another clade's garden.
Each new clade has a full 3-draft mutation set (Lichenes: Crust Creep, Mineral/Rich Veins,
Stonehide, Bedrock, Lithosphere…; Cuscuta: Gluttony, Questing Seed, Virulent Drink,
Strangler, Hemophage, Dodder Storm…). Both are player- and AI-selectable in the menu.

### 13.3 Time-gated Mutations (replaces the always-on trait shop) *(shipped)*
The current trait tree feels low-impact. Replace/augment it with **Mutations**: every
~2 minutes, *every* colony (and maybe fauna) is offered a choice of **2 dramatic perks**
that change *mechanics*, not just stats — reactive counterplay, drafted live. Draw
inspiration from real phylogenetic tricks, e.g.:
- **Succulent:** pruned leaves become seeds (turn the Prune verb into propagation);
  CAM "windows" in leaves; water-hoard batteries.
- **Spines/thorns:** damage or repel fauna that touch you.
- **Serotiny:** seeds only release after a debris impact / fire.
- **Allelopathy:** poison the substrate around you so rivals can't root nearby.
Metaprogression gates the pool: you access **tier-1 options only until you win 1/2/3 rounds**
with that faction, then deeper tiers unlock. Other unlocks: **palette swaps**, faction
cosmetics. (Metaprogression store: extend the localStorage save with a `profile` blob.)

**As shipped:** the trait shop is gone (essence now only fuels Bless/Lure). Every colony —
AI included — is dealt a 2-card offer at 90s and every 120s after its last choice
(`content/mutations.ts`, 6 per clade, 2 per tier); AI picks instantly down a preference
list, the player's offer pulses the 🧬 evolve button and auto-opens the panel. Mechanics
shipped: Serotiny (debris strikes jolt/fire cones), Ironwood, Thorn Needles / Thorned
Vines (bites wound fauna — kills queue a 75s respawn), Windborne (seeds curve toward
rocks), Twin Payload, Evergreen Patience, Everbloom, Sweetfruit (birds prioritize your
fruit), Succulence (Prune sows seeds), Narcotic Nectar (grazers sate 2.5×), Strangler
(contact ×2.5 + energy siphon), Deep Cords, Nightbloom (shaded domes charge 2×),
Sporecloud, Virulence (rot 2× + spread 2.5s), Necrosis (husk digestion 2× + double death
essence), Puppet Bloom (infection kills burst into your spores — `Part.infected` became
`infectedBy: colonyId`). Wins per clade live in `localStorage pluntz.profile`; tier t
unlocks at t−1 wins, AI mirrors the player's depth, and the menu shows ★wins/tier per
clade. Palette-swap unlocks remain future work.

### 13.4 Richer fauna ecology *(scarab + spider shipped)*
- **Satiety + harder bites + wandering + curved flight + working Lure**: done in M9.1.
- **New neutral actors** that change the environment, not just eat it:
  - **Scarab/dung-beetle** — slowly *pushes an asteroid*, redrawing the light map and
    territory adjacencies (a moving board). **Shipped as Scarabaeidae**: rests, braces
    against a rim, shoves ~3 u/s for 22–40s stints; never shoves rocks into each other or
    off the map; asteroid positions joined hashWorld as live state.
  - **Spider** — nests inside a plant and *kills other fauna* that come near (rent-a-guard;
    who does it protect?). **Shipped as Araneae**: claims a grown plant (>11 live parts),
    strikes anything within reach of its perch — guards the host from grazers but also
    murders pollinators and couriers. Kills feed the fauna respawn queue.
  - Still open: **pollinator upgrades**, carrion-eaters that race the detritivore for husks.

### 13.5 Atmosphere & the indifferent void *(fog shipped)*
The game should feel larger and less controllable:
- **Fog of war / unexplored space**: reveal only near your colony + your fauna; distant
  rocks are rumor until a seed or bird reaches them. (Render-only mask — does not touch sim
  determinism; sim always simulates the whole map.) **Shipped as a per-map feature, not
  omnipresent** (`MapDef.fog`): a low-res erase-blend veil (soft edges from upscaling)
  revealed by your plants, flying seeds, seed-carrying birds, and your Ping/Lure — which
  double as scouting flares on fogged maps. Unrevealed things bleed through faintly as
  rumor. Debuts on **C04 · Terra Incognita**: a huge fogged frontier with a cycling sun,
  two scarabs redrawing the rocks, and a rival growing unseen.
- **Bigger maps** with more happening off-screen: drifting derelict husks, spore storms,
  wandering megafauna, debris fields — events you react to, not cause.
- Sound/music pass for mood (procedural, same manifest pattern as art). **Shipped**
  (`src/audio/sound.ts`, all Web-Audio-synthesized, zero assets): an ethereal/organic
  score — Lydian pads breathing on an 8.5s cycle over a kalimba pluck line and rare
  shimmer bells, all through a generated-impulse reverb. Game state bends it: violence
  pushes the harmony minor, the dying sun closes the filter, win/lose resolve or collapse
  it. SFX are impact-forward and distance-attenuated from the camera (thump/crash/heart
  toll/whoosh/sonar), with musical events (sprouts, blessings, lure) quantized to the
  current chord. UI has its own voice: clicks, open/close, the draft-arrival arpeggio,
  pick confirmations, win/lose fanfares. Mute toggle in the speed bar, persisted.

### 13.6 Done in M9.1
Debris-riding seeds/spores; collapsible non-blocking verb tray; fauna behavior overhaul;
fungal spore reach.

---

## 14. Campaign Vision — The Long Road *(design; not yet scheduled)*

**The pitch:** you take one clade on a generational voyage across the cosmos toward the
**Promised Land** — a fabled region of perfect, inexhaustible light. The campaign is one
very long journey told across a chain of spaces, spatially and temporally far beyond a
skirmish: hours of travel, dozens of biomes, one lineage.

**First region shipped:** *LR·I · Shadow Canyon* (`r01`) — the Dimming
(`MapDef.dimming`: a darkness front sweeping +x where photosynthesis ends; decomposers
are untouched), the vanguard win (`MapDef.vanguard`: hold the threshold rock 30s,
contested holds reset), a canyon of wall-rocks whose floor is crossable by Lampyridae
lure-relay, a sunlit southern detour raced by rival Pilgrims, and the round chip reading
the gap between your leading edge and the front.

### 14.1 The caravan structure (how "one long map" actually plays)

The journey is a **corridor of connected regions** rather than one giant simulated map
(sim budget stays bounded; the fiction is continuous). What makes it a *journey* instead
of a level select:

- **The Dimming.** Behind you, space is dying — a slow wave of permanent darkness sweeps
  along the corridor. Rocks it swallows go lightless forever (fungus reads this very
  differently than everyone else…). You cannot hold ground forever; every paradise is
  temporary. The Dimming is the campaign's clock and its dramatic engine: it forces the
  leapfrog rhythm of *arrive → root → fatten → send the vanguard ahead → abandon the old
  garden*.
- **The Vanguard.** You advance by getting seeds across each region's far threshold —
  a scarab ferry, a debris storm, a bird migration, a long-shot cone volley. What crosses
  is literally what continues: the next region starts from the seeds/energy/mutations
  that made it across. Everything left behind is an epitaph.
- **Persistent lineage.** Mutations drafted along the way persist for the whole run
  (the three-draft structure becomes per-region: shallow drafts early in the journey,
  the weird deep biology unlocking as your lineage proves itself). Scars persist too —
  a region you barely escaped may cost you a draft slot or a burned palette.
- **Rest stops & story rocks.** Between contested regions, small quiet spaces: a single
  rich rock and a strange thing to look at. These are save points, breath, and lore.

### 14.2 Unique events & challenges (beyond competing)

Each region gets one signature dynamic — the existing sim already supports most of these
as *configurations*, which is the trick: puzzles are authored out of live mechanics, not
scripted cutscenes.

- **The Shadow Canyon.** A corridor of huge rocks where the sun never reaches the floor.
  Crossing requires chaining light: lure Lampyridae from lantern-post to lantern-post to
  keep a relay of gardens photosynthesizing in the dark. (Fungus walks it effortlessly —
  clade-asymmetric difficulty is a feature.)
- **The Herd.** A migration of Scarabaeidae is passing through, slowly rearranging the
  entire region. Ride it: your seeds can cross on their shells — or fight it, as they
  shove your home rock toward the Dimming.
- **The Sleeper.** A dormant megafauna (an island-sized titan) sleeps at the region's
  heart; the best light is on its back. Growth on its shell is free real estate until
  total colony mass crosses a threshold… then it wakes, shakes, and swims away with
  whatever survived — possibly deep into the corridor ahead (a gamble: the fastest route
  is on the monster).
- **The Orrery.** Rocks locked in orbital resonance; light gates open only when the
  alignment is right. A timing/positioning puzzle: plant so canopies peak exactly when
  the windows do, and fire the vanguard through the gap.
- **The Graveyard.** A region of husks — a civilization of plants that didn't make it.
  Detritivores feast; everyone else must chain anchors across dead wood. Reading the
  ruined gardens tells you (environmental storytelling) what killed them. It's still here.
- **Spore Storms / debris squalls.** Weather fronts that cross the region on a schedule
  visible from far off — shelter behind rocks, or harvest the storm (serotiny cones WANT
  to be hit).
- **The Silence.** A zone where verbs don't work (no ping, lure, bless, prune — the
  shepherd's voice can't reach). The colony must cross on pure autonomy: you set up the
  instincts (via drafts), then watch. The purest expression of pillar #1.
- **Rival pilgrims.** Other clades are making the same journey. Sometimes you contest a
  region; sometimes the smarter play is to draft behind them and let them clear it.

### 14.3 Structure & metaprogression

- A run is ~6–10 regions, 10–20 minutes each: a long evening or several sittings
  (autosave per region boundary — the existing save/resume already carries a world).
- **Fail forward:** losing a region doesn't end the run — the Dimming just takes it, and
  you restart the next region with only what escaped (possibly a single seed: the
  original fantasy, rediscovered mid-campaign).
- Campaign completion per clade is the premium metaprogression: finishing The Long Road
  with a clade unlocks its **palette set** and a run-modifier ("New Journey+": the
  Dimming moves faster, deeper drafts from region 1).
- Implementation note: regions are MapDefs plus a small **RegionScript** (timed events,
  win/exit condition, Dimming schedule) — the same data-driven pattern as maps today.
  The threshold-crossing = a `vanguard` win condition counting seeds/plants beyond a
  line. No new sim systems are required for the first three region archetypes (Canyon,
  Herd, Graveyard); the Sleeper and the Orrery need one new sim feature each (mobile
  mega-body; scripted orbital motion).

---

## 15. The Drift — follow-the-propagule exploration mode *(design; refine → implement next)*

**The pitch:** one seed, one camera, one endless sky. The Drift is Pluntz's open-world
mode: instead of shepherding a whole board from above, you live *inside* a single lineage
— the camera rides your current plant, and when it's time to move on you launch a special
seed and *go with it*, sailing over fogged space toward whatever glints out there. Every
garden you leave behind keeps living without you, feeding the lineage that left it.
It is Reassembly's "fly toward the strange light" fantasy re-expressed as plant
propagation: you don't pilot a ship, you *are* the dispersal.

This mode reuses nearly everything already shipped — fog, fauna ferries, mutations,
the autonomy sim — and rearranges it around one new camera rule and one new economy.

### 15.1 The three-body loop

The mode alternates between three states, each with its own feel:

1. **Rooted (the garden window).** The camera is tethered to your **Heir** — the one
   plant that carries the lineage. You see its rock and a modest halo of revealed space
   around it (fog everywhere else). You play Pluntz as normal here: verbs, growth,
   defense, watching. But the window is *small* — the world is always visibly bigger
   than what you know.
2. **In flight (the voyage).** You charge and launch the **Heir Seed** — and the camera
   goes WITH it. For ten to sixty seconds you are a seed: drifting past unknown rocks,
   through debris fields, over the light of feral gardens, fog peeling open in a narrow
   corridor around you. This is the mode's signature screen. Flight is mostly ballistic
   (aim well!), but mutations buy you agency mid-air (§15.4).
3. **Founding (the landfall).** The seed roots; a new Heir sprouts; the camera settles
   onto it. The *previous* garden — everything you built before — **retires into a
   Legacy garden** (§15.3): autonomous, off-camera, and now generating the resource that
   pays for your next mutations. The loop closes: every launch converts your past into
   fuel for your future.

The rhythm is deliberately breathing: tense rooted chapters (grow, survive, prepare)
punctuated by exhilarating flights (commit, drift, discover). The Long Road's leapfrog
rhythm, but *chosen* — no Dimming at your heels unless you wander into one.

### 15.2 The Heir Seed (the camera's body)

- **A verb, not an event.** `launchHeir` joins the verb tray in this mode. It is charged
  deliberately: the Heir plant grows a visibly special cone (bigger, brighter, slow —
  ~30–60s of colony energy investment), then you aim and fire like an artillery shot.
  Aiming shows a faded trajectory arc *through the fog* — you can see where you'll go,
  not what's there. That gap is the mode.
- **The camera rides it.** From ignition to rooting, the camera is glued to the seed
  (the existing `Lerper` makes this buttery for free). Zoom eases out slightly during
  flight so you read the space sliding past.
- **It reveals as it flies.** The seed carries a fog-reveal radius (like carried seeds
  already do in `FogView`) — a torchbeam corridor opens along its path and *stays
  revealed* (the Drift's fog remembers: explored space accumulates on a persistent mask,
  which is what makes it feel like mapping a world rather than defogging a level).
- **It can ride things.** All the ferry logic already exists: an Heir Seed that lands on
  drifting debris (`Seed.riding`) or hops onto a passing Scarabaeidae
  (`Seed.ridingFauna`) keeps the camera with it — suddenly you're a passenger on a
  stone beetle wandering the dark, deciding when to hop off. Long-distance travel
  *wants* to be multi-modal: launch → catch debris current → transfer to scarab → land.
- **Failure is survivable but real.** A seed that fizzles (lands on hostile crust, gets
  eaten, drifts out of juice) triggers succession (§15.6) — you fall back to the lineage,
  you don't game-over.

### 15.3 Legacy gardens (retiring the past into income)

When the Heir roots somewhere new, the old garden **seals**:

- It keeps living **fully autonomously** — no verbs reach it, no camera visits required
  (you *can* pan back along revealed space to look; you can't touch). It defends itself,
  breeds, ages. Pillar #1 (autonomy) is what makes this credible: the sim already runs
  gardens without you.
- It generates **Legacy** — the Drift's only meta-resource — as a slow trickle
  proportional to its *health at a glance* (living biomass, energy surplus). A thriving
  sealed garden drips steadily; a besieged one sputters; a dead one stops (but see
  §15.6 — even dead gardens leave one ember).
- **Perf/sim note:** gardens far outside the active window get frozen into an **amber
  snapshot** — their Legacy rate is sampled and fixed, plants stop simulating until the
  camera returns. Bounded sim cost no matter how far you roam; deterministic
  (snapshot/wake are pure world-state functions, hashable like everything else).
- **Design intent:** this makes expansion *feel* like propagation rather than conquest.
  You aren't abandoning your colony — you're becoming its next generation, and it is
  literally feeding you forward. The more gardens you successfully seed, the richer your
  lineage's mutation budget. Greed has a shape: seal too early and the garden is weak
  (poor trickle, may die); linger too long and you're playing a base game, not exploring.

### 15.4 Mutation-on-demand (the Legacy catalog)

The timed three-draft system stays in skirmish/Long Road untouched. The Drift replaces
it with **spending Legacy whenever you want** at the Heir — mutation as *outfitting*,
like buying ship parts in Reassembly:

- Open the lineage panel any time you're Rooted; every affordable card is purchasable
  immediately. Costs scale with how many you already own (soft exponential), so early
  cards are impulse buys and late cards are expedition goals.
- The catalog is organized into four **strands**, tuned for exploration rather than
  war (existing skirmish mutations slot in alongside these):
  - **Mobility** — *Longshot* (launch range ↑), *Tendril Vanes* (mid-flight steering:
    2–3 nudge impulses per flight, player-triggered), *Drift Sail* (ride debris
    currents; slow but infinite range), *Beetleback* (scarabs actively come catch your
    Heir Seed), *Serotinous Kick* (bounce off a rock once instead of rooting — a
    skip-stone).
  - **Protection** — *Stone Coat* (seed armor: survives fauna bites, hostile-crust
    landings), *Thornsheath* (grazers regret it), *Decoy Husk* (launch spits a fake
    that draws spiders' webs), *Ember Heart* (the Heir plant's heart regenerates).
  - **Sensing** — *Wide Eye* (bigger reveal radius rooted and in flight), *Rumor Root*
    (periodic pings mark the *direction* of the nearest undiscovered anomaly — the
    fog-glint system, made a stat), *Lightsight* (see feral gardens' glow through fog
    at long range), *Star Chart* (revealed fog never regrows blotches; minimap earned,
    not given).
  - **Colonization** — *Pioneer Root* (root on crusted/hostile/poor surfaces), *Quick
    Dome* (new gardens establish 2× faster — shrinks the vulnerable landfall window),
    *Rich Vein* (new gardens' Legacy trickle ↑), *Twin Heir* (launch two seeds, camera
    follows the lead one, the second is a free backup colony).
- **Mutations ride the seed.** The whole loadout travels with the Heir — the lineage
  is the build. This is why retiring gardens feels fine: the *plants* stay behind, the
  *biology* comes with you.
- Implementation note: `chooseMutation` and the `Mods` pipeline already do all of this
  — the only new machinery is a Legacy wallet on the player colony, purchase-anytime UI
  (the draft panel reskinned as a shop), and ~10 new mod hooks (steering impulses, seed
  armor, reveal radius, legacy rate). AI/feral colonies keep using the timed-draft path.

### 15.5 Changing clades mid-journey (grafting)

Faction transition is real but **earned at places, not bought from menus** — it's a
reason to explore, not a dropdown:

- **Seed-Vault Husks** (a rare anomaly, §15.7) hold the dormant germ of another clade.
  Reaching one lets you **graft**: your *next* Heir Seed hatches as the new faction.
  Your Legacy income, revealed map, and gardens all persist — the lineage continues,
  the biology pivots. Strand mutations (Mobility/Sensing/etc.) carry over; clade-specific
  ones (e.g. Serotiny) convert into a Legacy refund.
- **Old gardens keep their old clade.** After grafting Cuscuta from a Pinophyta line,
  your past is still pine forests — now *hosts you could come back and drink from*.
  Cross-clade lineage play emerges free from existing systems (the parasite economy,
  detritivore feasting on your own dead gardens, lichen prepping rock for grafted
  photosynthesizers).
- **Why it fits the fantasy:** real dispersal is opportunistic; the mode's story is
  "one life-line adapting to what it finds." Deep biome bands (§15.7) are *designed*
  to be hostile to your starting clade so a found vault reads as salvation.

### 15.6 Death & succession (the lineage never quite ends)

- If the Heir dies (or an Heir Seed is destroyed in flight), the camera falls back along
  the lineage to the **newest surviving Legacy garden**, which *wakes* (returns to full
  sim + verbs) and grows a new Heir cone. You've lost ground, not the run — the walk
  back out is the punishment, and re-crossing known space is fast because it's revealed
  and often still yours.
- If **every** garden is dead, the very first rock keeps a **Firstseed ember** — one
  free respawn at home with all mutations intact (Legacy wallet zeroed). The Drift is a
  sandbox with teeth, not a roguelike; the fail state is "start the map again from home,
  wiser," never "delete the save."

### 15.7 What's out there (the world worth flying into)

The Deep Field map from the exploration proposal is the Drift's home: one huge
(~10,000 × 8,000+) generated, fully-fogged space, structured as **directional biome
bands** so that *direction is a decision* — ice belt north (dim, Lampyridae swarms,
lichen heaven), debris alley east (ferry superhighway, spider dens), fungal deadlands
down-spin (husk fields, spore storms), rich core worlds guarded by the strongest feral
colonies. Scattered through it:

- **Feral colonies** — AI colonies of all five clades with pre-stacked mutation
  loadouts scaling with distance from home (just `colony.mutations` pushed at worldgen).
  Near ones are neighbors; far ones are apex gardens worth planning expeditions against.
- **Anomalies** (each one a hand-authored configuration of live mechanics, like Long
  Road regions): the *Great Bloom* derelict (free mutation), *Seed-Vault Husks*
  (grafting, §15.5), the *Lantern Grove* (tame Lampyridae light in a dark band), a
  *wormhole pair* (instant seed transit — late-game highway), the *Sleeper* (§14.2,
  now optional and findable). Discovering any anomaly grants Legacy — curiosity is
  income.
- **Rumor signals** — through-fog hints that give flight a heading: faint glints,
  drifting spore-haze, a directional shimmer in the music (the audio system's mood
  channel, aimed). Sensing mutations sharpen them.
- **Optional terminus:** the oldest rumor points somewhere — the **First Garden**, far
  in the richest, deadliest band. Reaching and rooting it is the Drift's "ending"
  (per-clade completion unlocks, like the Long Road's). But the mode is a sandbox
  first; the terminus is a horizon, not a timer.

### 15.8 Open design questions (for the refinement pass)

1. **Seal timing:** does the old garden retire when the Heir Seed *launches* (braver,
   cleaner camera story — the launch is a goodbye) or when it *roots* (safer — a failed
   flight falls back to a still-active garden)? Current lean: **on rooting**, with
   succession (§15.6) covering failed flights; revisit if lingering feels too safe.
2. **Verb reach:** rooted verbs (lure/ping/bless/prune) affect only the active window
   around the Heir? Current lean: yes — the shepherd's voice is local; Legacy gardens
   are truly on their own.
3. **Legacy trickle vs. lump:** continuous drip (feels alive, encourages many gardens)
   vs. one-time "inheritance" payout at sealing (cleaner, snapshot-friendly)? Current
   lean: **small lump + drip**, drip frozen by the amber snapshot anyway.
4. **Steering feel:** nudge-impulse charges (deterministic, replayable, mobile-friendly
   taps) vs. continuous tilt-steering? Current lean: impulses — they're discrete player
   events like verbs, so determinism and the input-recording model survive untouched.
5. **How much combat follows you:** do feral colonies ever counter-expand toward your
   gardens, or is threat purely where you fly? Lean: near-band ferals stay put;
   deep-band apex gardens send seeds back along your revealed corridor. The world
   should eventually answer your intrusion.

### 15.9 Build plan (phased so each step is playable)

- **Phase A — the camera is a seed** *(small)*: camera-tether to Heir + `launchHeir`
  verb + follow-flight + retire-to-autonomous on an existing skirmish map, no fog.
  Proves the core feel in an afternoon of play. New sim surface: a `heirPlantId` /
  `heirSeedId` on the player colony; camera reads it. (`Lerper` already smooths it.)
- **Phase B — Legacy + the shop** *(small-medium)*: Legacy wallet + trickle + amber
  snapshot; draft panel gains a purchase-anytime mode; first ~8 strand mutations
  (Longshot, Tendril Vanes, Stone Coat, Wide Eye, Pioneer Root, Quick Dome, Rich Vein,
  Twin Heir) — mostly existing mod hooks.
- **Phase C — the Deep Field** *(medium)*: big banded `generateDeepField` map; persistent
  fog-reveal mask; seed-torchbeam reveal; feral colonies with distance-scaled loadouts.
  This is the moment the mode becomes *the mode*.
- **Phase D — things to find** *(medium, content-driven)*: anomalies (Great Bloom,
  Seed Vault + grafting, Lantern Grove, wormhole pair), rumor signals, discovery Legacy,
  the First Garden terminus.
- **Phase E — polish the fantasy** *(ongoing)*: flight audio (wind-through-fog quiet →
  landfall swell), succession flow, Star Chart minimap, deep-band counter-expansion.

Phases A+B ship a complete playable loop on existing maps; C makes it exploration;
D makes it Reassembly.

---

## 16. Faction Proposals — for review *(design; pick which to build)*

Five factions ship today: **Pinophyta** (photo-spire), **Anthophyta** (photo-vine +
fauna), **Basidiomycota** (detritivore), **Lichenes** (lithovore), **Cuscuta** (parasite).
Below are candidate additions, each filling a *mechanical* niche none of the five occupy.
Ranked by how novel-and-buildable they are. Each lists its fantasy, its one core new
mechanic (and how it reuses existing systems), and a full 3-draft mutation sketch
(2 base cards + 1 win-unlocked bonus per draft, matching the current structure).

### 16.1 Droseraceae — the Carnivore (sundew) ★ recommended next
**Fantasy:** a glistening trap-plant that doesn't chase the light — it chases *meat*.
It lures fauna in and digests them alive. The Lure verb becomes its dinner bell.
**Core mechanic:** its leaves are sticky **traps**. Fauna that wander (or are lured)
within reach get snared and slowly digested — fauna HP drains into the plant's energy,
then the corpse is consumed. Photosynthesis is weak; fauna are the food. *Reuse:* the
Araneae web-capture/reel code almost verbatim (plant-as-trapper instead of spider), the
Lure system (its whole game), and fauna hp/respawn. New: `Fauna.trappedBy` + a trap pass.
**Why it's great:** turns the neutral ecology into a food web the player farms; the most
distinct economy left; leans on systems that already exist.
**Mutations —** D1: *Sweet Mucilage* (traps reach farther, hold stronger) · *Pitcher*
(one big trap that briefly holds even a Scarabaeidae) · ★*Fatal Nectar* (snared fauna die
2× faster). D2: *Digestive Bloom* (each kill bursts energy + a free seed) · *Snapfast*
(traps close instantly — small bugs never escape) · ★*Scent Glands* (you emit a constant
free Lure — you ARE the bait). D3: *Man-Eater* (traps also seize rival guardian-fauna:
spiders, allied swarms) · *Carrion Bloom* (dead fauna anywhere on your rock feed you like
a detritivore) · ★*Living Snare* (the plant slowly drags its traps toward nearby prey).

### 16.2 Crassulaceae — the Succulent (battery / burst)
**Fantasy:** a fat water-hoarder that sips by day and unleashes by night. Unkillable in
drought, terrifying in bursts. The survivor of dying-sun and Dimming maps.
**Core mechanic:** enormous **storage** (×3–5 capacity) + CAM metabolism (income barely
cares about sun angle or shade, upkeep is tiny). It banks vast reserves and can **dump**
them — a "supernova bloom" that spends the whole battery on one explosive seed volley, or
simply outlasts total darkness on stored charge. *Reuse:* almost pure tuning (capBase,
upkeep, minAngleEff) + one burst-reproduction action. The cheapest to build.
**Mutations —** D1: *Deep Cistern* (+capacity) · *CAM* (income ignores sun angle) ·
★*Waxen Skin* (contact + graze resistance). D2: *Cladode Drop* (pruned parts become
seeds — the existing Succulence) · *Cold Bloom* (income rises as the sun dims, like fungus)
· ★*Bezoar* (survives minutes of total darkness on reserves alone). D3: *Supernova Bloom*
(dump the full reserve into a massive seed/spore volley) · *Ironpetal* (near-unkillable) ·
★*Perennial* (heart regenerates; never truly starves out).

### 16.3 Pteridophyta — the Fern (swarm / r-strategist)
**Fantasy:** fragile, fast, endless. Blankets everything in spore clouds, dies at a touch,
but there is always more. The "zerg."
**Core mechanic:** **spore-cloud sprawl** — very cheap, very fast growth; frequent wide
spore bursts; short lifespans; thrives in shade and in the aftermath of war. Individually
weak (low hp, dies easily) but overwhelming in number. *Reuse:* pure tuning of the existing
growth/repro (fast cooldown, cheap parts, low hp, huge sporeFan, short leaf lifespans) +
maybe a periodic auto "spore storm." Easy.
**Mutations —** D1: *Prothallus* (seeds sprout instantly, half cost) · *Sori Storm* (giant
spore fans) · ★*Fireweed* (first to colonise dimmed/burned ground, huge income there).
D2: *Fiddlehead Rush* (grows twice as fast) · *Rhizome* (spreads to adjacent claimed ground
underground) · ★*Clonal Mat* (a killed fern reseeds itself once, free). D3: *Spore Bloom*
(continuous ambient spore rain over a whole region) · *Pioneer* (thrives on bare fresh rock
no one holds) · ★*Bracken Wall* (dense growth that physically walls rivals off a rock).

### 16.4 Formica-clade — the Domesticator (mutualist) *(ambitious)*
**Fantasy:** a plant that farms the fauna as an army. Its fruit doesn't just feed birds —
it *tames* them into guardians that hunt your rivals.
**Core mechanic:** fauna that eat its fruit become **allied** to your colony for a time —
they defend your gardens and attack rival plants and rival-allied fauna. It turns the
neutral ecology into your military; the Lure becomes a strike-order. *Reuse:* fauna combat
already exists (grazer bites, spider hunts) — add `Fauna.allegiance` + a "attack rival" AI
branch. Higher effort, but no faction touches fauna alliance yet.
**Mutations —** D1: *Extrafloral Nectar* (allies stay loyal longer) · *War Fruit* (allied
fauna hit harder) · ★*Domatia* (a permanent resident guardian, a friendly spider). D2:
*Aphid Farm* (allied fauna passively generate energy for you) · *Swarm Call* (your Lure
orders allies to strike a point) · ★*Pheromone* (rivals' fauna defect to you). D3: *Hive
Bloom* (breed your own fauna from pods) · *Warden* (allies guard the vanguard threshold) ·
★*Queen* (a super-guardian that clears a rock).

### 16.5 Cyanophyta — the Terraformer (map-changer) *(support/economy)*
**Fantasy:** makes dead rock livable, then hands off. A slow enabler that rewrites the
board and lifts everything friendly around it.
**Core mechanic:** its crust slowly converts plain rock it claims into **rich rock**
(nitrogen-fixing) — a *permanent map change* — and boosts adjacent friendly gardens.
A support/economy clade that alters terrain rather than fighting. *Reuse:* lithovore-style
coverage + flip `Asteroid.rich` under full coverage (needs a hash mix). Novel because it
mutates the map itself; weakest as a solo faction, best in a co-op/campaign frame.

**Recommendation:** build **16.1 Droseraceae** next — it's the most distinct fantasy, it
makes the fauna/Lure systems sing, and it reuses the spider capture code. **16.2
Crassulaceae** is the cheapest win (mostly tuning) and shines on the Long Road's dying-sun
regions. The others are strong but heavier lifts.

---

*Current state: M0–M9 + M9.1 + §13.1 mycelium + §13.2 fungal-identity split (5 factions:
Lichenes lithovore + Cuscuta parasite added) + §13.3 mutations (three 2-card drafts; wins
add a third card) + §13.4 fauna (Scarabaeidae, Araneae web-capture, Lampyridae, universal
Lure) + §13.5 per-map fog. Economy: essence removed — verbs on per-clade cooldowns. Pace
halved; player speed control. Procedural war-dynamic music + SFX + UI sound. Long Road
region I (Shadow Canyon) shipped with the Dimming + vanguard. Design queued for build:
§15 The Drift (follow-the-propagule open-world mode — camera rides an Heir Seed, retired
gardens become Legacy income, mutate-on-demand, grafting between clades) — refine →
implement next. Also queued: §16 new factions (Droseraceae recommended), Long Road
regions II+ (§14), M10 Android wrap.*
