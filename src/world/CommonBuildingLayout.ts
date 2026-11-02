import { commonBuildingKind, type CityEdge, type CommonBuildingKind } from './CommonBuildings';
import type { ParkBounds } from './ParkPaths';

export interface CommonBuildingPlacement {
  x: number;
  baseY: number;
  kind: CommonBuildingKind;
  edge: CityEdge;
  block: string;
}

/** Bloques periféricos con pasillos continuos delante y descansos en cada cruce. */
export function commonBuildingLayout(park: ParkBounds, width: number, height: number,
  pathRows: readonly number[]): CommonBuildingPlacement[] {
  const result: CommonBuildingPlacement[] = [];
  const counts: Record<CityEdge, number> = { west: 0, east: 0, north: 0, south: 0 };
  const center = width / 2;
  const addBlock = (edge: CityEdge, index: number, points: Array<{ x: number; baseY: number }>): void => {
    for (const point of points) {
      result.push({ ...point, edge, block: `${edge}-${index}`,
        kind: commonBuildingKind(edge, counts[edge]++) });
    }
  };

  // ~19 px entre siluetas dentro del bloque; descansos amplios junto a los senderos.
  const bands = [
    { start: park.top + 136, end: pathRows[0] - 120 },
    ...pathRows.slice(0, -1).map((row, i) => ({ start: row + 272, end: pathRows[i + 1] - 120 })),
    { start: pathRows[pathRows.length - 1] + 272, end: park.bottom + 16 },
  ];
  for (const edge of ['west', 'east'] as const) {
    bands.forEach((band, index) => {
      const points: Array<{ x: number; baseY: number }> = [];
      for (let baseY = band.start; baseY <= band.end; baseY += 192) {
        points.push({ x: edge === 'west' ? 8 : width - 112, baseY: baseY + (edge === 'east' ? 8 : 0) });
      }
      addBlock(edge, index, points);
    });
  }

  // Los huecos del frente norte conservan las posiciones de hidrantes, buzón y bicicletero.
  // Los extremos quedan fuera de los corredores de los cruces y el centro sigue abierto al parque.
  const north = [
    [park.left - 40, park.left + 72],
    [park.left + 208, park.left + 320],
    [center + 160, center + 344, center + 464],
  ];
  const south = [
    [park.left - 8, park.left + 104],
    [center - 376, center - 264],
    [center + 168, center + 280],
    [park.right - 200, park.right - 88],
  ];
  north.forEach((xs, index) => addBlock('north', index, xs.map((x) => ({ x, baseY: 176 }))));
  south.forEach((xs, index) => addBlock('south', index, xs.map((x) => ({ x, baseY: height - 16 }))));
  return result;
}
