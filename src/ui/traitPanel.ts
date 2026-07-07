import type { Colony, World } from '../sim/types';
import { TRAITS } from '../content/traits';
import { buyTrait } from '../sim/stats';

/**
 * The evolution panel: essence, the trait tree, and the two instinct
 * sliders. Opened from the ⬡ button; player colony only.
 */
export class TraitPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private essenceEl: HTMLElement;
  private open = false;

  constructor(
    private getWorld: () => World,
    private getColonyId: () => number,
  ) {
    const el = document.createElement('div');
    el.className = 'traitpanel';
    el.innerHTML = `
      <div class="tp-head">
        <span>EVOLUTION</span>
        <b class="tp-essence"></b>
        <button class="tp-close">×</button>
      </div>
      <div class="tp-sliders">
        <label>fortify <input type="range" class="tp-expand" min="0" max="100" /> expand</label>
        <label>spread <input type="range" class="tp-vertical" min="0" max="100" /> tall</label>
      </div>
      <div class="tp-list"></div>`;
    document.getElementById('ui')!.appendChild(el);
    this.el = el;
    this.listEl = el.querySelector('.tp-list')!;
    this.essenceEl = el.querySelector('.tp-essence')!;
    el.querySelector('.tp-close')!.addEventListener('click', () => this.hide());
    (el.querySelector('.tp-expand') as HTMLInputElement).addEventListener('input', (e) => {
      const c = this.colony();
      if (c) c.instincts.expand = Number((e.target as HTMLInputElement).value) / 100;
    });
    (el.querySelector('.tp-vertical') as HTMLInputElement).addEventListener('input', (e) => {
      const c = this.colony();
      if (c) c.instincts.vertical = Number((e.target as HTMLInputElement).value) / 100;
    });
  }

  private colony(): Colony | undefined {
    return this.getWorld().colonies.find((c) => c.id === this.getColonyId());
  }

  toggle(): void {
    this.open ? this.hide() : this.show();
  }

  show(): void {
    this.open = true;
    this.el.classList.add('open');
    const c = this.colony();
    if (c) {
      (this.el.querySelector('.tp-expand') as HTMLInputElement).value = String(
        c.instincts.expand * 100,
      );
      (this.el.querySelector('.tp-vertical') as HTMLInputElement).value = String(
        c.instincts.vertical * 100,
      );
    }
    this.rebuild();
  }

  hide(): void {
    this.open = false;
    this.el.classList.remove('open');
  }

  isOpen(): boolean {
    return this.open;
  }

  private rebuild(): void {
    const c = this.colony();
    if (!c) return;
    this.listEl.innerHTML = '';
    for (const t of TRAITS[c.faction] ?? []) {
      const owned = c.traits.includes(t.id);
      const row = document.createElement('div');
      row.className = `tp-trait${owned ? ' owned' : ''}`;
      row.innerHTML = `
        <div class="tp-trait-top">
          <b>${t.name}</b>
          <span>${owned ? '✓' : `${t.cost}⬡`}</span>
        </div>
        <p>${t.desc}</p>`;
      if (!owned) {
        row.addEventListener('click', () => {
          if (buyTrait(this.getWorld(), c.id, t.id)) this.rebuild();
        });
      }
      this.listEl.appendChild(row);
    }
  }

  /** Per-frame: essence readout + affordability classes. */
  update(): void {
    if (!this.open) return;
    const c = this.colony();
    if (!c) return;
    this.essenceEl.textContent = `${c.essence}⬡`;
    const rows = this.listEl.querySelectorAll<HTMLElement>('.tp-trait:not(.owned)');
    const defs = (TRAITS[c.faction] ?? []).filter((t) => !c.traits.includes(t.id));
    rows.forEach((row, i) => {
      row.classList.toggle('afford', (defs[i]?.cost ?? Infinity) <= c.essence);
    });
  }
}
