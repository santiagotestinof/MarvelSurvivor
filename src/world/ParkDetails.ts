import Phaser from 'phaser';
import { createRandom } from '../core/random';
import { nearParkPath, parkPaths, parkCrossPathOffset } from './ParkPaths';
import { placeParkFountain } from './ParkFountain';
import { placeParkPlaza } from './ParkPlaza';
import { placeParkFurniture } from './ParkFurniture';
import { parkLakeCenters, placeParkLake } from './ParkLake';

export function buildParkDetails(
  scene: Phaser.Scene,
  park: { left: number; right: number; top: number; bottom: number },
  rows: number[],
  centerX: number,
  obstacle: (x: number, y: number, w: number, h: number) => unknown,
): void {
  const g = scene.add.graphics().setDepth(-998);
  const random = createRandom(940);
  const paths = parkPaths(park, rows, centerX);
  // Matas rasantes: las flores se colocan con su PNG en ParkVegetation.
  for (let i = 0; i < 1800; i++) {
    const x = Math.floor((park.left + 12 + random() * (park.right - park.left - 24)) / 2) * 2;
    const y = Math.floor((park.top + 12 + random() * (park.bottom - park.top - 24)) / 2) * 2;
    if (nearParkPath(paths, x, y, 8)) continue;
    g.fillStyle(0x527143).fillRect(x, y, 2, 5).fillRect(x + 4, y + 2, 2, 3);

  }
  // Los senderos y sus bordes se resuelven con el tileset en ParkTerrain.
  for (const y of rows) {
    for (const x of [centerX - 224, centerX + 224]) {
      const pathY = (px: number) => y + parkCrossPathOffset((px - park.left) / (park.right - park.left), rows.indexOf(y));
      const benchY = pathY(x) + 86;
      // Sólo los dos bancos de Bethesda: apartarlos del desembarque y de la plaza.
      const seatY = benchY + (rows.indexOf(y) === 1 ? 48 : 0);
      const lampY = pathY(x + 44) - 80;
      placeParkFurniture(scene, 'bench', x, seatY, obstacle);
      placeParkFurniture(scene, 'lamp', x + 44, lampY, obstacle);
      placeParkFurniture(scene, 'bin', x - 46, benchY, obstacle);
    }
  }

  // Los dos lagos conservan sus centros; el PNG define las orillas y la colisión del agua.
  for (const [x, y] of parkLakeCenters(centerX, rows)) {
    placeParkLake(scene, x, y, obstacle);
  }
  // Plaza central transitable, con una fuente monumental de dos niveles.
  const fx = centerX;
  const fy = (park.top + park.bottom) / 2;
  placeParkPlaza(scene, fx, fy, paths);
  placeParkFountain(scene, fx, fy, obstacle);
}
