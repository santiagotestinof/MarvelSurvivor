import Phaser from 'phaser';
import { FIRE, MISSILES } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import { FireZone } from '../entities/FireZone';
import { HomingMissile } from '../entities/HomingMissile';
import type { PlayerStats } from '../progression/PlayerStats';

export type FireUpgrade = 'duration' | 'damage' | 'rate' | 'size';

/**
 * Minimisiles (arma principal de Iron Man): cada `MISSILES.cooldownMs` lanza una ráfaga de misiles (1 más los de Disparo múltiple y Cantidad) hacia los enemigos
 * más cercanos. Al pegar explotan y dañan también a los que estén alrededor.
 * Arranca bloqueada (nivel 0) y `unlock()` la activa (Iron Man la tiene desde el principio).
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
    /** Cajas y rocas: si no hay enemigos cerca, los misiles les apuntan (para sacar oro). */
    private readonly props: () => Iterable<{ x: number; y: number; isBroken: boolean }>,
  ) {
    this.missiles = scene.physics.add.group({ allowGravity: false });
    scene.physics.add.overlap(this.missiles, enemies, (m, e) => {
      const missile = m as HomingMissile;
      const enemy = e as Enemy;
      if (missile.active && !enemy.dying) this.explode(missile, enemy);
    });
  }

  /** Los minimisiles son el arma principal: se activan desde el principio (Iron Man). */
  unlock(): void {
    this.level = 1;
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
      else if (missile.aimPoint && !missile.target && Phaser.Math.Distance.Between(missile.x, missile.y, missile.aimPoint.x, missile.aimPoint.y) < 8) this.explode(missile, null);
      else missile.steer(deltaMs, () => this.nearestEnemies(missile.x, missile.y, 1)[0] ?? null);
    }

    if (this.level === 0 || now - this.lastFiredAt < MISSILES.cooldownMs * this.stats.cooldownMult) return;
    // Cantidad: 1 misil más los de "Disparo múltiple" y de la pasiva Cantidad.
    const count = this.stats.projectileCount;
    const targets = this.nearestEnemies(this.owner.x, this.owner.y, count);
    const prop = targets.length === 0 ? this.nearestProp() : null;
    if (targets.length === 0 && !prop) return;

    this.lastFiredAt = now;
    const originX = this.owner.x;
    const originY = this.owner.y - 14;
    for (let i = 0; i < count; i++) {
      const target = targets.length > 0 ? targets[i % targets.length] : null;
      // Salen abiertos en abanico hacia arriba y después giran hacia su objetivo.
      const spread = count === 1 ? 0 : (i / (count - 1) - 0.5) * 1.6;
      const heading = prop ? Math.atan2(prop.y - originY, prop.x - originX) + spread * 0.3 : -Math.PI / 2 + spread;
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
      if (prop) missile.aimPoint = { x: prop.x, y: prop.y };
      this.missiles.add(missile);
      // `group.add` reinicia la velocidad del cuerpo: se vuelve a aplicar con el rumbo inicial.
      missile.steer(0, () => target);
    }
  }

  private nearestProp(): { x: number; y: number } | null {
    const rangeSq = (MISSILES.aimRange * this.stats.rangeMult) ** 2;
    let best: { x: number; y: number } | null = null;
    let bestSq = rangeSq;
    for (const prop of this.props()) {
      if (prop.isBroken) continue;
      const d = (prop.x - this.owner.x) ** 2 + (prop.y - this.owner.y) ** 2;
      if (d < bestSq) {
        bestSq = d;
        best = { x: prop.x, y: prop.y };
      }
    }
    return best;
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

    const critical = Math.random() < this.stats.critChance;
    const damage = MISSILES.damage * this.stats.damageMult * (critical ? this.stats.critMult : 1);
    const splashRadius = MISSILES.splashRadius * this.stats.areaMult * this.stats.mainAreaMult;
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
