import Phaser from 'phaser';
import { createRandom } from '../core/random';
import { nearParkPath, parkPaths, PARK_PATH_WIDTH } from './ParkPaths';

export const PARK_TREE = 'park-detailed-tree';
export const PARK_PINE = 'park-detailed-pine';

/** Elipses escalonadas sobre una grilla: ningún borde suavizado en el agua o la piedra. */
function pixelOval(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color);
  for (let dy = -h / 2; dy < h / 2; dy += 4) {
    const half = Math.floor(w / 2 * Math.sqrt(Math.max(0, 1 - ((dy + 2) / (h / 2)) ** 2)) / 4) * 4;
    if (half > 0) g.fillRect(x - half, y + dy, half * 2, 4);
  }
}

/** Arte original dibujado en píxeles; solo contiene elementos del escenario. */
export function createParkTrees(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARK_TREE)) return;
  for (const pine of [false, true]) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x263e26, 0.22).fillEllipse(32, 73, 56, 14);
    g.fillStyle(0x493126).fillRect(26, 45, 12, 30).fillRect(20, 71, 24, 5);
    g.fillStyle(0x95633f).fillRect(29, 46, 5, 28);
    if (pine) {
      for (let tier = 0; tier < 4; tier++) {
        const y = 6 + tier * 11;
        const w = 12 + tier * 14;
        g.fillStyle(0x21472c).fillRect(32 - w / 2, y + 10, w, 13);
        g.fillStyle(0x356d39).fillRect(34 - w / 2, y + 6, w - 4, 14);
        g.fillStyle(0x568847).fillRect(34 - w / 2, y + 6, Math.max(4, w / 3), 6);
      }
    } else {
      g.fillStyle(0x244b2d).fillRect(10, 22, 44, 36).fillRect(4, 30, 56, 20);
      g.fillStyle(0x387637).fillRect(10, 19, 44, 31).fillRect(17, 12, 30, 42);
      g.fillStyle(0x559442).fillRect(14, 19, 30, 21).fillRect(23, 14, 21, 25);
      g.fillStyle(0x72a64c).fillRect(22, 19, 16, 6).fillRect(15, 28, 9, 5);
      g.fillStyle(0x2e652f).fillRect(41, 34, 10, 8).fillRect(24, 45, 13, 6);
    }
    // Grupos de hojas, ramas y corteza en píxeles.
    const leafRandom = createRandom(pine ? 46 : 82);
    for (let i = 0; i < 24; i++) {
      const x = 16 + Math.floor(leafRandom() * 8) * 4;
      const y = 24 + Math.floor(leafRandom() * 6) * 4;
      g.fillStyle(i % 3 === 0 ? 0x83ad55 : 0x326530).fillRect(x, y, 4, 3);
    }
    g.fillStyle(0x64432c).fillRect(24, 56, 5, 8).fillRect(35, 54, 5, 10);
    g.fillStyle(0xb08553).fillRect(30, 58, 2, 6).fillRect(30, 68, 2, 5);
    g.generateTexture(pine ? PARK_PINE : PARK_TREE, 64, 80);
    g.destroy();
  }
}

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
  // Flores y matas rasantes: aportan detalle sin añadir colisiones.
  for (let i = 0; i < 1800; i++) {
    const x = Math.floor((park.left + 12 + random() * (park.right - park.left - 24)) / 2) * 2;
    const y = Math.floor((park.top + 12 + random() * (park.bottom - park.top - 24)) / 2) * 2;
    if (nearParkPath(paths, x, y, 8)) continue;
    g.fillStyle(0x3b773b).fillRect(x, y, 2, 5).fillRect(x + 4, y + 2, 2, 3);
    if (i % 5 === 0) {
      g.fillStyle([0xf3df94, 0xdfa8ba, 0xc1dfe5][i % 3]).fillRect(x - 2, y - 2, 6, 2);
      g.fillRect(x, y - 4, 2, 6);
    }
  }
  // Todas las bases se dibujan antes de la tierra para unir las bifurcaciones.
  for (const [width, color] of [[PARK_PATH_WIDTH + 12, 0x56695c], [PARK_PATH_WIDTH + 8, 0xa1afaa], [PARK_PATH_WIDTH, 0x895b40]]) {
    g.lineStyle(width, color);
    for (const path of paths) {
      g.beginPath();
      g.moveTo(path[0].x, path[0].y);
      for (const point of path.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
    }
  }

  for (const y of rows) {
    for (const x of [centerX - 224, centerX + 224]) {
      const amplitude = rows.indexOf(y) === 1 ? 100 : 76;
      const pathY = (px: number) => y + amplitude * Math.sin((px - park.left) / (park.right - park.left) * Math.PI * 2);
      const benchY = pathY(x) + 86;
      const lampY = pathY(x + 44) - 80;
      const bench = scene.add.graphics().setPosition(x, benchY).setDepth(benchY);
      bench.fillStyle(0x342c26).fillRect(-22, -15, 4, 17).fillRect(18, -15, 4, 17);
      bench.fillStyle(0xa7794c).fillRect(-26, -24, 52, 6).fillRect(-26, -16, 52, 5);
      bench.fillStyle(0x68462f).fillRect(-26, -8, 52, 6);
      bench.fillStyle(0xd2a36a).fillRect(-25, -24, 50, 2).fillRect(-25, -8, 50, 2);
      bench.fillStyle(0xddd0a1).fillRect(-20, -22, 2, 2).fillRect(20, -22, 2, 2);
      obstacle(x, benchY - 4, 52, 12);
      const lamp = scene.add.graphics().setPosition(x + 44, lampY).setDepth(lampY);
      lamp.fillStyle(0x333e3d).fillRect(-3, -52, 6, 52).fillRect(-8, -3, 16, 3);
      lamp.fillRect(-9, -56, 18, 4).fillRect(-6, -70, 12, 4);
      lamp.fillStyle(0xf6d37d).fillRect(-5, -65, 10, 9);
      obstacle(x + 44, lampY - 2, 10, 6);
      const bin = scene.add.graphics().setPosition(x - 46, benchY).setDepth(benchY);
      bin.fillStyle(0x243d38).fillRect(-9, -22, 18, 22);
      bin.fillStyle(0x487566).fillRect(-6, -19, 12, 17);
      bin.fillStyle(0x182e2b).fillRect(-10, -25, 20, 5).fillRect(-4, -17, 8, 4);
      bin.fillStyle(0x81a28a).fillRect(-5, -10, 2, 7).fillRect(3, -10, 2, 7);
      obstacle(x - 46, benchY - 5, 18, 10);
    }
  }

  // Estanques pequeños, lejos de los ejes principales; contorno escalonado.
  for (const [x, y] of [[centerX - 330, rows[0] - 270], [centerX + 330, rows[2] + 270]]) {
    for (let dy = -96; dy < 96; dy += 8) {
      const half = Math.floor(136 * Math.sqrt(1 - ((dy + 4) / 96) ** 2) / 4) * 4;
      g.fillStyle(0x747d66).fillRect(x - half, y + dy, half * 2, 8);
      obstacle(x, y + dy + 4, half * 2, 8);
    }
    pixelOval(g, x, y, 256, 176, 0x9baf8d);
    pixelOval(g, x, y, 240, 160, 0x347c95);
    pixelOval(g, x - 12, y - 8, 180, 112, 0x4299aa);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x98d5d4).fillRect(x - 36 + (i % 3) * 24, y - 34 + i * 9, 14, 2);
    }
    for (const side of [-1, 1]) {
      g.fillStyle(0x55753f).fillRect(x + side * 108, y - 12, 4, 16);
      g.fillStyle(0xbfa772).fillRect(x + side * 108, y - 20, 4, 9);
      pixelOval(g, x + side * 64, y + 30, 16, 8, 0x639357);
    }
  }

  // Plaza central transitable, con una fuente monumental de dos niveles.
  const fx = centerX;
  const fy = (park.top + park.bottom) / 2;
  g.fillStyle(0x92998c).fillEllipse(fx, fy, 416, 332);
  g.fillStyle(0xc6bea7).fillEllipse(fx, fy, 400, 316);
  g.lineStyle(2, 0xada58f).strokeEllipse(fx, fy, 358, 274);
  // Contorno de la pileta y colisiones comparten las mismas franjas.
  for (let dy = -64; dy < 64; dy += 8) {
    const halfWidth = Math.floor(112 * Math.sqrt(1 - ((dy + 4) / 64) ** 2) / 4) * 4;
    g.fillStyle(0x646f6c).fillRect(fx - halfWidth, fy + dy, halfWidth * 2, 8);
    obstacle(fx, fy + dy + 4, halfWidth * 2, 8);
  }
  pixelOval(g, fx, fy + 4, 220, 112, 0x465768);
  pixelOval(g, fx, fy, 212, 108, 0x7994a2);
  pixelOval(g, fx, fy - 8, 212, 100, 0xacc4cc);
  pixelOval(g, fx, fy - 10, 196, 88, 0x526d80);
  pixelOval(g, fx, fy - 12, 184, 76, 0x348fa8);
  pixelOval(g, fx, fy - 14, 156, 56, 0x43b4c7);
  const fountain = scene.add.graphics().setPosition(fx, fy).setDepth(fy + 20);
  pixelOval(fountain, 0, 0, 48, 20, 0x43556a);
  fountain.fillStyle(0x536b80).fillRect(-14, -56, 28, 52);
  fountain.fillStyle(0x90aebe).fillRect(-10, -54, 8, 48);
  fountain.fillStyle(0xb9d1d5).fillRect(-10, -48, 20, 4).fillRect(-10, -24, 20, 4);
  pixelOval(fountain, 0, -52, 108, 32, 0x41556a);
  pixelOval(fountain, 0, -58, 108, 28, 0x94aebb);
  pixelOval(fountain, 0, -60, 88, 20, 0x348da6);
  fountain.fillStyle(0x4c6479).fillRect(-10, -100, 20, 38);
  fountain.fillStyle(0x9dbbc7).fillRect(-6, -98, 6, 36);
  pixelOval(fountain, 0, -96, 56, 20, 0x43596e);
  pixelOval(fountain, 0, -100, 56, 16, 0x9bb6c2);
  fountain.fillStyle(0x526a80).fillRect(-8, -130, 16, 26);
  fountain.fillStyle(0xb2ced6).fillRect(-4, -130, 4, 24);
  pixelOval(fountain, 0, -132, 24, 12, 0x819eaf);
  // Chorros en arcos escalonados, con reflejos y salpicaduras.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = side * Math.round((10 + t * 64) / 4) * 4;
      const y = Math.round((-118 + t * 100 - 48 * Math.sin(t * Math.PI)) / 4) * 4;
      fountain.fillStyle(i % 3 === 0 ? 0xc7f2ed : 0x58c5df).fillRect(x, y, 4, 8);
    }
    for (const x of [32, 44]) {
      fountain.fillStyle(0x6bd4e2).fillRect(side * x, -52, 4, 32);
      fountain.fillStyle(0xc3f2e8).fillRect(side * x - 4, -20, 12, 4);
    }
  }
}
