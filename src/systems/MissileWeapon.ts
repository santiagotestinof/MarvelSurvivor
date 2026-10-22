import Phaser from 'phaser';
import { MISSILES } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import { HomingMissile } from '../entities/HomingMissile';
import type { Enemy } from '../entities/Enemy';
import type { PlayerStats } from '../progression/PlayerStats';

/**
 * Minimisiles: cada `MISSILES.cooldownMs` lanza una ráfaga de `level` misiles hacia los enemigos
 * más cercanos. Al pegar explotan y dañan también a los que estén alrededor.
 * Arranca bloqueada (nivel 0); la mejora "Minimisiles" la desbloquea y la sube de nivel.
 */
export class MissileWeapon {
  level = 0;

  private readonly missiles: Phaser.Physics.Arcade.Group;
  private lastFiredAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
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

  levelUp(): void {
    this.level = Math.min(MISSILES.maxLevel, this.level + 1);
  }

  update(now: number, deltaMs: number): void {
    for (const missile of this.missiles.getChildren() as HomingMissile[]) {
      if (!missile.active) continue;
      if (now >= missile.expiresAt) this.explode(missile, null);
      else missile.steer(deltaMs, () => this.nearestEnemies(missile.x, missile.y, 1)[0] ?? null);
    }

    if (this.level === 0 || now - this.lastFiredAt < MISSILES.cooldownMs * this.stats.cooldownMult) return;
    const targets = this.nearestEnemies(this.owner.x, this.owner.y, this.level);
    if (targets.length === 0) return;

    this.lastFiredAt = now;
    const originX = this.owner.x;
    const originY = this.owner.y - 14;
    for (let i = 0; i < this.level; i++) {
      const target = targets[i % targets.length];
      // Salen abiertos en abanico hacia arriba y después giran hacia su objetivo.
      const spread = this.level === 1 ? 0 : (i / (this.level - 1) - 0.5) * 1.6;
      const heading = -Math.PI / 2 + spread;
      const missile = new HomingMissile(
        this.scene,
        originX,
        originY,
        heading,
        target,
        MISSILES.speed,
        Phaser.Math.DegToRad(MISSILES.turnRateDeg),
        now + MISSILES.lifetimeMs,
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

    const damage = MISSILES.damage * this.stats.damageMult;
    const splashSq = MISSILES.splashRadius ** 2;
    hit?.takeDamage(damage);
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy === hit || !enemy.active || enemy.dying) continue;
      if ((enemy.x - x) ** 2 + (enemy.y - 6 - y) ** 2 <= splashSq) enemy.takeDamage(damage * MISSILES.splashDamageRatio);
    }

    const blast = this.scene.add.circle(x, y, MISSILES.splashRadius, 0xffa53a, 0.55).setDepth(999_999).setScale(0.3);
    this.scene.tweens.add({ targets: blast, scale: 1, alpha: 0, duration: 220, onComplete: () => blast.destroy() });
  }
}
