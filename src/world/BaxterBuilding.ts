import type Phaser from 'phaser';

export const BAXTER_BUILDING = 'baxter-building';
const SCALE = 0.875;
const LEFT = 25;
const BOTTOM = 239;

/** PNG original 192×256, misma orientación y anclaje al suelo que el Baxter anterior. */
export function placeBaxterBuilding(scene: Phaser.Scene, x: number, baseY: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  scene.textures.get(BAXTER_BUILDING).setFilter(0); // NEAREST
  scene.add.image(x, baseY, BAXTER_BUILDING).setOrigin(LEFT / 192, BOTTOM / 256)
    .setScale(SCALE).setDepth(baseY).setName('manhattan-baxter-building');
  // Franjas de la base ensanchada: la altura de la torre no forma parte del cuerpo físico.
  const strips = [
    [28, 208, 127, 4], [27, 212, 125, 5], [26, 217, 126, 5],
    [25, 222, 127, 6], [26, 228, 127, 2], [28, 230, 123, 2],
    [30, 232, 120, 2], [34, 234, 114, 2], [123, 236, 19, 1],
    [124, 237, 16, 1], [125, 238, 13, 1],
  ];
  for (const [left, top, width, height] of strips) {
    obstacle(x + (left + width / 2 - LEFT) * SCALE,
      baseY + (top + height / 2 - BOTTOM) * SCALE, width * SCALE, height * SCALE);
  }
}
