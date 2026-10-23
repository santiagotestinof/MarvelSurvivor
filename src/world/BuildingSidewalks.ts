import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

/** Mobiliario en las veredas exteriores, delante de las fachadas. */
export function buildBuildingSidewalks(scene: Phaser.Scene, park: ParkBounds, width: number, height: number,
  obstacle: (x: number, y: number, w: number, h: number) => unknown): void {
  const fixtures: Array<{ x: number; y: number; variant: number }> = [];
  for (const x of [168, width - 176]) {
    for (let y = park.top + 200, i = 0; y < park.bottom; y += 320, i++) fixtures.push({ x, y, variant: i % 3 });
  }
  for (let x = park.left + 192, i = 0; x < park.right; x += 256, i++) {
    if (Math.abs(x - width / 2) < 110) continue;
    fixtures.push({ x, y: 176, variant: i % 3 }, { x, y: height - 144, variant: (i + 1) % 3 });
  }
  for (const { x, y, variant } of fixtures) {
    const g = scene.add.graphics().setPosition(x, y).setDepth(y);
    if (variant === 0) {
      // Hidrante y pequeña caja de servicios.
      g.fillStyle(0x464652).fillRect(-7, -3, 14, 4);
      g.fillStyle(0xab4f43).fillRect(-5, -19, 10, 17).fillRect(-9, -14, 18, 5);
      g.fillStyle(0xd07b5b).fillRect(-4, -18, 3, 13).fillRect(-6, -21, 12, 3);
      g.fillStyle(0x85463e).fillRect(-2, -24, 4, 3);
      g.fillStyle(0xc2a180).fillRect(-1, -13, 3, 3);
      obstacle(x, y - 3, 16, 8);
      g.fillStyle(0x65716e).fillRect(-18, 24, 28, 3);
      g.fillStyle(0x9baba0).fillRect(-16, 23, 24, 1);
    } else if (variant === 1) {
      // Buzón azul y expendedor de diarios rojo.
      g.fillStyle(0x263e58).fillRect(-12, -26, 24, 24).fillRect(-10, -2, 4, 6).fillRect(6, -2, 4, 6);
      g.fillStyle(0x416d93).fillRect(-10, -28, 20, 24);
      g.fillStyle(0x709caf).fillRect(-8, -27, 16, 2);
      g.fillStyle(0x233950).fillRect(-7, -21, 14, 4);
      g.fillStyle(0xc2d1c7).fillRect(-4, -13, 8, 5);
      obstacle(x, y, 24, 10);
      g.fillStyle(0x8e4440).fillRect(-10, 29, 20, 23);
      g.fillStyle(0xddddbe).fillRect(-7, 32, 14, 12);
      g.fillStyle(0x767d77).fillRect(-5, 34, 10, 2).fillRect(-5, 38, 7, 1);
      g.fillStyle(0x4e3e40).fillRect(-6, 46, 12, 3);
      obstacle(x, y + 50, 20, 8);
    } else {
      // Bicicletero y farol urbano de cuello curvo.
      for (const offset of [-12, 8]) {
        g.fillStyle(0x52636c).fillRect(offset, -14, 3, 16).fillRect(offset + 9, -14, 3, 16);
        g.fillStyle(0xabb8b7).fillRect(offset + 1, -17, 10, 3).fillRect(offset + 1, -14, 1, 12);
      }
      obstacle(x, y - 1, 34, 6);
      g.fillStyle(0x424f59).fillRect(-3, 29, 6, 4).fillRect(-1, -29, 3, 60);
      g.fillStyle(0x9ca8a4).fillRect(0, -29, 1, 57);
      g.fillStyle(0x525e67).fillRect(1, -34, 5, 6).fillRect(5, -37, 15, 4);
      g.fillStyle(0xd6d4b6).fillRect(11, -34, 9, 3);
      obstacle(x, y + 31, 8, 4);
    }
  }
}
