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
  /** Tiempo detenido: no se mueve y el daño que recibe se acumula hasta que se descongela. */
  frozen = false;

  private currentHealth: number;
  private frozenDamage = 0;
  private slowUntil = 0;
  private slowFactor = 1;
  private knockUntil = 0;
  private aimLockUntil = 0;
  private aimTarget: { x: number; y: number } | null = null;
  private moveSpeed: number;
  private speedScale: number;
  private facingAngle = Math.PI / 2;
  private facingReady = false;
  private currentDir: EnemyDirection = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, scaling: EnemyScaling) {
    super(scene, x, y, kind.texture, 0);
    this.kind = kind;
    this.maxHealth = Math.round(kind.health * scaling.health);
    this.currentHealth = this.maxHealth;
    this.speedScale = scaling.speed;
    this.moveSpeed = kind.speed * scaling.speed;
    this.contactDamage = kind.contactDamage;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(kind.origin.x, kind.origin.y);
    if (kind.scale && kind.scale !== 1) this.setScale(kind.scale);
    const { width, height, offsetX, offsetY } = kind.body;
    (this.body as Phaser.Physics.Arcade.Body).setSize(width, height).setOffset(offsetX, offsetY);
    this.setCollideWorldBounds(true);
    this.play(enemyAnimationKey(kind, this.currentDir));
    this.anims.timeScale = Math.min(1.6, 0.85 + scaling.speed * 0.15);
  }

  /** Si la ronda avanzó desde que apareció este enemigo, actualiza su velocidad para acompañar el ritmo actual. */
  syncTimeSpeed(currentSpeedScale: number): void {
    if (this.kind.id === 'overlord' || currentSpeedScale <= this.speedScale) return;
    this.speedScale = currentSpeedScale;
    this.moveSpeed = this.kind.speed * currentSpeedScale;
    this.anims.timeScale = Math.min(1.6, 0.85 + currentSpeedScale * 0.15);
  }

  /** Lo deja quieto durante `ms` apuntando hacia `(targetX, targetY)` mientras marca su disparo. */
  lockForShot(ms: number, targetX: number, targetY: number): void {
    this.aimLockUntil = this.scene.time.now + ms;
    this.aimTarget = { x: targetX, y: targetY };
    this.setVelocity(0, 0);
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

  /** Embestida hacia (dx, dy) a velocidad `speed` durante `ms` mirando en esa dirección. */
  lunge(dx: number, dy: number, speed: number, ms: number): void {
    const length = Math.hypot(dx, dy) || 1;
    this.aimLockUntil = 0;
    if (this.anims.isPaused) this.anims.resume();
    if (this.kind.directional) {
      this.facingAngle = Math.atan2(dy, dx);
      this.facingReady = true;
      this.updateFacing(dx, dy);
    }
    this.setVelocity((dx / length) * speed, (dy / length) * speed);
    this.knockUntil = this.scene.time.now + ms;
  }

  /** Lo congela en el tiempo (ulti de Doctor Strange). */
  freeze(): void {
    if (this.frozen || this.dying) return;
    this.frozen = true;
    this.frozenDamage = 0;
    this.setVelocity(0, 0);
    if (this.anims.isPlaying) this.anims.pause();
    this.setTint(0x8fe6ff);
  }

  /** Lo descongela y le aplica de golpe todo el daño acumulado. */
  thaw(): void {
    if (!this.frozen) return;
    this.frozen = false;
    if (this.anims.isPaused) this.anims.resume();
    if (this.harmless) this.setTint(0xb7c4d6);
    else this.clearTint();
    const damage = this.frozenDamage;
    this.frozenDamage = 0;
    if (damage > 0) this.takeDamage(damage);
  }

  get health(): number {
    return this.currentHealth;
  }

  chase(targetX: number, targetY: number, separationX = 0, separationY = 0): void {
    if (this.frozen) {
      this.setVelocity(0, 0);
      this.setDepth(this.y);
      return;
    }
    const now = this.scene.time.now;
    if (now < this.knockUntil) {
      this.setDepth(this.y);
      return;
    }

    // Mientras está marcando un disparo a distancia se queda clavado en el lugar durante 1 segundo.
    if (now < this.aimLockUntil) {
      this.setVelocity(0, 0);
      if (this.kind.directional && this.aimTarget) {
        const adx = this.aimTarget.x - this.x;
        const ady = this.aimTarget.y - this.y;
        this.updateFacing(adx, ady);
        if (this.anims.isPlaying && this.anims.currentAnim?.frames[0]) {
          this.anims.pause(this.anims.currentAnim.frames[0]);
        }
      }
      this.setDepth(this.y);
      return;
    }

    if (this.anims.isPaused) {
      this.anims.resume();
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
      } else if (distance <= preferredRange - 6) {
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
      this.updateFacing(dx, dy);
    }

    this.setDepth(this.y);
  }

  private updateFacing(dx: number, dy: number): void {
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

  /** Devuelve true si el golpe se aplicó. */
  takeDamage(amount: number): boolean {
    if (this.dying) return false;
    if (this.frozen) {
      this.frozenDamage += amount;
      return true;
    }
    this.currentHealth -= amount;

    if (this.currentHealth <= 0) {
      this.die();
    } else {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (!this.active) return;

        if (this.harmless) {
          this.setTint(0xb7c4d6);
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

    const baseScale = this.kind.scale ?? 1;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: baseScale * 1.25,
      scaleY: baseScale * 0.6,
      duration: 160,
      onComplete: () => this.destroy(),
    });
  }
}
