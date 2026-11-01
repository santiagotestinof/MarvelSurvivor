import type Phaser from 'phaser';

export const COMMON_BUILDINGS = {
  residential: {
    texture: 'manhattan-residential', path: 'assets/props/manhattan-residential.png', left: 10, bottom: 180,
    base: [[12, 152, 100, 12], [12, 164, 97, 4], [12, 168, 94, 4], [12, 172, 91, 4], [12, 176, 88, 4]],
  },
  apartments: {
    texture: 'manhattan-apartments', path: 'assets/props/manhattan-apartments.png', left: 11, bottom: 180,
    base: [[13, 152, 99, 4], [13, 156, 100, 4], [13, 160, 99, 4], [13, 164, 96, 4],
      [13, 168, 93, 4], [13, 172, 90, 4], [13, 176, 87, 4]],
  },
  commercial: {
    texture: 'manhattan-commercial', path: 'assets/props/manhattan-commercial.png', left: 11, bottom: 178,
    base: [[12, 152, 99, 8], [12, 160, 98, 4], [12, 164, 95, 4], [12, 168, 92, 4],
      [12, 172, 89, 4], [12, 176, 87, 2]],
  },
} as const;

export type CommonBuildingKind = keyof typeof COMMON_BUILDINGS;
export type CityEdge = 'west' | 'east' | 'north' | 'south';
const ORDER: readonly CommonBuildingKind[] = [
  'residential', 'apartments', 'commercial', 'apartments', 'residential', 'commercial',
  'residential', 'apartments', 'commercial', 'residential', 'commercial', 'apartments',
];
const EDGE_OFFSET: Record<CityEdge, number> = { west: 3, east: 7, north: 0, south: 5 };

/** Alternancia por frente, independiente del RNG de la vegetación y las oleadas. */
export function commonBuildingKind(edge: CityEdge, index: number): CommonBuildingKind {
  return ORDER[(index + EDGE_OFFSET[edge]) % ORDER.length];
}

/** PNG completos 128×192 a escala 1:1, sin espejados ni rotaciones. */
export function placeCommonBuilding(scene: Phaser.Scene, x: number, baseY: number, kind: CommonBuildingKind,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  const building = COMMON_BUILDINGS[kind];
  scene.add.image(x, baseY, building.texture).setOrigin(building.left / 128, building.bottom / 192)
    .setDepth(baseY).setName(`manhattan-common-${kind}`);
  // Franjas medidas sobre el alfa inferior de cada PNG: no bloquean toda su altura visual.
  for (const [left, top, width, height] of building.base) {
    obstacle(x + left + width / 2 - building.left,
      baseY + top + height / 2 - building.bottom, width, height);
  }
}
