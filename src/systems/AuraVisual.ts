import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';

/** Radio (px) de los círculos dibujados en las texturas del aura: el borde exterior está en 62 sobre 128. */
const TEXTURE_RING_RADIUS = 62;

/** Círculo de runas dorado que gira alrededor del dueño (aura de Doctor Strange). */
export class AuraVisual {
  private readonly outer: Phaser.GameObjects.Image;
  private readonly inner: Phaser.GameObjects.Image;
  private pulseLevel = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly owner: Phaser.GameObjects.Sprite,
  ) {
    this.outer = scene.add.image(owner.x, owner.y, TEXTURES.auraOuter).setBlendMode(Phaser.BlendModes.ADD);
    this.inner = scene.add.image(owner.x, owner.y, TEXTURES.auraInner).setBlendMode(Phaser.BlendModes.ADD);
    this.outer.once(Phaser.GameObjects.Events.DESTROY, () => this.inner.destroy());
  }

  /** Destello breve cuando el aura pega. */
  pulse(): void {
    this.pulseLevel = 1;
  }

  /** `radius` es el radio real del daño (px). */
  update(delta: number, radius: number): void {
    this.pulseLevel = Math.max(0, this.pulseLevel - delta / 160);
    const scale = (radius / TEXTURE_RING_RADIUS) * (1 + this.pulseLevel * 0.04);
    const alpha = 0.42 + this.pulseLevel * 0.3;
    const y = this.owner.y - 4;
    const depth = this.owner.y - 0.7;
    this.outer.setPosition(this.owner.x, y).setScale(scale).setAlpha(alpha).setDepth(depth).rotation += delta * 0.0004;
    this.inner.setPosition(this.owner.x, y).setScale(scale).setAlpha(alpha * 0.8).setDepth(depth).rotation -= delta * 0.0007;
  }

  /** Aura de la ulti: se agranda un poco, más brillante. */
  setVisible(visible: boolean): void {
    this.outer.setVisible(visible);
    this.inner.setVisible(visible);
  }

  destroy(): void {
    this.outer.destroy();
  }
}
