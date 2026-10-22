/** Claves de textura y rutas de los recursos que no pertenecen a un personaje. */
export const TEXTURES = {
  ground: 'ground',
  tree: 'tree',
  rock: 'rock',
  crate: 'crate',
  shadow: 'shadow',
} as const;

/** Rutas relativas a /public (la base se aplica en BootScene). */
export const ASSET_PATHS = {
  ground: 'assets/tiles/ground.png',
  tree: 'assets/props/tree.png',
  rock: 'assets/props/rock.png',
  crate: 'assets/props/crate.png',
} as const;
