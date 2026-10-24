import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

/** Ataque cuerpo a cuerpo: aviso breve, impacto único y enfriamiento entre golpes. */
interface PendingMeleeAttack {
  startedAt: number;
  impactAt: number;
  targetX: number;
  targetY: number;
  marker: Phaser.GameObjects.Arc;
}

const ATTACK_START_RANGE = 38;
const HIT_RANGE = 34;
const WINDUP_MS = 320;
const COOLDOWN_MS = 1250;

export class MeleeAttackSystem {
  private readonly nextAttackAt = new Map<Enemy, number>();
  private readonly pending = new Map<Enemy, PendingMeleeAttack>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Character,
    private readonly isPlayerUntargetable: () => boolean,
  ) {}

  update(now: number, enemies: Enemy[]): void {
    const active = new Set(enemies.filter(
      (enemy) => enemy.active && !enemy.dying && !enemy.harmless &&
        !enemy.kind.rangedAttack && enemy.kind.id !== 'overlord',
    ));

    for (const enemy of this.nextAttackAt.keys()) {
      if (!active.has(enemy)) this.nextAttackAt.delete(enemy);
    }
    for (const [enemy, attack] of this.pending) {
      if (!active.has(enemy)) {
        attack.marker.destroy();
        this.pending.delete(enemy);
      }
    }

    for (const enemy of active) {
      const attack = this.pending.get(enemy);
      if (attack) {
        const progress = Phaser.Math.Clamp((now - attack.startedAt) / WINDUP_MS, 0, 1);
        attack.marker.setAlpha(0.25 + Math.sin(now / 45) * 0.2 + progress * 0.35);
        attack.marker.setScale(0.75 + progress * 0.35);
        if (now < attack.impactAt) continue;

        const distance = Phaser.Math.Distance.Between(
          enemy.x, enemy.y, this.player.x, this.player.y - 8,
        );
        if (!this.isPlayerUntargetable() && distance <= HIT_RANGE) {
          this.player.takeDamage(enemy.contactDamage);
        }
        attack.marker.destroy();
        this.pending.delete(enemy);
        this.nextAttackAt.set(enemy, now + COOLDOWN_MS);
        continue;
      }

      if (now < (this.nextAttackAt.get(enemy) ?? 0)) continue;
      const distance = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, this.player.x, this.player.y - 8,
      );
      if (distance > ATTACK_START_RANGE) continue;

      enemy.lockForShot(WINDUP_MS, this.player.x, this.player.y - 8);
      const marker = this.scene.add.circle(this.player.x, this.player.y - 8, HIT_RANGE, 0xff3b30, 0.12)
        .setStrokeStyle(2, 0xff6a52, 0.9)
        .setDepth(this.player.y + 2);
      this.pending.set(enemy, {
        startedAt: now,
        impactAt: now + WINDUP_MS,
        targetX: this.player.x,
        targetY: this.player.y - 8,
        marker,
      });
    }
  }

  destroy(): void {
    for (const attack of this.pending.values()) attack.marker.destroy();
    this.pending.clear();
    this.nextAttackAt.clear();
  }
}
