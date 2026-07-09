import { Application, Container, Graphics } from 'pixi.js';
import { createWorld, stepWorld, spawnDebris, setPing, placeLure } from './sim/world';
import { pruneAlongPath, fireCone } from './sim/plant';
import { setEventSink } from './sim/events';
import type { Asteroid, FactionId, MapDef, Plant, World } from './sim/types';
import { add, dist, norm, scale, sub, fromAngle, type Vec2 } from './sim/vec';
import { MAPS, DEFAULT_MAP } from './content/maps/index';
import { generateSkirmish } from './content/maps/gen';
import { worldToSave, worldFromSave, type SavedWorld } from './sim/serialize';
import { TUNING } from './content/tuning';
import { FACTIONS } from './content/factions';
import { Starfield } from './render/starfield';
import { WorldView } from './render/worldView';
import { PlantView } from './render/plantView';
import { DebrisView } from './render/debrisView';
import { PruneView } from './render/pruneView';
import { FxView } from './render/fxView';
import { FaunaView } from './render/faunaView';
import { SeedView } from './render/seedView';
import { PingView } from './render/pingView';
import { Camera } from './ui/camera';
import { DebugPanel } from './ui/debugPanel';
import { Inspector } from './ui/inspector';
import { TraitPanel } from './ui/traitPanel';
import { Menu, type GameConfig } from './ui/menu';
import { bless } from './sim/stats';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#05060f',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  // --- World config (URL params seed the menu; menu owns the choice) ----------
  const params = new URLSearchParams(location.search);
  const okFaction = (x: string | null): x is FactionId =>
    x === 'pinophyta' || x === 'anthophyta' || x === 'basidiomycota';
  const pf = params.get('faction');
  const af = params.get('ai');
  const urlMap = params.get('map') ?? '';
  let cfg: GameConfig = {
    mapId: MAPS[urlMap] || urlMap === 'skirmish' ? urlMap : DEFAULT_MAP,
    playerFaction: okFaction(pf) ? pf : 'pinophyta',
    aiFaction: okFaction(af) ? af : 'pinophyta',
    seed: params.get('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() % 0xfffff) >>> 0,
  };
  let seed = cfg.seed;
  let map: MapDef = buildMap(cfg);
  function buildMap(c: GameConfig): MapDef {
    const base = c.mapId === 'skirmish' ? generateSkirmish(c.seed) : (MAPS[c.mapId] ?? MAPS[DEFAULT_MAP]);
    const m: MapDef = JSON.parse(JSON.stringify(base));
    for (const col of m.colonies) {
      if (col.player) col.faction = c.playerFaction;
      else if (!col.lockFaction) col.faction = c.aiFaction;
    }
    return m;
  }
  let world: World = createWorld(map, seed);
  setEventSink(world.events);
  let playerColonyId = world.colonies.find((c) => c.isPlayer)?.id ?? -1;

  // --- Scene graph -------------------------------------------------------------
  let starfield = new Starfield(world.width, world.height, seed);
  const worldRoot = new Container();
  const worldView = new WorldView();
  const plantView = new PlantView();
  const debrisView = new DebrisView();
  const pruneView = new PruneView();
  const fxView = new FxView();
  const faunaView = new FaunaView();
  const seedView = new SeedView();
  const pingView = new PingView();
  const aimG = new Graphics();
  worldRoot.addChild(
    worldView.container,
    plantView.container,
    debrisView.g,
    seedView.g,
    faunaView.g,
    fxView.g,
    pingView.g,
    pruneView.g,
    aimG,
  );
  app.stage.addChild(starfield.container, worldRoot);

  // --- Interaction state -------------------------------------------------------
  let speed = 1;
  let moveRocks = false;
  let pruneMode = false;
  let pingMode = false;
  let blessMode = false;
  let lureMode = false;
  let prunePath: Vec2[] | null = null;
  let draggedRock: Asteroid | null = null;
  let aiming: { plant: Plant; coneId: number; pos: Vec2 } | null = null;
  const inspector = new Inspector();

  /** Find an armed player cone near a world position (for the aim-drag verb). */
  function pickArmedCone(at: Vec2, radius: number): { plant: Plant; coneId: number } | null {
    for (const plant of world.plants) {
      if (!plant.alive || plant.colonyId !== playerColonyId) continue;
      for (const p of plant.parts) {
        if (p.dead || p.kind !== 'cone' || p.armedAt < 0) continue;
        const x = plant.astPos.x + p.tip.x;
        const y = plant.astPos.y + p.tip.y;
        if (Math.hypot(x - at.x, y - at.y) < radius) return { plant, coneId: p.id };
      }
    }
    return null;
  }

  const homeAst = world.asteroids[0];
  const camera = new Camera(app.canvas, world.width, world.height, {
    onDragStart(worldPos: Vec2): boolean {
      if (pruneMode) {
        prunePath = [worldPos];
        return true;
      }
      const cone = pickArmedCone(worldPos, 30 / camera.zoom);
      if (cone) {
        aiming = { ...cone, pos: worldPos };
        return true;
      }
      if (!moveRocks) return false;
      draggedRock =
        world.asteroids.find((a) => dist(a.pos, worldPos) < a.radius + 20) ?? null;
      return draggedRock !== null;
    },
    onDragMove(worldPos: Vec2): void {
      if (prunePath) {
        const last = prunePath[prunePath.length - 1];
        if (dist(last, worldPos) > 4) prunePath.push(worldPos);
        return;
      }
      if (aiming) {
        aiming.pos = worldPos;
        return;
      }
      if (draggedRock) {
        draggedRock.pos.x = worldPos.x;
        draggedRock.pos.y = worldPos.y;
      }
    },
    onDragEnd(): void {
      if (prunePath) {
        for (const plant of world.plants) {
          if (plant.colonyId === playerColonyId) pruneAlongPath(world, plant, prunePath);
        }
        prunePath = null;
        return;
      }
      if (aiming) {
        const cone = aiming.plant.parts[aiming.coneId];
        const from = add(aiming.plant.astPos, cone.tip);
        const dir = sub(aiming.pos, from);
        if (Math.hypot(dir.x, dir.y) > 25) fireCone(world, aiming.plant, aiming.coneId, dir);
        aiming = null;
        return;
      }
      draggedRock = null;
    },
    onTap(worldPos: Vec2): void {
      if (pruneMode) return; // taps in prune mode are just aborted swipes
      if (pingMode) {
        setPing(world, playerColonyId, worldPos);
        pingMode = false;
        pingBtn.classList.remove('active');
        return;
      }
      if (lureMode) {
        placeLure(world, playerColonyId, worldPos);
        lureMode = false;
        lureBtn.classList.remove('active');
        return;
      }
      if (blessMode) {
        const hit = pickPlant(world, worldPos, 30 / camera.zoom);
        const plant = world.plants.find((p) => p.id === hit);
        if (plant && plant.colonyId === playerColonyId) bless(world, plant);
        blessMode = false;
        blessBtn.classList.remove('active');
        return;
      }
      const fauna = pickFauna(world, worldPos, 24 / camera.zoom);
      if (fauna !== null) {
        inspector.showFauna(fauna);
        return;
      }
      const hit = pickPlant(world, worldPos, 26 / camera.zoom);
      if (hit !== null) inspector.show(hit);
      else inspector.hide();
    },
  });

  // --- Action bar (player verbs) -------------------------------------------------
  const actionBar = document.createElement('div');
  actionBar.className = 'actionbar';
  const pruneBtn = document.createElement('button');
  pruneBtn.textContent = '✂ prune';
  pruneBtn.addEventListener('click', () => {
    pruneMode = !pruneMode;
    pingMode = false;
    pingBtn.classList.remove('active');
    prunePath = null;
    pruneBtn.classList.toggle('active', pruneMode);
  });
  const pingBtn = document.createElement('button');
  pingBtn.textContent = '◎ ping';
  pingBtn.addEventListener('click', () => {
    pingMode = !pingMode;
    pruneMode = false;
    blessMode = false;
    prunePath = null;
    pruneBtn.classList.remove('active');
    blessBtn.classList.remove('active');
    pingBtn.classList.toggle('active', pingMode);
  });
  const blessBtn = document.createElement('button');
  blessBtn.textContent = `✦ bless ${TUNING.verbs.blessCost}⬡`;
  blessBtn.addEventListener('click', () => {
    blessMode = !blessMode;
    pruneMode = false;
    pingMode = false;
    prunePath = null;
    pruneBtn.classList.remove('active');
    pingBtn.classList.remove('active');
    blessBtn.classList.toggle('active', blessMode);
  });
  const lureBtn = document.createElement('button');
  lureBtn.textContent = '✿ lure 2⬡';
  lureBtn.addEventListener('click', () => {
    lureMode = !lureMode;
    pruneMode = false;
    pingMode = false;
    blessMode = false;
    prunePath = null;
    pruneBtn.classList.remove('active');
    pingBtn.classList.remove('active');
    blessBtn.classList.remove('active');
    lureBtn.classList.toggle('active', lureMode);
  });
  const traitPanel = new TraitPanel(
    () => world,
    () => playerColonyId,
  );
  const traitBtn = document.createElement('button');
  traitBtn.textContent = '⬡ evolve';
  traitBtn.addEventListener('click', () => traitPanel.toggle());
  // verbs live in a collapsible tray so they never cover the inspector
  const verbTray = document.createElement('div');
  verbTray.className = 'verb-tray';
  verbTray.append(traitBtn, lureBtn, blessBtn, pingBtn, pruneBtn);
  const trayToggle = document.createElement('button');
  trayToggle.className = 'tray-toggle';
  let trayOpen = true;
  const syncTray = (): void => {
    verbTray.classList.toggle('collapsed', !trayOpen);
    trayToggle.textContent = trayOpen ? '▾ acts' : '▸ acts';
    trayToggle.classList.toggle('active', trayOpen);
  };
  trayToggle.addEventListener('click', () => {
    trayOpen = !trayOpen;
    syncTray();
  });
  actionBar.append(verbTray, trayToggle);
  syncTray();
  document.getElementById('ui')!.appendChild(actionBar);
  camera.x = homeAst.pos.x;
  camera.y = homeAst.pos.y - 60;
  camera.zoom = 1.4;

  // --- Debug panel ---------------------------------------------------------------
  const panel = new DebugPanel({
    setSpeed: (m) => (speed = m),
    setSunAngleDeg: (deg) => (world.sun.angle = (deg * Math.PI) / 180),
    setDayCycle: (on) => (world.sun.cycle = on),
    setMoveRocks: (on) => (moveRocks = on),
    spawnDebris: () => {
      // aimed shot: from off-canopy toward the first living plant's crown
      const plant = world.plants.find((p) => p.alive);
      const ast = plant && world.asteroids.find((a) => a.id === plant.asteroidId);
      let target = { x: 0, y: 0 };
      if (plant && ast) {
        let n = 0;
        const sum = { x: 0, y: 0 };
        for (const p of plant.parts) {
          if (p.dead) continue;
          sum.x += ast.pos.x + p.tip.x;
          sum.y += ast.pos.y + p.tip.y;
          n++;
        }
        if (n > 0) target = { x: sum.x / n, y: sum.y / n };
      }
      const from = add(target, scale(fromAngle(world.rng.range(0, Math.PI * 2)), 700));
      const vel = scale(norm(sub(target, from)), TUNING.debris.debugSpeed);
      spawnDebris(world, from, vel, world.rng.range(8, 13));
    },
    openMenu: () => {
      speed = 0;
      menu.show();
    },
    grantEnergy: () => {
      for (const plant of world.plants) {
        if (plant.alive) plant.energy = Math.min(plant.energy + 60, plant.capacity);
      }
    },
    reset: (reseed) => resetWorld(reseed),
  });

  function resetWorld(reseed: boolean): void {
    if (reseed) seed = (Date.now() % 0xffffffff) >>> 0;
    world = createWorld(map, seed);
    setEventSink(world.events);
    playerColonyId = world.colonies.find((c) => c.isPlayer)?.id ?? -1;
    aiming = null;
    bannerShown = false;
    banner.classList.remove('open');
    inspector.hide();
    app.stage.removeChild(starfield.container);
    starfield = new Starfield(world.width, world.height, seed);
    app.stage.addChildAt(starfield.container, 0);
  }

  // --- Save / resume ---------------------------------------------------------------
  const SAVE_KEY = 'pluntz.save';
  let lastSaveAt = 0;
  function trySave(): void {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ cfg, world: worldToSave(world) }),
      );
    } catch {
      /* storage may be unavailable; play on */
    }
  }
  function clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
  function tryResume(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as { cfg: GameConfig; world: SavedWorld };
      cfg = saved.cfg;
      seed = cfg.seed;
      map = buildMap(cfg);
      world = worldFromSave(saved.world);
      setEventSink(world.events);
      playerColonyId = world.colonies.find((c) => c.isPlayer)?.id ?? -1;
      aiming = null;
      bannerShown = false;
      banner.classList.remove('open');
      inspector.hide();
      app.stage.removeChild(starfield.container);
      starfield = new Starfield(world.width, world.height, world.seed);
      app.stage.addChildAt(starfield.container, 0);
      lastSaveAt = world.time;
      speed = 1;
      return true;
    } catch {
      return false;
    }
  }

  // --- Start menu -----------------------------------------------------------------
  const menu = new Menu(cfg, (chosen) => {
    cfg = chosen;
    seed = cfg.seed;
    map = buildMap(cfg);
    resetWorld(false);
    lastSaveAt = 0;
    speed = 1;
    const qs = new URLSearchParams({
      map: cfg.mapId,
      faction: cfg.playerFaction,
      ai: cfg.aiFaction,
      seed: String(cfg.seed),
    });
    history.replaceState(null, '', `?${qs.toString()}`);
  }, tryResume);
  if (!params.get('play')) speed = 0; // hold the sim while the menu is up
  else menu.hide();

  // --- Round chip + end-of-round banner ------------------------------------------
  const roundChip = document.createElement('div');
  roundChip.className = 'roundchip';
  document.getElementById('ui')!.appendChild(roundChip);
  const banner = document.createElement('div');
  banner.className = 'banner';
  document.getElementById('ui')!.appendChild(banner);
  let bannerShown = false;

  function fmtTime(t: number): string {
    const s = Math.max(0, Math.floor(t));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function updateRoundUi(): void {
    if (world.colonies.length < 2) {
      roundChip.style.display = 'none';
      return;
    }
    roundChip.style.display = 'block';
    const counts = world.colonies
      .map((c) => {
        const n = world.plants.filter((p) => p.alive && p.colonyId === c.id).length;
        return `${c.name} ${n}`;
      })
      .join(' · ');
    let clock: string;
    if (world.roundState !== 'playing') clock = 'round over';
    else if (world.roundSec > 0 && world.time > world.roundSec) clock = '☀ THE SUN FADES';
    else if (world.roundSec > 0) clock = `☀ fades in ${fmtTime(world.roundSec - world.time)}`;
    else clock = '';
    const player = world.colonies.find((c) => c.id === playerColonyId);
    const essence = player ? ` · ⬡${player.essence}` : '';
    let hold = '';
    if (world.canopyWin && world.canopyHolder >= 0 && world.roundState === 'playing') {
      const h = world.colonies.find((c) => c.id === world.canopyHolder);
      const share = world.canopyShares.find((s) => s.colonyId === world.canopyHolder);
      const left = Math.max(0, Math.ceil(world.canopyWin.holdSec - world.canopyHeldSec));
      hold = ` — ◤ ${h?.name} holds ${Math.round((share?.share ?? 0) * 100)}% · ${left}s to win`;
    }
    roundChip.textContent = `${counts}${essence}${clock ? `  —  ${clock}` : ''}${hold}`;

    if (world.roundState !== 'playing' && !bannerShown) {
      bannerShown = true;
      clearSave(); // finished gardens don't resume
      const t = fmtTime(world.endedAt);
      const rival = world.colonies.find((c) => !c.isPlayer)?.name ?? 'the rival';
      const won = world.roundState === 'won';
      const line =
        world.endReason === 'canopy'
          ? won
            ? `Your canopy owns the light. ${rival} wither in your shade (${t}).`
            : `The ${rival} canopy owns the light. You wither in their shade (${t}).`
          : won
            ? `The void is yours. The last ${rival} heartseed went dark at ${t}.`
            : `Your last heartseed went dark at ${t}. The ${rival} overgrow your bones.`;
      banner.innerHTML = `
        <h1 class="${won ? 'win' : 'loss'}">${won ? 'OVERGROWTH' : 'EXTINCTION'}</h1>
        <p>${line}</p>
        <div class="btn-row"><button class="again">grow again</button><button class="tomenu">menu</button></div>`;
      banner.classList.add('open');
      (banner.querySelector('.again') as HTMLElement).addEventListener('click', () => {
        resetWorld(true);
      });
      (banner.querySelector('.tomenu') as HTMLElement).addEventListener('click', () => {
        banner.classList.remove('open');
        speed = 0;
        menu.show();
      });
    }
  }

  // --- Fixed-timestep loop ---------------------------------------------------------
  let acc = 0;
  let last = performance.now();
  let fpsEma = 60;
  let tickMsEma = 0;

  app.ticker.add(() => {
    const now = performance.now();
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    fpsEma += (1 / Math.max(frame, 1e-4) - fpsEma) * 0.05;

    acc += frame * speed;
    acc = Math.min(acc, TUNING.maxFrameCatchup * speed + TUNING.simDt);
    const t0 = performance.now();
    while (acc >= TUNING.simDt) {
      stepWorld(world, TUNING.simDt);
      acc -= TUNING.simDt;
    }
    tickMsEma += (performance.now() - t0 - tickMsEma) * 0.1;

    // camera -> stage transform
    const w = window.innerWidth;
    const h = window.innerHeight;
    worldRoot.scale.set(camera.zoom);
    worldRoot.position.set(w / 2 - camera.x * camera.zoom, h / 2 - camera.y * camera.zoom);
    starfield.update(camera.x, camera.y, w, h);

    worldView.update(world);
    plantView.update(world);
    debrisView.update(world);
    seedView.update(world);
    faunaView.update(world);
    pingView.update(world);
    pruneView.update(prunePath);

    // particles: drain sim events, shed wound motes, integrate
    fxView.ingest(world.events);
    world.events.length = 0;
    fxView.ambientWounds(world, frame);
    fxView.ambientFlow(world, frame);
    fxView.update(frame);

    // an actively-aimed cone never self-fires out from under the player
    if (aiming) {
      const cone = aiming.plant.parts[aiming.coneId];
      if (!cone.dead && cone.armedAt >= 0) cone.armedAt = world.time;
    }

    // aim affordance: range ring + aim line while dragging from an armed cone
    aimG.clear();
    if (aiming) {
      const cone = aiming.plant.parts[aiming.coneId];
      const from = add(aiming.plant.astPos, cone.tip);
      const range = FACTIONS[aiming.plant.faction].repro.seedRange;
      aimG.circle(from.x, from.y, range).stroke({ width: 1.5, color: 0xd7f59a, alpha: 0.12 });
      aimG.moveTo(from.x, from.y)
        .lineTo(aiming.pos.x, aiming.pos.y)
        .stroke({ width: 2, color: 0xd7f59a, alpha: 0.7 });
      aimG.circle(aiming.pos.x, aiming.pos.y, 7).stroke({ width: 2, color: 0xd7f59a, alpha: 0.9 });
    }

    inspector.update(world);
    traitPanel.update();
    updateRoundUi();

    // autosave every 10 sim-seconds while a round is live
    if (world.roundState === 'playing' && world.time - lastSaveAt >= 10) {
      lastSaveAt = world.time;
      trySave();
    }

    panel.update({
      fps: fpsEma,
      tickMs: tickMsEma,
      parts: world.plants.reduce((n, p) => n + p.parts.length, 0),
      plants: world.plants.length,
      asteroids: world.asteroids.length,
      debris: world.debris.length,
      sunAngleDeg: (world.sun.angle * 180) / Math.PI,
      seed,
      simTime: world.time,
    });
  });

  // debug hook for automation and console tinkering
  (window as unknown as Record<string, unknown>).__pluntz = {
    get world() {
      return world;
    },
    camera,
    /** Fast-forward n sim ticks (automation/testing only). */
    stepMany(n: number) {
      for (let i = 0; i < n; i++) stepWorld(world, TUNING.simDt);
    },
  };
}

function pickFauna(world: World, at: Vec2, radius: number): number | null {
  let best: number | null = null;
  let bestD = radius + 8;
  for (const fn of world.fauna) {
    const d = Math.hypot(fn.pos.x - at.x, fn.pos.y - at.y);
    if (d < bestD) {
      bestD = d;
      best = fn.id;
    }
  }
  return best;
}

function pickPlant(world: World, at: Vec2, radius: number): number | null {
  let best: number | null = null;
  let bestD = radius;
  for (const plant of world.plants) {
    const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
    if (!ast) continue;
    for (const part of plant.parts) {
      const d = Math.hypot(ast.pos.x + part.tip.x - at.x, ast.pos.y + part.tip.y - at.y);
      if (d < bestD) {
        bestD = d;
        best = plant.id;
      }
    }
  }
  return best;
}

void boot();
