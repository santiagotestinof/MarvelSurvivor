export const SCENE_KEYS = {
  boot: 'BootScene',
  menu: 'MenuScene',
  game: 'GameScene',
  hud: 'HudScene',
  shop: 'ShopScene',
  characters: 'CharacterScene',
  gacha: 'GachaScene',
} as const;

/** Clave del registro global: hay una ronda en pausa esperando en segundo plano (se volvió al menú sin terminarla). */
export const RUN_ACTIVE_KEY = 'runActive';
