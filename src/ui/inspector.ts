import type { Plant, World } from '../sim/types';
import { FACTIONS } from '../content/factions';

/** Bottom card shown when tapping a plant. Live-updates while open. */
export class Inspector {
  private el = document.getElementById('inspector')!;
  private plantId: number | null = null;

  show(plantId: number): void {
    this.plantId = plantId;
    this.el.classList.add('open');
  }

  hide(): void {
    this.plantId = null;
    this.el.classList.remove('open');
  }

  update(world: World): void {
    if (this.plantId === null) return;
    const plant = world.plants.find((p) => p.id === this.plantId);
    if (!plant) {
      this.hide();
      return;
    }
    this.el.innerHTML = renderCard(plant);
  }
}

function renderCard(plant: Plant): string {
  const f = FACTIONS[plant.faction];
  const net = plant.lastIncome - plant.lastUpkeep;
  const netStr = `${net >= 0 ? '+' : ''}${net.toFixed(2)}/s`;
  const netColor = net >= 0 ? '#7fe8b0' : '#f28a7a';
  const stems = plant.parts.filter((p) => p.kind === 'stem').length;
  const pct = Math.round((plant.energy / plant.capacity) * 100);
  const t = Math.floor(plant.age);
  return `
    <h3>${f.name.toUpperCase()}</h3>
    <div class="stat-row"><span>energy</span><b>${plant.energy.toFixed(1)} / ${plant.capacity} (${pct}%)</b></div>
    <div class="bar"><div style="width:${pct}%"></div></div>
    <div class="stat-row"><span>income / upkeep</span><b>${plant.lastIncome.toFixed(2)} / ${plant.lastUpkeep.toFixed(2)}</b></div>
    <div class="stat-row"><span>net</span><b style="color:${netColor}">${netStr}</b></div>
    <div class="stat-row"><span>needles lit</span><b>${plant.litLeaves} / ${plant.totalLeaves}</b></div>
    <div class="stat-row"><span>stems / parts</span><b>${stems} / ${plant.parts.length}</b></div>
    <div class="stat-row"><span>age</span><b>${Math.floor(t / 60)}m ${t % 60}s</b></div>`;
}
