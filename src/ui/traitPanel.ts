import type { Colony, World } from '../sim/types';
import { MUTATION_TIMING, mutationDef, DRIFT_CATALOG } from '../content/mutations';
import { chooseMutation, buyDriftMutation, driftCardCost } from '../sim/stats';
import { SOUND } from '../audio/sound';

const STRAND_LABEL: Record<string, string> = {
  mobility: 'mobility',
  protection: 'protection',
  sensing: 'sensing',
  colonization: 'colonization',
};

/**
 * The evolution panel. Its heart is the mutation draft: when the clock
 * deals the player a draft (2 cards, 3 where wins have widened it), the
 * cards appear here (the panel auto-opens from main.ts) and the player
 * keeps one. Below that: owned mutations. Opened by tapping the round chip.
 */
export class TraitPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private open = false;
  private lastKey = '';

  constructor(
    private getWorld: () => World,
    private getColonyId: () => number,
  ) {
    const el = document.createElement('div');
    el.className = 'traitpanel';
    el.innerHTML = `
      <div class="tp-head">
        <span>EVOLUTION</span>
        <button class="tp-close">×</button>
      </div>
      <div class="tp-list"></div>`;
    document.getElementById('ui')!.appendChild(el);
    this.el = el;
    this.listEl = el.querySelector('.tp-list')!;
    el.querySelector('.tp-close')!.addEventListener('click', () => this.hide());
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
    this.lastKey = '';
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
    const world = this.getWorld();
    const c = this.colony();
    if (!c) return;
    if (world.drift) {
      this.rebuildShop(world, c);
      return;
    }
    this.listEl.innerHTML = '';

    if (c.pendingOffer) {
      const head = document.createElement('div');
      head.className = 'tp-offer-head';
      head.textContent = `🧬 DRAFT ${c.mutations.length + 1} of 3 — keep one`;
      this.listEl.appendChild(head);
      for (const id of c.pendingOffer) {
        const m = mutationDef(c.faction, id);
        if (!m) continue;
        const card = document.createElement('div');
        card.className = 'tp-trait tp-offer';
        card.innerHTML = `
          <div class="tp-trait-top">
            <b>${m.name}</b>
            <span>${m.bonus ? '★ won card' : `draft ${m.tier}`}</span>
          </div>
          <p>${m.desc}</p>`;
        card.addEventListener('click', () => {
          if (chooseMutation(world, c.id, id)) {
            SOUND.ui('pick');
            this.hide(); // decision made — back to the garden
          }
        });
        this.listEl.appendChild(card);
      }
    } else {
      const wait = document.createElement('div');
      wait.className = 'tp-offer-head tp-wait';
      wait.textContent =
        c.mutations.length >= 3
          ? '🧬 fully evolved this round'
          : `🧬 draft ${c.mutations.length + 1} of 3 arrives in ${this.countdown()}`;
      this.listEl.appendChild(wait);
    }

    if (c.mutations.length > 0) {
      const head = document.createElement('div');
      head.className = 'tp-owned-head';
      head.textContent = 'your mutations';
      this.listEl.appendChild(head);
      for (const id of c.mutations) {
        const m = mutationDef(c.faction, id);
        if (!m) continue;
        const row = document.createElement('div');
        row.className = 'tp-trait owned';
        row.innerHTML = `
          <div class="tp-trait-top">
            <b>${m.name}</b>
            <span>✓ d${m.tier}</span>
          </div>
          <p>${m.desc}</p>`;
        this.listEl.appendChild(row);
      }
    }
    if (c.bonusDepth < 3) {
      const note = document.createElement('p');
      note.className = 'tp-tier-note';
      note.textContent = `win with this clade to add a third card to draft ${c.bonusDepth + 1}`;
      this.listEl.appendChild(note);
    }
  }

  /** The Drift shop: spend Legacy on strand mutations, any time. */
  private rebuildShop(world: World, c: Colony): void {
    this.listEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'tp-offer-head';
    head.textContent = `❂ THE DRIFT — Legacy ${Math.floor(c.legacy)}`;
    this.listEl.appendChild(head);
    const note = document.createElement('p');
    note.className = 'tp-tier-note';
    note.textContent = 'Retired gardens trickle Legacy. Spend it here — the loadout rides your lineage.';
    this.listEl.appendChild(note);

    for (const card of DRIFT_CATALOG) {
      const owned = c.mutations.includes(card.id);
      const cost = driftCardCost(c, card.id);
      const afford = c.legacy >= cost;
      const el = document.createElement('div');
      el.className = `tp-trait${owned ? ' owned' : ' tp-offer'}`;
      if (!owned && !afford) el.classList.add('tp-locked');
      el.innerHTML = `
        <div class="tp-trait-top">
          <b>${card.name}</b>
          <span>${owned ? '✓ owned' : `❂ ${cost}`} · ${STRAND_LABEL[card.strand]}</span>
        </div>
        <p>${card.desc}</p>`;
      if (!owned) {
        el.addEventListener('click', () => {
          if (buyDriftMutation(world, c.id, card.id)) {
            SOUND.ui('pick');
            this.rebuild();
          } else {
            SOUND.ui('close');
          }
        });
      }
      this.listEl.appendChild(el);
    }
  }

  private countdown(): string {
    const world = this.getWorld();
    const c = this.colony();
    if (!c) return '';
    if (c.nextMutationAt >= MUTATION_TIMING.never) return '—';
    const s = Math.max(0, Math.ceil(c.nextMutationAt - world.time));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Per-frame: rebuild when the offer state changes. */
  update(): void {
    if (!this.open) return;
    const c = this.colony();
    if (!c) return;
    const key = this.getWorld().drift
      ? `drift:${Math.floor(c.legacy)}:${c.mutations.length}`
      : `${c.pendingOffer ? c.pendingOffer.join(',') : this.countdown()}:${c.mutations.length}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.rebuild();
    }
  }
}
