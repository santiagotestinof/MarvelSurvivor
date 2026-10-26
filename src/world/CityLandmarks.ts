import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

type Obstacle = (x: number, y: number, w: number, h: number) => unknown;
type Landmark = 'avengers' | 'bugle' | 'sanctum' | 'baxter';

function drawAvengersTower(scene: Phaser.Scene, x: number, y: number, obstacle: Obstacle): void {
  const g = scene.add.graphics().setPosition(x, y).setDepth(y).setScale(1, 1.07);
  // Espina alta a la izquierda y fachada que se ensancha hacia la base.
  g.fillStyle(0x273e59).fillPoints([{ x: 0, y: -198 }, { x: 42, y: -198 },
    { x: 68, y: -145 }, { x: 52, y: -102 }, { x: 122, y: -14 }, { x: 122, y: 0 }, { x: 0, y: 0 }], true);
  g.fillStyle(0x326e8b).fillRect(2, -194, 28, 188);
  for (let wx = 5; wx < 28; wx += 7) g.fillStyle(0x649ba9).fillRect(wx, -192, 2, 184);
  // Retícula de vidrio, respetando la diagonal de la torre.
  for (let py = -96; py < -8; py += 12) {
    const right = 52 + (py + 102) * 0.78;
    for (let wx = 36; wx < right - 5; wx += 10) {
      g.fillStyle(0x527f9a).fillRect(wx, py, 6, 8);
      g.fillStyle(0x8bb9c3).fillRect(wx, py, 2, 8);
    }
  }
  g.lineStyle(5, 0x8aafb9).beginPath().moveTo(40, -198).lineTo(48, -174)
    .lineTo(65, -151).lineTo(94, -145).strokePath();
  // Volumen superior en voladizo, con pisos horizontales y borde inclinado.
  g.fillStyle(0x264f70).fillPoints([{ x: 30, y: -149 }, { x: 155, y: -149 },
    { x: 139, y: -115 }, { x: 105, y: -98 }, { x: 30, y: -98 }], true);
  for (let floor = 0; floor < 5; floor++) {
    const py = -146 + floor * 9;
    g.fillStyle(0xadc8ca).fillRect(53, py, 94 - floor * 7, 3);
    g.fillStyle(0x65a9b8).fillRect(59, py + 4, 80 - floor * 7, 2);
  }
  g.fillStyle(0xc4d2d0).fillRect(35, -153, 126, 5);
  g.lineStyle(4, 0x8baeb6).lineBetween(155, -147, 138, -115).lineBetween(138, -115, 105, -99);
  // Plataforma lateral y helipuerto, con soporte diagonal.
  g.fillStyle(0x354e62).fillTriangle(60, -91, 126, -91, 75, -70);
  g.fillStyle(0x63899a).fillRect(28, -98, 146, 8);
  g.fillStyle(0xc0c8bd).fillRect(25, -101, 150, 4);
  g.fillStyle(0x384d5d).fillEllipse(150, -100, 58, 18);
  g.lineStyle(2, 0xd6b865).strokeEllipse(150, -101, 49, 13);
  g.lineStyle(2, 0xdce2d4).lineBetween(144, -105, 144, -98).lineBetween(155, -105, 155, -98)
    .lineBetween(144, -102, 155, -102);
  // Emblema grande en la unión entre la espina y el volumen superior.
  g.fillStyle(0x233e78).fillCircle(44, -126, 24);
  g.lineStyle(3, 0xe2e5cb).strokeCircle(44, -126, 23);
  g.lineStyle(5, 0xdfe7d8).beginPath().moveTo(30, -109).lineTo(46, -145).lineTo(55, -110).strokePath();
  g.lineStyle(4, 0xdfe7d8).lineBetween(36, -122, 62, -122);
  g.fillStyle(0x899fac).fillRect(-3, -7, 128, 7);
  g.fillStyle(0xabc6c9).fillRect(48, -23, 18, 16);
  obstacle(x + 60, y - 25, 126, 56);
}

