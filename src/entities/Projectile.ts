import Phaser from 'phaser';

/**
 * Disparo que viaja en línea recta y desaparece al superar su alcance.
 * Con `pierce` > 0 atraviesa esa cantidad de enemigos (a cada uno le pega una sola vez).
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  readonly damage: number;
  readonly critical: boolean;

  private readonly startX: number;
  private readonly startY: number;
  private readonly maxDistance: number;
  private pierceLeft: number;
  private readonly alreadyHit = new Set<object>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    damage: number,
    maxDistance: number,
    velocityX: number,
    velocityY: number,
    options: { pierce?: number; critical?: boolean } = {},
  ) {
    super(scene, x, y, texture);
    this.damage = damage;
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance;
    this.pierceLeft = options.pierce ?? 0;
    this.critical = options.critical ?? false;
    // El crítico se ve más grande y dorado.
    if (this.critical) this.setScale(1.5).setTint(0xffe272);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    (this.body as Phaser.Physics.Arcade.Body).setSize(6, 6).setOffset(1, 1);
    this.setVelocity(velocityX, velocityY);
    this.setRotation(Math.atan2(velocityY, velocityX));
    this.setDepth(1_000_000); // siempre por encima de personajes y enemigos
  }

  /** ¿Puede pegarle a este enemigo? (no le pega dos veces al mismo). */
  canHit(target: object): boolean {
    return this.active && !this.alreadyHit.has(target);
  }

  /** Marca un objetivo como ya golpeado sin gastar perforación (para props, que no frenan el disparo). */
  markHit(target: object): void {
    this.alreadyHit.add(target);
  }

  /** Registra el golpe. Devuelve true si el disparo tiene que desaparecer (ya no le queda perforación). */
  registerHit(target: object): boolean {
    this.alreadyHit.add(target);
    if (this.pierceLeft <= 0) return true;
    this.pierceLeft--;
    return false;
  }

  hasExpired(): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, this.startX, this.startY) > this.maxDistance;
  }
}
