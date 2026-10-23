import { TEXTURES } from '../config/assetKeys';
import type { ActionSheet, CharacterDefinition } from './CharacterDefinition';

/** Los spritesheets de todos los héroes siguen la misma convención (ver `tools/generate-sprites.mjs`). */
function sheets(id: string): CharacterDefinition['sheets'] {
  const sheet = (action: 'idle' | 'walk', frameCount: number, frameRate: number): ActionSheet => ({
    textureKey: `${id}-${action}`,
    path: `assets/characters/${id}/${id}-${action}.png`,
    frameCount,
    frameRate,
    loop: true,
  });
  return { idle: sheet('idle', 4, 4), walk: sheet('walk', 6, 10) };
}

const FRAME = { width: 32, height: 32 };
const ORIGIN = { x: 0.5, y: 30 / 32 };
const BODY = { width: 10, height: 8, offsetX: 11, offsetY: 22 };

export const CAPITAN_ID = 'capitan';
export const SPIDERMAN_ID = 'spiderman';
export const THOR_ID = 'thor';
export const HULK_ID = 'hulk';

/** Capitán América: el escudo sale, atraviesa a todos y vuelve a su mano. */
export const capitanDefinition: CharacterDefinition = {
  id: CAPITAN_ID,
  displayName: 'Capitán América',
  rarity: 'common',
  weaponText: 'Escudo: va y vuelve atravesando enemigos',
  frame: FRAME,
  origin: ORIGIN,
  body: BODY,
  stats: {
    moveSpeed: 85,
    maxHealth: 130,
    attack: {
      kind: 'shield',
      cooldownMs: 1000,
      damage: 14,
      projectileTexture: TEXTURES.shield,
      projectileSpeed: 190,
      aimRange: 150,
      maxDistance: 120,
    },
  },
  sheets: sheets(CAPITAN_ID),
};

/** Spider-Man: rápido y frágil; sus telarañas frenan a los enemigos. */
export const spidermanDefinition: CharacterDefinition = {
  id: SPIDERMAN_ID,
  displayName: 'Spider-Man',
  rarity: 'rare',
  weaponText: 'Telarañas: disparo rápido que frena a los enemigos',
  frame: FRAME,
  origin: ORIGIN,
  body: BODY,
  stats: {
    moveSpeed: 118,
    maxHealth: 80,
    attack: {
      kind: 'web',
      cooldownMs: 330,
      damage: 6,
      projectileTexture: TEXTURES.web,
      projectileSpeed: 280,
      aimRange: 190,
      maxDistance: 220,
      slowMs: 1500,
      slowFactor: 0.55,
    },
  },
  sheets: sheets(SPIDERMAN_ID),
};

/** Thor: invoca rayos que caen sobre los enemigos cercanos y dañan en área. */
export const thorDefinition: CharacterDefinition = {
  id: THOR_ID,
  displayName: 'Thor',
  rarity: 'epic',
  weaponText: 'Rayos: caen sobre los enemigos y dañan en área',
  frame: FRAME,
  origin: ORIGIN,
  body: BODY,
  stats: {
    moveSpeed: 90,
    maxHealth: 110,
    attack: {
      kind: 'thunder',
      cooldownMs: 850,
      damage: 16,
      projectileTexture: TEXTURES.thunder,
      projectileSpeed: 0,
      aimRange: 170,
      maxDistance: 170,
      radius: 26,
    },
  },
  sheets: sheets(THOR_ID),
};

/** Hulk: lento y con muchísima vida; golpea el piso y empuja a todos los que lo rodean. */
export const hulkDefinition: CharacterDefinition = {
  id: HULK_ID,
  displayName: 'Hulk',
  rarity: 'legendary',
  weaponText: 'Golpe al piso: onda de choque que empuja a todos',
  frame: FRAME,
  origin: ORIGIN,
  body: { width: 12, height: 8, offsetX: 10, offsetY: 22 },
  stats: {
    moveSpeed: 80,
    maxHealth: 190,
    attack: {
      kind: 'quake',
      cooldownMs: 1100,
      damage: 13,
      projectileTexture: TEXTURES.repulsor,
      projectileSpeed: 0,
      aimRange: 60,
      maxDistance: 60,
      radius: 52,
    },
  },
  sheets: sheets(HULK_ID),
};
