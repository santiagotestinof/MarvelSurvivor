import Phaser from 'phaser';
import { buildLakeWaterStrips, LAKE_SIZE, LAKE_SCALE, LAKE_ORIGIN, type LakeStrip } from './ParkLakeData';

export const PARK_LAKE = 'park-lake';
const collisionCache = new WeakMap<Phaser.Textures.Texture, LakeStrip[]>();

export function parkLakeCenters(centerX: number, rows: number[]): number[][] {
  return [[centerX - 330, rows[0] - 270], [centerX + 330, rows[2] + 270]];
}

/** Reserva anterior para mantener exactamente la distribución de árboles y plantas. No es física. */
export function lakePlacementBounds(centerX: number, rows: number[]): Phaser.Geom.Rectangle[] {
  const bounds: Phaser.Geom.Rectangle[] = [];
  for (const [x, y] of parkLakeCenters(centerX, rows)) {
    for (let dy = -96; dy < 96; dy += 8) {
      const half = Math.floor(136 * Math.sqrt(1 - ((dy + 4) / 96) ** 2) / 4) * 4;
      bounds.push(new Phaser.Geom.Rectangle(x - half, y + dy, half * 2, 8));
    }
  }
  return bounds;
}

export function placeParkLake(scene: Phaser.Scene, x: number, y: number,
  obstacle: (x: number, y: number, w: number, h: number) => unknown): void {
  const texture = scene.textures.get(PARK_LAKE);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  let strips = collisionCache.get(texture);
  if (!strips) {
    const source = texture.getSourceImage() as HTMLImageElement;
    if (source.width !== LAKE_SIZE || source.height !== LAKE_SIZE) throw new Error('El PNG del lago debe medir 256×256.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = LAKE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo leer el contorno del lago.');
    ctx.drawImage(source, 0, 0);
    strips = buildLakeWaterStrips(ctx.getImageData(0, 0, LAKE_SIZE, LAKE_SIZE).data);
    collisionCache.set(texture, strips);
  }
  scene.add.image(x, y, PARK_LAKE).setOrigin(LAKE_ORIGIN.x / LAKE_SIZE, LAKE_ORIGIN.y / LAKE_SIZE)
    .setScale(LAKE_SCALE).setDepth(-997.5).setName('central-park-lake');
  for (const strip of strips) {
    const collider = obstacle(x + (strip.left + strip.width / 2 - LAKE_ORIGIN.x) * LAKE_SCALE,
      y + (strip.top + strip.height / 2 - LAKE_ORIGIN.y) * LAKE_SCALE,
      strip.width * LAKE_SCALE, strip.height * LAKE_SCALE);
    if (collider instanceof Phaser.GameObjects.Rectangle) collider.setData('parkLakeWater', true);
  }
}
