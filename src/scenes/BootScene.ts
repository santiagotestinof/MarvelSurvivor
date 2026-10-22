import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { ASSET_PATHS, TEXTURES } from '../config/assetKeys';
import { SCENE_KEYS } from '../config/sceneKeys';
import { loadEnemyAssets, registerEnemyAnimations } from '../enemies/enemyKinds';
import { loadCharacterAssets, registerCharacterAnimations } from '../systems/AnimationSystem';

/** Carga todos los recursos, registra las animaciones y pasa a la escena de juego. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.load.setPath(import.meta.env.BASE_URL);

    this.load.image(TEXTURES.ground, ASSET_PATHS.ground);
    this.load.image(TEXTURES.tree, ASSET_PATHS.tree);
    this.load.image(TEXTURES.rock, ASSET_PATHS.rock);
    this.load.image(TEXTURES.crate, ASSET_PATHS.crate);

    this.load.image(TEXTURES.repulsor, ASSET_PATHS.repulsor);
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
    for (const { definition } of Object.values(CHARACTER_REGISTRY)) {
      registerCharacterAnimations(this, definition);
    }
    registerEnemyAnimations(this);
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

  /** Sombra elíptica compartida por todos los personajes. */
  private createShadowTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(8, 3, 16, 6);
    g.generateTexture(TEXTURES.shadow, 16, 6);
    g.destroy();
  }
}
