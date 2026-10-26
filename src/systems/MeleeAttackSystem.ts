import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

/** Distancia (al cuerpo del jugador) a la que un enemigo cuenta como "tocándolo". */
const CONTACT_RANGE = 16;
/** Mientras un enemigo lo toca, le hace daño cada tanto. No hay inmunidad: varios enemigos pegan a la vez. */
const CONTACT_TICK_MS = 500;

/**
 * Daño por contacto: los enemigos no "atacan", solo lastiman al jugador cuando lo tocan.
 * Cada enemigo tiene su propio ritmo de daño; el jugador no queda inmune después de un golpe.
 */
export class MeleeAttackSystem {
  private readonly nextHitAt = new Map<Enemy, number>();

  constructor(
    private readonly player: Character,
    private readonly isPlayerUntargetable: () => boolean,
  ) {}

  update(now: number, enemies: Enemy[]): void {
    const active = new Set(enemies.filter(
      (enemy) => enemy.active && !enemy.dying && !enemy.harmless && !enemy.frozen &&
        !enemy.kind.rangedAttack && enemy.kind.id !== 'overlord',
    ));
    for (const enemy of this.nextHitAt.keys()) {
      if (!active.has(enemy)) this.nextHitAt.delete(enemy);
    }
    if (this.isPlayerUntargetable()) return;

    for (const enemy of active) {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y - 8);
      if (distance > CONTACT_RANGE) continue;
      if (now < (this.nextHitAt.get(enemy) ?? 0)) continue;
      this.player.takeDamage(enemy.meleeDamage);
      this.nextHitAt.set(enemy, now + CONTACT_TICK_MS);
    }
  }

  destroy(): void {
    this.nextHitAt.clear();
  }
}
