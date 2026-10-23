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
  /** Enemigo sin colmillos: está en el mapa pero no hace daño al tocar. */
  harmless = false;

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
    this.setCollideWorldBounds(true);
    this.play(enemyAnimationKey(kind));
  }

  /** Lo deja sin poder dañar y lo pinta pálido para que se note. */
  defang(): void {
    this.harmless = true;
    this.setAlpha(0.6).setTint(0xb7c4d6);
  }

  get health(): number {
    return this.currentHealth;
  }

  chase(targetX: number, targetY: number, separationX = 0, separationY = 0): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const chaseX = distance > 0.5 ? dx / distance : 0;
    const chaseY = distance > 0.5 ? dy / distance : 0;
    const moveX = chaseX + separationX * 1.8;
    const moveY = chaseY + separationY * 1.8;
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0.001) {
      this.setVelocity((moveX / moveLength) * this.moveSpeed, (moveY / moveLength) * this.moveSpeed);
    } else {
      this.setVelocity(0, 0);
    }
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
        if (!this.active) return;
        if (this.harmless) this.setTint(0xb7c4d6);
        else this.clearTint();
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
