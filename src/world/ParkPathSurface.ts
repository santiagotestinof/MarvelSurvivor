import Phaser from 'phaser';
import { PARK_PATH_WIDTH, type ParkBounds, type ParkPoint } from './ParkPaths';
import { PLAZA_WIDTH, PLAZA_HEIGHT, PLAZA_BORDER, PLAZA_ENTRY_CLEARANCE } from './ParkPlazaLayout';
import { buildPathDistanceChunks, PATH_CHUNK_SIZE } from './ParkPathSurfaceData';

/** Reutiliza el interior y la transición recta del Wang, sin agrandar sus píxeles. */
export function drawUniformParkPaths(scene: Phaser.Scene, width: number, height: number,
  park: ParkBounds, paths: ParkPoint[][], atlas: HTMLCanvasElement): void {
  const context = atlas.getContext('2d');
  if (!context) throw new Error('No se pudo leer el terreno natural.');
  const source = context.getImageData(0, 0, 128, 128).data;
  const chunks = buildPathDistanceChunks(width, height, park, paths);
  const plazaX = (park.left + park.right) / 2;
  const plazaY = (park.top + park.bottom) / 2;
  for (const chunk of chunks.values()) {
    const key = `park-uniform-path-${chunk.x}-${chunk.y}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, PATH_CHUNK_SIZE, PATH_CHUNK_SIZE);
      if (!texture) throw new Error('No se pudo preparar un tramo del sendero.');
      const pixels = texture.context.createImageData(PATH_CHUNK_SIZE, PATH_CHUNK_SIZE);
      for (let i = 0; i < chunk.distances.length; i++) {
        if (!Number.isFinite(chunk.distances[i])) continue;
        const x = chunk.x + i % PATH_CHUNK_SIZE;
        const y = chunk.y + Math.floor(i / PATH_CHUNK_SIZE);
        const distance = Math.sqrt(chunk.distances[i]);
        const rx = PLAZA_WIDTH / 2 + PLAZA_BORDER;
        const ry = PLAZA_HEIGHT / 2 + PLAZA_BORDER;
        const plazaRadius = Math.hypot((x + 0.5 - plazaX) / rx, (y + 0.5 - plazaY) / ry);
        // El desembarque se ensancha sólo hacia dentro de la plaza, sin un escalón exterior.
        const entry = Math.max(0, Math.min(PLAZA_ENTRY_CLEARANCE, (1 - plazaRadius) * Math.min(rx, ry)));
        const halfWidth = PARK_PATH_WIDTH / 2 + entry;
        if (distance > halfWidth + 8) continue;
        // Pieza 6: grava pura. Pieza 3: verde arriba y grava abajo.
        const interior = distance <= halfWidth - 8;
        const sx = interior ? 64 + x % 32 : 96 + (x + y) % 32;
        const sy = interior ? 32 + y % 32 : Math.max(0, Math.min(31, Math.floor(16 + halfWidth - distance)));
        const s = (sy * 128 + sx) * 4;
        // Dejar ver el césped original en la misma fase global; no pegar parches verdes.
        if (source[s + 1] > source[s] && source[s] < 105) continue;
        for (let channel = 0; channel < 4; channel++) pixels.data[i * 4 + channel] = source[s + channel];
      }
      texture.context.putImageData(pixels, 0, 0);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    scene.add.image(chunk.x, chunk.y, key).setOrigin(0).setDepth(-999.5);
  }
}
