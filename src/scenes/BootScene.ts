import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { ASSET_PATHS, TEXTURES } from '../config/assetKeys';
import { loadCharacterAssets, registerCharacterAnimations } from '../systems/AnimationSystem';

/** Carga todos los recursos, registra las animaciones y pasa a la escena de juego. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.setPath(import.meta.env.BASE_URL);

    this.load.image(TEXTURES.ground, ASSET_PATHS.ground);
    this.load.image(TEXTURES.tree, ASSET_PATHS.tree);
    this.load.image(TEXTURES.rock, ASSET_PATHS.rock);
    this.load.image(TEXTURES.crate, ASSET_PATHS.crate);

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
    for (const { definition } of Object.values(CHARACTER_REGISTRY)) {
      registerCharacterAnimations(this, definition);
    }
    this.scene.start('GameScene');
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
