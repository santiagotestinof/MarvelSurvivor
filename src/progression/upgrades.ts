import type { Character } from '../entities/Character';
import type { PlayerStats } from './PlayerStats';

export interface UpgradeContext {
  stats: PlayerStats;
  player: Character;
}

/** Una mejora que se puede elegir al subir de nivel. Para sumar otra: agregar una entrada a UPGRADES. */
export type UpgradeCategory = 'attack' | 'defense' | 'utility';

export const UPGRADE_CATEGORIES: Record<UpgradeCategory, { label: string; color: number }> = {
  attack: { label: 'ATAQUE', color: 0xff6b4a },
  defense: { label: 'DEFENSA', color: 0x3ddc84 },
  utility: { label: 'UTILIDAD', color: 0x37b6ff },
};

export interface UpgradeDefinition {
  id: string;
  category: UpgradeCategory;
  name: string;
  description: string;
  apply: (ctx: UpgradeContext) => void;
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'damage',
    category: 'attack',
    name: 'Más daño',
    description: '+20% de daño',
    apply: ({ stats }) => (stats.damageMult *= 1.2),
  },
  {
    id: 'fire-rate',
    category: 'attack',
    name: 'Cadencia',
    description: '+15% de velocidad de disparo',
    apply: ({ stats }) => (stats.cooldownMult *= 0.87),
  },
  {
    id: 'speed',
    category: 'utility',
    name: 'Propulsores',
    description: '+10% de velocidad de movimiento',
    apply: ({ player }) => player.setMoveSpeed(player.moveSpeed * 1.1),
  },
  {
    id: 'health',
    category: 'defense',
    name: 'Armadura',
    description: '+25 de vida máxima y cura 25',
    apply: ({ player }) => player.addMaxHealth(25),
  },
  {
    id: 'repair',
    category: 'defense',
    name: 'Reparación',
    description: 'Recupera 40 de vida',
    apply: ({ player }) => player.heal(40),
  },
  {
    id: 'magnet',
    category: 'utility',
    name: 'Imán',
    description: '+40% de radio para juntar gemas',
    apply: ({ stats }) => (stats.pickupRadius *= 1.4),
  },
  {
    id: 'range',
    category: 'attack',
    name: 'Alcance',
    description: '+20% de alcance de disparo',
    apply: ({ stats }) => (stats.rangeMult *= 1.2),
  },
];

/** Elige `count` mejoras distintas al azar. */
export function pickUpgradeChoices(count: number): UpgradeDefinition[] {
  const pool = [...UPGRADES];
  const picked: UpgradeDefinition[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}
