import { TEXTURES } from '../../config/assetKeys';
import type { CharacterDefinition } from '../CharacterDefinition';

export const IRON_MAN_ID = 'ironman';

/**
 * Los spritesheets actuales son provisionales (generados con tools/generate-sprites.mjs).
 * Para reemplazarlos por arte definitivo alcanza con sustituir los PNG respetando el formato:
 * cuadros de 32×32, una fila por dirección (orden de core/direction.ts), los pies en (16, 30).
 */
export const ironManDefinition: CharacterDefinition = {
  id: IRON_MAN_ID,
  displayName: 'Iron Man',
  frame: { width: 32, height: 32 },
  origin: { x: 0.5, y: 30 / 32 },
  body: { width: 10, height: 8, offsetX: 11, offsetY: 22 },
  stats: {
    moveSpeed: 95,
    maxHealth: 100,
    // Repulsores: disparo automático al enemigo más cercano.
    attack: {
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
