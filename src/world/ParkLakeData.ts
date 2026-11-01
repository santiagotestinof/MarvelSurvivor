export const LAKE_SIZE = 256;
export const LAKE_SCALE = 1.25;
// Centro del área visible (27,47)..(232,207), sin contar los márgenes transparentes.
export const LAKE_ORIGIN = { x: 130, y: 127.5 };
export interface LakeStrip { left: number; top: number; width: number; height: number }

/** Cubre el agua y un margen mínimo de seguridad, sin bloquear las plantas de la orilla. */
export function buildLakeWaterStrips(pixels: Uint8ClampedArray): LakeStrip[] {
  if (pixels.length !== LAKE_SIZE * LAKE_SIZE * 4) throw new Error('El lago debe medir 256×256.');
  const rows = Array.from({ length: LAKE_SIZE }, () => ({ left: LAKE_SIZE, right: -1 }));
  for (let y = 0; y < LAKE_SIZE; y++) for (let x = 0; x < LAKE_SIZE; x++) {
    const i = (y * LAKE_SIZE + x) * 4;
    const r = pixels[i];
    if (pixels[i + 3] < 128 || pixels[i + 1] <= r + 20 || pixels[i + 2] <= r + 20) continue;
    rows[y].left = Math.min(rows[y].left, x);
    rows[y].right = Math.max(rows[y].right, x);
  }
  const strips: LakeStrip[] = [];
  for (let top = 0; top < LAKE_SIZE; top += 4) {
    let left = LAKE_SIZE;
    let right = -1;
    // Dilatación de dos píxeles para que el cuerpo no se meta en el borde del agua.
    for (let y = Math.max(0, top - 2); y < Math.min(LAKE_SIZE, top + 6); y++) {
      left = Math.min(left, rows[y].left);
      right = Math.max(right, rows[y].right);
    }
    if (right < left) continue;
    left = Math.max(0, left - 2);
    right = Math.min(LAKE_SIZE - 1, right + 2);
    const previous = strips[strips.length - 1];
    if (previous && previous.left === left && previous.width === right - left + 1 &&
      previous.top + previous.height === top) previous.height += 4;
    else strips.push({ left, top, width: right - left + 1, height: 4 });
  }
  if (!strips.length) throw new Error('No se pudo identificar el agua del PNG del lago.');
  return strips;
}
