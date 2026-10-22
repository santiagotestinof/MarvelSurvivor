/** Claves de textura y rutas de los recursos que no pertenecen a un personaje ni a un enemigo. */
export const TEXTURES = {
  ground: 'ground',
  tree: 'tree',
  rock: 'rock',
  crate: 'crate',
  shadow: 'shadow',
  repulsor: 'repulsor',
  missile: 'missile',
  fire: 'fire',
  gem: 'xp-gem',
} as const;

/** Animaciones de efectos (no de personajes ni enemigos). */
export const EFFECT_ANIMS = {
  fire: 'fire:burn',
} as const;

/** Rutas relativas a /public (la base se aplica en BootScene). */
export const ASSET_PATHS = {
  ground: 'assets/tiles/ground.png',
  tree: 'assets/props/tree.png',
  rock: 'assets/props/rock.png',
  crate: 'assets/props/crate.png',
  repulsor: 'assets/projectiles/repulsor.png',
  missile: 'assets/projectiles/missile.png',
  /** Hoja de 3 cuadros de 32x32 (círculo plano). */
  fire: 'assets/effects/fire.png',
} as const;
