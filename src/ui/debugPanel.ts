export interface DebugCallbacks {
  setSpeed(mult: number): void;
  setSunAngleDeg(deg: number): void;
  setDayCycle(on: boolean): void;
  setMoveRocks(on: boolean): void;
  spawnDebris(): void;
  grantEnergy(): void;
  reset(reseed: boolean): void;
  openMenu(): void;
}

export interface DebugStats {
  fps: number;
  tickMs: number;
  parts: number;
  plants: number;
  asteroids: number;
  debris: number;
  sunAngleDeg: number;
  seed: number;
  simTime: number;
}

/**
 * The developer panel from GDD §11 — ships in M0, never removed (eventually
 * hidden behind a triple-tap). Collapsible via its header.
 */
export class DebugPanel {
  private stats: HTMLElement;
  private sunSlider: HTMLInputElement;
  private speedButtons: HTMLButtonElement[] = [];
  private suppressSlider = false;

  constructor(cb: DebugCallbacks) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head">PLUNTZ dev — M9</div>
      <div class="panel-body">
        <div class="stats"></div>
        <div class="btn-row speed"></div>
        <div>
          <label class="chk" style="justify-content:space-between">
            <span>sun angle</span><span class="sun-val"></span>
          </label>
          <input type="range" class="sun" min="0" max="360" step="1" />
        </div>
        <label class="chk"><input type="checkbox" class="cycle" /> day cycle</label>
        <label class="chk"><input type="checkbox" class="move" /> move rocks (drag)</label>
        <div class="btn-row">
          <button class="debris">spawn debris</button>
          <button class="energy">+60⚡</button>
        </div>
        <div class="btn-row">
          <button class="reset">replant</button>
          <button class="reseed">reseed</button>
          <button class="menu-open">menu</button>
        </div>
      </div>`;
    document.getElementById('ui')!.appendChild(panel);

    const head = panel.querySelector('.panel-head') as HTMLElement;
    const body = panel.querySelector('.panel-body') as HTMLElement;
    head.addEventListener('click', () => body.classList.toggle('hidden'));

    this.stats = panel.querySelector('.stats') as HTMLElement;

    const speedRow = panel.querySelector('.speed') as HTMLElement;
    for (const s of [0, 1, 2, 4, 8]) {
      const b = document.createElement('button');
      b.textContent = s === 0 ? '⏸' : `${s}×`;
      if (s === 1) b.classList.add('active');
      b.addEventListener('click', () => {
        this.speedButtons.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        cb.setSpeed(s);
      });
      this.speedButtons.push(b);
      speedRow.appendChild(b);
    }

    this.sunSlider = panel.querySelector('.sun') as HTMLInputElement;
    this.sunSlider.addEventListener('input', () => {
      if (!this.suppressSlider) cb.setSunAngleDeg(Number(this.sunSlider.value));
    });
    (panel.querySelector('.cycle') as HTMLInputElement).addEventListener('change', (e) =>
      cb.setDayCycle((e.target as HTMLInputElement).checked),
    );
    (panel.querySelector('.move') as HTMLInputElement).addEventListener('change', (e) =>
      cb.setMoveRocks((e.target as HTMLInputElement).checked),
    );
    (panel.querySelector('.debris') as HTMLElement).addEventListener('click', () =>
      cb.spawnDebris(),
    );
    (panel.querySelector('.energy') as HTMLElement).addEventListener('click', () =>
      cb.grantEnergy(),
    );
    (panel.querySelector('.reset') as HTMLElement).addEventListener('click', () =>
      cb.reset(false),
    );
    (panel.querySelector('.reseed') as HTMLElement).addEventListener('click', () =>
      cb.reset(true),
    );
    (panel.querySelector('.menu-open') as HTMLElement).addEventListener('click', () =>
      cb.openMenu(),
    );
    this.sunVal = panel.querySelector('.sun-val') as HTMLElement;
  }

  private sunVal!: HTMLElement;

  update(s: DebugStats): void {
    const t = Math.floor(s.simTime);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    this.stats.innerHTML = `
      <div class="stat-row"><span>fps / tick</span><b>${s.fps.toFixed(0)} / ${s.tickMs.toFixed(2)}ms</b></div>
      <div class="stat-row"><span>parts/plants/rocks/debris</span><b>${s.parts} / ${s.plants} / ${s.asteroids} / ${s.debris}</b></div>
      <div class="stat-row"><span>sim time / seed</span><b>${mm}:${ss} / ${s.seed}</b></div>`;
    const deg = Math.round(((s.sunAngleDeg % 360) + 360) % 360);
    this.sunVal.textContent = `${deg}°`;
    this.suppressSlider = true;
    this.sunSlider.value = String(deg);
    this.suppressSlider = false;
  }
}
