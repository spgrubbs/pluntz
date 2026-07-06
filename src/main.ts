import { Application, Container } from 'pixi.js';
import { createWorld, stepWorld } from './sim/world';
import type { Asteroid, World } from './sim/types';
import { dist, type Vec2 } from './sim/vec';
import { DEV01 } from './content/maps/dev01';
import { TUNING } from './content/tuning';
import { Starfield } from './render/starfield';
import { WorldView } from './render/worldView';
import { PlantView } from './render/plantView';
import { Camera } from './ui/camera';
import { DebugPanel } from './ui/debugPanel';
import { Inspector } from './ui/inspector';

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
  const urlSeed = new URLSearchParams(location.search).get('seed');
  let seed = urlSeed ? Number(urlSeed) >>> 0 : 1337;
  let world: World = createWorld(DEV01, seed);

  // --- Scene graph -------------------------------------------------------------
  let starfield = new Starfield(world.width, world.height, seed);
  const worldRoot = new Container();
  const worldView = new WorldView();
  const plantView = new PlantView();
  worldRoot.addChild(worldView.container, plantView.container);
  app.stage.addChild(starfield.container, worldRoot);

  // --- Interaction state -------------------------------------------------------
  let speed = 1;
  let moveRocks = false;
  let draggedRock: Asteroid | null = null;
  const inspector = new Inspector();

  const homeAst = world.asteroids[0];
  const camera = new Camera(app.canvas, world.width, world.height, {
    onDragStart(worldPos: Vec2): boolean {
      if (!moveRocks) return false;
      draggedRock =
        world.asteroids.find((a) => dist(a.pos, worldPos) < a.radius + 20) ?? null;
      return draggedRock !== null;
    },
    onDragMove(worldPos: Vec2): void {
      if (draggedRock) {
        draggedRock.pos.x = worldPos.x;
        draggedRock.pos.y = worldPos.y;
      }
    },
    onDragEnd(): void {
      draggedRock = null;
    },
    onTap(worldPos: Vec2): void {
      const hit = pickPlant(world, worldPos, 26 / camera.zoom);
      if (hit !== null) inspector.show(hit);
      else inspector.hide();
    },
  });
  camera.x = homeAst.pos.x;
  camera.y = homeAst.pos.y - 60;
  camera.zoom = 1.4;

  // --- Debug panel ---------------------------------------------------------------
  const panel = new DebugPanel({
    setSpeed: (m) => (speed = m),
    setSunAngleDeg: (deg) => (world.sun.angle = (deg * Math.PI) / 180),
    setDayCycle: (on) => (world.sun.cycle = on),
    setMoveRocks: (on) => (moveRocks = on),
    reset: (reseed) => {
      if (reseed) seed = (Date.now() % 0xffffffff) >>> 0;
      world = createWorld(DEV01, seed);
      inspector.hide();
      app.stage.removeChild(starfield.container);
      starfield = new Starfield(world.width, world.height, seed);
      app.stage.addChildAt(starfield.container, 0);
    },
  });

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
    inspector.update(world);

    panel.update({
      fps: fpsEma,
      tickMs: tickMsEma,
      parts: world.plants.reduce((n, p) => n + p.parts.length, 0),
      plants: world.plants.length,
      asteroids: world.asteroids.length,
      sunAngleDeg: (world.sun.angle * 180) / Math.PI,
      seed,
      simTime: world.time,
    });
  });
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
