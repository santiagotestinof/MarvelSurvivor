import Phaser from 'phaser';
import { createRandom } from '../core/random';
import type { ParkBounds } from './ParkPaths';

/** Acabados de vereda exclusivamente visuales: no agregan obstáculos. */
export function drawCityPaving(g: Phaser.GameObjects.Graphics, park: ParkBounds, width: number, height: number,
  roadXs: number[], roadYs: number[]): void {
  const random = createRandom(4241);
  const inRoad = (x: number, y: number) => roadXs.some((rx) => x >= rx - 4 && x < rx + 292) ||
    roadYs.some((ry) => y >= ry - 4 && y < ry + 292);
  for (let y = 0; y < height; y += 32) {
    for (let x = 0; x < width; x += 32) {
      if (x >= park.left && x < park.right && y >= park.top && y < park.bottom) continue;
      if (inRoad(x + 16, y + 16)) continue;
      const tone = [0x959b9c, 0x9ea3a2, 0xa5a9a6, 0x999f9e][Math.floor(random() * 4)];
      g.fillStyle(0x69777b).fillRect(x, y, 32, 32);
      g.fillStyle(tone).fillRect(x + 1, y + 1, 30, 30);
      g.fillStyle(0xb9bcb4).fillRect(x + 2, y + 2, 28, 1).fillRect(x + 2, y + 3, 1, 26);
      g.fillStyle(0x838e90).fillRect(x + 2, y + 29, 28, 1);
      for (let i = 0; i < 3; i++) {
        const dx = 4 + Math.floor(random() * 23);
        const dy = 4 + Math.floor(random() * 23);
        g.fillStyle(i === 0 ? 0x899595 : 0xb0b4ad).fillRect(x + dx, y + dy, 1, 1);
      }
      if (random() < 0.025) {
        g.lineStyle(1, 0x7c8787).beginPath().moveTo(x + 8, y + 1).lineTo(x + 11, y + 7)
          .lineTo(x + 9, y + 11).lineTo(x + 14, y + 16).strokePath();
      }
    }
  }
}

export function drawCityCurbs(g: Phaser.GameObjects.Graphics, width: number, height: number,
  roadXs: number[], roadYs: number[]): void {
  for (const rx of roadXs) {
    for (const x of [rx - 4, rx + 288]) {
      for (let y = 0; y < height; y += 24) {
        if (roadYs.some((ry) => y < ry + 296 && y + 24 > ry - 4)) continue;
        g.fillStyle(0x535e65).fillRect(x - 1, y, 6, 24);
        g.fillStyle(0xb9b8a9).fillRect(x, y + 1, 4, 22);
        g.fillStyle(0xe0d9bf).fillRect(x, y + 1, 1, 21);
        if (y % 240 === 96) {
          g.fillStyle(0x293a43).fillRect(x + (x < rx ? 5 : -10), y + 4, 9, 16);
          for (let slot = 0; slot < 4; slot++) {
            g.fillStyle(0x6c7d80).fillRect(x + (x < rx ? 6 : -9), y + 5 + slot * 4, 7, 1);
          }
        }
      }
    }
  }
  for (const ry of roadYs) {
    for (const y of [ry - 4, ry + 288]) {
      for (let x = 0; x < width; x += 24) {
        if (roadXs.some((rx) => x < rx + 296 && x + 24 > rx - 4)) continue;
        g.fillStyle(0x535e65).fillRect(x, y - 1, 24, 6);
        g.fillStyle(0xb9b8a9).fillRect(x + 1, y, 22, 4);
        g.fillStyle(0xe0d9bf).fillRect(x + 1, y, 21, 1);
      }
    }
  }
}
