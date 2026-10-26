import type Phaser from 'phaser';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Ángulos (en grados) que prueba, de menor a mayor, para rodear un obstáculo. */
const DETOUR_ANGLES = [35, 70, 105, 140].map((deg) => (deg * Math.PI) / 180);
/** Cuánto mira hacia adelante (px) para ver si hay un obstáculo en el camino. */
const LOOK_AHEAD = 56;
/** Una vez elegido el lado por el que rodea, lo mantiene este tiempo (evita que titubee de un lado al otro). */
const KEEP_SIDE_MS = 900;

/**
 * Hace que los enemigos rodeen los obstáculos (la fuente del medio, edificios, autos) en vez de quedarse empujándolos
 * en línea recta: si el camino directo hacia el jugador choca, prueba desviarse cada vez más hacia un lado
 * y se queda con ese lado un rato.
 */
export class ObstacleAvoidance {
  private readonly boxes: Box[] = [];
  private readonly sides = new WeakMap<object, { side: 1 | -1; until: number }>();

  constructor(obstacles: Phaser.Physics.Arcade.StaticGroup) {
    for (const child of obstacles.getChildren()) {
      const body = child.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!body) continue;
      this.boxes.push({ left: body.x, top: body.y, right: body.x + body.width, bottom: body.y + body.height });
    }
  }

  /**
   * Devuelve la dirección (unitaria) que conviene seguir desde (`x`, `y`) para ir hacia (`dirX`, `dirY`) sin trabarse.
   * `owner` identifica al enemigo para recordar su lado; `radius` es su tamaño aproximado.
   */
  steer(owner: object, x: number, y: number, dirX: number, dirY: number, radius: number, now: number): { x: number; y: number } {
    if (!this.blocked(x, y, dirX, dirY, radius)) {
      const mem = this.sides.get(owner);
      if (mem && now > mem.until) this.sides.delete(owner);
      return { x: dirX, y: dirY };
    }

    let mem = this.sides.get(owner);
    if (!mem || now > mem.until) {
      mem = { side: this.cheaperSide(x, y, dirX, dirY, radius), until: now + KEEP_SIDE_MS };
      this.sides.set(owner, mem);
    } else {
      mem.until = now + KEEP_SIDE_MS;
    }
    for (const angle of DETOUR_ANGLES) {
      const dir = this.rotate(dirX, dirY, angle * mem.side);
      if (!this.blocked(x, y, dir.x, dir.y, radius)) return dir;
    }
    return this.rotate(dirX, dirY, (Math.PI / 2) * mem.side);
  }

  /** El lado (1 = girar a la derecha, -1 = a la izquierda) por el que se libra el obstáculo con menos desvío. */
  private cheaperSide(x: number, y: number, dirX: number, dirY: number, radius: number): 1 | -1 {
    for (const angle of DETOUR_ANGLES) {
      const right = !this.blocked(x, y, ...this.pair(this.rotate(dirX, dirY, angle)), radius);
      const left = !this.blocked(x, y, ...this.pair(this.rotate(dirX, dirY, -angle)), radius);
      if (right && !left) return 1;
      if (left && !right) return -1;
      if (right && left) return Math.random() < 0.5 ? 1 : -1;
    }
    return Math.random() < 0.5 ? 1 : -1;
  }

  private pair(v: { x: number; y: number }): [number, number] {
    return [v.x, v.y];
  }

  private rotate(x: number, y: number, angle: number): { x: number; y: number } {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }

  /** ¿El segmento de largo `LOOK_AHEAD` desde (x, y) en esa dirección toca algún obstáculo (agrandado por `radius`)? */
  private blocked(x: number, y: number, dirX: number, dirY: number, radius: number): boolean {
    const x2 = x + dirX * LOOK_AHEAD;
    const y2 = y + dirY * LOOK_AHEAD;
    const minX = Math.min(x, x2) - radius;
    const maxX = Math.max(x, x2) + radius;
    const minY = Math.min(y, y2) - radius;
    const maxY = Math.max(y, y2) + radius;
    for (const box of this.boxes) {
      if (box.right < minX || box.left > maxX || box.bottom < minY || box.top > maxY) continue;
      if (this.segmentHits(x, y, dirX * LOOK_AHEAD, dirY * LOOK_AHEAD, box, radius)) return true;
    }
    return false;
  }

  /** Segmento contra rectángulo agrandado (método de las franjas). */
  private segmentHits(x: number, y: number, dx: number, dy: number, box: Box, radius: number): boolean {
    let tMin = 0;
    let tMax = 1;
    const axes: [number, number, number, number][] = [
      [x, dx, box.left - radius, box.right + radius],
      [y, dy, box.top - radius, box.bottom + radius],
    ];
    for (const [origin, delta, lo, hi] of axes) {
      if (Math.abs(delta) < 1e-6) {
        if (origin < lo || origin > hi) return false;
      } else {
        let t1 = (lo - origin) / delta;
        let t2 = (hi - origin) / delta;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
      }
    }
    return true;
  }
}
