/**
 * Números de juego (balance). Todo lo que se quiera ajustar para probar está acá.
 * Provisional: falta jugarlo bastante para afinar el balance.
 */

function readRoundDurationMs(): number {
  // ?ronda=30 acorta la ronda a 30 segundos (útil para probar el jefe rápido).
  const raw = new URLSearchParams(window.location.search).get('ronda');
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds >= 5 ? seconds * 1000 : 5 * 60 * 1000;
}

export const ROUND = {
  /** Duración de las oleadas. Al terminar aparece el jefe. */
  durationMs: readRoundDurationMs(),
  bossHealthMultiplier: 2.5,
  bossSpeedMultiplier: 1.15,
  bossMinionIntervalMs: 4500,
};

export const PLAYER_HIT = {
  /** Tiempo sin recibir daño después de un golpe. */
  invulnerabilityMs: 700,
};

export const PROGRESSION = {
  /** XP necesaria para pasar del nivel 1 al 2. */
  baseXp: 5,
  /** Cada nivel pide esta cantidad más que el anterior. */
  xpPerLevel: 3,
  /** Opciones de mejora que se ofrecen al subir de nivel. */
  upgradeChoices: 3,
};

export const WAVES = {
  startIntervalMs: 1400,
  endIntervalMs: 450,
  /** Enemigos por aparición: crece de 1 a este valor durante la ronda. */
  maxBatch: 2,
  maxAlive: 60,
  /** Distancia fuera de la pantalla donde aparecen. */
  spawnMargin: 28,
  /** Al final de la ronda los enemigos tienen (1 + growth) veces la vida base. */
  healthGrowth: 1.5,
  speedGrowth: 0.4,
};
