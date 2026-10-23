import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Enemy } from '../entities/Enemy';

/** Enemigos vivos del grupo. */
export function activeEnemies(group: Phaser.Physics.Arcade.Group): Enemy[] {
  return (group.getChildren() as Enemy[]).filter((enemy) => enemy.active && !enemy.dying);
}

/** Daña a todo lo que esté a `radius` de (x, y): enemigos (con empuje opcional) y cajas/rocas. Devuelve cuántos enemigos tocó. */
export function damageArea(
  enemies: Phaser.Physics.Arcade.Group,
  props: Iterable<BreakableProp>,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knockback = 0,
): number {
  const radiusSq = radius * radius;
  let hits = 0;
  for (const enemy of activeEnemies(enemies)) {
    const dx = enemy.x - x;
    const dy = enemy.y - 6 - y;
    if (dx * dx + dy * dy > radiusSq) continue;
    enemy.takeDamage(damage);
    hits++;
    if (knockback > 0 && !enemy.dying && enemy.kind.id !== 'overlord') enemy.knockback(dx, dy, knockback, 140);
  }
  for (const prop of props) {
    if (prop.isBroken) continue;
    if ((prop.x - x) ** 2 + (prop.y - y) ** 2 <= radiusSq) prop.takeDamage(damage);
  }
  return hits;
}

/** Rayo de Thor cayendo en (x, y) con un destello del tamaño del área. */
export function drawThunder(scene: Phaser.Scene, x: number, y: number, radius: number, critical = false): void {
  const depth = 999_999;
  const bolt = scene.add.image(x, y + 6, TEXTURES.thunder).setOrigin(0.5, 1).setDepth(depth);
  const flash = scene.add.circle(x, y, radius, critical ? 0xffe272 : 0x6fd8ff, 0.45).setDepth(depth - 1);
  scene.tweens.add({
    targets: [bolt, flash],
    alpha: 0,
    duration: 220,
    onComplete: () => {
      bolt.destroy();
      flash.destroy();
    },
  });
}
