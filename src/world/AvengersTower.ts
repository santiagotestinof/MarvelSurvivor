import type Phaser from 'phaser';

export const AVENGERS_TOWER = 'avengers-tower';
const SCALE = 0.875;
const BASE_CENTER = 92;
const BOTTOM = 239;

/** PNG original 192×256; conserva el centro de la base de la torre anterior. */
export function placeAvengersTower(scene: Phaser.Scene, x: number, baseY: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  const centerX = x + 60;
  scene.textures.get(AVENGERS_TOWER).setFilter(0); // NEAREST
  scene.add.image(centerX, baseY, AVENGERS_TOWER).setOrigin(BASE_CENTER / 192, BOTTOM / 256)
    .setScale(SCALE).setDepth(baseY).setName('manhattan-avengers-tower');
  // Contorno inferior medido en el PNG: ni la fachada ni el voladizo son obstáculos.
  const strips = [
    [47, 208, 89, 4], [46, 212, 92, 8], [47, 220, 91, 2],
    [51, 222, 84, 2], [53, 224, 81, 2], [55, 226, 77, 2],
    [57, 228, 72, 2], [60, 230, 69, 2], [62, 232, 65, 2],
    [64, 234, 61, 2], [72, 236, 20, 1], [79, 237, 13, 2],
  ];
  for (const [left, top, width, height] of strips) {
    obstacle(centerX + (left + width / 2 - BASE_CENTER) * SCALE,
      baseY + (top + height / 2 - BOTTOM) * SCALE, width * SCALE, height * SCALE);
  }
}
