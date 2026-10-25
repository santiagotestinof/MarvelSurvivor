import type Phaser from 'phaser';
import { HERO_ICONS } from './heroIcons';
import { META_ITEM_SIZE, META_ITEM_TEXTURE, metaItemFrame } from './metaItemIcons';

/**
 * Íconos provisionales de las mejoras, dibujados como pixel art desde texto (como los sprites
 * provisionales, nada de arte de terceros). Cada carácter es un píxel; '.' es transparente.
 * Para sumar uno: una entrada con el mismo `id` que la mejora.
 */
const PALETTE: Record<string, number> = {
  K: 0x161616,
  W: 0xffffff,
  S: 0xc9d3dd,
  Y: 0xf5c518,
  O: 0xff8a2a,
  R: 0xe23b3b,
  G: 0x3ddc84,
  D: 0x1f8a4c,
  C: 0x37d5ff,
  B: 0x2f6fe0,
  P: 0xb44cff,
  M: 0xff7ac8,
};

const ICONS: Record<string, string[]> = {
  ...HERO_ICONS,
  damage: [
    '....O.....',
    '.O..O..O..',
    '..O.Y.O...',
    '...YYY....',
    'OOYYWYYOO.',
    '...YYY....',
    '..O.Y.O...',
    '.O..O..O..',
    '....O.....',
    '..........',
  ],
  'fire-rate': [
    '..........',
    '.YY...YY..',
    '.OYY..OYY.',
    '..OYY..OYY',
    '...OYY..OY',
    '..OYY..OYY',
    '.OYY..OYY.',
    '.YY...YY..',
    '..........',
    '..........',
  ],
  duration: [
    '..CCCCCC..',
    '.C......C.',
    'C...WW...C',
    'C...WW...C',
    'C...WWW..C',
    'C........C',
    '.C......C.',
    '..CCCCCC..',
    '..........',
    '..........',
  ],
  armor: [
    '.SSSSSSSS.',
    'SSWWSSSSSS',
    'SWWSSSSSSS',
    'SSSSSKSSSS',
    'SSSSSKSSSS',
    '.SSSKKSSS.',
    '.SSSSSSSS.',
    '..SSSSSS..',
    '...SSSS...',
    '....SS....',
  ],
  amount: [
    '..........',
    '.YY....YY.',
    'YWWY..YWWY',
    'YWWY..YWWY',
    '.YY....YY.',
    '....YY....',
    '...YWWY...',
    '...YWWY...',
    '....YY....',
    '..........',
  ],
  area: [
    '.G......G.',
    'G.G....G.G',
    '..........',
    '.....Y....',
    '....YYY...',
    '.....Y....',
    '..........',
    'G.G....G.G',
    '.G......G.',
    '..........',
  ],
  speed: [
    '....R.....',
    '...RR.....',
    '...ROR....',
    '..ROOR....',
    '..ROYOR...',
    '.ROYYOR...',
    '.ROYYYOR..',
    '.RROYWORR.',
    '..RROORR..',
    '...RRRR...',
  ],
  health: [
    '.KKKKKKKK.',
    'KGGGGGGGGK',
    'KGWWGGGGDK',
    'KGWGGGGGDK',
    'KGGGGGGGDK',
    '.KGGGGGDK.',
    '.KGGGGGDK.',
    '..KGGGDK..',
    '...KGDK...',
    '....KK....',
  ],
  repair: [
    '..........',
    '.RR...RR..',
    'RWRR.RRRR.',
    'RWRRRRRRR.',
    'RRRRRRRRR.',
    '.RRRRRRR..',
    '..RRRRR...',
    '...RRR....',
    '....R.....',
    '..........',
  ],
  magnet: [
    '.SSS..SSS.',
    '.SSS..SSS.',
    '.RRR..BBB.',
    '.RR....BB.',
    '.RR....BB.',
    '.RR....BB.',
    '.RRR..BBB.',
    '..RRRBBB..',
    '...RRBB...',
    '..........',
  ],
  missiles: [
    '..........',
    '..R.SSSS..',
    '.RRSWWWWSR',
    'YOKWWRRWWR',
    '.RRSWWWWSR',
    '..R.SSSS..',
    '..........',
    '..........',
    '..........',
    '..........',
  ],
  multishot: [
    '..........',
    '.......CW.',
    '.....CC...',
    '...CC.....',
    '.CCCCCCCW.',
    '...CC.....',
    '.....CC...',
    '.......CW.',
    '..........',
    '..........',
  ],
  pierce: [
    '..........',
    '....RR....',
    '....RR....',
    '....RR....',
    'CCCCWWCCCW',
    '....RR....',
    '....RR....',
    '....RR....',
    '..........',
    '..........',
  ],
  'shot-speed': [
    '..........',
    'S.........',
    '..S..CCC..',
    'S...CCCCW.',
    '..S.CCCCW.',
    'S....CCC..',
    '..........',
    'S.........',
    '..........',
    '..........',
  ],
  crit: [
    '....Y.....',
    '....Y.....',
    '...YWY....',
    'YYYYWYYYY.',
    '.YYWWWYY..',
    '..YYWYY...',
    '..YY.YY...',
    '.YY...YY..',
    '.Y.....Y..',
    '..........',
  ],
  unibeam: [
    '..CCCC....',
    '.CWWWWC...',
    'CWCCCCWC..',
    'CWCKKCWCCC',
    'CWCKKCWWWW',
    'CWCCCCWCCC',
    'CWCCCCWC..',
    '.CWWWWC...',
    '..CCCC....',
    '..........',
  ],
  evolution: [
    '....YY....',
    '....YY....',
    '...YWWY...',
    'YYYWWWWYYY',
    '.YYWWWWYY.',
    '..YYWWYY..',
    '..YYWWYY..',
    '.YYY..YYY.',
    '.YY....YY.',
    '..........',
  ],
  'shield-bounces': [
    '..........',
    '.BBBB.....',
    'BWWWWB.CC.',
    'BWRRWB..C.',
    'BWRRWB.C..',
    'BWWWWB.CC.',
    '.BBBB..C..',
    '......CC..',
    '..........',
    '..........',
  ],
  'missiles-evolution': [
    '......SWR.',
    '.....SWSR.',
    '....SWS...',
    '...SWS....',
    '..SKS.....',
    '.OYO......',
    'ROYOR.....',
    'RROYOR....',
    '.RRORR....',
    '..RRR.....',
  ],
  'burn-duration': [
    '.KKKKKKK..',
    '.KOOOOOK..',
    '..KOOOK...',
    '...KOK....',
    '....K.....',
    '...KYK....',
    '..KYYYK...',
    '.KYYYYYK..',
    '.KKKKKKK..',
    '..........',
  ],
  'burn-damage': [
    '.......W..',
    '...R..WWW.',
    '..RR...W..',
    '..ROR.....',
    '.ROYOR....',
    '.ROYYOR...',
    'ROYWYYOR..',
    'ROYWWYOR..',
    '.RROOORR..',
    '..RRRRR...',
  ],
  'burn-rate': [
    '..R.......',
    '.RR.......',
    '.ROR...Y..',
    'ROYOR...Y.',
    'ROYYOR...Y',
    'ROYWYR..Y.',
    '.ROYOR.Y..',
    '..RRR.....',
    '..........',
    '..........',
  ],
  'burn-size': [
    'W........W',
    '.W......W.',
    '..........',
    '...ROOR...',
    '..ROYYOR..',
    '..RRRRRR..',
    '..........',
    '.W......W.',
    'W........W',
    '..........',
  ],
  range: [
    '....C.....',
    '....C.....',
    '..CCCCC...',
    '.C..C..C..',
    'CCCC.CCCC.',
    '.C..C..C..',
    '..CCCCC...',
    '....C.....',
    '....C.....',
    '..........',
  ],
};

