import type Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

export const PARK_ENTRY_GATE = 'park-entry-gate';

/** Accesos norte y sur abiertos: sólo las bases de los pilares bloquean el movimiento. */
export function buildParkEntrance(scene: Phaser.Scene, park: ParkBounds, centerX: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  for (const y of [park.top + 4, park.bottom - 4]) {
    placeGate(scene, centerX, y, obstacle);
  }
}

function placeGate(scene: Phaser.Scene, centerX: number, y: number,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  const scale = 1.5;
  // PNG 128×128, apoyo al final de la fila 109. El centro de la abertura está en x=64.5.
  // El arco elevado se dibuja delante de quienes pasan por detrás o debajo;
  // la abertura transparente y la ausencia de cuerpo central mantienen el paso libre.
  scene.add.image(centerX, y, PARK_ENTRY_GATE).setOrigin(64.5 / 128, 110 / 128)
    .setScale(scale).setDepth(y + 1).setName('central-park-entry-gate');
  // Sólo las plataformas inferiores: x, y, ancho y alto medidos en el PNG original.
  for (const [left, top, width, height] of [[2, 96, 30, 14], [98, 96, 29, 14]]) {
    obstacle(centerX + (left + width / 2 - 64.5) * scale,
      y + (top + height / 2 - 110) * scale, width * scale, height * scale);
  }
}
