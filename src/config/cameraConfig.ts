export const CAMERA_CONFIG = {
  /** Suavizado del seguimiento (0 = no se mueve, 1 = pegada al personaje). */
  followLerp: 0.12,
  /** Alto aproximado, en píxeles del mundo, que se quiere ver en pantalla. */
  targetViewHeight: 270,
  /** El zoom siempre es un entero para que el pixel art quede nítido. */
  minZoom: 2,
  maxZoom: 6,
  /** En la ronda se aleja la cámara (todo se ve más chico y entra más mapa). 1 = como antes. */
  roundZoomFactor: 0.7,
} as const;

/** Zoom entero que muestra al menos ~360×270 unidades del mundo (sirve también para celulares en vertical). */
export function computeZoom(viewportWidth: number, viewportHeight: number): number {
  const zoom = Math.round(Math.min(viewportWidth / 360, viewportHeight / CAMERA_CONFIG.targetViewHeight));
  return Math.min(CAMERA_CONFIG.maxZoom, Math.max(1, zoom));
}

/** Zoom de la ronda: más lejano que el de los menús, en pasos de 0,25 para que el pixel art siga prolijo. */
export function computeRoundZoom(viewportWidth: number, viewportHeight: number): number {
  const raw = Math.min(viewportWidth / 360, viewportHeight / CAMERA_CONFIG.targetViewHeight) * CAMERA_CONFIG.roundZoomFactor;
  const stepped = Math.round(raw * 4) / 4;
  return Math.min(CAMERA_CONFIG.maxZoom, Math.max(1.5, stepped));
}
