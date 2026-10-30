import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { ASSET_PATHS, EFFECT_ANIMS, TEXTURES } from '../config/assetKeys';
import { SCENE_KEYS } from '../config/sceneKeys';
import { loadEnemyAssets, registerEnemyAnimations } from '../enemies/enemyKinds';
import { loadCharacterAssets, registerCharacterAnimations } from '../systems/AnimationSystem';
import { loadMetaItemIcons } from '../ui/metaItemIcons';
import { loadImageIcons, registerUpgradeIcons } from '../ui/upgradeIcons';

declare const __BUILD_ID__: string;

/** Carga todos los recursos, registra las animaciones y pasa a la escena de juego. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.load.setPath(import.meta.env.BASE_URL);

    this.load.image(TEXTURES.ground, `${ASSET_PATHS.ground}?v=${__BUILD_ID__}`);
    this.load.image(TEXTURES.tree, `${ASSET_PATHS.tree}?v=${__BUILD_ID__}`);
    this.load.spritesheet(TEXTURES.rock, `${ASSET_PATHS.rock}?v=${__BUILD_ID__}`, { frameWidth: 16, frameHeight: 12 });
    this.load.spritesheet(TEXTURES.crate, `${ASSET_PATHS.crate}?v=${__BUILD_ID__}`, { frameWidth: 16, frameHeight: 16 });

    this.load.image(TEXTURES.repulsor, ASSET_PATHS.repulsor);
    this.load.image('ironman-menu', `assets/characters/ironman/ironman-menu.png?v=${__BUILD_ID__}`);
    this.load.image(TEXTURES.missile, ASSET_PATHS.missile);
    this.load.image(TEXTURES.shield, ASSET_PATHS.shield);
    this.load.image(TEXTURES.web, ASSET_PATHS.web);
    this.load.image(TEXTURES.thunder, ASSET_PATHS.thunder);
    this.load.image(TEXTURES.auraOuter, `${ASSET_PATHS.auraOuter}?v=${__BUILD_ID__}`);
    this.load.image(TEXTURES.auraInner, `${ASSET_PATHS.auraInner}?v=${__BUILD_ID__}`);
    this.load.image(TEXTURES.spark, `${ASSET_PATHS.spark}?v=${__BUILD_ID__}`);
    this.load.image(TEXTURES.strangeArms, `${ASSET_PATHS.strangeArms}?v=${__BUILD_ID__}`);
    this.load.spritesheet(TEXTURES.fire, ASSET_PATHS.fire, { frameWidth: 32, frameHeight: 32 });
    loadMetaItemIcons(this);
    loadImageIcons(this);
    loadEnemyAssets(this);

    for (const { definition } of Object.values(CHARACTER_REGISTRY)) {
      loadCharacterAssets(this, definition);
    }

    const label = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Cargando...', { color: '#ffffff', fontSize: '16px' })
      .setOrigin(0.5);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => label.destroy());
  }

  create(): void {
    this.createShadowTexture();
    this.createGemTexture();
    this.createCoinTexture();
    this.createMagnetTexture();
    this.createFruitTexture();
    this.createHammerTexture();
    this.createChestTexture();
    this.createBookTexture();
    registerUpgradeIcons(this);
    for (const { definition } of Object.values(CHARACTER_REGISTRY)) {
      registerCharacterAnimations(this, definition);
    }
    registerEnemyAnimations(this);
    if (!this.anims.exists(EFFECT_ANIMS.fire)) {
      this.anims.create({
        key: EFFECT_ANIMS.fire,
        frames: this.anims.generateFrameNumbers(TEXTURES.fire, { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    this.scene.start(SCENE_KEYS.menu);
  }

  /** Gema de experiencia provisional: rombo celeste. */
  private createGemTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x0b4a6b, 1).fillPoints([{ x: 4, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 8 }, { x: 0, y: 4 }], true);
    g.fillStyle(0x37d5ff, 1).fillPoints([{ x: 4, y: 1 }, { x: 7, y: 4 }, { x: 4, y: 7 }, { x: 1, y: 4 }], true);
    g.fillStyle(0xd9f7ff, 1).fillRect(3, 2, 2, 2);
    g.generateTexture(TEXTURES.gem, 8, 8);
    g.destroy();
  }

  /** Moneda de oro provisional: círculo dorado con brillo. */
  private createCoinTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x7a4a00, 1).fillCircle(4, 4, 4);
    g.fillStyle(0xffc933, 1).fillCircle(4, 4, 3);
    g.fillStyle(0xfff0a6, 1).fillRect(2, 2, 2, 2);
    g.generateTexture(TEXTURES.coin, 8, 8);
    g.destroy();
  }

  /** Imán de experiencia provisional: herradura roja con las puntas plateadas. */
  private createMagnetTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x5a1010, 1).fillRect(0, 0, 10, 10);
    g.clear();
    g.fillStyle(0x7a1414, 1).fillRect(0, 1, 4, 9).fillRect(6, 1, 4, 9).fillRect(0, 6, 10, 4);
    g.fillStyle(0xe23b3b, 1).fillRect(1, 2, 2, 7).fillRect(7, 2, 2, 7).fillRect(1, 7, 8, 2);
    g.fillStyle(0xdfe6ee, 1).fillRect(0, 0, 4, 3).fillRect(6, 0, 4, 3);
    g.fillStyle(0xffffff, 1).fillRect(1, 1, 1, 1);
    g.generateTexture(TEXTURES.magnet, 10, 10);
    g.destroy();
  }

  /** Martillo de Thor (provisional): cabeza de metal con franja y mango de cuero. */
  private createHammerTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2a303c, 1).fillRect(1, 0, 12, 8);
    g.fillStyle(0x9aa6b8, 1).fillRect(2, 1, 10, 6);
    g.fillStyle(0xdfe6ee, 1).fillRect(2, 1, 10, 2);
    g.fillStyle(0x6d788a, 1).fillRect(2, 5, 10, 2);
    g.fillStyle(0x2a303c, 1).fillRect(6, 8, 2, 7);
    g.fillStyle(0x7a4a1e, 1).fillRect(6, 8, 2, 6);
    g.fillStyle(0xe0b84a, 1).fillRect(5, 13, 4, 1);
    g.generateTexture(TEXTURES.hammer, 14, 15);
    g.destroy();
  }

  /** Fruta que cura (provisional): manzana roja con hojita. */
  private createFruitTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x6b1010, 1).fillRect(1, 3, 8, 6).fillRect(2, 2, 6, 8);
    g.fillStyle(0xe03030, 1).fillRect(2, 3, 6, 6).fillRect(3, 2, 4, 7);
    g.fillStyle(0xff8a8a, 1).fillRect(3, 4, 1, 2);
    g.fillStyle(0x5a3a12, 1).fillRect(5, 0, 1, 2);
    g.fillStyle(0x4cc04c, 1).fillRect(6, 1, 2, 1);
    g.generateTexture(TEXTURES.fruit, 10, 10);
    g.destroy();
  }

  /** Cofre provisional: caja de madera con refuerzos dorados y cerradura. */
  private createChestTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3b230d, 1).fillRect(0, 2, 14, 10);
    g.fillStyle(0x8a5a22, 1).fillRect(1, 3, 12, 8);
    g.fillStyle(0xb57a30, 1).fillRect(1, 3, 12, 3);
    g.fillStyle(0xf2c53d, 1).fillRect(0, 6, 14, 1).fillRect(3, 3, 1, 8).fillRect(10, 3, 1, 8);
    g.fillStyle(0xfff0a6, 1).fillRect(6, 6, 2, 3);
    g.fillStyle(0x3b230d, 1).fillRect(7, 7, 1, 1);
    g.generateTexture(TEXTURES.chest, 14, 12);
    g.destroy();
  }

  /** Libro secreto (easter egg): tapa azul con lomo y un destello dorado. */
  private createBookTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x10203f, 1).fillRect(0, 1, 12, 13);
    g.fillStyle(0x2a52a8, 1).fillRect(1, 2, 10, 11);
    g.fillStyle(0x1b3677, 1).fillRect(1, 2, 2, 11);
    g.fillStyle(0xf4efe0, 1).fillRect(3, 13, 8, 1);
    g.fillStyle(0xf2c53d, 1).fillRect(5, 4, 4, 1).fillRect(5, 6, 4, 1).fillRect(6, 8, 2, 3);
    g.fillStyle(0xfff0a6, 1).fillRect(6, 5, 2, 1);
    g.generateTexture(TEXTURES.book, 12, 14);
    g.destroy();
  }

  /** Sombra elíptica compartida por todos los personajes. */
  private createShadowTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(8, 3, 16, 6);
    g.generateTexture(TEXTURES.shadow, 16, 6);
    g.destroy();
  }
}
