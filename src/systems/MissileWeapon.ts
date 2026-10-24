import Phaser from 'phaser';
import { FIRE, MISSILES } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import { FireZone } from '../entities/FireZone';
import { HomingMissile } from '../entities/HomingMissile';
import type { PlayerStats } from '../progression/PlayerStats';

/** Bono fijo de cada nivel de los Minimisiles (nv 1 = base). Se acumulan desde el nv 2. */
interface MissileBonus {
  amount?: number;
  /** Multiplica el tiempo entre ráfagas (menor = más seguido). */
  cooldown?: number;
  damage?: number;
  area?: number;
}

const MISSILE_TABLE: readonly MissileBonus[] = [
  {}, // nv 1: 1 misil
  { amount: 1 },
  { cooldown: 0.8 },
  { amount: 1 },
  { damage: 1.4, area: 1.2 },
];

/** Textos de la tarjeta al pasar a cada nivel (el nv 1 es la presentación del arma). */
export const MISSILE_LEVELS: readonly string[] = [
  '1 misil por ráfaga',
  '+1 misil por ráfaga',
  'Ráfagas más seguidas (−20 %)',
  '+1 misil por ráfaga',
  '+40 % de daño, +20 % de área de la explosión',
];

export type FireUpgrade = 'duration' | 'damage' | 'rate' | 'size';

/**
 * Minimisiles: cada `MISSILES.cooldownMs` lanza una ráfaga de misiles (cantidad y bonos fijos por nivel, `MISSILE_TABLE`) hacia los enemigos
 * más cercanos. Al pegar explotan y dañan también a los que estén alrededor.
 * Arranca bloqueada (nivel 0); la mejora "Minimisiles" la desbloquea y la sube de nivel.
 * Evolucionada (Misiles incendiarios), cada explosión deja un charco de fuego (`FIRE`).
 */
export class MissileWeapon {
  level = 0;
  evolved = false;
  /** Niveles de las mejoras de fuego (solo después de evolucionar). */
  readonly fireLevels: Record<FireUpgrade, number> = { duration: 0, damage: 0, rate: 0, size: 0 };

