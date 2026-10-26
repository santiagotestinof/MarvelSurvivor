import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

/** Vehículos originales vistos desde arriba, estacionados y con colisión estática. */
export function buildParkedVehicles(scene: Phaser.Scene, park: ParkBounds, rows: number[], width: number, height: number,
  obstacles: Phaser.Physics.Arcade.StaticGroup,
  addObstacle: (x: number, y: number, w: number, h: number) => unknown): void {
  const roadXs = [park.left - 400, park.right + 112];
  const roadYs = [park.top - 400, park.bottom + 112];
  let serial = 0;
  const parkVehicle = (x: number, y: number, vertical: boolean, reverse: boolean): void => {
    const variant = serial++ % 8;
    const bus = variant === 6;
    const van = variant === 4;
    const taxi = variant === 2;
    const length = bus ? 108 : van ? 68 : 58;
    const breadth = bus ? 34 : 30;
    const bw = vertical ? breadth : length;
    const bh = vertical ? length : breadth;
    const footprint = new Phaser.Geom.Rectangle(x - bw / 2 - 10, y - bh / 2 - 10, bw + 20, bh + 20);
    if (obstacles.getChildren().some((object) => Phaser.Geom.Intersects.RectangleToRectangle(
      footprint, (object as Phaser.GameObjects.Rectangle).getBounds()))) return;
    const g = scene.add.graphics().setPosition(x, y).setDepth(y + bh / 2);
    g.setRotation((vertical ? Math.PI / 2 : 0) + (reverse ? Math.PI : 0));
    const left = -length / 2;
    const right = length / 2;
    const body = [0x466e94, 0x914b43, 0xddb34f, 0x59745c, 0xb3b6ad, 0x4b5364, 0xc6a466, 0x947c9c][variant];
    g.fillStyle(0x252d38, 0.3).fillRect(left - 2, -breadth / 2 + 3, length + 4, breadth);
    // Ruedas sobresalen de la carrocería; interior oscuro y reflejo del neumático.
    for (const wx of [left + 10, right - 15]) {
      for (const wy of [-breadth / 2 - 2, breadth / 2 - 3]) {
        g.fillStyle(0x1c2631).fillRect(wx, wy, 9, 6);
        g.fillStyle(0x62707a).fillRect(wx + 2, wy + 2, 5, 2);
      }
    }
    g.fillStyle(0x27323d).fillRect(left, -breadth / 2 + 2, length, breadth - 4);
    g.fillStyle(body).fillRect(left + 2, -breadth / 2 + 3, length - 4, breadth - 6);
    g.fillStyle(0xe0d8bd).fillRect(left + 4, -breadth / 2 + 3, length - 8, 1);
    g.fillStyle(0x34434c).fillRect(left + 3, breadth / 2 - 5, length - 6, 2);
    // Paragolpes, ópticas y luces traseras.
    g.fillStyle(0x87979c).fillRect(left - 1, -9, 2, 18).fillRect(right - 1, -9, 2, 18);
    g.fillStyle(0xffe2a0).fillRect(right - 4, -11, 3, 5).fillRect(right - 4, 6, 3, 5);
    g.fillStyle(0xc65350).fillRect(left + 1, -10, 3, 4).fillRect(left + 1, 6, 3, 4);
    if (bus) {
      // Bus urbano con techo claro, ventanillas y equipo de aire acondicionado.
      g.fillStyle(0xd3d1bd).fillRect(left + 12, -10, length - 27, 20);
      for (let wx = left + 14; wx < right - 12; wx += 12) {
        g.fillStyle(0x283e55).fillRect(wx, -14, 9, 4).fillRect(wx, 10, 9, 4);
        g.fillStyle(0x78a7bc).fillRect(wx + 1, -14, 5, 1).fillRect(wx + 1, 10, 5, 1);
      }
      g.fillStyle(0x354f64).fillRect(right - 12, -11, 7, 22);
      g.fillStyle(0x9ba6a4).fillRect(-12, -7, 22, 14);
      for (let wx = -8; wx < 8; wx += 4) g.fillStyle(0x6f7c7e).fillRect(wx, -5, 1, 10);
    } else {
      g.fillStyle(0x273e51).fillRect(-14, -11, 26, 22);
      g.fillStyle(0x80acbd).fillRect(7, -9, 5, 18).fillRect(-14, -9, 4, 18);
      g.fillStyle(body).fillRect(-8, -9, van ? 12 : 13, 18);
      g.fillStyle(0xbac8c2).fillRect(-7, -8, 10, 1);
      g.fillStyle(0x617f8c).fillRect(right - 15, -8, 9, 1);
      g.fillStyle(0xa6b4b1).fillRect(-1, -13, 4, 2).fillRect(-1, 11, 4, 2);
      if (taxi) {
        g.fillStyle(0x323d43).fillRect(-6, -4, 11, 8);
        g.fillStyle(0xf9d875).fillRect(-5, -3, 9, 6);
        g.fillStyle(0x514731).fillRect(-3, -1, 5, 2);
      }
    }
    addObstacle(x, y, bw, bh);
  };
  for (const rx of roadXs) {
    for (let y = 128; y < height - 96; y += 228) {
      if (roadYs.some((ry) => y > ry - 160 && y < ry + 448)) continue;
      if (rows.some((row) => Math.abs(y - row) < 132)) continue;
      parkVehicle(rx + 26, y, true, false);
      parkVehicle(rx + 262, y + 28, true, true);
    }
  }
  for (const ry of roadYs) {
    for (let x = 128; x < width - 96; x += 228) {
      if (roadXs.some((rx) => x > rx - 160 && x < rx + 448)) continue;
      if (Math.abs(x - width / 2) < 140) continue;
      parkVehicle(x, ry + 26, false, true);
      parkVehicle(x + 28, ry + 262, false, false);
    }
  }
}
