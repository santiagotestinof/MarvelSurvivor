import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';
import { placeDailyBugle } from './DailyBugle';
import { placeBaxterBuilding } from './BaxterBuilding';
import { placeAvengersTower } from './AvengersTower';
import { placeSanctum } from './Sanctum';

type Obstacle = (x: number, y: number, w: number, h: number) => unknown;
type Landmark = 'avengers' | 'bugle' | 'sanctum' | 'baxter';

export function drawLandmark(scene: Phaser.Scene, x: number, y: number, kind: Landmark, obstacle: Obstacle): void {
  if (kind === 'bugle') {
    placeDailyBugle(scene, x, y, obstacle);
    return;
  }
  if (kind === 'avengers') {
    placeAvengersTower(scene, x, y, obstacle);
    return;
  }
  if (kind === 'baxter') {
    placeBaxterBuilding(scene, x, y, obstacle);
    return;
  }
  placeSanctum(scene, x, y, obstacle);
}

export function buildStreetServices(scene: Phaser.Scene, park: ParkBounds, rows: number[], obstacle: Obstacle): void {
  for (const [x, y] of [[park.left - 56, rows[0] + 180], [park.right + 56, rows[2] - 180]]) {
    const g = scene.add.graphics().setPosition(x, y).setDepth(y);
    // Carrito de salchichas con sombrilla de paños rojos, azules y amarillos.
    g.fillStyle(0x2c343d).fillRect(-19, -1, 8, 6).fillRect(12, -1, 8, 6);
    g.fillStyle(0xa9bdbe).fillRect(-24, -23, 48, 24);
    g.fillStyle(0x9d363a).fillRect(-21, -19, 42, 17);
    g.fillStyle(0xe2bd68).fillRect(-15, -15, 30, 3).fillRect(-15, -9, 30, 2);
    g.fillStyle(0xe0e2cb).fillRect(-27, -25, 54, 4);
    g.fillStyle(0x606d75).fillRect(-2, -58, 3, 33);
    g.fillStyle(0xb54749).fillPoints([{ x: -32, y: -52 }, { x: -8, y: -70 }, { x: 0, y: -70 }, { x: -12, y: -52 }], true);
    g.fillStyle(0x426ca0).fillPoints([{ x: -12, y: -52 }, { x: 0, y: -70 }, { x: 12, y: -52 }], true);
    g.fillStyle(0xe0b64f).fillPoints([{ x: 12, y: -52 }, { x: 0, y: -70 }, { x: 8, y: -70 }, { x: 32, y: -52 }], true);
    g.fillStyle(0xd8c991).fillRect(-20, -35, 5, 10).fillRect(-10, -33, 5, 8);
    g.fillStyle(0xb8493a).fillRect(-19, -37, 3, 3);
    obstacle(x, y - 8, 48, 20);
  }
  for (const [x, y] of [[park.left - 60, rows[1] + 220], [park.right + 60, rows[1] - 220]]) {
    const g = scene.add.graphics().setPosition(x, y).setDepth(y);
    // Refugio, banco, panel de rutas y cartel de parada.
    g.fillStyle(0x4a616d).fillRect(-32, -49, 64, 42);
    g.fillStyle(0x91b6be).fillRect(-29, -46, 58, 33);
    g.fillStyle(0xc5d9cf).fillRect(-26, -44, 4, 29).fillRect(2, -44, 3, 29);
    g.fillStyle(0x43525f).fillRect(-34, -54, 68, 6).fillRect(-32, -49, 3, 49).fillRect(29, -49, 3, 49);
    g.fillStyle(0xc0c6bc).fillRect(-34, -54, 68, 2);
    g.fillStyle(0x805f4c).fillRect(-22, -13, 44, 5);
    g.fillStyle(0x333e48).fillRect(-20, -8, 3, 8).fillRect(17, -8, 3, 8);
    g.fillStyle(0xeee0b6).fillRect(11, -40, 14, 20);
    g.fillStyle(0x729bb0).fillRect(13, -37, 10, 3).fillRect(13, -31, 7, 1).fillRect(13, -27, 9, 1);
    g.fillStyle(0x6e7d83).fillRect(42, -55, 3, 55);
    g.fillStyle(0xe2e3d2).fillRect(35, -66, 18, 17);
    g.fillStyle(0x3e719b).fillRect(37, -64, 14, 13);
    g.fillStyle(0xe2e9df).fillRect(40, -61, 8, 5).fillRect(40, -54, 2, 2).fillRect(46, -54, 2, 2);
    obstacle(x, y - 8, 68, 18);
    obstacle(x + 43, y - 1, 6, 4);
  }
}
