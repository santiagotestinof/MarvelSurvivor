import Phaser from 'phaser';
import { createRandom } from '../core/random';
import { nearParkPath, parkPaths, parkCrossPathOffset, PARK_PATH_WIDTH } from './ParkPaths';

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
  for (const [width, color] of [[PARK_PATH_WIDTH + 12, 0x4e505b], [PARK_PATH_WIDTH + 8, 0x94919d], [PARK_PATH_WIDTH, 0xbd9867]]) {
    g.fillStyle(color);
    for (const path of paths) {
      // Limitar ambos bordes al parque evita que una curva invada la vereda.
      const edge = (side: number) => path.map((point, index) => {
        const before = path[Math.max(0, index - 1)];
        const after = path[Math.min(path.length - 1, index + 1)];
        const endpoint = index === 0 || index === path.length - 1;
        const vertical = path[0].y === park.top;
        // Una sección completa sobre el límite, sin desplazar una esquina hacia adentro.
        const dx = endpoint ? (vertical ? 0 : 1) : after.x - before.x;
        const dy = endpoint ? (vertical ? 1 : 0) : after.y - before.y;
        const length = Math.hypot(dx, dy);
        return {
          x: Phaser.Math.Clamp(point.x - side * dy / length * width / 2, park.left, park.right),
          y: Phaser.Math.Clamp(point.y + side * dx / length * width / 2, park.top, park.bottom),
        };
      });
      g.fillPoints([...edge(1), ...edge(-1).reverse()], true);
    }
  }

  // Bloques de piedra en ambos bordes: juntas transversales y bisel iluminado.
  for (const path of paths) {
    for (let index = 0; index < path.length - 2; index += 2) {
      const a = path[index];
      const b = path[index + 2];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // No dibujar bordillos internos atravesando las bifurcaciones.
      if (paths.some((other) => other !== path && other.some((p) => Math.hypot(p.x - mid.x, p.y - mid.y) < 34))) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / length;
      const ny = (b.x - a.x) / length;
      const pointAt = (p: { x: number; y: number }, distance: number) => ({
        x: Phaser.Math.Clamp(p.x + nx * distance, park.left, park.right),
        y: Phaser.Math.Clamp(p.y + ny * distance, park.top, park.bottom),
      });
      for (const side of [-1, 1]) {
        const innerA = pointAt(a, side * 22);
        const outerA = pointAt(a, side * 26);
        const innerB = pointAt(b, side * 22);
        const outerB = pointAt(b, side * 26);
        g.fillStyle([0x93909b, 0xa09ba5, 0x898894][(index / 2) % 3]);
        g.fillPoints([innerA, outerA, outerB, innerB], true);
        g.lineStyle(1, 0xc2bac3).lineBetween(innerA.x, innerA.y, innerB.x, innerB.y);
        g.lineStyle(1, 0x5e5c69).lineBetween(innerA.x, innerA.y, outerA.x, outerA.y);
      }
    }
  }

  // Tierra ocre con granos, piedritas y manchas suaves; distribución fija al reiniciar.
  const dirtRandom = createRandom(6021);
  for (const path of paths) {
    for (let index = 1; index < path.length - 1; index++) {
      const point = path[index];
      const before = path[index - 1];
      const after = path[index + 1];
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.hypot(dx, dy);
      const offset = (dirtRandom() - 0.5) * (PARK_PATH_WIDTH - 10);
      const x = Math.floor((point.x - dy / length * offset) / 2) * 2;
      const y = Math.floor((point.y + dx / length * offset) / 2) * 2;
      if (x < park.left + 4 || x > park.right - 6 || y < park.top + 4 || y > park.bottom - 6) continue;
      const variation = dirtRandom();
      if (variation < 0.32) {
        g.fillStyle(0xc5a273).fillRect(x, y, 4, 2);
      } else if (variation < 0.56) {
        g.fillStyle(0xaf895c).fillRect(x, y, 2, 2);
      } else if (variation < 0.7) {
        g.fillStyle(0x917756).fillRect(x, y, 3, 2);
        g.fillStyle(0xab906b).fillRect(x, y, 2, 1);
      } else if (variation < 0.8) {
        g.fillStyle(0xdbb981).fillRect(x, y, 2, 2);
      }
    }
  }

  for (const y of rows) {
    for (const x of [centerX - 224, centerX + 224]) {
      const pathY = (px: number) => y + parkCrossPathOffset((px - park.left) / (park.right - park.left), rows.indexOf(y));
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
      // Hierro oscuro, base moldurada y linterna de vidrio cálido.
      lamp.fillStyle(0x292b36).fillRect(-9, -4, 18, 4).fillRect(-7, -8, 14, 6);
      lamp.fillStyle(0x55515c).fillRect(-6, -7, 11, 3);
      lamp.fillStyle(0x30313c).fillRect(-5, -20, 10, 13).fillRect(-3, -62, 6, 44);
      lamp.fillStyle(0x77717b).fillRect(-4, -19, 2, 10).fillRect(-2, -61, 1, 42);
      lamp.fillStyle(0x252833).fillRect(2, -60, 2, 40);
      lamp.fillStyle(0x8b8083).fillRect(-5, -21, 10, 2).fillRect(-4, -58, 8, 2);
      lamp.fillStyle(0x292b36).fillRect(-5, -66, 10, 5).fillRect(-7, -82, 14, 17);
      lamp.fillStyle(0xa68b66).fillRect(-5, -80, 10, 13);
      lamp.fillStyle(0xf0ca80).fillRect(-4, -79, 8, 11);
      lamp.fillStyle(0xffe9b0).fillRect(-3, -79, 3, 9);
      lamp.fillStyle(0x58505a).fillRect(0, -81, 2, 15).fillRect(-6, -68, 12, 2);
      lamp.fillStyle(0x252833).fillRect(-9, -85, 18, 4).fillRect(-7, -89, 14, 4);
      lamp.fillStyle(0x514b5b).fillRect(-6, -88, 12, 3).fillRect(-4, -92, 8, 3);
      lamp.fillStyle(0x94818b).fillRect(-6, -85, 11, 1).fillRect(-3, -91, 3, 2);
      lamp.fillStyle(0x30303c).fillRect(-2, -96, 4, 4);
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
  pixelOval(g, fx, fy, 416, 332, 0x555965);
  pixelOval(g, fx, fy - 2, 408, 324, 0xa6a0aa);
  pixelOval(g, fx, fy, 396, 312, 0x7a7580);
  // Baldosas escalonadas recortadas contra la plaza, con juntas y biseles.
  const pavingRandom = createRandom(197);
  for (let ty = -156; ty < 156; ty += 20) {
    const shift = Math.floor((ty + 156) / 20) % 2 === 0 ? 0 : 16;
    for (let tx = -224 + shift; tx < 200; tx += 32) {
      const color = [0xb8ada9, 0xaca5a7, 0xc3b6ad, 0xb2aaad][Math.floor(pavingRandom() * 4)];
      for (let dy = 1; dy < 19 && ty + dy < 156; dy++) {
        const half = Math.floor(196 * Math.sqrt(Math.max(0, 1 - ((ty + dy) / 156) ** 2)));
        const left = Math.max(tx + 1, -half);
        const right = Math.min(tx + 31, half);
        if (right <= left) continue;
        g.fillStyle(dy === 1 ? 0xd4c9c0 : dy === 18 ? 0x90868e : color);
        g.fillRect(fx + left, fy + ty + dy, right - left, 1);
      }
    }
  }
  g.lineStyle(2, 0x726e7c).strokeEllipse(fx, fy, 368, 284);
  g.lineStyle(1, 0xd4c9c0).strokeEllipse(fx, fy - 2, 364, 280);
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
