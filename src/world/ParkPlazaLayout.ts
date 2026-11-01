/** Medidas compartidas por la plaza y sus encuentros con el terreno Wang. */
export const PLAZA_WIDTH = 396;
export const PLAZA_HEIGHT = 312;
export const PLAZA_BORDER = 10;
export const PLAZA_ENTRY_CLEARANCE = 24;

export function insidePlaza(x: number, y: number, centerX: number, centerY: number): boolean {
  return ((x - centerX) / (PLAZA_WIDTH / 2 + PLAZA_BORDER)) ** 2 +
    ((y - centerY) / (PLAZA_HEIGHT / 2 + PLAZA_BORDER)) ** 2 <= 1;
}
