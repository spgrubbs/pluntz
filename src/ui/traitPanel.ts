import type { Colony, World } from '../sim/types';
import { MUTATION_TIMING, mutationDef } from '../content/mutations';
import { chooseMutation } from '../sim/stats';
import { SOUND } from '../audio/sound';

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
    const key = `${c.pendingOffer ? c.pendingOffer.join(',') : this.countdown()}:${c.mutations.length}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.rebuild();
    }
  }
}
