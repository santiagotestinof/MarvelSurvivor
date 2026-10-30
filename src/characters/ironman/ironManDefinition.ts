import { TEXTURES } from '../../config/assetKeys';
import { HERO_BASE } from '../../config/gameplayConfig';
import type { CharacterDefinition } from '../CharacterDefinition';

export const IRON_MAN_ID = 'ironman';
// El zoom mínimo de la ronda es 1.5: 2/3 evita reducir el arte por debajo
// de un píxel de pantalla, lo que hacía desaparecer detalles del casco.
export const IRON_MAN_SCALE = 2 / 3;

/**
 * Arte importado de Crear_un_sprite_de_Iron.zip (ver character-studio/iron-man/imported).
 * Cuadros nativos de 92×92, una fila por dirección, suelo en (46, 78).
 */
export const ironManDefinition: CharacterDefinition = {
  id: IRON_MAN_ID,
  displayName: 'Iron Man',
  rarity: 'common',
  weaponText: 'Repulsores: disparan al enemigo más cercano',
  frame: { width: 92, height: 92 },
  origin: { x: 0.5, y: 78 / 92 },
  // La colisión sigue midiendo 10×8 en el mundo, centrada en el mismo suelo.
  body: {
    width: 10 / IRON_MAN_SCALE, height: 8 / IRON_MAN_SCALE,
    offsetX: 46 - 5 / IRON_MAN_SCALE, offsetY: 78 - 4 / IRON_MAN_SCALE,
  },
  stats: {
    moveSpeed: HERO_BASE.moveSpeed,
    maxHealth: 100,
    // Arma principal: repulsores. Los minimisiles son su arma exclusiva (ver `MissileWeapon`).
    attack: {
      kind: 'bolt',
      cooldownMs: 600,
      damage: 9,
      projectileTexture: TEXTURES.repulsor,
      projectileSpeed: 240,
      aimRange: 150,
      maxDistance: 240,
    },
  },
  sheets: {
    idle: {
      textureKey: 'ironman-idle',
      path: 'assets/characters/ironman/ironman-idle.png',
      frameCount: 1,
      frameRate: 1,
      loop: true,
    },
    walk: {
      textureKey: 'ironman-walk',
      path: 'assets/characters/ironman/ironman-walk.png',
      frameCount: 7,
      frameRate: 10,
      loop: true,
    },
  },
};
