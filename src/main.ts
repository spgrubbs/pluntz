import { Application, Container, Graphics } from 'pixi.js';
import { createWorld, stepWorld, spawnDebris, setPing } from './sim/world';
import { pruneAlongPath, fireCone } from './sim/plant';
import { setEventSink } from './sim/events';
import type { Asteroid, Plant, World } from './sim/types';
import { add, dist, norm, scale, sub, fromAngle, type Vec2 } from './sim/vec';
import { MAPS, DEFAULT_MAP } from './content/maps/index';
import { TUNING } from './content/tuning';
import { FACTIONS } from './content/factions';
import { Starfield } from './render/starfield';
import { WorldView } from './render/worldView';
import { PlantView } from './render/plantView';
import { DebrisView } from './render/debrisView';
import { PruneView } from './render/pruneView';
import { FxView } from './render/fxView';
import { SeedView } from './render/seedView';
import { PingView } from './render/pingView';
import { Camera } from './ui/camera';
import { DebugPanel } from './ui/debugPanel';
import { Inspector } from './ui/inspector';
import { TraitPanel } from './ui/traitPanel';
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

  // --- World -----------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const urlSeed = params.get('seed');
  let seed = urlSeed ? Number(urlSeed) >>> 0 : 1337;
  const map = MAPS[params.get('map') ?? DEFAULT_MAP] ?? MAPS[DEFAULT_MAP];
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
  const seedView = new SeedView();
  const pingView = new PingView();
  const aimG = new Graphics();
  worldRoot.addChild(
    worldView.container,
    plantView.container,
    debrisView.g,
    seedView.g,
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
      if (blessMode) {
        const hit = pickPlant(world, worldPos, 30 / camera.zoom);
        const plant = world.plants.find((p) => p.id === hit);
        if (plant && plant.colonyId === playerColonyId) bless(world, plant);
        blessMode = false;
        blessBtn.classList.remove('active');
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
  const traitPanel = new TraitPanel(
    () => world,
    () => playerColonyId,
  );
  const traitBtn = document.createElement('button');
  traitBtn.textContent = '⬡ evolve';
  traitBtn.addEventListener('click', () => traitPanel.toggle());
  actionBar.appendChild(traitBtn);
  actionBar.appendChild(blessBtn);
  actionBar.appendChild(pingBtn);
  actionBar.appendChild(pruneBtn);
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
        <div class="btn-row"><button class="again">grow again</button></div>`;
      banner.classList.add('open');
      (banner.querySelector('.again') as HTMLElement).addEventListener('click', () => {
        resetWorld(true);
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
    pingView.update(world);
    pruneView.update(prunePath);

    // particles: drain sim events, shed wound motes, integrate
    fxView.ingest(world.events);
    world.events.length = 0;
    fxView.ambientWounds(world, frame);
    fxView.update(frame);

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
  };
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
