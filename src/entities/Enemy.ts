import Phaser from 'phaser';
import { enemyAnimationKey, type EnemyKind } from '../enemies/enemyKinds';

export interface EnemyScaling {
  health: number;
  speed: number;
}

/** Enemigo que persigue al jugador en línea recta. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly contactDamage: number;
  readonly maxHealth: number;
  dying = false;

  private currentHealth: number;
  private readonly moveSpeed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, scaling: EnemyScaling) {
    super(scene, x, y, kind.texture, 0);
    this.kind = kind;
    this.maxHealth = Math.round(kind.health * scaling.health);
    this.currentHealth = this.maxHealth;
    this.moveSpeed = kind.speed * scaling.speed;
    this.contactDamage = kind.contactDamage;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(kind.origin.x, kind.origin.y);
    const { width, height, offsetX, offsetY } = kind.body;
    (this.body as Phaser.Physics.Arcade.Body).setSize(width, height).setOffset(offsetX, offsetY);
    this.play(enemyAnimationKey(kind));
  }

  get health(): number {
    return this.currentHealth;
  }

  chase(targetX: number, targetY: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.5) this.setVelocity((dx / distance) * this.moveSpeed, (dy / distance) * this.moveSpeed);
    this.setDepth(this.y);
  }

  /** Devuelve true si el golpe se aplicó. */
  takeDamage(amount: number): boolean {
    if (this.dying) return false;
    this.currentHealth -= amount;

    if (this.currentHealth <= 0) {
      this.die();
    } else {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (this.active) this.clearTint();
      });
    }
    return true;
  }

  private die(): void {
    this.dying = true;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setVelocity(0, 0);
    this.setTintFill(0xffffff);
    this.emit('died', this);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 0.6,
      duration: 160,
      onComplete: () => this.destroy(),
    });
  }
}
