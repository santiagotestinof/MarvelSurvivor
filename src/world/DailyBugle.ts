import type Phaser from 'phaser';

export const DAILY_BUGLE = 'daily-bugle';
const SCALE = 0.875;
const LEFT = 21;
const BOTTOM = 239;

/** PNG original 192×256: anclado al borde izquierdo y al suelo del monumento anterior. */
export function placeDailyBugle(scene: Phaser.Scene, x: number, baseY: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  scene.textures.get(DAILY_BUGLE).setFilter(0); // Phaser.Textures.FilterMode.NEAREST
  scene.add.image(x, baseY, DAILY_BUGLE).setOrigin(LEFT / 192, BOTTOM / 256)
    .setScale(SCALE).setDepth(baseY).setName('manhattan-daily-bugle');
  // Contorno inferior medido sobre el alfa. La fachada y el cartel no bloquean movimiento.
  const strips = [
    [23, 208, 132, 14], [23, 222, 131, 2], [21, 224, 129, 2],
    [21, 226, 127, 2], [21, 228, 124, 2], [21, 230, 121, 2],
    [21, 232, 118, 2], [36, 234, 100, 2], [52, 236, 81, 1], [88, 237, 44, 2],
  ];
  for (const [left, top, width, height] of strips) {
    obstacle(x + (left + width / 2 - LEFT) * SCALE,
      baseY + (top + height / 2 - BOTTOM) * SCALE, width * SCALE, height * SCALE);
  }
}
