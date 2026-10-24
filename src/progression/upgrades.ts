import { BASIC_ATTACK_LIMITS, FIRE, MISSILES, PROGRESSION } from '../config/gameplayConfig';
import type { AttackKind } from '../characters/CharacterDefinition';
import type { Character } from '../entities/Character';
import { HERO_WEAPONS, HERO_WEAPON_MAX_LEVEL, type HeroWeapon } from '../systems/HeroWeapons';
import type { FireUpgrade, MissileWeapon } from '../systems/MissileWeapon';
import type { PlayerStats } from './PlayerStats';

export interface UpgradeContext {
  stats: PlayerStats;
  player: Character;
  missiles: MissileWeapon;
  /** Cuántas veces se eligió cada mejora en esta ronda (por `id`). */
  taken: Readonly<Record<string, number>>;
  /** Cómo ataca el héroe: algunas mejoras del ataque básico no sirven para todos. */
  basicKind: AttackKind;
  /** Héroe elegido: algunas mejoras son exclusivas de uno. */
  heroId: string;
  /** Arma secundaria exclusiva del héroe (si tiene). */
  heroWeapon: HeroWeapon | null;
}

export type UpgradeCategory = 'attack' | 'defense' | 'utility' | 'evolution';

/** Nombre y color de cada categoría en la tarjeta de mejora. */
export const UPGRADE_CATEGORIES: Record<UpgradeCategory, { label: string; color: number }> = {
  attack: { label: 'ATAQUE', color: 0xff6b4a },
  defense: { label: 'DEFENSA', color: 0x3ddc84 },
  utility: { label: 'UTILIDAD', color: 0x37b6ff },
  evolution: { label: 'EVOLUCIÓN', color: 0xf5c518 },
};

/**
 * Una mejora que se puede elegir al subir de nivel. Para sumar otra: agregar una entrada a UPGRADES
 * y su ícono (mismo `id`) en `ui/upgradeIcons.ts`.
 */
export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  apply: (ctx: UpgradeContext) => void;
  /** Texto según el estado actual (reemplaza a `description` en la tarjeta). */
  describe?: (ctx: UpgradeContext) => string;
  /** Si devuelve false no se ofrece (por ejemplo, un arma al nivel máximo). */
  isAvailable?: (ctx: UpgradeContext) => boolean;
  /**
   * Mejora pasiva (no ligada a un arma): en una ronda solo se pueden tener `PROGRESSION.maxPassiveTypes`
   * tipos distintos; los que ya se tienen se pueden seguir mejorando.
   */
  passive?: boolean;
  /** Si está, la mejora solo le sale a esos héroes. */
  exclusiveTo?: readonly string[];
  /** Peso al sortear las 3 opciones (1 por defecto). Más alto = sale más seguido. */
  weight?: number;
}

const IRON_MAN_ONLY = ['ironman'] as const;
const times = (ctx: UpgradeContext, id: string): number => ctx.taken[id] ?? 0;
const pct = (value: number): string => `${Math.round(value * 100)}%`;

