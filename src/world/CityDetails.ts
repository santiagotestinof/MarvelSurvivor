import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

type AddObstacle = (x: number, y: number, width: number, height: number) => unknown;

/** Fachadas originales: ladrillo, piedra y vidrio con proporciones de edificios neoyorquinos. */
export function drawCityBuilding(scene: Phaser.Scene, x: number, baseY: number): void {
  const variant = Math.abs(Math.floor(x / 128) + Math.floor(baseY / 320)) % 4;
  const height = baseY < 240 ? 120 : 152 + variant * 16;
  const roof = -height;
  const g = scene.add.graphics().setPosition(x, baseY).setDepth(baseY);
  const wall = [0xa27362, 0xc0b7a3, 0x829baa, 0xb5a28b][variant];
  g.fillStyle(0x303b46, 0.22).fillRect(-4, -10, 116, 18);
  // Lateral sombreado y azotea en perspectiva.
  g.fillStyle(0x4c5864).fillPoints([{ x: 96, y: roof }, { x: 108, y: roof - 12 }, { x: 108, y: -12 }, { x: 96, y: 0 }], true);
  g.fillStyle(wall).fillRect(0, roof, 96, height);
  g.fillStyle(0x6b6c70).fillRect(0, -28, 96, 28);
  g.fillStyle(0xc8c4b7).fillRect(-2, roof, 100, 5).fillRect(-2, -30, 100, 4);
  // Cornisas entre pisos y textura discreta de ladrillos.
  for (let y = roof + 8; y < -32; y += 24) {
    g.fillStyle(variant === 0 ? 0x8b6257 : 0x9ba4a2).fillRect(0, y + 18, 96, 2);
    if (variant === 0) {
      for (let bx = 4; bx < 96; bx += 16) g.fillStyle(0xb1846f).fillRect(bx, y + 20, 7, 1);
    }
    for (let col = 0; col < 4; col++) {
      const wx = 8 + col * 22;
      g.fillStyle(0x535d69).fillRect(wx - 1, y - 1, 14, 19);
      g.fillStyle(0xcbd0c7).fillRect(wx, y, 12, 17);
      g.fillStyle(0x38526b).fillRect(wx + 2, y + 1, 8, 14);
      g.fillStyle(0x80a8bb).fillRect(wx + 3, y + 2, 3, 5);
      g.fillStyle(0x9ab9c6).fillRect(wx + 2, y + 8, 8, 1);
      g.fillStyle(0xd6cdbb).fillRect(wx - 2, y + 16, 16, 2);
    }
  }
  if (variant === 0 || variant === 3) {
    // Escalera de incendios: descansos, barandas y diagonales.
    for (let y = roof + 26; y < -36; y += 24) {
      g.fillStyle(0x3c4249).fillRect(26, y, 42, 3).fillRect(26, y - 6, 42, 1);
      for (let bx = 26; bx <= 66; bx += 8) g.fillRect(bx, y - 6, 1, 7);
      g.lineStyle(2, 0x495057).lineBetween(30, y + 3, 60, y + 22);
    }
  }
  // Locales y acceso a nivel de vereda.
  g.fillStyle(0x283d4c).fillRect(7, -22, 25, 19).fillRect(64, -22, 25, 19);
  g.fillStyle(0x79a6b5).fillRect(9, -20, 7, 15).fillRect(66, -20, 7, 15);
  g.fillStyle(0xc6bfb1).fillRect(38, -25, 20, 25);
  g.fillStyle(0x334754).fillRect(41, -23, 14, 23);
  g.fillStyle(0xe0c590).fillRect(51, -11, 2, 2);
  g.fillStyle(variant % 2 === 0 ? 0x486658 : 0x69566a).fillRect(4, -29, 30, 6).fillRect(62, -29, 30, 6);
  g.fillStyle(0xb7b8ae).fillRect(35, -2, 25, 3);
  // Azotea con pretil, claraboya y ventilación.
  g.fillStyle(0xd4d2c7).fillPoints([{ x: -2, y: roof }, { x: 10, y: roof - 12 }, { x: 110, y: roof - 12 }, { x: 98, y: roof }], true);
  g.fillStyle(0x8d9699).fillRect(14, roof - 10, 76, 6);
  g.fillStyle(0xbec5c2).fillRect(18, roof - 15, 20, 10);
  g.fillStyle(0x656f78).fillRect(21, roof - 13, 14, 4);
  for (let i = 0; i < 4; i++) g.fillStyle(0xa8b5b8).fillRect(22 + i * 3, roof - 13, 1, 4);
  if (variant === 0) {
    g.fillStyle(0x42464a).fillRect(68, roof - 23, 2, 17).fillRect(84, roof - 23, 2, 17);
    g.fillStyle(0x755b4b).fillRect(65, roof - 34, 24, 18);
    g.fillStyle(0xb1916b).fillRect(67, roof - 33, 3, 16);
    g.fillStyle(0x444e57).fillTriangle(62, roof - 34, 77, roof - 44, 92, roof - 34);
    g.fillStyle(0x414850).fillRect(65, roof - 20, 24, 2);
  }
}

