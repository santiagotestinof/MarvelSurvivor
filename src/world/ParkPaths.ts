export type ParkBounds = { left: number; right: number; top: number; bottom: number };
export type ParkPoint = { x: number; y: number };
export const PARK_PATH_WIDTH = 44;

/** Una única geometría para dibujar senderos y reservar sus márgenes. */
export function parkPaths(park: ParkBounds, rows: number[], cx: number): ParkPoint[][] {
  const vertical: ParkPoint[] = [];
  for (let y = park.top; y <= park.bottom; y += 8) {
    const t = (y - park.top) / (park.bottom - park.top);
    vertical.push({ x: cx + 105 * Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI), y });
  }
  return [vertical, ...rows.map((row, index) => {
    const points: ParkPoint[] = [];
    for (let x = park.left; x <= park.right; x += 8) {
      const t = (x - park.left) / (park.right - park.left);
      points.push({ x, y: row + (index === 1 ? 100 : 76) * Math.sin(t * Math.PI * 2) });
    }
    return points;
  })];
}

export function nearParkPath(paths: ParkPoint[][], x: number, y: number, clearance = 0): boolean {
  const radiusSq = (PARK_PATH_WIDTH / 2 + 7 + clearance) ** 2;
  return paths.some((path) => path.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < radiusSq));
}