/** Mejora de fuego: solo existe después de evolucionar los misiles. */
function fireUpgrade(kind: FireUpgrade, id: string, name: string, text: string): UpgradeDefinition {
  return {
    id,
    name,
    description: text,
    category: 'attack',
    exclusiveTo: IRON_MAN_ONLY,
    describe: ({ missiles }) => `${text} (nv ${missiles.fireLevels[kind]} → ${missiles.fireLevels[kind] + 1})`,
    isAvailable: ({ missiles }) => missiles.evolved && missiles.fireLevels[kind] < FIRE.upgradeMaxLevel,
    apply: ({ missiles }) => missiles.upgradeFire(kind),
  };
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  // ---- Stats generales
  {
    id: 'damage',
    passive: true,
    name: 'Más daño',
    description: '+20% de daño',
    category: 'attack',
    apply: ({ stats }) => (stats.damageMult *= 1.2),
  },
  {
    id: 'fire-rate',
    passive: true,
    name: 'Cadencia',
    description: '+15% de velocidad de disparo',
    category: 'attack',
    apply: ({ stats }) => (stats.cooldownMult *= 0.87),
  },
  {
    id: 'duration',
    passive: true,
    name: 'Duración',
    description: '+15% de duración de los efectos (portales, fuego, misiles)',
    category: 'attack',
    apply: ({ stats }) => (stats.durationMult *= 1.15),
  },
  {
    id: 'amount',
    passive: true,
    name: 'Cantidad',
    description: '+1 disparo, portal, escudo o rayo en las armas',
    category: 'attack',
    describe: ({ stats }) => `+1 disparo, portal, escudo o rayo en las armas (${stats.amountBonus} → ${stats.amountBonus + 1})`,
    isAvailable: (ctx) => times(ctx, 'amount') < 3,
    apply: ({ stats }) => stats.amountBonus++,
  },
  {
    id: 'area',
    passive: true,
    name: 'Área',
    description: '+15% de área de las armas (aura, explosiones, rayos)',
    category: 'attack',
    apply: ({ stats }) => (stats.areaMult *= 1.15),
  },
  {
    id: 'speed',
    passive: true,
    name: 'Velocidad',
    description: '+10% de velocidad de movimiento',
    category: 'utility',
    apply: ({ player }) => player.setMoveSpeed(player.moveSpeed * 1.1),
  },
  {
    id: 'health',
    passive: true,
    name: 'Vida máxima',
    description: '+25 de vida máxima y cura 25',
    category: 'defense',
    apply: ({ player }) => player.addMaxHealth(25),
  },
  {
    id: 'repair',
    name: 'Reparación',
    description: 'Recupera 40 de vida',
    category: 'defense',
    apply: ({ player }) => player.heal(40),
  },
  {
    id: 'magnet',
    passive: true,
    name: 'Imán',
    description: '+40% de radio para juntar gemas',
    category: 'utility',
    apply: ({ stats }) => (stats.pickupRadius *= 1.4),
  },
  {
    id: 'range',
    passive: true,
    name: 'Alcance',
    description: '+20% de alcance de disparo',
    category: 'attack',
    apply: ({ stats }) => (stats.rangeMult *= 1.2),
  },

  // ---- Ataque básico (repulsor)
  {
    id: 'multishot',
    name: 'Disparo múltiple',
    description: '+1 disparo en abanico',
    category: 'attack',
    describe: ({ stats, basicKind }) =>
      `${basicKind === 'fan' ? '+1 zarpazo en otra dirección' : basicKind === 'thunder' ? '+1 rayo por ataque' : '+1 disparo en abanico'} (${stats.projectileCount} → ${stats.projectileCount + 1})`,
    isAvailable: ({ stats, basicKind }) => basicKind !== 'aura' && stats.projectileCount < BASIC_ATTACK_LIMITS.maxProjectiles,
    apply: ({ stats }) => stats.projectileCount++,
  },
  {
    id: 'pierce',
    name: 'Perforación',
    description: 'El disparo atraviesa +1 enemigo',
    category: 'attack',
    describe: ({ stats }) => `El disparo atraviesa +1 enemigo (${stats.pierce} → ${stats.pierce + 1})`,
    isAvailable: ({ stats, basicKind, heroWeapon }) =>
      (basicKind === 'bolt' || basicKind === 'web' || (basicKind === 'aura' && (heroWeapon?.level ?? 0) > 0)) &&
      stats.pierce < BASIC_ATTACK_LIMITS.maxPierce,
    apply: ({ stats }) => stats.pierce++,
  },
  {
    id: 'shot-speed',
    name: 'Velocidad del disparo',
    description: '+25% de velocidad de los disparos',
    category: 'attack',
    isAvailable: (ctx) =>
      (ctx.basicKind === 'bolt' ||
        ctx.basicKind === 'web' ||
        ctx.basicKind === 'shield' ||
        (ctx.basicKind === 'aura' && (ctx.heroWeapon?.level ?? 0) > 0)) &&
      times(ctx, 'shot-speed') < BASIC_ATTACK_LIMITS.maxSpeedUpgrades,
    apply: ({ stats }) => (stats.projectileSpeedMult *= 1.25),
  },
  {
    id: 'crit',
    name: 'Crítico',
    description: '+10% de probabilidad de doble daño',
    category: 'attack',
    describe: ({ stats }) => `+10% de probabilidad de doble daño (${pct(stats.critChance)} → ${pct(stats.critChance + 0.1)})`,
    isAvailable: ({ stats }) => stats.critChance < BASIC_ATTACK_LIMITS.maxCritChance - 1e-6,
    apply: ({ stats }) => (stats.critChance = Math.min(BASIC_ATTACK_LIMITS.maxCritChance, stats.critChance + 0.1)),
  },

  // ---- Minimisiles y su evolución
  {
    id: 'missiles',
    exclusiveTo: IRON_MAN_ONLY,
    name: 'Minimisiles',
    description: 'Misiles teledirigidos que explotan',
    category: 'attack',
    describe: ({ missiles }) => {
      if (missiles.level === 0) return 'ARMA NUEVA: misiles teledirigidos que explotan';
      const text = `+1 misil por ráfaga (${missiles.level} → ${missiles.level + 1})`;
      return missiles.level + 1 === MISSILES.maxLevel ? `${text}. Al máximo, con Más daño x${MISSILES.evolutionDamagePicks}, evolucionan` : text;
    },
    isAvailable: ({ missiles }) => !missiles.maxed,
    apply: ({ missiles }) => missiles.levelUp(),
  },
  {
    id: 'missiles-evolution',
    exclusiveTo: IRON_MAN_ONLY,
    name: 'Misiles incendiarios',
    description: 'Las explosiones dejan fuego que quema',
    category: 'evolution',
    isAvailable: (ctx) =>
      ctx.missiles.maxed && !ctx.missiles.evolved && times(ctx, 'damage') >= MISSILES.evolutionDamagePicks,
    apply: ({ missiles }) => missiles.evolve(),
    // Es la recompensa de juntar los requisitos: que no tarde en salir.
    weight: 4,
  },
  fireUpgrade('duration', 'burn-duration', 'Fuego duradero', '+30% de duración del fuego'),
  fireUpgrade('damage', 'burn-damage', 'Fuego intenso', '+30% de daño del fuego'),
  fireUpgrade('rate', 'burn-rate', 'Fuego voraz', 'Quema 18% más seguido'),
  fireUpgrade('size', 'burn-size', 'Fuego expansivo', '+20% de tamaño del área'),

  // ---- Armas exclusivas de cada héroe (solo le salen a ese héroe)
  ...Object.entries(HERO_WEAPONS).map(
    ([heroId, weapon]): UpgradeDefinition => ({
      id: weapon.upgradeId,
      name: weapon.name,
      description: weapon.text,
      category: 'attack',
      exclusiveTo: [heroId],
      describe: ({ heroWeapon }) => {
        const level = heroWeapon?.level ?? 0;
        return level === 0 ? `ARMA NUEVA: ${weapon.text}` : `${weapon.levels[level - 1]} (nv ${level} → ${level + 1})`;
      },
      isAvailable: ({ heroWeapon }) => !!heroWeapon && !heroWeapon.maxed,
      apply: ({ heroWeapon }) => heroWeapon?.levelUp(),
    }),
  ),

  // ---- Zarpazo de Hulk (abanico)
  {
    id: 'fan-width',
    name: 'Abanico ancho',
    description: '+25% de ángulo del zarpazo',
    category: 'attack',
    exclusiveTo: ['hulk'],
    describe: (ctx) => `+25% de ángulo del zarpazo (nv ${times(ctx, 'fan-width')} → ${times(ctx, 'fan-width') + 1})`,
    isAvailable: (ctx) => times(ctx, 'fan-width') < HERO_WEAPON_MAX_LEVEL,
    apply: ({ stats }) => (stats.fanAngleMult *= 1.25),
  },
  {
    id: 'fan-reach',
    name: 'Brazos largos',
    description: '+20% de alcance del zarpazo',
    category: 'attack',
    exclusiveTo: ['hulk'],
    describe: (ctx) => `+20% de alcance del zarpazo (nv ${times(ctx, 'fan-reach')} → ${times(ctx, 'fan-reach') + 1})`,
    isAvailable: (ctx) => times(ctx, 'fan-reach') < HERO_WEAPON_MAX_LEVEL,
    apply: ({ stats }) => (stats.fanReachMult *= 1.2),
  },
];


