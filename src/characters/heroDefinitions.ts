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

/** Todos los héroes usan cuadros de 48×48 con el suelo en (24, 41), igual que Iron Man. */
const FRAME = { width: 48, height: 48 };
const ORIGIN = { x: 0.5, y: 41 / 48 };
const BODY = { width: 10, height: 8, offsetX: 19, offsetY: 37 };

export const CAPITAN_ID = 'capitan';
export const SPIDERMAN_ID = 'spiderman';
export const THOR_ID = 'thor';
export const HULK_ID = 'hulk';
export const STRANGE_ID = 'strange';

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
    moveSpeed: 70.4,
    maxHealth: 130,
    attack: {
      kind: 'shield',
      cooldownMs: 1300,
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
  weaponText: 'Telarañas: disparo rápido que frena un poco a los enemigos',
  frame: FRAME,
  origin: ORIGIN,
  body: BODY,
  stats: {
    moveSpeed: 97.7,
    maxHealth: 80,
    attack: {
      kind: 'web',
      cooldownMs: 650,
      damage: 9,
      projectileTexture: TEXTURES.web,
      projectileSpeed: 280,
      aimRange: 190,
      maxDistance: 220,
      slowMs: 1200,
      slowFactor: 0.7,
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
    moveSpeed: 74.5,
    maxHealth: 110,
    attack: {
      kind: 'thunder',
      cooldownMs: 1300,
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

/** Hulk: lento y con muchísima vida; su zarpazo es un abanico fino (cuerpo a cuerpo) que se puede ir ampliando. */
export const hulkDefinition: CharacterDefinition = {
  id: HULK_ID,
  displayName: 'Hulk',
  rarity: 'legendary',
  weaponText: 'Zarpazo: abanico fino que se ensancha y alarga con mejoras',
  frame: FRAME,
  origin: ORIGIN,
  body: { width: 12, height: 8, offsetX: 10, offsetY: 22 },
  stats: {
    moveSpeed: 73.6,
    maxHealth: 190,
    attack: {
      kind: 'fan',
      cooldownMs: 910,
      damage: 15,
      projectileTexture: TEXTURES.repulsor,
      projectileSpeed: 0,
      aimRange: 72,
      maxDistance: 62,
      arcDegrees: 38,
    },
  },
  sheets: sheets(HULK_ID),
};

/**
 * Doctor Strange: flota (como Iron Man) y siempre se ve de frente, sin dibujo de espalda.
 * Su ataque es un aura de runas que daña seguido a todo lo que se acerca; con Área / Alcance crece.
 * Ulti: "Tiempo detenido" (ver `TimeStopUltimate`).
 */
export const strangeDefinition: CharacterDefinition = {
  id: STRANGE_ID,
  displayName: 'Doctor Strange',
  rarity: 'epic',
  weaponText: 'Aura de runas que daña a los cercanos. Ulti: tiempo detenido',
  // Dibujo de Santi a tamaño original: cuadro de 48×56, suelo en (24, 51) y el cuerpo flota 3 px.
  frame: { width: 48, height: 56 },
  origin: { x: 0.5, y: 51 / 56 },
  body: { width: 8, height: 6, offsetX: 20, offsetY: 48 },
  stats: {
    moveSpeed: 77.3,
    maxHealth: 105,
    attack: {
      kind: 'aura',
      cooldownMs: 520,
      damage: 10,
      projectileTexture: TEXTURES.repulsor,
      projectileSpeed: 0,
      aimRange: 0,
      maxDistance: 0,
      radius: 72,
    },
  },
  sheets: sheets(STRANGE_ID),
};