  private readonly missiles: Phaser.Physics.Arcade.Group;
  private fires: FireZone[] = [];
  private lastFiredAt = -Infinity;
  private now = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
    /** Daño de área a cajas y rocas cerca de una explosión. */
    private readonly splashProps: (x: number, y: number, radius: number, damage: number) => void,
  ) {
    this.missiles = scene.physics.add.group({ allowGravity: false });
    scene.physics.add.overlap(this.missiles, enemies, (m, e) => {
      const missile = m as HomingMissile;
      const enemy = e as Enemy;
      if (missile.active && !enemy.dying) this.explode(missile, enemy);
    });
  }

  get maxed(): boolean {
    return this.level >= MISSILES.maxLevel;
  }

  /** Suma de los bonos fijos de los niveles alcanzados. */
  private get bonus(): Required<MissileBonus> {
    const total = { amount: 0, cooldown: 1, damage: 1, area: 1 };
    for (let i = 1; i < this.level; i++) {
      const b = MISSILE_TABLE[i];
      total.amount += b.amount ?? 0;
      total.cooldown *= b.cooldown ?? 1;
      total.damage *= b.damage ?? 1;
      total.area *= b.area ?? 1;
    }
    return total;
  }

  levelUp(): void {
    this.level = Math.min(MISSILES.maxLevel, this.level + 1);
  }

  evolve(): void {
    this.evolved = true;
  }

  upgradeFire(kind: FireUpgrade): void {
    this.fireLevels[kind] = Math.min(FIRE.upgradeMaxLevel, this.fireLevels[kind] + 1);
  }

  // Valores actuales del fuego: cada nivel de mejora suma un porcentaje sobre la base.
  get fireDurationMs(): number {
    return FIRE.durationMs * (1 + 0.3 * this.fireLevels.duration) * this.stats.durationMult;
  }

  get fireDamage(): number {
    return FIRE.damage * (1 + 0.3 * this.fireLevels.damage) * this.stats.damageMult;
  }

  get fireTickMs(): number {
    return FIRE.tickMs * 0.82 ** this.fireLevels.rate;
  }

  get fireRadius(): number {
    return FIRE.radius * (1 + 0.2 * this.fireLevels.size) * this.stats.areaMult;
  }

  update(now: number, deltaMs: number): void {
    this.now = now;
    const enemies = this.enemies.getChildren() as Enemy[];
    for (const fire of this.fires) fire.update(now, enemies, this.fireDamage, this.fireTickMs);
    this.fires = this.fires.filter((fire) => !fire.expired);

    for (const missile of this.missiles.getChildren() as HomingMissile[]) {
      if (!missile.active) continue;
      if (now >= missile.expiresAt) this.explode(missile, null);
      else missile.steer(deltaMs, () => this.nearestEnemies(missile.x, missile.y, 1)[0] ?? null);
    }

    if (this.level === 0 || now - this.lastFiredAt < MISSILES.cooldownMs * this.bonus.cooldown * this.stats.cooldownMult) return;
    // Cantidad: el nivel del arma más los misiles extra de la mejora permanente.
    const count = 1 + this.bonus.amount + this.stats.amountBonus;
    const targets = this.nearestEnemies(this.owner.x, this.owner.y, count);
    if (targets.length === 0) return;

    this.lastFiredAt = now;
    const originX = this.owner.x;
    const originY = this.owner.y - 14;
    for (let i = 0; i < count; i++) {
      const target = targets[i % targets.length];
      // Salen abiertos en abanico hacia arriba y después giran hacia su objetivo.
      const spread = count === 1 ? 0 : (i / (count - 1) - 0.5) * 1.6;
      const heading = -Math.PI / 2 + spread;
      const missile = new HomingMissile(
        this.scene,
        originX,
        originY,
        heading,
        target,
        MISSILES.speed * this.stats.projectileSpeedMult,
        Phaser.Math.DegToRad(MISSILES.turnRateDeg),
        now + MISSILES.lifetimeMs * this.stats.durationMult,
      );
      this.missiles.add(missile);
      // `group.add` reinicia la velocidad del cuerpo: se vuelve a aplicar con el rumbo inicial.
      missile.steer(0, () => target);
    }
  }

  /** Hasta `count` enemigos distintos dentro del alcance, del más cercano al más lejano. */
  private nearestEnemies(x: number, y: number, count: number): Enemy[] {
    const rangeSq = (MISSILES.aimRange * this.stats.rangeMult) ** 2;
    return (this.enemies.getChildren() as Enemy[])
      .filter((e) => e.active && !e.dying)
      .map((enemy) => ({ enemy, d: (enemy.x - x) ** 2 + (enemy.y - y) ** 2 }))
      .filter(({ d }) => d <= rangeSq)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map(({ enemy }) => enemy);
  }

  /** Daño directo a `hit` (si pegó) y daño de área a los que estén cerca del punto de impacto. */
  private explode(missile: HomingMissile, hit: Enemy | null): void {
    const x = missile.x;
    const y = missile.y;
    missile.destroy();

    const damage = MISSILES.damage * this.bonus.damage * this.stats.damageMult;
    const splashRadius = MISSILES.splashRadius * this.bonus.area * this.stats.areaMult;
    const splashSq = splashRadius ** 2;
    hit?.takeDamage(damage);
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy === hit || !enemy.active || enemy.dying) continue;
      if ((enemy.x - x) ** 2 + (enemy.y - 6 - y) ** 2 <= splashSq) enemy.takeDamage(damage * MISSILES.splashDamageRatio);
    }

    this.splashProps(x, y, splashRadius, damage);

    if (this.evolved) {
      this.fires.push(new FireZone(this.scene, x, y + 6, this.fireRadius, this.now + this.fireDurationMs, this.now));
    }

    const blast = this.scene.add.circle(x, y, splashRadius, 0xffa53a, 0.55).setDepth(999_999).setScale(0.3);
    this.scene.tweens.add({ targets: blast, scale: 1, alpha: 0, duration: 220, onComplete: () => blast.destroy() });
  }
}
