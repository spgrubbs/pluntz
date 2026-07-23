import type { Vec2 } from '../sim/vec';
import { TUNING } from '../content/tuning';

export interface CameraCallbacks {
  /** Return true to consume the drag (e.g. debug rock-moving). */
  onDragStart?(world: Vec2): boolean;
  onDragMove?(world: Vec2): void;
  onDragEnd?(): void;
  onTap?(world: Vec2): void;
}

interface PointerInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

/**
 * Touch-first camera: one finger pans (or drags a rock in debug move mode),
 * two fingers pinch-zoom, mouse wheel zooms at the cursor. Short still
 * presses are taps.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  /** Whether the user currently has a finger/pointer down (for auto-follow). */
  get dragging(): boolean {
    return this.pointers.size > 0;
  }

  private pointers = new Map<number, PointerInfo>();
  private pinchDist = 0;
  private dragConsumed = false;
  private moved = false;
  private boundsW: number;
  private boundsH: number;

  constructor(
    private canvas: HTMLCanvasElement,
    worldW: number,
    worldH: number,
    private cb: CameraCallbacks = {},
  ) {
    this.boundsW = worldW;
    this.boundsH = worldH;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: this.x + (sx - window.innerWidth / 2) / this.zoom,
      y: this.y + (sy - window.innerHeight / 2) / this.zoom,
    };
  }

  private clamp(): void {
    const m = TUNING.camera.panMargin;
    const hw = this.boundsW / 2 + m;
    const hh = this.boundsH / 2 + m;
    this.x = Math.max(-hw, Math.min(hw, this.x));
    this.y = Math.max(-hh, Math.min(hh, this.y));
    this.zoom = Math.max(TUNING.camera.minZoom, Math.min(TUNING.camera.maxZoom, this.zoom));
  }

  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
    });
    if (this.pointers.size === 1) {
      this.moved = false;
      this.dragConsumed =
        this.cb.onDragStart?.(this.screenToWorld(e.clientX, e.clientY)) ?? false;
    } else if (this.pointers.size === 2) {
      this.dragConsumed = false;
      this.pinchDist = this.pointerDist();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > TUNING.camera.tapMaxPx) {
      this.moved = true;
    }

    if (this.pointers.size === 1) {
      if (this.dragConsumed) {
        this.cb.onDragMove?.(this.screenToWorld(e.clientX, e.clientY));
      } else {
        this.x -= dx / this.zoom;
        this.y -= dy / this.zoom;
        this.clamp();
      }
    } else if (this.pointers.size === 2) {
      const d = this.pointerDist();
      if (this.pinchDist > 0 && d > 0) {
        const mid = this.pointerMid();
        this.zoomAt(mid.x, mid.y, d / this.pinchDist);
        // two-finger pan by half the average movement
        this.x -= dx / this.zoom / 2;
        this.y -= dy / this.zoom / 2;
        this.clamp();
      }
      this.pinchDist = d;
    }
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.dragConsumed && this.pointers.size === 0) {
      this.cb.onDragEnd?.();
      this.dragConsumed = false;
    }
    if (
      p &&
      this.pointers.size === 0 &&
      !this.moved &&
      performance.now() - p.startTime < TUNING.camera.tapMaxMs
    ) {
      this.cb.onTap?.(this.screenToWorld(p.x, p.y));
    }
    if (this.pointers.size < 2) this.pinchDist = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  private zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom *= factor;
    this.clamp();
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  private pointerDist(): number {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  }

  private pointerMid(): Vec2 {
    const ps = [...this.pointers.values()];
    return { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
  }
}
