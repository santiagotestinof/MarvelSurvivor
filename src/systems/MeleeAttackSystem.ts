import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

/** Ataque cuerpo a cuerpo con tiempo de preparación, impacto único y enfriamiento. */
interface PendingMeleeAttack {
  impactAt: number;
}

const ATTACK_START_RANGE = 38;
const HIT_RANGE = 34;
const WINDUP_MS = 320;
const COOLDOWN_MS = 1250;

export class MeleeAttackSystem {
  private readonly nextAttackAt = new Map<Enemy, number>();
  private readonly pending = new Map<Enemy, PendingMeleeAttack>();

  constructor(
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
    for (const enemy of this.pending.keys()) {
      if (!active.has(enemy)) {
        this.pending.delete(enemy);
      }
    }

    for (const enemy of active) {
      const attack = this.pending.get(enemy);
      if (attack) {
        if (now < attack.impactAt) continue;

        const distance = Phaser.Math.Distance.Between(
          enemy.x, enemy.y, this.player.x, this.player.y - 8,
        );
        if (!this.isPlayerUntargetable() && distance <= HIT_RANGE) {
          this.player.takeDamage(enemy.meleeDamage);
        }
        this.pending.delete(enemy);
        this.nextAttackAt.set(enemy, now + COOLDOWN_MS);
        continue;
      }

      if (now < (this.nextAttackAt.get(enemy) ?? 0)) continue;
      const distance = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, this.player.x, this.player.y - 8,
      );
      if (distance > ATTACK_START_RANGE) continue;

      this.pending.set(enemy, {
        impactAt: now + WINDUP_MS,
      });
    }
  }

  destroy(): void {
    this.pending.clear();
    this.nextAttackAt.clear();
  }
}
