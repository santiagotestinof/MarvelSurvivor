import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { BreakableProp } from '../entities/BreakableProp';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { PlayerStats } from '../progression/PlayerStats';
import { activeEnemies } from './areaDamage';

/** Valores del martillo volador de Thor (arma principal). */
export const HAMMER = {
  /** Velocidad de vuelo (px/s); la pasiva Velocidad la sube. */
  speed: 480,
  /** Hasta dónde se aleja de Thor para ir a por un enemigo o una caja. */
  leash: 300,
  /** Radio del golpe del martillo (px, antes de Área). */
  hitRadius: 13,
  /** Tiempo mínimo entre dos golpes de un mismo martillo al mismo enemigo. */
  rehitMs: 350,
  /** Cuánto sigue de largo después de un golpe antes de elegir el próximo objetivo. */
  overshootMs: 110,
} as const;

type Target = { x: number; y: number };

interface Hammer {
  sprite: Phaser.GameObjects.Image;
  target: (Target & object) | null;
  last: object | null;
  overshootUntil: number;
  vx: number;
  vy: number;
  hitAt: WeakMap<object, number>;
}

/**
 * Thor: martillos que siempre están en el aire y van de enemigo en enemigo, sin cadencia.
 * Hay uno por cada disparo del arma principal (`stats.shotCount`). Sin nada para golpear, giran alrededor de Thor.
 */
export class FlyingHammers {
  private readonly hammers: Hammer[] = [];
  private orbit = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
    private readonly props: () => Iterable<BreakableProp>,
    /** Daño de un golpe (con crítico), ya multiplicado por el daño del jugador. */
    private readonly rollDamage: () => number,
  ) {}

  update(now: number, delta: number): void {
    // Cantidad no suma martillos (solo agranda las armas exclusivas): hay uno por disparo propio del arma.
    const count = this.stats.projectileCount;
    while (this.hammers.length < count) {
      const sprite = this.scene.add.image(this.owner.x, this.owner.y - 10, TEXTURES.hammer).setDepth(999_991);
      this.hammers.push({ sprite, target: null, last: null, overshootUntil: 0, vx: 0, vy: 0, hitAt: new WeakMap() });
    }
    while (this.hammers.length > count) this.hammers.pop()?.sprite.destroy();

    const size = this.stats.areaMult * this.stats.mainAreaMult;
    const speed = HAMMER.speed * this.stats.projectileSpeedMult;
    const dt = delta / 1000;
    this.orbit += dt * 2.4;
    const enemies = activeEnemies(this.enemies);
    const taken = new Set<object>();
    for (const h of this.hammers) if (h.target) taken.add(h.target);

    this.hammers.forEach((h, i) => {
      const s = h.sprite;
      s.setScale(1.1 * size).setRotation(s.rotation + dt * 14);

      // Sigue de largo un instante después de un golpe: se ve que atraviesa.
      if (now < h.overshootUntil) {
        s.x += h.vx * dt;
        s.y += h.vy * dt;
      } else {
        if (h.target && !this.isValid(h.target)) h.target = null;
        if (!h.target) {
          h.target = this.pickTarget(s, enemies, h.last, taken);
          if (h.target) taken.add(h.target);
        }
        let tx: number;
        let ty: number;
        let v = speed;
        if (h.target) {
          tx = h.target.x;
          ty = h.target.y - 6;
        } else {
          // Sin nada cerca: da vueltas alrededor de Thor.
          const a = this.orbit + (i * Math.PI * 2) / Math.max(1, this.hammers.length);
          tx = this.owner.x + Math.cos(a) * 38;
          ty = this.owner.y - 10 + Math.sin(a) * 30;
          v = speed * 1.4;
        }
        const dx = tx - s.x;
        const dy = ty - s.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, v * dt);
        if (dist > 0.01) {
          h.vx = (dx / dist) * v;
          h.vy = (dy / dist) * v;
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
        }
      }

      // Golpea todo lo que toca (con un respiro por enemigo).
      const reach = HAMMER.hitRadius * size;
      for (const enemy of enemies) {
        if (enemy.dying || (h.hitAt.get(enemy) ?? 0) > now) continue;
        if ((enemy.x - s.x) ** 2 + (enemy.y - 6 - s.y) ** 2 > (reach + 6) ** 2) continue;
        h.hitAt.set(enemy, now + HAMMER.rehitMs);
        enemy.takeDamage(this.rollDamage());
        if (!enemy.dying && enemy.kind.id !== 'overlord') enemy.knockback(enemy.x - s.x, enemy.y - s.y, 60, 80);
        if (enemy === h.target) this.afterHit(h, enemy, now);
      }
      for (const prop of this.props()) {
        if (prop.isBroken || (h.hitAt.get(prop) ?? 0) > now) continue;
        if ((prop.x - s.x) ** 2 + (prop.y - s.y) ** 2 > (reach + 8) ** 2) continue;
        h.hitAt.set(prop, now + HAMMER.rehitMs);
        prop.takeDamage(this.rollDamage());
        if (prop === h.target) this.afterHit(h, prop, now);
      }
    });
  }

  destroy(): void {
    for (const h of this.hammers) h.sprite.destroy();
    this.hammers.length = 0;
  }

  private afterHit(h: Hammer, target: object, now: number): void {
    h.last = target;
    h.target = null;
    h.overshootUntil = now + HAMMER.overshootMs;
  }

  private isValid(target: object): boolean {
    if (target instanceof BreakableProp) return !target.isBroken;
    const enemy = target as Enemy;
    return !enemy.dying && enemy.active;
  }

  /** El enemigo más cercano al martillo (que no sea el recién golpeado ni el de otro martillo); sin enemigos, una caja o roca. */
  private pickTarget(sprite: Phaser.GameObjects.Image, enemies: Enemy[], last: object | null, taken: Set<object>): (Target & object) | null {
    const near = (x: number, y: number): boolean => (x - this.owner.x) ** 2 + (y - this.owner.y) ** 2 <= HAMMER.leash * HAMMER.leash;
    const d2 = (x: number, y: number): number => (x - sprite.x) ** 2 + (y - sprite.y) ** 2;
    let best: Enemy | null = null;
    let bestD = Infinity;
    let fallback: Enemy | null = null;
    for (const enemy of enemies) {
      if (enemy.dying || !near(enemy.x, enemy.y)) continue;
      const d = d2(enemy.x, enemy.y - 6);
      if (enemy === last || taken.has(enemy)) {
        if (enemy === last && (!fallback || d < d2(fallback.x, fallback.y - 6))) fallback = enemy;
        continue;
      }
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    if (best) return best;
    // Si el único enemigo cerca es otro al que ya va un compañero, va al mismo; si es el que acaba de golpear, vuelve a él.
    for (const enemy of enemies) if (!enemy.dying && near(enemy.x, enemy.y) && enemy !== last) return enemy;
    if (fallback) return fallback;
    let prop: BreakableProp | null = null;
    let propD = Infinity;
    for (const p of this.props()) {
      if (p.isBroken || !near(p.x, p.y) || taken.has(p)) continue;
      const d = d2(p.x, p.y);
      if (d < propD) {
        propD = d;
        prop = p;
      }
    }
    return prop;
  }
}
