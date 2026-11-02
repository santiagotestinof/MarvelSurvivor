import Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';
import { drawManhattanSidewalk } from './ManhattanSidewalk';
import { drawManhattanAsphalt } from './ManhattanAsphalt';

export const CITY_TILESET = 'city-pixellab';
export const CITY_SOURCE = 'city-pixellab-source';
const CITY_TILES = [12, 15, 8, 9, 0, 11, 14, 7, 13, 4, 1, 10, 3, 2, 5, 6] as const;

function createCityTiles(scene: Phaser.Scene): void {
  if (scene.textures.exists(CITY_TILESET)) return;
  const source = scene.textures.get(CITY_SOURCE).getSourceImage() as HTMLImageElement;
  const atlas = scene.textures.createCanvas(CITY_TILESET, 128, 128);
  if (!atlas) throw new Error('No se pudo crear el atlas urbano.');
  atlas.context.drawImage(source, 0, 0);
  // La marca vial de la pieza central no debe repetirse por todas las calzadas.
  // Se usa su zona de asfalto limpio; las líneas de carril se dibujan sobre el mapa.
  const asphalt = document.createElement('canvas');
  asphalt.width = asphalt.height = 16;
  const ctx = asphalt.getContext('2d');
  if (!ctx) throw new Error('No se pudo extraer el asfalto.');
  ctx.drawImage(source, 64, 48, 16, 16, 0, 0, 16, 16);
  const pattern = atlas.context.createPattern(asphalt, 'repeat');
  if (!pattern) throw new Error('No se pudo crear el patrón de asfalto.');
  atlas.context.fillStyle = pattern;
  atlas.context.fillRect(64, 32, 32, 32);
  atlas.refresh();
  atlas.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Cuatro cruces por intersección, con franjas perpendiculares al recorrido peatonal. */
export function drawCityCrosswalks(g: Phaser.GameObjects.Graphics, roadXs: number[], roadYs: number[]): void {
  for (const rx of roadXs) {
    for (const ry of roadYs) {
      // Cruces norte y sur sobre la avenida vertical.
      for (const y of [ry - 72, ry + 304]) {
        for (let offset = 8; offset < 280; offset += 24) {
          g.fillStyle(0xe3e2d4).fillRect(rx + offset, y, 12, 56);
          g.fillStyle(0xf4f0df).fillRect(rx + offset, y, 12, 2);
        }
        const stopY = y < ry ? y - 14 : y + 68;
        g.fillStyle(0xd7d9cf).fillRect(rx + 8, stopY, 272, 3);
      }
      // Cruces oeste y este sobre la avenida horizontal.
      for (const x of [rx - 72, rx + 304]) {
        for (let offset = 8; offset < 280; offset += 24) {
          g.fillStyle(0xe3e2d4).fillRect(x, ry + offset, 56, 12);
          g.fillStyle(0xf4f0df).fillRect(x, ry + offset, 56, 2);
        }
        const stopX = x < rx ? x - 14 : x + 68;
        g.fillStyle(0xd7d9cf).fillRect(stopX, ry + 8, 3, 272);
      }
    }
  }
}

/** Acabados de vereda exclusivamente visuales: no agregan obstáculos. */
export function drawCityPaving(g: Phaser.GameObjects.Graphics, park: ParkBounds, width: number, height: number,
  roadXs: number[], roadYs: number[]): void {
  createCityTiles(g.scene);
  const size = 32;
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const inRoad = (x: number, y: number) => roadXs.some((rx) => x > rx && x < rx + 288) ||
    roadYs.some((ry) => y > ry && y < ry + 288);
  const vertices = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: cols + 1 }, (_, col) => inRoad(col * size, row * size)));
  const data = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const x = col * size;
      const y = row * size;
      if (x >= park.left && x < park.right && y >= park.top && y < park.bottom) return -1;
      const mask = Number(vertices[row][col]) | (Number(vertices[row][col + 1]) << 1) |
        (Number(vertices[row + 1][col]) << 2) | (Number(vertices[row + 1][col + 1]) << 3);
      return CITY_TILES[mask];
    }));
  const map = g.scene.make.tilemap({ data, tileWidth: size, tileHeight: size });
  const tileset = map.addTilesetImage(CITY_TILESET, CITY_TILESET, size, size, 0, 0);
  if (!tileset) throw new Error('No se pudo cargar el tileset de calles y veredas.');
  map.createLayer(0, tileset, 0, 0)?.setDepth(-999.25);
  drawManhattanAsphalt(g.scene, data,
    g.scene.textures.get(CITY_TILESET).getSourceImage() as HTMLCanvasElement);
  drawManhattanSidewalk(g.scene, data,
    g.scene.textures.get(CITY_TILESET).getSourceImage() as HTMLCanvasElement);
}

/** Rejillas junto al cordón; la piedra se dibuja con las transiciones del tileset. */
export function drawCityCurbs(g: Phaser.GameObjects.Graphics, _width: number, height: number,
  roadXs: number[], roadYs: number[]): void {
  for (const rx of roadXs) {
    for (const x of [rx - 4, rx + 288]) {
      for (let y = 0; y < height; y += 24) {
        if (roadYs.some((ry) => y < ry + 296 && y + 24 > ry - 4)) continue;
        if (y % 240 === 96) {
          g.fillStyle(0x293a43).fillRect(x + (x < rx ? 5 : -10), y + 4, 9, 16);
          for (let slot = 0; slot < 4; slot++) {
            g.fillStyle(0x6c7d80).fillRect(x + (x < rx ? 6 : -9), y + 5 + slot * 4, 7, 1);
          }
        }
      }
    }
  }
}
