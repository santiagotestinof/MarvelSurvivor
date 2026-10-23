import type { Rarity } from './CharacterDefinition';

/** Nombre y color de cada rareza (menú de personajes y gacha). */
export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: 'COMÚN', color: 0xb8c4cc, css: '#b8c4cc' },
  rare: { label: 'RARO', color: 0x37b6ff, css: '#37b6ff' },
  epic: { label: 'ÉPICO', color: 0xb44cff, css: '#b44cff' },
  legendary: { label: 'LEGENDARIO', color: 0xf5c518, css: '#f5c518' },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