/** Lado de cada ícono en píxeles (antes de escalar). */
export const UPGRADE_ICON_SIZE = 10;

/** Pasivas de la ronda que usan el mismo ícono que su mejora permanente de la tienda (id de la pasiva → id permanente). */
const META_ICON_OF: Record<string, string> = {
  damage: 'might',
  'fire-rate': 'cooldown',
  duration: 'duration',
  amount: 'amount',
  area: 'area',
  speed: 'move-speed',
  health: 'max-health',
  armor: 'armor',
  repair: 'recovery',
  magnet: 'magnet',
  'shot-speed': 'projectile-speed',
  luck: 'luck',
  growth: 'growth',
  greed: 'greed',
  curse: 'curse',
};

/** Pasivas con un ícono propio de Santi (imagen de 32 de ancho): Alcance = visor de Cíclope, Crítico = shuriken, Perforación = cola de Scorpion, Disparo múltiple = tentáculos. */
const IMAGE_ICONS: Record<string, { key: string; path: string }> = {
  range: { key: 'icon-range', path: 'assets/ui/icon-range.png' },
  crit: { key: 'icon-crit', path: 'assets/ui/icon-crit.png' },
  pierce: { key: 'icon-pierce', path: 'assets/ui/icon-pierce.png' },
  multishot: { key: 'icon-multishot', path: 'assets/ui/icon-multishot.png' },
};

declare const __BUILD_ID__: string;

/** Encola la carga de esos íconos (llamar desde preload). */
export function loadImageIcons(scene: Phaser.Scene): void {
  for (const icon of Object.values(IMAGE_ICONS)) scene.load.image(icon.key, `${icon.path}?v=${__BUILD_ID__}`);
}

/**
 * Pone el ícono de una mejora en una imagen. `scale` es el de los íconos chicos (10×10); los de la tienda
 * (32×32) se achican para ocupar el mismo lugar.
 */
export function setUpgradeIcon(icon: Phaser.GameObjects.Image, id: string, scale: number): void {
  const own = IMAGE_ICONS[id];
  if (own && icon.scene.textures.exists(own.key)) {
    icon.setTexture(own.key).setScale((scale * UPGRADE_ICON_SIZE) / META_ITEM_SIZE);
    return;
  }
  const meta = META_ICON_OF[id];
  if (meta && icon.scene.textures.exists(META_ITEM_TEXTURE)) {
    icon.setTexture(META_ITEM_TEXTURE, metaItemFrame(meta)).setScale((scale * UPGRADE_ICON_SIZE) / META_ITEM_SIZE);
  } else {
    const key = upgradeIconKey(id);
    icon.setTexture(icon.scene.textures.exists(key) ? key : '__WHITE').setScale(scale);
  }
}

export function upgradeIconKey(upgradeId: string): string {
  // Todas las evoluciones de héroe comparten la estrella.
  return `upgrade-icon:${upgradeId.startsWith('evolution-') ? 'evolution' : upgradeId}`;
}

/** Genera las texturas de los íconos (llamar una vez, desde BootScene). */
export function registerUpgradeIcons(scene: Phaser.Scene): void {
  for (const [id, rows] of Object.entries(ICONS)) {
    const key = upgradeIconKey(id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const color = PALETTE[char];
        if (color !== undefined) g.fillStyle(color, 1).fillRect(x, y, 1, 1);
      });
    });
    g.generateTexture(key, UPGRADE_ICON_SIZE, UPGRADE_ICON_SIZE);
    g.destroy();
  }
}
