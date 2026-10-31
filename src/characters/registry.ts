import type Phaser from 'phaser';
import type { CharacterDefinition } from './CharacterDefinition';
import { Character } from '../entities/Character';
import { IronMan } from './ironman/IronMan';
import {
  CAPITAN_ID,
  CAPITAN_SCALE,
  HULK_ID,
  HULK_SCALE,
  SPIDERMAN_ID,
  SPIDERMAN_SCALE,
  STRANGE_ID,
  STRANGE_SCALE,
  THOR_ID,
  THOR_SCALE,
  capitanDefinition,
  hulkDefinition,
  spidermanDefinition,
  strangeDefinition,
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
  [CAPITAN_ID]: { definition: capitanDefinition, create: (scene, x, y) => new Character(scene, x, y, capitanDefinition).setScale(CAPITAN_SCALE) },
  [SPIDERMAN_ID]: { definition: spidermanDefinition, create: (scene, x, y) => new Character(scene, x, y, spidermanDefinition).setScale(SPIDERMAN_SCALE) },
  [THOR_ID]: { definition: thorDefinition, create: (scene, x, y) => new Character(scene, x, y, thorDefinition).setScale(THOR_SCALE) },
  [STRANGE_ID]: { definition: strangeDefinition, create: (scene, x, y) => new Character(scene, x, y, strangeDefinition).setScale(STRANGE_SCALE) },
  [HULK_ID]: { definition: hulkDefinition, create: (scene, x, y) => new Character(scene, x, y, hulkDefinition).setScale(HULK_SCALE) },
};

/** Héroe de respaldo (si el progreso guardado no tiene ninguno). */
export const STARTER_ID = IRON_MAN_ID;

/** Héroes comunes: de entre ellos se sortea el que se regala la primera vez que se entra. */
export const COMMON_HEROES: readonly string[] = Object.keys(CHARACTER_REGISTRY).filter(
  (id) => CHARACTER_REGISTRY[id].definition.rarity === 'common',
);

export function createCharacter(scene: Phaser.Scene, id: string, x: number, y: number): Character {
  const entry = CHARACTER_REGISTRY[id];
  if (!entry) throw new Error(`Personaje desconocido: ${id}`);
  return entry.create(scene, x, y);
}
