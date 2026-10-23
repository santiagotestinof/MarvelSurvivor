import Phaser from 'phaser';
import { BREAKABLE_PROPS } from '../config/gameplayConfig';

export type BreakableKind = keyof typeof BREAKABLE_PROPS;

/** Objeto del mapa (caja, roca) que se rompe con los disparos y suelta oro. */
export class BreakableProp {
  private health: number;
  private broken = false;

  constructor(
    readonly kind: BreakableKind,
    private readonly image: Phaser.GameObjects.Image,
    /** Cuerpo de colisión estático (está en el grupo de obstáculos). */
    readonly collider: Phaser.GameObjects.Rectangle,
    private readonly onBroken: (prop: BreakableProp) => void,
  ) {
    this.health = BREAKABLE_PROPS[kind].health;
    collider.setData('prop', this);
  }

  get x(): number {
    return this.collider.x;
  }

  /** Centro del objeto (hacia donde se apunta). */
  get y(): number {
    return this.collider.y;
  }

  get isBroken(): boolean {
    return this.broken;
  }

  /** Cantidad de oro que suelta al romperse. */
  rollGold(): number {
    const { min, max } = BREAKABLE_PROPS[this.kind].gold;
    return Phaser.Math.Between(min, max);
  }

  takeDamage(amount: number): void {
    if (this.broken) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.break();
      return;
    }
    // Sacudida corta para que se note el golpe.
    this.image.setTintFill(0xffffff);
    this.image.scene.time.delayedCall(60, () => this.image.active && this.image.clearTint());
  }

  private break(): void {
    this.broken = true;
    // Al destruir el collider se libera el paso (sale del grupo de obstáculos y pierde el cuerpo).
    this.collider.destroy();
    this.onBroken(this);
    this.image.setTintFill(0xffffff);
    this.image.scene.tweens.add({
      targets: this.image,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.5,
      duration: 180,
      onComplete: () => this.image.destroy(),
    });
  }
}
