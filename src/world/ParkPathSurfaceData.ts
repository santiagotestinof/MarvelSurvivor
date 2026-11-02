import { PARK_PATH_WIDTH, type ParkBounds, type ParkPoint } from './ParkPaths';
import { PLAZA_ENTRY_CLEARANCE } from './ParkPlazaLayout';

export const PATH_CHUNK_SIZE = 256;
export interface PathDistanceChunk { x: number; y: number; distances: Float32Array }

/** Distancia al eje continuo: el ancho ya no depende de la fase de la grilla Wang. */
export function buildPathDistanceChunks(width: number, height: number, park: ParkBounds,
  paths: ParkPoint[][]): Map<string, PathDistanceChunk> {
  const chunks = new Map<string, PathDistanceChunk>();
  const radius = PARK_PATH_WIDTH / 2 + 8 + PLAZA_ENTRY_CLEARANCE;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthSq = vx * vx + vy * vy;
    if (lengthSq === 0) continue;
    const left = Math.max(0, park.left, Math.floor(Math.min(a.x, b.x) - radius));
    const right = Math.min(width - 1, park.right - 1, Math.ceil(Math.max(a.x, b.x) + radius));
    const top = Math.max(0, park.top, Math.floor(Math.min(a.y, b.y) - radius));
    const bottom = Math.min(height - 1, park.bottom - 1, Math.ceil(Math.max(a.y, b.y) + radius));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - a.x) * vx + (y + 0.5 - a.y) * vy) / lengthSq));
      const d = (x + 0.5 - a.x - t * vx) ** 2 + (y + 0.5 - a.y - t * vy) ** 2;
      if (d > radius * radius) continue;
      const cx = Math.floor(x / PATH_CHUNK_SIZE) * PATH_CHUNK_SIZE;
      const cy = Math.floor(y / PATH_CHUNK_SIZE) * PATH_CHUNK_SIZE;
      const key = `${cx}-${cy}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = { x: cx, y: cy, distances: new Float32Array(PATH_CHUNK_SIZE ** 2).fill(Infinity) };
        chunks.set(key, chunk);
      }
      const index = (y - cy) * PATH_CHUNK_SIZE + x - cx;
      chunk.distances[index] = Math.min(chunk.distances[index], d);
    }
  }
  return chunks;
}
