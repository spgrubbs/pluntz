import type { Plant, World } from '../sim/types';
import { FACTIONS } from '../content/factions';
import { plantStatus } from '../sim/inspect';

/**
 * Bottom card shown when tapping a plant. The DOM is built once per plant so
 * the expandable sections keep their open/closed state; only values update.
 */
export class Inspector {
  private el = document.getElementById('inspector')!;
  private plantId: number | null = null;
  private builtFor: number | null = null;
  private refs: Record<string, HTMLElement> = {};

  show(plantId: number): void {
    this.plantId = plantId;
    this.el.classList.add('open');
  }

  hide(): void {
    this.plantId = null;
    this.builtFor = null;
    this.el.classList.remove('open');
  }

  update(world: World): void {
    if (this.plantId === null) return;
    const plant = world.plants.find((p) => p.id === this.plantId);
    if (!plant) {
      this.hide();
      return;
    }
    if (this.builtFor !== plant.id) this.build(plant);
    this.refresh(plant);
  }

  private build(plant: Plant): void {
    const f = FACTIONS[plant.faction];
    const prios = f.behavior.priorities
      .map((p) => `<li data-prio="${p.id}">${p.text}</li>`)
      .join('');
    this.el.innerHTML = `
      <h3>${f.name.toUpperCase()}</h3>
      <div class="aim" data-ref="aim"></div>
      <div class="stat-row"><span>energy</span><b data-ref="energy"></b></div>
      <div class="bar"><div data-ref="bar"></div></div>
      <div class="stat-row"><span>net energy</span><b data-ref="net"></b></div>
      <div class="stat-row"><span>needles</span><b data-ref="needles"></b></div>
      <div class="stat-row"><span>wounds</span><b data-ref="wounds"></b></div>
      <details data-ref="secBehavior">
        <summary>behavior — what &amp; why</summary>
        <p class="desc">${f.behavior.summary}</p>
        <ol class="prio">${prios}</ol>
        <div class="stat-row"><span>trunk</span><b data-ref="trunk"></b></div>
        <div class="stat-row"><span>branches</span><b data-ref="branches"></b></div>
        <div class="stat-row"><span>open needle slots</span><b data-ref="slots"></b></div>
      </details>
      <details data-ref="secEnergy">
        <summary>energy detail</summary>
        <div class="stat-row"><span>needle income</span><b data-ref="leafIncome"></b></div>
        <div class="stat-row"><span>heartseed trickle</span><b data-ref="heartIncome"></b></div>
        <div class="stat-row"><span>upkeep: stems</span><b data-ref="upStems"></b></div>
        <div class="stat-row"><span>upkeep: needles</span><b data-ref="upLeaves"></b></div>
        <div class="stat-row"><span>upkeep: heart + roots</span><b data-ref="upCore"></b></div>
        <div class="stat-row"><span>parts / age</span><b data-ref="parts"></b></div>
      </details>`;
    this.refs = {};
    this.el.querySelectorAll<HTMLElement>('[data-ref]').forEach((n) => {
      this.refs[n.dataset.ref!] = n;
    });
    this.builtFor = plant.id;
  }

  private refresh(plant: Plant): void {
    const f = FACTIONS[plant.faction];
    const r = this.refs;
    const s = plantStatus(plant);
    const net = plant.lastIncome - plant.lastUpkeep;

    // aim line: warning trumps intent
    const aimEl = r.aim;
    if (s.warning) {
      aimEl.textContent = `⚠ ${s.warning}`;
      aimEl.classList.add('warn');
    } else {
      aimEl.textContent = `▸ ${s.aim}`;
      aimEl.classList.remove('warn');
    }

    if (!plant.alive) {
      r.energy.textContent = '—';
      r.bar.style.width = '0%';
      r.net.textContent = '—';
      r.net.style.color = '#8fa0bd';
      r.needles.textContent = 'dropped';
      r.wounds.textContent = '—';
    } else {
      const wounded = plant.parts.filter((p) => !p.dead && p.hp < p.maxHp * 0.98);
      if (wounded.length === 0) {
        r.wounds.textContent = 'none';
        r.wounds.style.color = '#8fa0bd';
      } else {
        const worst = Math.round(
          Math.min(...wounded.map((p) => p.hp / p.maxHp)) * 100,
        );
        r.wounds.textContent = `${wounded.length} wounded · worst at ${worst}% hp`;
        r.wounds.style.color = '#e8b054';
      }
      const pct = Math.round((plant.energy / plant.capacity) * 100);
      r.energy.textContent = `${plant.energy.toFixed(1)} / ${plant.capacity} (${pct}%)`;
      r.bar.style.width = `${pct}%`;
      r.net.textContent = `${net >= 0 ? '+' : ''}${net.toFixed(2)}/s (${plant.lastIncome.toFixed(2)} in, ${plant.lastUpkeep.toFixed(2)} up)`;
      r.net.style.color = net >= 0 ? '#7fe8b0' : '#f28a7a';
      r.needles.textContent = `${plant.litLeaves} lit · ${plant.canopyLeaves} canopy · ${plant.shadowLeaves} shadow`;
    }

    // highlight the active priority
    this.el.querySelectorAll<HTMLElement>('[data-prio]').forEach((li) => {
      li.classList.toggle('active', li.dataset.prio === s.intent);
    });
    r.trunk.textContent = `${s.trunkSegs} / ${s.trunkTarget} segments`;
    r.branches.textContent = `${s.budsActive} growing · ${s.budsDone} finished`;
    r.slots.textContent = String(s.needleSlotsOpen);

    // energy detail (alive parts only — husk costs nothing)
    const count = (k: string): number =>
      plant.parts.filter((p) => p.kind === k && !p.dead).length;
    const stems = count('stem');
    const roots = count('root');
    r.leafIncome.textContent = `+${(plant.lastIncome - f.energy.heartIncome).toFixed(2)}/s`;
    r.heartIncome.textContent = `+${f.energy.heartIncome.toFixed(2)}/s`;
    r.upStems.textContent = `−${(stems * f.energy.upkeep.stem).toFixed(2)}/s (${stems})`;
    r.upLeaves.textContent = `−${(plant.totalLeaves * f.energy.upkeep.leaf).toFixed(2)}/s (${plant.totalLeaves})`;
    r.upCore.textContent = `−${(f.energy.upkeep.heart + roots * f.energy.upkeep.root).toFixed(2)}/s`;
    const t = Math.floor(plant.age);
    const alive = plant.parts.filter((p) => !p.dead).length;
    r.parts.textContent = `${alive}/${plant.parts.length} alive · ${Math.floor(t / 60)}m ${t % 60}s`;
  }
}
