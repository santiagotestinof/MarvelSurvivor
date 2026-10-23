import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

interface EnemyShot {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  damage: number;
}

export class RangedAttackSystem {
  private readonly nextShotAt = new Map<Enemy, number>();
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

    for (const enemy of active) {
      const attack = enemy.kind.rangedAttack;
      if (!attack) continue;

      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y - 8);
      if (distance > attack.range) continue;

      const nextShot = this.nextShotAt.get(enemy);
      if (nextShot === undefined) {
        this.nextShotAt.set(enemy, now + attack.cooldownMs * 0.5);
        continue;
      }
      if (now < nextShot) continue;

      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y - 8, this.player.x, this.player.y - 8);
      const sprite = this.scene.add.circle(enemy.x, enemy.y - 8, 4, 0xff8a36);
      sprite.setStrokeStyle(2, 0xffd7a8);
      sprite.setDepth(enemy.y + 1);

      this.shots.push({
        sprite,
        velocityX: Math.cos(angle) * attack.projectileSpeed,
        velocityY: Math.sin(angle) * attack.projectileSpeed,
        damage: attack.damage,
      });
      this.nextShotAt.set(enemy, now + attack.cooldownMs);
    }

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.sprite.x += shot.velocityX * (delta / 1000);
      shot.sprite.y += shot.velocityY * (delta / 1000);

      if (Phaser.Math.Distance.Between(shot.sprite.x, shot.sprite.y, this.player.x, this.player.y - 8) <= 16) {
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
    this.shots.length = 0;
    this.nextShotAt.clear();
  }
}
