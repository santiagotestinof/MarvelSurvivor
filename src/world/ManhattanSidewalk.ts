import Phaser from 'phaser';
import { buildSidewalkPatterns, sidewalkSlab } from './SidewalkPattern';

export const MANHATTAN_SIDEWALK = 'manhattan-sidewalk';
export const MANHATTAN_SIDEWALK_WORN = 'manhattan-sidewalk-worn';
const SIZE = 32;
const CHUNK = 256;

/** Máscara del pavimento original: conserva el asfalto y la franja junto al cordón. */
export function sidewalkPixelMask(source: Uint8ClampedArray): Uint8Array {
  const palette = new Set<number>();
  const rgb = (i: number): number => source[i] << 16 | source[i + 1] << 8 | source[i + 2];
  // Pieza 12 del Wang urbano: vereda completa, con sus juntas y grietas antiguas.
  for (let y = 96; y < 128; y++) for (let x = 0; x < SIZE; x++) palette.add(rgb((y * 128 + x) * 4));
  const mask = new Uint8Array(128 * 128);
  for (let tile = 0; tile < 16; tile++) {
    const tx = tile % 4 * SIZE;
    const ty = Math.floor(tile / 4) * SIZE;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const pixel = (ty + y) * 128 + tx + x;
      if (!palette.has(rgb(pixel * 4))) continue;
      let nearAsphalt = false;
      if (tile !== 12) {
        for (let dy = -2; dy <= 2 && !nearAsphalt; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (x + dx < 0 || x + dx >= SIZE || y + dy < 0 || y + dy >= SIZE) continue;
          const i = ((ty + y + dy) * 128 + tx + x + dx) * 4;
          if (source[i + 2] > source[i]) { nearAsphalt = true; break; }
        }
      }
      if (!nearAsphalt) mask[pixel] = 1;
    }
  }
  return mask;
}

/** Losas de 32 px sobre la máscara existente: no cambia la geometría ni las colisiones. */
export function drawManhattanSidewalk(scene: Phaser.Scene, data: number[][],
  original: HTMLCanvasElement): void {
  const originalCtx = original.getContext('2d');
  if (!originalCtx) throw new Error('No se pudo leer el pavimento urbano.');
  const mask = sidewalkPixelMask(originalCtx.getImageData(0, 0, 128, 128).data);
  const readPixels = (key: string, size: number): Uint8ClampedArray => {
    const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    if (source.width !== size || source.height !== size) throw new Error(`La textura ${key} debe medir ${size}×${size}.`);
    const sample = document.createElement('canvas');
    sample.width = sample.height = size;
    const ctx = sample.getContext('2d');
    if (!ctx) throw new Error('No se pudo leer el PNG de la vereda.');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, size, size).data;
  };
  const patterns = buildSidewalkPatterns(readPixels(MANHATTAN_SIDEWALK, 128), readPixels(MANHATTAN_SIDEWALK_WORN, 96));
  const chunks = new Map<string, { x: number; y: number; texture: Phaser.Textures.CanvasTexture; pixels: ImageData }>();
  const cached = new Set<string>();
  for (let row = 0; row < data.length; row++) for (let col = 0; col < data[row].length; col++) {
    const tile = data[row][col];
    if (tile < 0 || tile === 6) continue;
    const cx = Math.floor(col * SIZE / CHUNK) * CHUNK;
    const cy = Math.floor(row * SIZE / CHUNK) * CHUNK;
    const key = `manhattan-sidewalk-grey-32-${cx}-${cy}`;
    if (cached.has(key)) continue;
    if (!chunks.has(key) && scene.textures.exists(key)) {
      scene.add.image(cx, cy, key).setOrigin(0).setDepth(-999.125);
      cached.add(key);
      continue;
    }
    let chunk = chunks.get(key);
    if (!chunk) {
      const texture = scene.textures.createCanvas(key, CHUNK, CHUNK);
      if (!texture) throw new Error('No se pudo preparar un tramo de vereda.');
      chunk = { x: cx, y: cy, texture, pixels: texture.context.createImageData(CHUNK, CHUNK) };
      chunks.set(key, chunk);
    }
    const tx = tile % 4 * SIZE;
    const ty = Math.floor(tile / 4) * SIZE;
    const pavement = sidewalkSlab(patterns, col, row);
    for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
      if (!mask[(ty + py) * 128 + tx + px]) continue;
      const x = col * SIZE + px;
      const y = row * SIZE + py;
      const target = ((y - cy) * CHUNK + x - cx) * 4;
      const s = (py * SIZE + px) * 4;
      for (let channel = 0; channel < 4; channel++) chunk.pixels.data[target + channel] = pavement[s + channel];
    }
  }
  for (const chunk of chunks.values()) {
    chunk.texture.context.putImageData(chunk.pixels, 0, 0);
    chunk.texture.refresh();
    chunk.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.add.image(chunk.x, chunk.y, chunk.texture.key).setOrigin(0).setDepth(-999.125);
  }
}
