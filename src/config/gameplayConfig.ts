/**
 * Números de juego (balance). Todo lo que se quiera ajustar para probar está acá.
 * Provisional: falta jugarlo bastante para afinar el balance.
 */

function readRoundDurationMs(): number {
  // ?ronda=30 acorta la ronda a 30 segundos (útil para probar el jefe rápido).
  const raw = new URLSearchParams(window.location.search).get('ronda');
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds >= 5 ? seconds * 1000 : 15 * 60 * 1000;
}

export const ROUND = {
  /** Duración de las oleadas. Al terminar aparece el jefe. */
  durationMs: readRoundDurationMs(),
  bossHealthMultiplier: 1500 / 440,
  bossSpeedMultiplier: 1.15,
  bossMinionIntervalMs: 4500,
};

/**
 * Rareza de las mejoras de la ronda: al ofrecer una mejora con niveles de rareza se sortea común / rara / épica / legendaria
 * (cada una con su valor propio). La Suerte permanente (`stats.luck`) hace más probables las raras.
 */
export const UPGRADE_RARITY = {
  weights: { common: 86, rare: 10, epic: 3, legendary: 1 },
  /** Cuánto sube el peso de cada rareza por nivel de Suerte. */
  luckBoost: { rare: 0.2, epic: 0.5, legendary: 1.4 },
};

/** Evolución del arma principal de cada héroe. */
export const EVOLUTION = {
  /** Veces que hay que haber tomado la pasiva asociada para que salga la evolución. */
  passivePicks: 3,
  /** Escudo rebotador del Capitán: rebotes de base (la mejora "Más rebotes" suma hasta `shieldMaxExtra` más). */
  shieldBounces: 5,
  shieldMaxExtra: 5,
  /** Telaraña inmovilizadora de Spider-Man: cuánto queda inmóvil el enemigo (ms). */
  webFreezeMs: 2500,
  /** Martillo sísmico de Thor: largo y ancho de la onda en línea (px). */
  thorLineLength: 190,
  thorLineWidth: 22,
  /** Dimensión lenta de Strange: cuánto se agranda el aura y cómo frena a los enemigos. */
  strangeRadiusMult: 1.8,
  strangeSlowMs: 900,
  strangeSlowFactor: 0.55,
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
  startIntervalMs: 800,
  endIntervalMs: 220,
  /** Enemigos por aparición: crece de 1 a este valor durante la ronda. */
  maxBatch: 3,
  maxAlive: 160,
  /** Distancia fuera de la pantalla donde aparecen. */
  spawnMargin: 28,
  /** Al final de la ronda los enemigos tienen (1 + healthGrowth) veces la vida base. */
  healthGrowth: 2.4,
  /** Al final de la ronda los enemigos son (1 + speedGrowth) veces más rápidos. */
  speedGrowth: 0.55,
};

/**
 * Oleadas especiales: cada tanto entra de golpe un grupo grande, alternando una manada (todos juntos desde un costado)
 * y un círculo que rodea al jugador. Con `?oleada` en la URL salen cada 15 s para probarlas.
 */
export const SPECIAL_WAVES = {
  /** Cuándo sale la primera y cada cuánto las siguientes (tiempo de la ronda). */
  firstAtMs: 60_000,
  everyMs: 75_000,
  /** Enemigos de la manada y del círculo: crecen de un valor a otro durante la ronda. */
  hordeCount: { from: 20, to: 45 },
  ringCount: { from: 22, to: 40 },
  /** Cuántos enemigos más que el tope normal se aceptan mientras dura la oleada. */
  extraAlive: 60,
};

/** Minimisiles teledirigidos (se desbloquean con la mejora "Minimisiles"). */
export const MISSILES = {
  /** Tiempo entre ráfagas (lo acorta la mejora de cadencia). */
  cooldownMs: 1100,
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
  crate: { health: 40, gold: { min: 3, max: 6 } },
  rock: { health: 60, gold: { min: 2, max: 5 } },
} as const;

/** Probabilidad de que una caja o roca rota suelte un imán que atrae toda la experiencia (y las frutas) del mapa. */
export const PROP_MAGNET_CHANCE = 0.08;

/** Probabilidad (muy baja) de que un enemigo suelte un imán al morir; hay cientos por ronda. */
export const ENEMY_MAGNET_CHANCE = 0.002;

/** Fruta que curan: algunos enemigos la sueltan al morir. Cura una parte de la vida máxima (con un mínimo). */
export const FRUIT = {
  chance: 0.015,
  healFraction: 0.12,
  minHeal: 8,
};

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

/** Tienda de héroes: cada héroe se compra una sola vez con oro, según su rareza. */
export const HERO_SHOP = {
  prices: { common: 300, rare: 800, epic: 2000, legendary: 5000 },
} as const;
