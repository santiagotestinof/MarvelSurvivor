export type ParkBounds = { left: number; right: number; top: number; bottom: number };
export type ParkPoint = { x: number; y: number };
export const PARK_PATH_WIDTH = 44;

/** Tramos rectos unidos por curvas con tangentes horizontales en ambos extremos. */
function curvedOffset(t: number, stops: readonly (readonly [number, number])[]): number {
  for (let i = 1; i < stops.length; i++) {
    const [end, value] = stops[i];
    const [start, previous] = stops[i - 1];
    if (t > end) continue;
    const u = Math.max(0, Math.min(1, (t - start) / (end - start)));
    return previous + (value - previous) * u * u * (3 - 2 * u);
  }
  return stops[stops.length - 1][1];
}

export function parkCrossPathOffset(t: number, index: number): number {
  const bend = index === 1 ? -40 : 40;
  return curvedOffset(t, [[0, 0], [0.18, 0], [0.34, bend], [0.66, bend], [0.82, 0], [1, 0]]);
}

/** Una única geometría para dibujar senderos y reservar sus márgenes. */
export function parkPaths(park: ParkBounds, rows: number[], cx: number): ParkPoint[][] {
  const vertical: ParkPoint[] = [];
  for (let y = park.top; y <= park.bottom; y += 8) {
    const t = (y - park.top) / (park.bottom - park.top);
    const offset = curvedOffset(t, [[0, 0], [0.12, 0], [0.20, -48], [0.36, -48],
      [0.44, 0], [0.56, 0], [0.64, 48], [0.80, 48], [0.88, 0], [1, 0]]);
    vertical.push({ x: cx + offset, y });
  }
  return [vertical, ...rows.map((row, index) => {
    const points: ParkPoint[] = [];
    for (let x = park.left; x <= park.right; x += 8) {
      const t = (x - park.left) / (park.right - park.left);
      points.push({ x, y: row + parkCrossPathOffset(t, index) });
    }
    return points;
  })];
}

export function nearParkPath(paths: ParkPoint[][], x: number, y: number, clearance = 0): boolean {
  const radiusSq = (PARK_PATH_WIDTH / 2 + 7 + clearance) ** 2;
  return paths.some((path) => path.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < radiusSq));
}
