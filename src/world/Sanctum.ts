import type Phaser from 'phaser';

export const SANCTUM = 'sanctum';
const SCALE = 0.875;
const BASE_CENTER = 92;
const BOTTOM = 238;

/** PNG original 192×256, centrado en la base del Sanctum anterior. */
export function placeSanctum(scene: Phaser.Scene, x: number, baseY: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  const centerX = x + 72 * 1.2;
  scene.textures.get(SANCTUM).setFilter(0); // NEAREST
  scene.add.image(centerX, baseY, SANCTUM).setOrigin(BASE_CENTER / 192, BOTTOM / 256)
    .setScale(SCALE).setDepth(baseY).setName('manhattan-sanctum');
  // La base incluye la escalinata, sin extender la colisión hasta el techo.
  const strips = [
    [25, 208, 136, 15], [25, 223, 135, 2], [24, 225, 132, 2],
    [24, 227, 130, 2], [24, 229, 127, 2], [24, 231, 124, 2],
    [39, 233, 105, 1], [57, 234, 86, 2], [57, 236, 83, 1], [89, 237, 10, 1],
  ];
  for (const [left, top, width, height] of strips) {
    obstacle(centerX + (left + width / 2 - BASE_CENTER) * SCALE,
      baseY + (top + height / 2 - BOTTOM) * SCALE, width * SCALE, height * SCALE);
  }
}
