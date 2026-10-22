export const CAMERA_CONFIG = {
  /** Suavizado del seguimiento (0 = no se mueve, 1 = pegada al personaje). */
  followLerp: 0.12,
  /** Alto aproximado, en píxeles del mundo, que se quiere ver en pantalla. */
  targetViewHeight: 270,
  /** El zoom siempre es un entero para que el pixel art quede nítido. */
  minZoom: 2,
  maxZoom: 6,
} as const;

export function computeZoom(viewportHeight: number): number {
  const zoom = Math.round(viewportHeight / CAMERA_CONFIG.targetViewHeight);
  return Math.min(CAMERA_CONFIG.maxZoom, Math.max(CAMERA_CONFIG.minZoom, zoom));
}
