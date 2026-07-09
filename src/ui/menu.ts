import type { FactionId } from '../sim/types';
import { MAPS, MAP_CHOICES } from '../content/maps/index';
import { winsFor, maxTierFor } from './profile';

export interface GameConfig {
  mapId: string;
  playerFaction: FactionId;
  aiFaction: FactionId;
  seed: number;
}

const FACTION_CHOICES: { id: FactionId; label: string; blurb: string }[] = [
  { id: 'pinophyta', label: '🌲 Pinophyta', blurb: 'patient armored spires · ballistic cones' },
  { id: 'anthophyta', label: '✿ Anthophyta', blurb: 'racing vines · fruit carried by birds' },
  { id: 'basidiomycota', label: '🍄 Basidiomycota', blurb: 'sunless web · spores infect rivals' },
];

/** The front door: map, factions, seed, GROW. */
export class Menu {
  private el: HTMLElement;
  private cfg: GameConfig;

  constructor(
    initial: GameConfig,
    onStart: (cfg: GameConfig) => void,
    private onResume?: () => boolean,
  ) {
    this.cfg = { ...initial };
    const el = document.createElement('div');
    el.className = 'menu open';
    el.innerHTML = `
      <div class="menu-card">
        <h1>PLUNTZ</h1>
        <p class="menu-sub">a small vulnerable sapling in a large dynamic void</p>
        <button class="resume" style="display:none">↻ RESUME GARDEN</button>
        <div class="menu-section"><span>map</span><div class="menu-col maps"></div></div>
        <div class="menu-section"><span>your clade</span><div class="menu-row pf"></div></div>
        <div class="menu-section rival-row"><span>rival clade</span><div class="menu-row af"></div></div>
        <div class="menu-section">
          <span>seed</span>
          <div class="menu-row">
            <input class="seed" type="number" />
            <button class="dice">🎲</button>
          </div>
        </div>
        <button class="grow">G R O W</button>
      </div>`;
    document.getElementById('ui')!.appendChild(el);
    this.el = el;

    const mapsRow = el.querySelector('.maps')!;
    for (const mc of MAP_CHOICES) {
      const b = document.createElement('button');
      b.textContent = mc.label;
      b.dataset.id = mc.id;
      b.addEventListener('click', () => {
        this.cfg.mapId = mc.id;
        this.sync();
      });
      mapsRow.appendChild(b);
    }
    const resumeBtn = el.querySelector('.resume') as HTMLElement;
    resumeBtn.addEventListener('click', () => {
      if (this.onResume?.()) this.hide();
    });
    for (const [row, key] of [
      ['.pf', 'playerFaction'],
      ['.af', 'aiFaction'],
    ] as const) {
      const target = el.querySelector(row)!;
      for (const fc of FACTION_CHOICES) {
        const b = document.createElement('button');
        b.innerHTML = `${fc.label}<small>${fc.blurb}</small>${row === '.pf' ? '<em class="wins"></em>' : ''}`;
        b.dataset.id = fc.id;
        b.addEventListener('click', () => {
          this.cfg[key] = fc.id;
          this.sync();
        });
        target.appendChild(b);
      }
    }
    const seedInput = el.querySelector('.seed') as HTMLInputElement;
    seedInput.addEventListener('input', () => {
      this.cfg.seed = Number(seedInput.value) >>> 0;
    });
    el.querySelector('.dice')!.addEventListener('click', () => {
      this.cfg.seed = (Date.now() % 0xfffff) >>> 0;
      this.sync();
    });
    el.querySelector('.grow')!.addEventListener('click', () => {
      this.hide();
      onStart({ ...this.cfg });
    });
    this.sync();
  }

  private sync(): void {
    const el = this.el;
    (el.querySelector('.seed') as HTMLInputElement).value = String(this.cfg.seed);
    el.querySelectorAll<HTMLElement>('.maps button').forEach((b) =>
      b.classList.toggle('active', b.dataset.id === this.cfg.mapId),
    );
    el.querySelectorAll<HTMLElement>('.pf button').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === this.cfg.playerFaction);
      // metaprogression readout: wins with this clade -> unlocked mutation depth
      const winsEl = b.querySelector('.wins');
      if (winsEl) {
        const f = b.dataset.id as FactionId;
        const w = winsFor(f);
        winsEl.textContent = w > 0 ? `★${w} · mutations tier ${maxTierFor(f)}` : 'mutations tier 1';
      }
    });
    el.querySelectorAll<HTMLElement>('.af button').forEach((b) =>
      b.classList.toggle('active', b.dataset.id === this.cfg.aiFaction),
    );
    // sandbox maps have no rival colony; skirmish always has one
    const hasRival =
      this.cfg.mapId === 'skirmish' || (MAPS[this.cfg.mapId]?.colonies.length ?? 1) > 1;
    (el.querySelector('.rival-row') as HTMLElement).style.display = hasRival ? '' : 'none';
    // resume only when a garden is stored
    let hasSave = false;
    try {
      hasSave = !!localStorage.getItem('pluntz.save.v2');
    } catch {
      hasSave = false;
    }
    (el.querySelector('.resume') as HTMLElement).style.display = hasSave ? '' : 'none';
  }

  show(): void {
    this.sync();
    this.el.classList.add('open');
  }

  hide(): void {
    this.el.classList.remove('open');
  }

  isOpen(): boolean {
    return this.el.classList.contains('open');
  }
}
