import type Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { CharacterDefinition } from './CharacterDefinition';
import { IronMan } from './ironman/IronMan';
import { IRON_MAN_ID, ironManDefinition } from './ironman/ironManDefinition';

interface CharacterEntry {
  definition: CharacterDefinition;
  create: (scene: Phaser.Scene, x: number, y: number) => Character;
}

/** Catálogo de personajes. Para sumar uno (Thor, Spider-Man...) se agrega una entrada acá. */
export const CHARACTER_REGISTRY: Record<string, CharacterEntry> = {
  [IRON_MAN_ID]: {
    definition: ironManDefinition,
    create: (scene, x, y) => new IronMan(scene, x, y),
  },
};

export function createCharacter(scene: Phaser.Scene, id: string, x: number, y: number): Character {
  const entry = CHARACTER_REGISTRY[id];
  if (!entry) throw new Error(`Personaje desconocido: ${id}`);
  return entry.create(scene, x, y);
}
