import { META } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { PlayerStats } from '../progression/PlayerStats';
import { saveData } from './saveData';

export interface MetaContext {
  stats: PlayerStats;
  player: Character;
}

/**
 * Mejora permanente (se compra con oro en la tienda del menú y vale para todos los personajes).
 * Para sumar otra: agregar una entrada a META_UPGRADES.
 */
export interface MetaUpgradeDefinition {
  id: string;
  /** Nombre en español y, entre paréntesis, el nombre original del juego en el que se inspira. */
  name: string;
  /** Qué hace (texto de la tarjeta), para un nivel dado. */
  effect: (level: number) => string;
  /** Aplica el efecto total de `level` niveles al empezar una ronda. */
  apply: (level: number, ctx: MetaContext) => void;
  maxLevel: number;
  /** Costo del primer nivel; cada nivel siguiente cuesta `META.costGrowth` veces más. */
  baseCost: number;
}

const percent = (value: number): string => `+${Math.round(value * 100)}%`;
const plural = (count: number, one: string, many: string): string => `+${count} ${count === 1 ? one : many}`;

export const META_UPGRADES: readonly MetaUpgradeDefinition[] = [
  {
    id: 'might',
    name: 'Fuerza',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.05)} de daño de las armas`,
    apply: (level, { stats }) => (stats.damageMult *= 1 + level * 0.05),
  },
  {
    id: 'armor',
    name: 'Armadura',
    maxLevel: 3,
    baseCost: 80,
    effect: (level) => `Cada golpe hace ${level} menos de daño`,
    apply: (level, { player }) => (player.armor += level),
  },
  {
    id: 'max-health',
    name: 'Vida máxima',
    maxLevel: 5,
    baseCost: 40,
    effect: (level) => `+${level * 10} de vida máxima`,
    apply: (level, { player }) => player.addMaxHealth(level * 10),
  },
  {
    id: 'recovery',
    name: 'Recuperación',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `Regenera ${(level * 0.2).toFixed(1).replace('.', ',')} de vida por segundo`,
    apply: (level, { stats }) => (stats.regenPerSecond += level * 0.2),
  },
  {
    id: 'cooldown',
    name: 'Enfriamiento',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.04)} de velocidad de ataque`,
    apply: (level, { stats }) => (stats.cooldownMult /= 1 + level * 0.04),
  },
  {
    id: 'area',
    name: 'Área',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.05)} de tamaño de los ataques`,
    apply: (level, { stats }) => (stats.areaMult *= 1 + level * 0.05),
  },
  {
    id: 'projectile-speed',
    name: 'Vel. proyectiles',
    maxLevel: 5,
    baseCost: 40,
    effect: (level) => `${percent(level * 0.1)} de velocidad de los proyectiles`,
    apply: (level, { stats }) => (stats.projectileSpeedMult *= 1 + level * 0.1),
  },
  {
    id: 'duration',
    name: 'Duración',
    maxLevel: 5,
    baseCost: 50,
    effect: (level) => `${percent(level * 0.1)} de duración de misiles y fuego`,
    apply: (level, { stats }) => (stats.durationMult *= 1 + level * 0.1),
  },
  {
    id: 'amount',
    name: 'Cantidad',
    maxLevel: 2,
    baseCost: 250,
    effect: (level) => `${plural(level, 'proyectil', 'proyectiles')} por ataque`,
    apply: (level, { stats }) => (stats.amountBonus += level),
  },
  {
    id: 'move-speed',
    name: 'Vel. movimiento',
    maxLevel: 5,
    baseCost: 40,
    effect: (level) => `${percent(level * 0.04)} de velocidad al moverte`,
    apply: (level, { player }) => player.setMoveSpeed(player.moveSpeed * (1 + level * 0.04)),
  },
  {
    id: 'magnet',
    name: 'Imán',
    maxLevel: 5,
    baseCost: 30,
    effect: (level) => `${percent(level * 0.1)} de alcance para juntar`,
    apply: (level, { stats }) => (stats.pickupRadius *= 1 + level * 0.1),
  },
  {
    id: 'luck',
    name: 'Suerte',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.02)} de crítico y ${percent(level * 0.1)} de oro en enemigos`,
    apply: (level, { stats }) => {
      stats.critChance += level * 0.02;
      stats.goldChanceMult += level * 0.1;
    },
  },
  {
    id: 'growth',
    name: 'Crecimiento',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.08)} de experiencia`,
    apply: (level, { stats }) => (stats.xpMult += level * 0.08),
  },
  {
    id: 'greed',
    name: 'Codicia',
    maxLevel: 5,
    baseCost: 60,
    effect: (level) => `${percent(level * 0.1)} de oro`,
    apply: (level, { stats }) => (stats.goldMult += level * 0.1),
  },
  {
    id: 'curse',
    name: 'Maldición',
    maxLevel: 5,
    baseCost: 80,
    effect: (level) => `${percent(level * 0.1)} de velocidad, vida y cantidad de enemigos`,
    apply: (level, { stats }) => (stats.curseMult += level * 0.1),
  },
  {
    id: 'revival',
    name: 'Resurrección',
    maxLevel: 1,
    baseCost: 300,
    effect: (level) => `${plural(level, 'vida extra', 'vidas extra')} (revivís con la mitad)`,
    apply: (level, { stats }) => (stats.revivals += level),
  },
  {
    id: 'omni',
    name: 'Omni',
    maxLevel: 5,
    baseCost: 100,
    effect: (level) => `${percent(level * 0.03)} de fuerza, velocidad, duración y área`,
    apply: (level, { stats }) => {
      const bonus = 1 + level * 0.03;
      stats.damageMult *= bonus;
      stats.projectileSpeedMult *= bonus;
      stats.durationMult *= bonus;
      stats.areaMult *= bonus;
    },
  },
  {
    id: 'charm',
    name: 'Encanto',
    maxLevel: 5,
    baseCost: 50,
    effect: (level) => `${percent(level * 0.1)} de enemigos (más experiencia y oro)`,
    apply: (level, { stats }) => (stats.spawnMult += level * 0.1),
  },
  {
    id: 'defang',
    name: 'Sin colmillos',
    maxLevel: 3,
    baseCost: 100,
    effect: (level) => `${Math.round(level * 5)}% de los enemigos no te hacen daño`,
    apply: (level, { stats }) => (stats.defangChance += level * 0.05),
  },
  {
    id: 'reroll',
    name: 'Repetición',
    maxLevel: 3,
    baseCost: 80,
    effect: (level) => `${plural(level, 'cambio', 'cambios')} de opciones por ronda`,
    apply: (level, { stats }) => (stats.rerolls += level),
  },
  {
    id: 'skip',
    name: 'Saltear',
    maxLevel: 3,
    baseCost: 80,
    effect: (level) => `${plural(level, 'salto', 'saltos')} por ronda (dan experiencia)`,
    apply: (level, { stats }) => (stats.skips += level),
  },
  {
    id: 'banish',
    name: 'Desterrar',
    maxLevel: 3,
    baseCost: 80,
    effect: (level) => `${plural(level, 'destierro', 'destierros')} por ronda de una mejora`,
    apply: (level, { stats }) => (stats.banishes += level),
  },
  {
    id: 'preserve',
    name: 'Conservar',
    maxLevel: 3,
    baseCost: 120,
    effect: (level) => `${Math.round(level * 20)}% de no gastar repetir, saltear ni desterrar`,
    apply: (level, { stats }) => (stats.preserveChance += level * 0.2),
  },
];

/** Oro que cuesta subir la mejora del nivel actual `level` al siguiente. */
export function costOfNextLevel(def: MetaUpgradeDefinition, level: number): number {
  return Math.round(def.baseCost * META.costGrowth ** level);
}

/** Aplica al jugador todas las mejoras permanentes compradas. */
export function applyMetaUpgrades(ctx: MetaContext): void {
  for (const def of META_UPGRADES) {
    const level = saveData.levelOf(def.id);
    if (level > 0) def.apply(Math.min(level, def.maxLevel), ctx);
  }
}

/** Oro gastado en total en las mejoras compradas (lo que devuelve el reembolso). */
export function totalSpentGold(): number {
  let total = 0;
  for (const def of META_UPGRADES) {
    for (let level = 0; level < Math.min(saveData.levelOf(def.id), def.maxLevel); level++) total += costOfNextLevel(def, level);
  }
  return total;
}

/** Devuelve todo el oro gastado y deja las mejoras en nivel 0 (para rearmar la combinación). */
export function refundAllUpgrades(): void {
  saveData.refund(totalSpentGold());
}
