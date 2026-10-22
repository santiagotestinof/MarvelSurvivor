import type { Character } from '../entities/Character';
import type { MissileWeapon } from '../systems/MissileWeapon';
import type { PlayerStats } from './PlayerStats';

export interface UpgradeContext {
  stats: PlayerStats;
  player: Character;
  missiles: MissileWeapon;
}

export type UpgradeCategory = 'attack' | 'defense' | 'utility';

/** Nombre y color de cada categoría en la tarjeta de mejora. */
export const UPGRADE_CATEGORIES: Record<UpgradeCategory, { label: string; color: number }> = {
  attack: { label: 'ATAQUE', color: 0xff6b4a },
  defense: { label: 'DEFENSA', color: 0x3ddc84 },
  utility: { label: 'UTILIDAD', color: 0x37b6ff },
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
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'damage',
    name: 'Más daño',
    description: '+20% de daño',
    category: 'attack',
    apply: ({ stats }) => (stats.damageMult *= 1.2),
  },
  {
    id: 'fire-rate',
    name: 'Cadencia',
    description: '+15% de velocidad de disparo',
    category: 'attack',
    apply: ({ stats }) => (stats.cooldownMult *= 0.87),
  },
  {
    id: 'speed',
    name: 'Propulsores',
    description: '+10% de velocidad de movimiento',
    category: 'utility',
    apply: ({ player }) => player.setMoveSpeed(player.moveSpeed * 1.1),
  },
  {
    id: 'health',
    name: 'Armadura',
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
    name: 'Imán',
    description: '+40% de radio para juntar gemas',
    category: 'utility',
    apply: ({ stats }) => (stats.pickupRadius *= 1.4),
  },
  {
    id: 'range',
    name: 'Alcance',
    description: '+20% de alcance de disparo',
    category: 'attack',
    apply: ({ stats }) => (stats.rangeMult *= 1.2),
  },
  {
    id: 'missiles',
    name: 'Minimisiles',
    description: 'Misiles teledirigidos que explotan',
    category: 'attack',
    describe: ({ missiles }) =>
      missiles.level === 0
        ? 'ARMA NUEVA: misiles teledirigidos que explotan'
        : `+1 misil por ráfaga (${missiles.level} → ${missiles.level + 1})`,
    isAvailable: ({ missiles }) => !missiles.maxed,
    apply: ({ missiles }) => missiles.levelUp(),
  },
];

/** Elige `count` mejoras distintas al azar entre las disponibles, con el texto según el estado actual. */
export function pickUpgradeChoices(count: number, ctx: UpgradeContext): UpgradeDefinition[] {
  const pool = UPGRADES.filter((upgrade) => upgrade.isAvailable?.(ctx) ?? true);
  const picked: UpgradeDefinition[] = [];
  while (picked.length < count && pool.length > 0) {
    const upgrade = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    picked.push(upgrade.describe ? { ...upgrade, description: upgrade.describe(ctx) } : upgrade);
  }
  return picked;
}
