import { TEXTURES } from '../../config/assetKeys';
import type { CharacterDefinition } from '../CharacterDefinition';

export const IRON_MAN_ID = 'ironman';

/**
 * Los spritesheets actuales son provisionales (generados con tools/generate-sprites.mjs).
 * Para reemplazarlos por arte definitivo alcanza con sustituir los PNG respetando el formato:
 * cuadros de 48×48 (Iron Man es más grande que el resto), una fila por dirección (orden de core/direction.ts), el suelo en (24, 41) y el cuerpo flota 6 px arriba.
 */
export const ironManDefinition: CharacterDefinition = {
  id: IRON_MAN_ID,
  displayName: 'Iron Man',
  rarity: 'common',
  weaponText: 'Repulsores: disparan solos al enemigo más cercano',
  frame: { width: 48, height: 48 },
  origin: { x: 0.5, y: 41 / 48 },
  body: { width: 10, height: 8, offsetX: 19, offsetY: 37 },
  stats: {
    moveSpeed: 95,
    maxHealth: 100,
    // Repulsores: disparo automático al enemigo más cercano.
    attack: {
      kind: 'bolt',
      cooldownMs: 450,
      damage: 10,
      projectileTexture: TEXTURES.repulsor,
      projectileSpeed: 240,
      aimRange: 200,
      maxDistance: 240,
    },
  },
  sheets: {
    idle: {
      textureKey: 'ironman-idle',
      path: 'assets/characters/ironman/ironman-idle.png',
      frameCount: 4,
      frameRate: 4,
      loop: true,
    },
    walk: {
      textureKey: 'ironman-walk',
      path: 'assets/characters/ironman/ironman-walk.png',
      frameCount: 6,
      frameRate: 10,
      loop: true,
    },
  },
};
