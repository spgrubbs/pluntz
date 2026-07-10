import { Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import type { World } from '../sim/types';

/**
 * Fog of war — a special feature of a few maps (MapDef.fog), not omnipresent.
 * Render-only: the sim always runs the whole map, so determinism and saves
 * are untouched; the veil just hides what no friendly thing is near.
 *
 * Revealed by: your plants (a generous halo around their rock), your flying
 * seeds and spores, any bird carrying your seed, and your Ping and Lure —
 * which quietly become scouting verbs on fogged maps.
 *
 * Implementation: the veil is drawn into a low-resolution RenderTexture
 * (dark rect + erase-blend "light" circles), then stretched over the world.
 * The low resolution is the point: upscaling gives soft, cheap fog edges.
 */
const FOG_COLOR = 0x04060d;
const SCALE = 0.22; // texture resolution relative to the world

export class FogView {
  readonly container = new Container();
  enabled = false;
  private sprite: Sprite | null = null;
  private tex: RenderTexture | null = null;
  private scene = new Container();
  private veil = new Graphics();
  private lights = new Graphics();
  private sizedFor = '';

  constructor() {
    this.lights.blendMode = 'erase';
    this.scene.addChild(this.veil, this.lights);
  }

  update(world: World, playerColonyId: number, renderer: Renderer): void {
    if (!this.enabled || playerColonyId < 0) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    const key = `${world.width}x${world.height}`;
    if (key !== this.sizedFor) {
      this.sizedFor = key;
      const tw = Math.ceil(world.width * SCALE);
      const th = Math.ceil(world.height * SCALE);
      this.tex?.destroy(true);
      this.sprite?.destroy();
      this.tex = RenderTexture.create({ width: tw, height: th });
      this.sprite = new Sprite(this.tex);
      this.sprite.position.set(-world.width / 2, -world.height / 2);
      this.sprite.scale.set(1 / SCALE);
      this.container.removeChildren();
      this.container.addChild(this.sprite);
      this.veil.clear().rect(0, 0, tw, th).fill({ color: FOG_COLOR, alpha: 0.93 });
    }

    // collect this frame's reveal circles (world coords)
    const holes: { x: number; y: number; r: number }[] = [];
    for (const p of world.plants) {
      if (!p.alive || p.colonyId !== playerColonyId) continue;
      const ast = world.asteroids.find((a) => a.id === p.asteroidId);
      holes.push({ x: p.astPos.x, y: p.astPos.y, r: (ast?.radius ?? 60) + 270 });
    }
    for (const s of world.seeds) {
      if (s.colonyId === playerColonyId) holes.push({ x: s.pos.x, y: s.pos.y, r: 140 });
    }
    for (const fn of world.fauna) {
      if (fn.carryColony === playerColonyId) holes.push({ x: fn.pos.x, y: fn.pos.y, r: 160 });
    }
    if (world.ping && world.ping.colonyId === playerColonyId) {
      holes.push({ x: world.ping.x, y: world.ping.y, r: 230 });
    }
    if (world.lure && world.lure.colonyId === playerColonyId) {
      holes.push({ x: world.lure.x, y: world.lure.y, r: 180 });
    }

    const g = this.lights;
    g.clear();
    const ox = world.width / 2;
    const oy = world.height / 2;
    for (const h of holes) {
      const x = (h.x + ox) * SCALE;
      const y = (h.y + oy) * SCALE;
      // graded erase: a bright certain core fading to rumor at the rim
      g.circle(x, y, h.r * SCALE).fill({ color: 0xffffff, alpha: 0.45 });
      g.circle(x, y, h.r * 0.78 * SCALE).fill({ color: 0xffffff, alpha: 0.7 });
      g.circle(x, y, h.r * 0.55 * SCALE).fill({ color: 0xffffff, alpha: 1 });
    }
    renderer.render({ container: this.scene, target: this.tex!, clear: true });
  }
}
