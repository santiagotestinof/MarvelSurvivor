import Phaser from 'phaser';

export const MANHATTAN_ASPHALT = 'manhattan-asphalt';
const SIZE = 32;
const CHUNK = 256;
const TEXTURE_INTENSITY = 0.65;
const CHARCOAL = [45, 47, 49] as const;

/** Sólo el fondo plano del asfalto: no incluye marcas, cordones ni pavimento peatonal. */
export function asphaltPixelMask(source: Uint8ClampedArray): Uint8Array {
  const mask = new Uint8Array(128 * 128);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (source[p] === 55 && source[p + 1] === 54 && source[p + 2] === 61 && source[p + 3] === 255) mask[i] = 1;
  }
  return mask;
}

/** PNG original a escala 1:1, con fase global para no cortar la textura entre tiles o bloques. */
export function drawManhattanAsphalt(scene: Phaser.Scene, data: number[][], original: HTMLCanvasElement): void {
  const originalCtx = original.getContext('2d');
  if (!originalCtx) throw new Error('No se pudo leer la superficie de las calles.');
  const mask = asphaltPixelMask(originalCtx.getImageData(0, 0, 128, 128).data);
  const source = scene.textures.get(MANHATTAN_ASPHALT).getSourceImage() as HTMLImageElement;
  if (source.width !== 128 || source.height !== 128) throw new Error('El asfalto debe medir 128×128.');
  const sample = document.createElement('canvas');
  sample.width = sample.height = 128;
  const ctx = sample.getContext('2d');
  if (!ctx) throw new Error('No se pudo leer el PNG del asfalto.');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  const asphalt = ctx.getImageData(0, 0, 128, 128).data;
  // 65 % de textura + 35 % de gris carbón: baja el contraste sin desenfocar los píxeles.
  for (let i = 0; i < asphalt.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      asphalt[i + c] = Math.round(asphalt[i + c] * TEXTURE_INTENSITY + CHARCOAL[c] * (1 - TEXTURE_INTENSITY));
    }
  }
  const chunks = new Map<string, { x: number; y: number; texture: Phaser.Textures.CanvasTexture; pixels: ImageData }>();
  const cached = new Set<string>();
  for (let row = 0; row < data.length; row++) for (let col = 0; col < data[row].length; col++) {
    const tile = data[row][col];
    if (tile < 0 || tile === 12) continue;
    const cx = Math.floor(col * SIZE / CHUNK) * CHUNK;
    const cy = Math.floor(row * SIZE / CHUNK) * CHUNK;
    const key = `manhattan-asphalt-muted-${cx}-${cy}`;
    if (cached.has(key)) continue;
    if (!chunks.has(key) && scene.textures.exists(key)) {
      scene.add.image(cx, cy, key).setOrigin(0).setDepth(-999.2);
      cached.add(key);
      continue;
    }
    let chunk = chunks.get(key);
    if (!chunk) {
      const texture = scene.textures.createCanvas(key, CHUNK, CHUNK);
      if (!texture) throw new Error('No se pudo preparar un tramo de asfalto.');
      chunk = { x: cx, y: cy, texture, pixels: texture.context.createImageData(CHUNK, CHUNK) };
      chunks.set(key, chunk);
    }
    const tx = tile % 4 * SIZE;
    const ty = Math.floor(tile / 4) * SIZE;
    for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
      if (!mask[(ty + py) * 128 + tx + px]) continue;
      const x = col * SIZE + px;
      const y = row * SIZE + py;
      const target = ((y - cy) * CHUNK + x - cx) * 4;
      const s = ((y % 128) * 128 + x % 128) * 4;
      for (let c = 0; c < 4; c++) chunk.pixels.data[target + c] = asphalt[s + c];
    }
  }
  for (const chunk of chunks.values()) {
    chunk.texture.context.putImageData(chunk.pixels, 0, 0);
    chunk.texture.refresh();
    chunk.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    // Debajo de las veredas (-999.125), las marcas viales (-999) y el mobiliario urbano.
    scene.add.image(chunk.x, chunk.y, chunk.texture.key).setOrigin(0).setDepth(-999.2);
  }
}
