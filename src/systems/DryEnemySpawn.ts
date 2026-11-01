import type { EnemyKind } from '../enemies/enemyKinds';
import type { WorldRect } from '../world/BossArena';

interface Point { x: number; y: number }

/** Reubica sólo las apariciones que pisan agua, considerando escala, origen y cuerpo. */
export function dryEnemySpawn(kind: EnemyKind, x: number, y: number, world: WorldRect,
  water: readonly WorldRect[], view: WorldRect): Point {
  const scale = kind.scale ?? 1;
  const offsetX = (kind.body.offsetX - kind.frame.width * kind.origin.x) * scale;
  const offsetY = (kind.body.offsetY - kind.frame.height * kind.origin.y) * scale;
  const width = kind.body.width * scale;
  const height = kind.body.height * scale;
  const dry = (px: number, py: number): boolean => !water.some((rect) =>
    px + offsetX < rect.x + rect.width && px + offsetX + width > rect.x &&
    py + offsetY < rect.y + rect.height && py + offsetY + height > rect.y);
  if (dry(x, y)) return { x, y };

  const insideWorld = (px: number, py: number): boolean => px + offsetX >= world.x &&
    py + offsetY >= world.y && px + offsetX + width <= world.x + world.width &&
    py + offsetY + height <= world.y + world.height;
  const offscreen = (px: number, py: number): boolean => px + offsetX + width <= view.x ||
    px + offsetX >= view.x + view.width || py + offsetY + height <= view.y ||
    py + offsetY >= view.y + view.height;
  const outward = Math.atan2(y - view.y - view.height / 2, x - view.x - view.width / 2);
  let fallback: Point | undefined;
  for (let radius = 16; radius <= 384; radius += 16) {
    for (let step = 0; step < 48; step++) {
      const angle = outward + step * Math.PI / 24;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (!insideWorld(px, py) || !dry(px, py)) continue;
      fallback ??= { x: px, y: py };
      if (offscreen(px, py)) return { x: px, y: py };
    }
  }
  if (fallback) return fallback;
  // Seguridad para mapas futuros: nunca aceptar agua si no hay sitio junto al lago.
  for (let py = world.y + height - offsetY; py < world.y + world.height - height; py += 32) {
    for (let px = world.x + width - offsetX; px < world.x + world.width - width; px += 32) {
      if (insideWorld(px, py) && dry(px, py)) return { x: px, y: py };
    }
  }
  throw new Error('No hay suelo seco disponible para generar el enemigo.');
}
