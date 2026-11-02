import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';
import { cityCarGeometry, placeCityCar } from './CityCars';

/** Vehículos originales vistos desde arriba, estacionados y con colisión estática. */
export function buildParkedVehicles(scene: Phaser.Scene, park: ParkBounds, rows: number[], width: number, height: number,
  obstacles: Phaser.Physics.Arcade.StaticGroup,
  addObstacle: (x: number, y: number, w: number, h: number) => unknown): void {
  const roadXs = [park.left - 400, park.right + 112];
  const roadYs = [park.top - 400, park.bottom + 112];
  let serial = 0;
  const parkVehicle = (x: number, y: number, vertical: boolean, reverse: boolean): void => {
    const variant = serial++ % 8;
    const car = cityCarGeometry(x, y, vertical, reverse, variant);
    const checkWidth = car.width;
    const checkHeight = car.height;
    const footprint = new Phaser.Geom.Rectangle(x - checkWidth / 2 - 10, y - checkHeight / 2 - 10,
      checkWidth + 20, checkHeight + 20);
    if (obstacles.getChildren().some((object) => Phaser.Geom.Intersects.RectangleToRectangle(
      footprint, (object as Phaser.GameObjects.Rectangle).getBounds()))) return;
    placeCityCar(scene, x, y, car, addObstacle);
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
