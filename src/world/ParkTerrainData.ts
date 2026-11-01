import { nearParkPath, type ParkBounds, type ParkPoint } from './ParkPaths';
import { insidePlaza, PLAZA_ENTRY_CLEARANCE } from './ParkPlazaLayout';

/** PNG verificado: 128×128, 4 columnas y 4 filas, sin margen ni espaciado. */
export const PARK_TILE_SIZE = 32;
export const PARK_TILESET_SIZE = 128;

// Bits de GRAVA: superior izquierda=1, superior derecha=2,
// inferior izquierda=4, inferior derecha=8. Valores: índices del PNG por filas.
export const PARK_TILE_BY_CORNERS = [12, 15, 8, 9, 0, 11, 14, 7, 13, 4, 1, 10, 3, 2, 5, 6] as const;

export function createParkTerrainData(width: number, height: number, park: ParkBounds,
  paths: ParkPoint[][]): number[][] {
  const size = PARK_TILE_SIZE;
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const plazaX = (park.left + park.right) / 2;
  const plazaY = (park.top + park.bottom) / 2;
  // Un único valor por vértice compartido: las piezas vecinas coinciden en sus conexiones.
  const vertices = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: cols + 1 }, (_, col) => {
      const x = col * size;
      const y = row * size;
      return x >= park.left && x <= park.right && y >= park.top && y <= park.bottom &&
        (nearParkPath(paths, x, y) ||
          (insidePlaza(x, y, plazaX, plazaY) && nearParkPath(paths, x, y, PLAZA_ENTRY_CLEARANCE)));
    }));
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const mask = Number(vertices[row][col]) | (Number(vertices[row][col + 1]) << 1) |
        (Number(vertices[row + 1][col]) << 2) | (Number(vertices[row + 1][col + 1]) << 3);
      return PARK_TILE_BY_CORNERS[mask];
    }));
}