/** Tipos distintos de mejoras pasivas que ya se tomaron en la ronda. */
export function passiveTypesTaken(taken: Readonly<Record<string, number>>): number {
  return UPGRADES.filter((upgrade) => upgrade.passive && (taken[upgrade.id] ?? 0) > 0).length;
}

/** Las mejoras pasivas tomadas en la ronda y cuántas veces se eligió cada una (en orden de aparición en `UPGRADES`). */
export function passivesTaken(taken: Readonly<Record<string, number>>): { id: string; count: number }[] {
  return UPGRADES.filter((upgrade) => upgrade.passive && (taken[upgrade.id] ?? 0) > 0).map((upgrade) => ({
    id: upgrade.id,
    count: taken[upgrade.id],
  }));
}

/** ¿Hay lugar para esta mejora? Las pasivas nuevas se bloquean al llegar al límite de tipos. */
function hasSlot(upgrade: UpgradeDefinition, taken: Readonly<Record<string, number>>): boolean {
  if (!upgrade.passive || (taken[upgrade.id] ?? 0) > 0) return true;
  return passiveTypesTaken(taken) < PROGRESSION.maxPassiveTypes;
}

/** Elige `count` mejoras distintas al azar (según su peso) entre las disponibles, con el texto según el estado. */
export function pickUpgradeChoices(
  count: number,
  ctx: UpgradeContext,
  banished: ReadonlySet<string> = new Set(),
): UpgradeDefinition[] {
  const pool = UPGRADES.filter(
    (upgrade) =>
      !banished.has(upgrade.id) &&
      (!upgrade.exclusiveTo || upgrade.exclusiveTo.includes(ctx.heroId)) &&
      hasSlot(upgrade, ctx.taken) &&
      (upgrade.isAvailable?.(ctx) ?? true),
  );
  const picked: UpgradeDefinition[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, upgrade) => sum + (upgrade.weight ?? 1), 0);
    let roll = Math.random() * total;
    let index = pool.findIndex((upgrade) => (roll -= upgrade.weight ?? 1) <= 0);
    if (index < 0) index = pool.length - 1;
    const upgrade = pool.splice(index, 1)[0];
    picked.push(upgrade.describe ? { ...upgrade, description: upgrade.describe(ctx) } : upgrade);
  }
  return picked;
}
