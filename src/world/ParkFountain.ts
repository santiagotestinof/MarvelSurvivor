import type Phaser from 'phaser';

export const PARK_FOUNTAIN = 'park-fountain';
const SCALE = 2;
// Centro de la pileta en el PNG de 128×128; no es el centro de la estatua.
const ORIGIN = { x: 62, y: 80 };

// Franjas de la base medidas sobre el alfa del PNG: x, y, ancho, alto.
// Cubren el agua y el muro exterior sin bloquear el aire alrededor de la estatua.
const BASE_STRIPS = [
  [34, 46, 55, 4], [26, 50, 71, 4], [23, 54, 78, 4], [19, 58, 85, 4],
  [18, 62, 87, 4], [17, 66, 89, 4], [16, 70, 91, 4], [16, 74, 91, 4],
  [17, 78, 89, 4], [17, 82, 89, 4], [17, 86, 89, 4], [19, 90, 85, 4],
  [22, 94, 80, 4], [26, 98, 72, 4], [33, 102, 59, 4], [40, 106, 44, 4],
  [55, 110, 14, 2],
] as const;

export function placeParkFountain(scene: Phaser.Scene, x: number, y: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  scene.add.image(x, y, PARK_FOUNTAIN)
    .setOrigin(ORIGIN.x / 128, ORIGIN.y / 128)
    .setScale(SCALE)
    // La profundidad usa el centro de apoyo, igual que el cuerpo del personaje.
    // El borde inferior tapaba al jugador incluso fuera de los laterales de la base.
    .setDepth(y)
    .setName('central-park-fountain');
  for (const [left, top, width, height] of BASE_STRIPS) {
    obstacle(x + (left + width / 2 - ORIGIN.x) * SCALE,
      y + (top + height / 2 - ORIGIN.y) * SCALE, width * SCALE, height * SCALE);
  }
}
