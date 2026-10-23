import type Phaser from 'phaser';

/**
 * Íconos de la tienda de mejoras permanentes: un objeto de Marvel por mejora, dibujados con
 * `tools/meta-icons.mjs` (hoja `public/assets/ui/meta-items.png`, cuadros de 16×16 en una fila).
 * El orden de `META_ICON_IDS` tiene que ser el mismo que el del generador.
 */
export const META_ICON_IDS: readonly string[] = [
  'might', 'armor', 'max-health', 'recovery', 'cooldown', 'area', 'projectile-speed', 'duration',
  'amount', 'move-speed', 'magnet', 'luck', 'growth', 'greed', 'curse', 'revival',
  'omni', 'charm', 'defang', 'reroll', 'skip', 'banish', 'preserve',
];

export const META_ITEM_SIZE = 16;
declare const __BUILD_ID__: string;

export const META_ITEM_TEXTURE = 'meta-items';
export const META_ITEM_PATH = 'assets/ui/meta-items.png';

/** Encola la carga de la hoja de íconos (llamar desde preload). */
export function loadMetaItemIcons(scene: Phaser.Scene): void {
  // ?v= evita que el navegador muestre una hoja vieja guardada en caché.
  scene.load.spritesheet(META_ITEM_TEXTURE, `${META_ITEM_PATH}?v=${__BUILD_ID__}`, { frameWidth: META_ITEM_SIZE, frameHeight: META_ITEM_SIZE });
}

/** Número de cuadro del ícono de una mejora (0 si no se conoce). */
export function metaItemFrame(id: string): number {
  return Math.max(0, META_ICON_IDS.indexOf(id));
}
