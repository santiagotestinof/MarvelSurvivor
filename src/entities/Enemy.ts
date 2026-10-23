import Phaser from 'phaser';
import {
  enemyAnimationKey,
  enemyDirectionFromAngle,
  type EnemyDirection,
  type EnemyKind,
} from '../enemies/enemyKinds';

export interface EnemyScaling {
  health: number;
  speed: number;
}

/** Velocidad máxima de giro visual (radianes/s) para que pase por las vistas diagonales 3/4 de forma natural. */
const FACING_TURN_SPEED = 8.5;

/** Enemigo que persigue al jugador en línea recta. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly contactDamage: number;
  readonly maxHealth: number;
  dying = false;
  /** Enemigo sin colmillos: está en el mapa pero no hace daño al tocar. */
  harmless = false;

  private currentHealth: number;
  private slowUntil = 0;
  private slowFactor = 1;
  private knockUntil = 0;
  private readonly moveSpeed: number;
  private facingAngle = Math.PI / 2;
  private facingReady = false;
  private currentDir: EnemyDirection = 'down';

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
    if (kind.id === 'sentinel') this.setTint(0xffb36b);
    this.play(enemyAnimationKey(kind, this.currentDir));
  }

  /** Lo deja sin poder dañar y lo pinta pálido para que se note. */
  defang(): void {
    this.harmless = true;
    this.setAlpha(0.6).setTint(0xb7c4d6);
  }

  /** Lo frena: conserva `factor` de su velocidad durante `ms`. */
  applySlow(ms: number, factor: number): void {
    this.slowUntil = this.scene.time.now + ms;
    this.slowFactor = factor;
  }

  /** Lo empuja en la dirección (dx, dy) durante `ms` (no persigue mientras tanto). */
  knockback(dx: number, dy: number, speed: number, ms: number): void {
    const length = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / length) * speed, (dy / length) * speed);
    this.knockUntil = this.scene.time.now + ms;
  }

  get health(): number {
    return this.currentHealth;
  }

  chase(targetX: number, targetY: number, separationX = 0, separationY = 0): void {
    const now = this.scene.time.now;
    if (now < this.knockUntil) {
      this.setDepth(this.y);
      return;
    }
    const speed = this.moveSpeed * (now < this.slowUntil ? this.slowFactor : 1);
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    let moveX = distance > 0.5 ? dx / distance : 0;
    let moveY = distance > 0.5 ? dy / distance : 0;

    if (this.kind.rangedAttack) {
      const preferredRange = this.kind.rangedAttack.range;
      if (distance < preferredRange - 28) {
        moveX *= -1;
        moveY *= -1;
      } else if (distance <= preferredRange + 28) {
        moveX = 0;
        moveY = 0;
      }
    }

    moveX += separationX * 1.8;
    moveY += separationY * 1.8;
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0.001) {
      this.setVelocity((moveX / moveLength) * speed, (moveY / moveLength) * speed);
    } else {
      this.setVelocity(0, 0);
    }

    if (this.kind.directional && distance > 1) {
      // Suaviza el ángulo de mirada hacia el objetivo/movimiento para pasar por las vistas diagonales (3/4).
      const targetAngle = Math.atan2(dy, dx);
      const dt = Math.min(0.05, (this.scene.game.loop.delta || 16.6) / 1000);
      if (!this.facingReady) {
        this.facingAngle = targetAngle;
        this.facingReady = true;
      } else {
        this.facingAngle = Phaser.Math.Angle.RotateTo(this.facingAngle, targetAngle, FACING_TURN_SPEED * dt);
      }
      const nextDir = enemyDirectionFromAngle(this.facingAngle, this.currentDir);
      if (nextDir !== this.currentDir) {
        this.currentDir = nextDir;
        const nextKey = enemyAnimationKey(this.kind, nextDir);
        const progress = this.anims.getProgress();
        this.play(nextKey, true);
        this.anims.setProgress(progress);
      }
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

        if (this.harmless) {
          this.setTint(0xb7c4d6);
        } else if (this.kind.id === 'sentinel') {
          this.setTint(0xffb36b);
        } else {
          this.clearTint();
        }
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