function drawBaxterTower(scene: Phaser.Scene, x: number, y: number, obstacle: Obstacle): void {
  const g = scene.add.graphics().setPosition(x, y).setDepth(y);
  // La silueta completa se curva: no hay un rectángulo detrás de los nervios.
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (let py = -210; py <= -18; py += 4) {
    const t = (py + 210) / 192;
    const outer = Math.round((14 * (1 - t) + 20 * Math.sin(Math.PI * t)) / 2) * 2;
    const inset = outer + 8 + Math.round(32 * t ** 6 / 2) * 2;
    g.fillStyle(0x5e737c).fillRect(144 - outer, py, 8, 4);
    g.fillStyle(0xc8c8b9).fillRect(outer, py, 144 - outer * 2, 4);
    if (py < -26) {
      g.fillStyle(0x344e65).fillRect(inset, py, 144 - inset * 2, 4);
      for (let wx = 16; wx < 132; wx += 8) {
        if (wx < inset || wx + 3 > 144 - inset) continue;
        g.fillStyle(0x7895a2).fillRect(wx, py, 1, 4);
        g.fillStyle(0x4e708b).fillRect(wx + 1, py, 2, 4);
      }
      if ((py + 210) % 12 === 0) g.fillStyle(0x91a6ac).fillRect(inset, py, 144 - inset * 2, 1);
    }
    g.fillStyle(0xede6d0).fillRect(outer, py, 2, 4);
    g.fillStyle(0x9fa99f).fillRect(142 - outer, py, 2, 4);
    left.push({ x: inset, y: py });
    right.push({ x: 144 - inset, y: py });
  }
  for (const edge of [left, right]) {
    g.lineStyle(2, 0xeee6ca).beginPath().moveTo(edge[0].x, edge[0].y);
    for (const p of edge) g.lineTo(p.x, p.y);
    g.strokePath();
  }
  g.fillStyle(0xc8c9bc).fillRect(16, -205, 112, 4).fillRect(40, -145, 64, 5);
  g.fillStyle(0x919e9f).fillRect(42, -140, 60, 3);
  g.fillStyle(0x34516c).fillCircle(72, -175, 22);
  g.lineStyle(2, 0xe4e7d8).strokeCircle(72, -175, 22);
  g.lineStyle(4, 0xe4e7d8).beginPath().moveTo(77, -192).lineTo(60, -171).lineTo(85, -171).strokePath();
  g.lineBetween(77, -192, 77, -158);
  g.fillStyle(0x9fa9a5).fillRect(-2, -20, 148, 20);
  g.fillStyle(0x304b61).fillRect(55, -19, 34, 19);
  g.fillStyle(0x83abb7).fillRect(58, -16, 12, 15).fillRect(74, -16, 12, 15);
  obstacle(x + 72, y - 23, 152, 52);
}