function trafficSignal(scene: Phaser.Scene, x: number, y: number, red: boolean, obstacle: AddObstacle): void {
  const g = scene.add.graphics().setPosition(x, y).setDepth(y);
  g.fillStyle(0x343d48).fillRect(-6, -3, 12, 4).fillRect(-2, -58, 4, 56);
  g.fillStyle(0x9da6a5).fillRect(-1, -54, 1, 48);
  g.fillStyle(0x3a3d43).fillRect(-7, -78, 14, 28);
  g.fillStyle(0xb49448).fillRect(-6, -77, 12, 26);
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x323c3d).fillRect(-4, -75 + i * 8, 8, 7);
    g.fillStyle(i === (red ? 0 : 2) ? (red ? 0xe66c58 : 0x79bd7c) : 0x515749).fillRect(-2, -74 + i * 8, 4, 4);
  }
  obstacle(x, y - 2, 10, 6);
}

export function buildCityDetails(scene: Phaser.Scene, park: ParkBounds, rows: number[], width: number, height: number,
  obstacle: AddObstacle): void {
  const roadXs = [park.left - 400, park.right + 112];
  const roadYs = [park.top - 400, park.bottom + 112];
  const ground = scene.add.graphics().setDepth(-998);
  // Señales en esquinas, fuera del espacio de cruce.
  for (const rx of roadXs) {
    for (const ry of roadYs) {
      for (const dx of [-24, 312]) {
        for (const dy of [-24, 312]) trafficSignal(scene, rx + dx, ry + dy, dx === dy, obstacle);
      }
    }
    for (const row of rows) {
      trafficSignal(scene, rx - 24, row + 70, true, obstacle);
      trafficSignal(scene, rx + 312, row - 70, false, obstacle);
    }
    for (let y = 800; y < height - 640; y += 640) {
      // Tapas de alcantarilla rasantes.
      ground.fillStyle(0x303d47).fillEllipse(rx + 72, y, 28, 20);
      ground.lineStyle(1, 0x748087).strokeEllipse(rx + 72, y, 25, 17);
      for (let line = -4; line <= 4; line += 4) ground.fillStyle(0x52626b).fillRect(rx + 63, y + line, 18, 1);
    }
  }
  for (const x of [park.left - 54, park.right + 54]) {
    for (let y = park.top + 200; y < park.bottom; y += 480) {
      if (rows.some((row) => Math.abs(y - row) < 110)) continue;
      const g = scene.add.graphics().setPosition(x, y).setDepth(y);
      // Jardinera de vereda y cesto metálico, con cuerpos bajos.
      g.fillStyle(0x51545a).fillRect(-22, -14, 44, 14);
      g.fillStyle(0xa08c77).fillRect(-22, -15, 44, 4);
      g.fillStyle(0x365c43).fillRect(-19, -22, 38, 8).fillRect(-13, -27, 26, 8);
      for (let i = 0; i < 5; i++) g.fillStyle(i % 2 === 0 ? 0xe6b8ba : 0xdfd6aa).fillRect(-15 + i * 7, -23, 3, 3);
      obstacle(x, y - 4, 44, 10);
      g.fillStyle(0x353f49).fillRect(34, -22, 14, 23);
      g.fillStyle(0x899592).fillRect(33, -24, 16, 4);
      for (let i = 0; i < 4; i++) g.fillStyle(0x6a797b).fillRect(36 + i * 3, -18, 1, 16);
      obstacle(x + 41, y - 3, 14, 8);
    }
  }
  // Obras puntuales a un costado: conos pequeños, sin cerrar la avenida.
  for (const [x, y] of [[roadXs[0] + 24, 940], [roadXs[1] + 264, 2820]]) {
    for (let i = 0; i < 3; i++) {
      const cone = scene.add.graphics().setPosition(x, y + i * 32).setDepth(y + i * 32);
      cone.fillStyle(0x3c4144).fillRect(-8, -3, 16, 5);
      cone.fillStyle(0xcf713c).fillRect(-5, -9, 10, 7).fillRect(-3, -16, 6, 9);
      cone.fillStyle(0xf4dfb7).fillRect(-4, -10, 8, 3);
      cone.fillStyle(0xf49b53).fillRect(-2, -17, 3, 6);
      obstacle(x, y + i * 32 - 1, 12, 5);
    }
  }
  // Bolardos separados en los frentes norte y sur; centro libre para los accesos.
  for (const y of [park.top - 28, park.bottom + 28]) {
    for (let x = park.left + 80; x < park.right - 40; x += 160) {
      if (Math.abs(x - width / 2) < 100) continue;
      const post = scene.add.graphics().setPosition(x, y).setDepth(y);
      post.fillStyle(0x343b45).fillRect(-4, -18, 8, 19).fillRect(-6, -2, 12, 3);
      post.fillStyle(0x929b98).fillRect(-3, -18, 2, 16);
      post.fillStyle(0xd9c893).fillRect(-3, -13, 6, 3);
      obstacle(x, y - 1, 8, 5);
    }
  }
}
