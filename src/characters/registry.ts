import type Phaser from 'phaser';
import type { CharacterDefinition } from './CharacterDefinition';
import { Character } from '../entities/Character';
import { IronMan } from './ironman/IronMan';
import {
  CAPITAN_ID,
  HULK_ID,
  SPIDERMAN_ID,
  THOR_ID,
  capitanDefinition,
  hulkDefinition,
  spidermanDefinition,
  thorDefinition,
} from './heroDefinitions';
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
  [CAPITAN_ID]: { definition: capitanDefinition, create: (scene, x, y) => new Character(scene, x, y, capitanDefinition) },
  [SPIDERMAN_ID]: { definition: spidermanDefinition, create: (scene, x, y) => new Character(scene, x, y, spidermanDefinition) },
  [THOR_ID]: { definition: thorDefinition, create: (scene, x, y) => new Character(scene, x, y, thorDefinition) },
  [HULK_ID]: { definition: hulkDefinition, create: (scene, x, y) => new Character(scene, x, y, hulkDefinition) },
};

/** Héroe con el que se empieza (ya viene desbloqueado). */
export const STARTER_ID = IRON_MAN_ID;

/** Héroes que se consiguen en el gacha (todos menos el inicial). */
export const GACHA_POOL: readonly string[] = Object.keys(CHARACTER_REGISTRY).filter((id) => id !== STARTER_ID);

export function createCharacter(scene: Phaser.Scene, id: string, x: number, y: number): Character {
  const entry = CHARACTER_REGISTRY[id];
  if (!entry) throw new Error(`Personaje desconocido: ${id}`);
  return entry.create(scene, x, y);
}