export function drawLandmark(scene: Phaser.Scene, x: number, y: number, kind: Landmark, obstacle: Obstacle): void {
  if (kind === 'avengers') {
    drawAvengersTower(scene, x, y, obstacle);
    return;
  }
  if (kind === 'baxter') {
    drawBaxterTower(scene, x, y, obstacle);
    return;
  }
  const g = scene.add.graphics().setPosition(x, y).setDepth(y);
  if (kind === 'sanctum') g.setScale(1.2, 1);
  const wall = kind === 'bugle' ? 0x9b8a6a : 0x835d56;
  g.fillStyle(0x303d45, 0.25).fillRect(-4, -10, 168, 20);
  g.fillStyle(0x465563).fillRect(144, -160, 12, 160);
  g.fillStyle(wall).fillRect(0, -160, 144, 160);
  // Marcos de piedra, hileras de ventanas y relieves originales en pixel art.
  for (let floor = 0; floor < 5; floor++) {
    const fy = -148 + floor * 25;
    g.fillStyle(0xd2c7b4).fillRect(0, fy + 20, 144, 3);
    for (let col = 0; col < 5; col++) {
      const fx = 8 + col * 27;
      g.fillStyle(0x525a61).fillRect(fx - 1, fy - 1, 21, 20);
      g.fillStyle(0x314550).fillRect(fx, fy, 18, 18);
      g.fillStyle(0x78939f).fillRect(fx + 2, fy + 2, 4, 14);
      g.fillStyle(0xadbcb8).fillRect(fx, fy + 8, 18, 1);
    }
  }
  g.fillStyle(0xe0d8c2).fillRect(-4, -163, 152, 5).fillRect(-3, -28, 150, 5);
  g.fillStyle(0x3a4e5b).fillRect(57, -23, 30, 23);
  g.fillStyle(0x98bcc4).fillRect(60, -21, 10, 18).fillRect(74, -21, 10, 18);
  g.fillStyle(0xcac4b8).fillRect(52, -2, 40, 4);

  if (kind === 'bugle') {
    g.fillStyle(0x64676a).fillRect(5, -172, 132, 8);
    g.fillStyle(0x404a50).fillRect(13, -194, 2, 23);
    g.fillStyle(0x53575b).fillRect(26, -181, 3, 10).fillRect(117, -181, 3, 10);
    scene.add.text(x + 6, y - 190, 'DAILY BUGLE', { fontFamily: 'monospace', fontSize: '20px',
      color: '#c74d48', fontStyle: 'bold', stroke: '#643a3c', strokeThickness: 1 }).setDepth(y).setResolution(1);
    g.fillStyle(0x9f3739).fillRect(24, -31, 96, 12);
    scene.add.text(x + 29, y - 30, 'DAILY BUGLE', { fontFamily: 'monospace', fontSize: '11px', color: '#f0dfbc' }).setDepth(y);
    for (const px of [4, 136]) for (let py = -151; py < -30; py += 12) g.fillStyle(0xbdb7a5).fillRect(px, py, 6, 7);
    // Escalera exterior roja, característica de la referencia.
    for (let py = -145; py < -40; py += 25) {
      g.fillStyle(0x923e3a).fillRect(144, py, 12, 3);
      g.lineStyle(2, 0xb4554b).lineBetween(145, py + 3, 154, py + 24);
      for (let step = 0; step < 4; step++) g.fillStyle(0xd2856c).fillRect(145 + step * 2, py + 5 + step * 5, 5, 1);
    }
  } else if (kind === 'sanctum') {
    g.fillStyle(0x304f48).fillPoints([{ x: -3, y: -151 }, { x: 14, y: -193 },
      { x: 130, y: -193 }, { x: 147, y: -151 }], true);
    for (let tx = 18; tx < 132; tx += 12) g.fillStyle(0x506b60).fillRect(tx, -188, 2, 32);
    g.fillStyle(0x858f81).fillRect(9, -195, 126, 4);
    for (const chimney of [6, 128]) {
      g.fillStyle(0x9d9e8e).fillRect(chimney, -210, 10, 32);
      g.fillStyle(0xc6c5b2).fillRect(chimney - 2, -213, 14, 4);
      g.fillStyle(0x696f66).fillRect(chimney + 1, -220, 6, 7);
    }
    g.fillStyle(0x233d3c).fillCircle(72, -170, 24);
    g.lineStyle(4, 0xb9a57e).strokeCircle(72, -170, 22);
    g.lineStyle(3, 0xb9a57e).lineBetween(56, -187, 88, -153).lineBetween(88, -187, 56, -153);
    g.lineStyle(2, 0xb9a57e).strokeEllipse(66, -172, 16, 38).strokeEllipse(78, -168, 16, 38);
    for (const px of [20, 116]) {
      g.fillStyle(0x616960).fillRect(px - 7, -178, 15, 22);
      g.fillStyle(0xb4afa0).fillRect(px - 7, -179, 15, 3);
      g.fillStyle(0x283c3a).fillRect(px - 4, -175, 9, 15);
    }
    g.fillStyle(0x989b92).fillRect(-2, -151, 7, 124).fillRect(139, -151, 7, 124);
    g.fillStyle(0x3a3c58).fillRect(54, -27, 36, 27);
    for (const px of [30, 108]) g.fillStyle(0xb2ad9c).fillRect(px, -126, 5, 97);
    g.fillStyle(0x777e76).fillRect(51, -84, 42, 4).fillRect(55, -91, 34, 2);
    for (let px = 55; px < 90; px += 6) g.fillStyle(0x343d3c).fillRect(px, -90, 2, 8);
  }
  const scaleX = kind === 'sanctum' ? 1.2 : 1;
  obstacle(x + 72 * scaleX, y - 25, 152 * scaleX, 58);
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
