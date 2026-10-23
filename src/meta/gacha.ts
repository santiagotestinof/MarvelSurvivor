import { CHARACTER_REGISTRY, GACHA_POOL } from '../characters/registry';
import type { Rarity } from '../characters/CharacterDefinition';
import { RARITY_ORDER } from '../characters/rarity';
import { GACHA } from '../config/gameplayConfig';
import { saveData } from './saveData';

export interface PullResult {
  id: string;
  rarity: Rarity;
  /** true si es la primera vez que sale (se desbloquea). */
  isNew: boolean;
  /** Oro devuelto si ya lo tenías. */
  refund: number;
}

const heroesOf = (rarity: Rarity): string[] => GACHA_POOL.filter((id) => CHARACTER_REGISTRY[id].definition.rarity === rarity);

/** Elige una rareza al azar según los pesos, entre `allowed` (solo las que tienen héroes). */
function rollRarity(allowed: readonly Rarity[]): Rarity {
  const options = allowed.filter((rarity) => heroesOf(rarity).length > 0);
  const total = options.reduce((sum, rarity) => sum + GACHA.weights[rarity], 0);
  let roll = Math.random() * total;
  for (const rarity of options) {
    roll -= GACHA.weights[rarity];
    if (roll <= 0) return rarity;
  }
  return options[options.length - 1];
}

/** Tiradas que faltan para la garantía de un héroe épico o mejor. */
export function pullsUntilGuarantee(): number {
  return Math.max(0, GACHA.pityPulls - saveData.pity);
}

/** ¿Ya están todos los héroes del gacha? */
export function hasEverything(): boolean {
  return GACHA_POOL.every((id) => saveData.isUnlocked(id));
}

/** Hace UNA tirada (sin cobrar): desbloquea el héroe o devuelve oro si ya lo tenía, y actualiza la garantía. */
export function pullOnce(): PullResult {
  const guaranteed = saveData.pity + 1 >= GACHA.pityPulls;
  const high = RARITY_ORDER.filter((rarity) => rarity === 'epic' || rarity === 'legendary');
  const rarity = rollRarity(guaranteed && high.some((r) => heroesOf(r).length > 0) ? high : RARITY_ORDER);
  const pool = heroesOf(rarity);
  const id = pool[Math.floor(Math.random() * pool.length)];

  const isNew = saveData.unlock(id);
  const refund = isNew ? 0 : GACHA.duplicateGold[rarity];
  if (refund > 0) saveData.addGold(refund);
  saveData.setPity(rarity === 'epic' || rarity === 'legendary' ? 0 : saveData.pity + 1);
  return { id, rarity, isNew, refund };
}

/** Cobra y hace `count` tiradas. Devuelve null si no alcanza el oro. */
export function pull(count: number): PullResult[] | null {
  if (!saveData.spend(GACHA.pullCost * count)) return null;
  return Array.from({ length: count }, () => pullOnce());
}
