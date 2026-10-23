import type { Character } from '../entities/Character';
import type { PlayerStats } from '../progression/PlayerStats';
import { META } from '../config/gameplayConfig';
import { saveData } from './saveData';

export interface MetaContext {
  stats: PlayerStats;
  player: Character;
}

/**
 * Mejora permanente (se compra con oro en el menú y vale para todos los personajes).
 * Para sumar otra: agregar una entrada a META_UPGRADES.
 */
export interface MetaUpgradeDefinition {
  id: string;
  name: string;
  /** Texto del efecto total para un nivel dado (por ejemplo "+20 de vida"). */
  effect: (level: number) => string;
  /** Aplica el efecto total de `level` niveles al empezar una ronda. */
  apply: (level: number, ctx: MetaContext) => void;
  /** Costo del primer nivel; cada nivel siguiente cuesta `META.costGrowth` veces más. */
  baseCost: number;
}

const percent = (value: number): string => `+${Math.round(value * 100)}%`;

export const META_UPGRADES: readonly MetaUpgradeDefinition[] = [
  {
    id: 'vitality',
    name: 'Vitalidad',
    baseCost: 40,
    effect: (level) => `+${level * 10} de vida máxima`,
    apply: (level, { player }) => player.addMaxHealth(level * 10),
  },
  {
    id: 'power',
    name: 'Potencia',
    baseCost: 50,
    effect: (level) => `${percent(level * 0.05)} de daño`,
    apply: (level, { stats }) => (stats.damageMult *= 1 + level * 0.05),
  },
  {
    id: 'haste',
    name: 'Cadencia',
    baseCost: 50,
    effect: (level) => `${percent(level * 0.04)} de velocidad de disparo`,
    apply: (level, { stats }) => (stats.cooldownMult /= 1 + level * 0.04),
  },
  {
    id: 'thrusters',
    name: 'Propulsores',
    baseCost: 40,
    effect: (level) => `${percent(level * 0.04)} de velocidad de movimiento`,
    apply: (level, { player }) => player.setMoveSpeed(player.moveSpeed * (1 + level * 0.04)),
  },
  {
    id: 'magnet',
    name: 'Imán',
    baseCost: 30,
    effect: (level) => `${percent(level * 0.1)} de radio para juntar`,
    apply: (level, { stats }) => (stats.pickupRadius *= 1 + level * 0.1),
  },
  {
    id: 'learning',
    name: 'Aprendizaje',
    baseCost: 60,
    effect: (level) => `${percent(level * 0.08)} de experiencia`,
    apply: (level, { stats }) => (stats.xpMult += level * 0.08),
  },
  {
    id: 'greed',
    name: 'Codicia',
    baseCost: 60,
    effect: (level) => `${percent(level * 0.1)} de oro`,
    apply: (level, { stats }) => (stats.goldMult += level * 0.1),
  },
  {
    id: 'fortune',
    name: 'Suerte',
    baseCost: 60,
    effect: (level) => `${percent(level * 0.1)} de chance de oro en enemigos`,
    apply: (level, { stats }) => (stats.goldChanceMult += level * 0.1),
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
    if (level > 0) def.apply(Math.min(level, META.maxLevel), ctx);
  }
}
