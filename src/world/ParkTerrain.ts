import Phaser from 'phaser';
import type { ParkBounds, ParkPoint } from './ParkPaths';
import { PARK_TILE_SIZE, PARK_TILESET_SIZE } from './ParkTerrainData';
import { drawUniformParkPaths } from './ParkPathSurface';

export const PARK_TILESET = 'park-natural-terrain';
export const PARK_NATURAL_SOURCE = 'park-natural-wang-source';
export const PARK_GRASS_SOURCE = 'park-wang-gravel';

/** Conserva el césped original y toma la grava y sus transiciones del nuevo PNG. */
function createNaturalTiles(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARK_TILESET)) return;
  const source = scene.textures.get(PARK_NATURAL_SOURCE).getSourceImage() as HTMLImageElement;
  const grass = scene.textures.get(PARK_GRASS_SOURCE).getSourceImage() as HTMLImageElement;
  for (const image of [source, grass]) {
    if (image.width !== PARK_TILESET_SIZE || image.height !== PARK_TILESET_SIZE) {
      throw new Error('Los tilesets Wang del parque deben medir 128×128 con piezas de 32×32.');
    }
  }
  const atlas = scene.textures.createCanvas(PARK_TILESET, PARK_TILESET_SIZE, PARK_TILESET_SIZE);
  if (!atlas) throw new Error('No se pudo preparar el terreno natural.');
  const ctx = atlas.context;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grass, 0, 0);
  const oldPixels = ctx.getImageData(0, 0, PARK_TILESET_SIZE, PARK_TILESET_SIZE).data;
  ctx.clearRect(0, 0, PARK_TILESET_SIZE, PARK_TILESET_SIZE);
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, PARK_TILESET_SIZE, PARK_TILESET_SIZE);
  // La paleta verde de esta hoja tiene G > R y R < 105. La grava y el borde
  // terroso quedan intactos. Se copian píxeles del tile 6 antiguo (césped puro),
  // con la misma fase local, para que el suelo verde no cambie ni tenga costuras.
  for (let y = 0; y < PARK_TILESET_SIZE; y++) {
    for (let x = 0; x < PARK_TILESET_SIZE; x++) {
      const i = (y * PARK_TILESET_SIZE + x) * 4;
      if (pixels.data[i + 1] <= pixels.data[i] || pixels.data[i] >= 105) continue;
      const old = ((PARK_TILE_SIZE + y % PARK_TILE_SIZE) * PARK_TILESET_SIZE +
        PARK_TILE_SIZE * 2 + x % PARK_TILE_SIZE) * 4;
      for (let channel = 0; channel < 4; channel++) pixels.data[i + channel] = oldPixels[old + channel];
    }
  }
  ctx.putImageData(pixels, 0, 0);
  atlas.refresh();
  atlas.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Césped original y senderos de ancho constante sobre los mismos ejes. Sin colisiones. */
export function buildParkTerrain(scene: Phaser.Scene, width: number, height: number,
  park: ParkBounds, paths: ParkPoint[][]): void {
  createNaturalTiles(scene);
  const size = PARK_TILE_SIZE;
  const map = scene.make.tilemap({
    data: Array.from({ length: Math.ceil(height / size) }, () =>
      Array<number>(Math.ceil(width / size)).fill(12)),
    tileWidth: size,
    tileHeight: size,
  });
  const tileset = map.addTilesetImage(PARK_TILESET, PARK_TILESET, size, size, 0, 0);
  if (!tileset) throw new Error('No se pudo cargar el tileset Wang del parque.');
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('No se pudo crear la capa de terreno del parque.');
  layer.setDepth(-1000);
  drawUniformParkPaths(scene, width, height, park, paths,
    scene.textures.get(PARK_TILESET).getSourceImage() as HTMLCanvasElement);
}
