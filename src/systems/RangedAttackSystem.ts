import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { WorldRect } from '../world/BossArena';

interface EnemyShot {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  damage: number;
}

interface EnemyCharge {
  enemy: Enemy;
  line: Phaser.GameObjects.Line;
  reticle: Phaser.GameObjects.Arc;
  startedAt: number;
  fireAt: number;
  targetX: number;
  targetY: number;
}

/** Se queda quieto durante 1 segundo marcando la trayectoria antes de disparar. */
const TELEGRAPH_MS = 1000;
const HIT_RADIUS = 13;

export class RangedAttackSystem {
  private readonly nextShotAt = new Map<Enemy, number>();
  private readonly charges = new Map<Enemy, EnemyCharge>();
  private readonly shots: EnemyShot[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Character,
    private readonly world: WorldRect,
  ) {}

  update(now: number, delta: number, enemies: Enemy[]): void {
    const active = new Set(enemies.filter((enemy) => enemy.active && !enemy.dying && !enemy.harmless && enemy.kind.rangedAttack));

    for (const enemy of this.nextShotAt.keys()) {
      if (!active.has(enemy)) this.nextShotAt.delete(enemy);
    }
    for (const [enemy, charge] of this.charges) {
      if (!active.has(enemy)) {
        charge.line.destroy();
        charge.reticle.destroy();
        this.charges.delete(enemy);
      }
    }

    for (const enemy of active) {
      const attack = enemy.kind.rangedAttack;
      if (!attack || this.charges.has(enemy)) continue;

      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y - 8);
      if (distance > attack.range) continue;

      const nextShot = this.nextShotAt.get(enemy);
      if (nextShot === undefined) {
        this.nextShotAt.set(enemy, now + attack.cooldownMs * 0.5);
        continue;
      }
      if (now < nextShot) continue;

      const targetX = this.player.x;
      const targetY = this.player.y - 8;
      // Clava al Chitauri en el lugar durante 1 segundo mirando hacia donde marcó el tiro.
      enemy.lockForShot(TELEGRAPH_MS, targetX, targetY);

      const line = this.scene.add.line(0, 0, enemy.x, enemy.y - 10, targetX, targetY, 0x38a8ff, 0.85);
      line.setOrigin(0, 0);
      line.setLineWidth(2, 1);
      line.setDepth(enemy.y + 1);

      const reticle = this.scene.add.circle(targetX, targetY, 9, 0x38a8ff, 0.18);
      reticle.setStrokeStyle(1.5, 0x9ce8ff, 0.9);
      reticle.setDepth(enemy.y + 1);

      this.charges.set(enemy, {
        enemy,
        line,
        reticle,
        startedAt: now,
        fireAt: now + TELEGRAPH_MS,
        targetX,
        targetY,
      });
    }

    for (const [enemy, charge] of this.charges) {
      const ratio = Phaser.Math.Clamp((now - charge.startedAt) / TELEGRAPH_MS, 0, 1);
      charge.line.setTo(enemy.x, enemy.y - 10, charge.targetX, charge.targetY);
      charge.line.setAlpha(0.45 + Math.sin(now / 40) * 0.35);
      charge.reticle.setScale(1.15 - ratio * 0.55);
      charge.reticle.setAlpha(0.4 + ratio * 0.55);

      if (now < charge.fireAt) continue;

      const attack = enemy.kind.rangedAttack;
      if (!attack) {
        charge.line.destroy();
        charge.reticle.destroy();
        this.charges.delete(enemy);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y - 10, charge.targetX, charge.targetY);
      const sprite = this.scene.add.circle(enemy.x, enemy.y - 10, 4, 0x38a8ff);
      sprite.setStrokeStyle(2, 0xd4f6ff);
      sprite.setDepth(enemy.y + 1);
      this.shots.push({
        sprite,
        velocityX: Math.cos(angle) * attack.projectileSpeed,
        velocityY: Math.sin(angle) * attack.projectileSpeed,
        damage: enemy.kind.id === 'sentinel' && now >= 10 * 60_000 ? attack.damage * 2 : attack.damage,
      });

      charge.line.destroy();
      charge.reticle.destroy();
      this.charges.delete(enemy);
      this.nextShotAt.set(enemy, now + attack.cooldownMs);
    }

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.sprite.x += shot.velocityX * (delta / 1000);
      shot.sprite.y += shot.velocityY * (delta / 1000);

      if (Phaser.Math.Distance.Between(shot.sprite.x, shot.sprite.y, this.player.x, this.player.y - 8) <= HIT_RADIUS) {
        this.player.takeDamage(shot.damage);
        shot.sprite.destroy();
        this.shots.splice(i, 1);
        continue;
      }

      if (
        shot.sprite.x < this.world.x ||
        shot.sprite.y < this.world.y ||
        shot.sprite.x > this.world.x + this.world.width ||
        shot.sprite.y > this.world.y + this.world.height
      ) {
        shot.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const shot of this.shots) shot.sprite.destroy();
    for (const charge of this.charges.values()) {
      charge.line.destroy();
      charge.reticle.destroy();
    }
    this.shots.length = 0;
    this.charges.clear();
    this.nextShotAt.clear();
  }
}
