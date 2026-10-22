/**
 * Las 8 direcciones de movimiento/orientación.
 * El valor numérico es la FILA que ocupa cada dirección en los spritesheets de personajes
 * (ver tools/generate-sprites.mjs). Si se cambia este orden hay que regenerar los sprites.
 */
export enum Direction {
  Down = 0,
  DownLeft = 1,
  Left = 2,
  UpLeft = 3,
  Up = 4,
  UpRight = 5,
  Right = 6,
  DownRight = 7,
}

export const ALL_DIRECTIONS: readonly Direction[] = [
  Direction.Down,
  Direction.DownLeft,
  Direction.Left,
  Direction.UpLeft,
  Direction.Up,
  Direction.UpRight,
  Direction.Right,
  Direction.DownRight,
];

export const DIRECTION_NAMES = [
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
  'right',
  'down-right',
] as const;

// Sectores de 45° empezando en "derecha" y girando en sentido horario (el eje Y de pantalla crece hacia abajo).
const SECTOR_TO_DIRECTION: readonly Direction[] = [
  Direction.Right,
  Direction.DownRight,
  Direction.Down,
  Direction.DownLeft,
  Direction.Left,
  Direction.UpLeft,
  Direction.Up,
  Direction.UpRight,
];

/** Convierte un vector de movimiento (coordenadas de pantalla) en una de las 8 direcciones. */
export function directionFromVector(x: number, y: number): Direction {
  const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  return SECTOR_TO_DIRECTION[(sector + 8) % 8];
}
