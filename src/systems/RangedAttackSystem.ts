import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

interface EnemyShot {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  damage: number;
}

interface EnemyCharge {
  enemy: Enemy;
  line: Phaser.GameObjects.Line;
  fireAt: number;
  targetX: number;
  targetY: number;
}

const TELEGRAPH_MS = 450;
const HIT_RADIUS = 13;

export class RangedAttackSystem {
  private readonly nextShotAt = new Map<Enemy, number>();
  private readonly charges = new Map<Enemy, EnemyCharge>();
  private readonly shots: EnemyShot[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Character,
    private readonly world: { width: number; height: number },
  ) {}

  update(now: number, delta: number, enemies: Enemy[]): void {
    const active = new Set(enemies.filter((enemy) => enemy.active && !enemy.dying && enemy.kind.rangedAttack));

    for (const enemy of this.nextShotAt.keys()) {
      if (!active.has(enemy)) this.nextShotAt.delete(enemy);
    }
    for (const [enemy, charge] of this.charges) {
      if (!active.has(enemy)) {
        charge.line.destroy();
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
      const line = this.scene.add.line(0, 0, enemy.x, enemy.y - 8, targetX, targetY, 0xff6b4a, 0.8);
      line.setOrigin(0, 0);
      line.setLineWidth(2, 1);
      line.setDepth(enemy.y + 1);
      this.charges.set(enemy, { enemy, line, fireAt: now + TELEGRAPH_MS, targetX, targetY });
    }

    for (const [enemy, charge] of this.charges) {
      charge.line.setTo(enemy.x, enemy.y - 8, charge.targetX, charge.targetY);
      charge.line.setAlpha(0.5 + Math.sin(now / 45) * 0.35);

      if (now < charge.fireAt) continue;

      const attack = enemy.kind.rangedAttack;
      if (!attack) {
        charge.line.destroy();
        this.charges.delete(enemy);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y - 8, charge.targetX, charge.targetY);
      const sprite = this.scene.add.circle(enemy.x, enemy.y - 8, 4, 0xff8a36);
      sprite.setStrokeStyle(2, 0xffd7a8);
      sprite.setDepth(enemy.y + 1);
      this.shots.push({
        sprite,
        velocityX: Math.cos(angle) * attack.projectileSpeed,
        velocityY: Math.sin(angle) * attack.projectileSpeed,
        damage: attack.damage,
      });

      charge.line.destroy();
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
        shot.sprite.x < 0 ||
        shot.sprite.y < 0 ||
        shot.sprite.x > this.world.width ||
        shot.sprite.y > this.world.height
      ) {
        shot.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const shot of this.shots) shot.sprite.destroy();
    for (const charge of this.charges.values()) charge.line.destroy();
    this.shots.length = 0;
    this.charges.clear();
    this.nextShotAt.clear();
  }
}
