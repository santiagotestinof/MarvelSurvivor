import type Phaser from 'phaser';
import type { CharacterDefinition } from '../characters/CharacterDefinition';

const IMPORTED_PORTRAITS = ['ironman', 'capitan', 'thor', 'strange', 'hulk', 'spiderman'];

/**
 * Textura del retrato de un héroe para los menús. Los héroes con diseño nuevo tienen su `<id>-menu`;
 * los demás usan el primer cuadro de su hoja de reposo, recortado a lo que se ve (se crea una vez).
 */
export function portraitKey(scene: Phaser.Scene, def: CharacterDefinition): string {
  if (IMPORTED_PORTRAITS.includes(def.id)) return `${def.id}-menu`;
  const key = `${def.id}-portrait`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(def.sheets.idle.textureKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const { width, height } = def.frame;
  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  const ctx = probe.getContext('2d');
  if (!ctx) return def.sheets.idle.textureKey;
  ctx.drawImage(source, 0, 0, width, height, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return def.sheets.idle.textureKey;
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')?.drawImage(probe, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  scene.textures.addCanvas(key, out);
  scene.textures.get(key).setFilter(0); // 0 = NEAREST: pixel art sin suavizar al agrandar
  return key;
}
