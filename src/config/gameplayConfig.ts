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
  bossHealthMultiplier: 1500 / 440,
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
  /** Tipos distintos de mejoras pasivas (no ligadas a un arma) que se pueden tener en una ronda. */
  maxPassiveTypes: 4,
  /** Al saltear una subida de nivel se recibe esta parte de la experiencia que pedía el nivel siguiente. */
  skipXpRatio: 0.4,
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

/** Minimisiles teledirigidos (se desbloquean con la mejora "Minimisiles"). */
export const MISSILES = {
  /** Tiempo entre ráfagas (lo acorta la mejora de cadencia). */
  cooldownMs: 2400,
  damage: 22,
  /** Píxeles por segundo. */
  speed: 170,
  /** Cuánto puede girar por segundo para seguir al objetivo. */
  turnRateDeg: 300,
  /** Si no pega en este tiempo, explota igual. */
  lifetimeMs: 2600,
  /** Distancia a la que busca objetivos (la sube la mejora de alcance). */
  aimRange: 240,
  /** La explosión daña a los cercanos con esta fracción del daño. */
  splashRadius: 24,
  splashDamageRatio: 0.5,
  /** Nivel máximo = misiles por ráfaga. */
  maxLevel: 4,
  /** Veces que hay que haber elegido "Más daño" para que aparezca la evolución (con los misiles al máximo). */
  evolutionDamagePicks: 3,
};

/** Fuego que dejan los misiles evolucionados (Misiles incendiarios). Las mejoras de fuego lo multiplican. */
export const FIRE = {
  durationMs: 2500,
  /** Tiempo entre quemaduras a los enemigos que están dentro. */
  tickMs: 500,
  /** Daño por quemadura (también lo sube "Más daño"). */
  damage: 6,
  radius: 22,
  /** Niveles máximos de cada mejora de fuego. */
  upgradeMaxLevel: 5,
};

/** Mejoras del ataque básico: cuántas veces se puede elegir cada una. */
export const BASIC_ATTACK_LIMITS = {
  /** Disparos por ataque como máximo. */
  maxProjectiles: 4,
  maxPierce: 3,
  maxSpeedUpgrades: 4,
  maxCritChance: 0.5,
  /** Ángulo entre disparos del abanico (radianes). */
  spread: 0.2,
};

/** Oro: se junta en la ronda (props rotos y enemigos) y se gasta en mejoras permanentes del menú. */
export const GOLD = {
  /** Si el jugador pierde, se queda con esta parte del oro juntado. */
  defeatKeepRatio: 0.5,
  /** Oro extra por vencer al jefe. */
  bossBonus: 20,
};

/** Props que se rompen con los disparos: vida y oro (mínimo y máximo) que sueltan. */
export const BREAKABLE_PROPS = {
  crate: { health: 15, gold: { min: 3, max: 6 } },
  rock: { health: 30, gold: { min: 2, max: 5 } },
} as const;

export const META = {
  /** Cada nivel cuesta esta cantidad de veces más que el anterior. */
  costGrowth: 1.6,
};

/** Mejora permanente Resurrección: con cuánta vida vuelve, cuánto tiempo está protegido y la onda que empuja a los enemigos. */
export const REVIVAL = {
  healthRatio: 0.5,
  protectedMs: 2000,
  blastRadius: 90,
  blastDamage: 40,
};

/** Gacha de héroes: se paga con oro; los repetidos devuelven oro según su rareza. */
export const GACHA = {
  pullCost: 100,
  /** Tiradas de la tanda grande ("x10"). */
  multiPulls: 10,
  /** Si pasan tantas tiradas sin héroe épico o mejor, la siguiente garantiza uno. */
  pityPulls: 10,
  /** Probabilidad relativa de cada rareza (se ignoran las rarezas sin héroes). */
  weights: { common: 55, rare: 30, epic: 12, legendary: 3 },
  /** Oro que devuelve un héroe repetido. */
  duplicateGold: { common: 30, rare: 60, epic: 120, legendary: 250 },
} as const;
