import Phaser from 'phaser';
import { createRandom } from '../core/random';
import { nearParkPath, parkPaths, type ParkBounds } from './ParkPaths';

export const PARK_GROUND = 'park-living-ground';

/** Césped original con variantes sutiles que no forman un tablero de verdes. */
export function createParkGround(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARK_GROUND)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const random = createRandom(512);
  for (let tile = 0; tile < 18; tile++) {
    const ox = tile * 16;
    g.fillStyle(tile < 16 ? 0x416f37 : 0x969d91).fillRect(ox, 0, 16, 16);
    for (let i = 0; i < 25; i++) {
      const x = ox + Math.floor(random() * 16);
      const y = Math.floor(random() * 16);
      g.fillStyle([0x386331, 0x48783c, 0x3d6933, 0x507c3e][i % 4]).fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
    }
    if (tile % 5 === 1) {
      g.fillStyle(0x355d2e).fillRect(4, 11, 7, 2);
      g.fillStyle(0x2c5229).fillRect(5, 8, 1, 4).fillRect(8, 7, 1, 5);
      g.fillStyle(0x648a46).fillRect(10, 9, 1, 3);
    }
  }
  g.generateTexture(PARK_GROUND, 288, 16);
  g.destroy();
}

/** Plantas bajas transitables: no se añaden cuerpos físicos ni se tapan personajes. */
export function buildParkVegetation(scene: Phaser.Scene, park: ParkBounds, rows: number[], cx: number,
  occupied: Phaser.Geom.Rectangle[]): void {
  const random = createRandom(7134);
  const paths = parkPaths(park, rows, cx);
  const cy = (park.top + park.bottom) / 2;
  const g = scene.add.graphics().setDepth(-997);
  const colors = [0xe9a2bf, 0xf1d169, 0xd4e5ed, 0xb9a0db, 0xed897d];
  const placed: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 650; i++) {
    const x = Math.floor((park.left + 32 + random() * (park.right - park.left - 64)) / 2) * 2;
    const y = Math.floor((park.top + 32 + random() * (park.bottom - park.top - 64)) / 2) * 2;
    if (nearParkPath(paths, x, y, 28)) continue;
    const footprint = new Phaser.Geom.Rectangle(x - 20, y - 26, 40, 36);
    if (occupied.some((bounds) => Phaser.Geom.Intersects.RectangleToRectangle(footprint, bounds))) continue;
    if (((x - cx) / 240) ** 2 + ((y - cy) / 200) ** 2 < 1) continue;
    if ([[cx - 330, rows[0] - 270], [cx + 330, rows[2] + 270]].some(([px, py]) =>
      Math.abs(x - px) < 164 && Math.abs(y - py) < 124)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 44)) continue;
    placed.push({ x, y });
    if (i % 4 === 1) {
      // Matas compactas: hojas finas con puntas inclinadas y nervaduras.
      g.fillStyle(0x2c502b).fillRect(x - 10, y - 1, 20, 3);
      for (let blade = 0; blade < 6; blade++) {
        const bx = x - 8 + blade * 3;
        const height = 7 + Math.floor(random() * 5) * 2;
        const lean = blade < 3 ? -1 : 1;
        g.fillStyle(0x1e4429).fillRect(bx - 1, y - height + 3, 3, height - 2);
        g.fillStyle(blade % 2 === 0 ? 0x648f48 : 0x497b39).fillRect(bx, y - height + 2, 1, height - 2);
        g.fillStyle(0x7ca358).fillRect(bx + lean, y - height, 1, 3);
        g.fillStyle(0x527e3e).fillRect(bx + lean * 2, y - height + 4, 2, 1);
      }
      continue;
    }
    const bush = i % 3 === 0;
    const flowerColor = colors[i % colors.length];
    if (bush) {
      // Contorno escalonado, follaje a tres tonos y pequeñas flores.
      g.fillStyle(0x2d6945).fillRect(x - 12, y - 2, 24, 4);
      g.fillStyle(0x214b37).fillRect(x - 14, y - 12, 28, 10).fillRect(x - 10, y - 20, 20, 20);
      g.fillStyle(0x387447).fillRect(x - 12, y - 12, 24, 8).fillRect(x - 8, y - 18, 16, 14);
      g.fillStyle(0x579252).fillRect(x - 8, y - 16, 10, 4).fillRect(x - 10, y - 8, 4, 3);
      g.fillStyle(0x74a765).fillRect(x - 6, y - 16, 4, 2).fillRect(x + 4, y - 12, 3, 2);
    }
    // Sitios separados: cada flor conserva su silueta y su centro.
    const flowerSites = bush ? [[-8, -10], [0, -16], [8, -8]] : [[-8, -8], [0, -14], [8, -6]];
    for (const [dx, dy] of flowerSites) {
      const fx = x + dx;
      const fy = y + dy;
      if (!bush) {
        g.fillStyle(0x39783c).fillRect(fx, fy, 2, y - fy);
        g.fillStyle(0x5a933f).fillRect(fx - 2, fy + 4, 3, 2).fillRect(fx + 1, fy + 6, 3, 2);
      }
      g.fillStyle(flowerColor).fillRect(fx - 2, fy, 6, 2).fillRect(fx, fy - 2, 2, 6);
      g.fillStyle(0xffecac).fillRect(fx, fy, 2, 2);
    }
  }
}
