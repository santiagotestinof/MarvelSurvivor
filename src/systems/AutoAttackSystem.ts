import Phaser from 'phaser';
import type { AttackDefinition } from '../characters/CharacterDefinition';
import { BASIC_ATTACK_LIMITS } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import type { PlayerStats } from '../progression/PlayerStats';

/** Dispara automáticamente al enemigo más cercano dentro del alcance de puntería. */
export class AutoAttackSystem {
  readonly projectiles: Phaser.Physics.Arcade.Group;
  private lastShotAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly attack: AttackDefinition,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
  ) {
    this.projectiles = scene.physics.add.group({ allowGravity: false });
  }

  update(now: number): void {
    this.removeExpiredProjectiles();
    if (now - this.lastShotAt < this.attack.cooldownMs * this.stats.cooldownMult) return;

    const target = this.findNearestEnemy();
    if (!target) return;

    this.fireAt(target);
    this.lastShotAt = now;
  }

  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let nearestSq = (this.attack.aimRange * this.stats.rangeMult) ** 2;

    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (!enemy.active || enemy.dying) continue;
      const dx = enemy.x - this.owner.x;
      const dy = enemy.y - this.owner.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestSq) {
        nearestSq = distSq;
        nearest = enemy;
      }
    }
    return nearest;
  }

  /** Dispara `projectileCount` disparos en abanico, centrados en la dirección del objetivo. */
  private fireAt(target: Enemy): void {
    const { stats } = this;
    const originX = this.owner.x;
    const originY = this.owner.y - 14; // a la altura del pecho
    const aim = Math.atan2(target.y - 8 - originY, target.x - originX);
    const speed = this.attack.projectileSpeed * stats.projectileSpeedMult;
    const count = stats.projectileCount;

    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * BASIC_ATTACK_LIMITS.spread;
      const critical = Math.random() < stats.critChance;
      const damage = this.attack.damage * stats.damageMult * (critical ? stats.critMult : 1);
      const projectile = new Projectile(
        this.scene,
        originX,
        originY,
        this.attack.projectileTexture,
        damage,
        this.attack.maxDistance * stats.rangeMult,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        { pierce: stats.pierce, critical },
      );
      this.projectiles.add(projectile);
      // `group.add` reinicia la velocidad del cuerpo: se vuelve a aplicar.
      projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  private removeExpiredProjectiles(): void {
    for (const child of this.projectiles.getChildren() as Projectile[]) {
      if (child.hasExpired()) child.destroy();
    }
  }
}
