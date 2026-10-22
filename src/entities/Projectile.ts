import Phaser from 'phaser';

/** Disparo que viaja en línea recta y desaparece al superar su alcance. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  readonly damage: number;

  private readonly startX: number;
  private readonly startY: number;
  private readonly maxDistance: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    damage: number,
    maxDistance: number,
    velocityX: number,
    velocityY: number,
  ) {
    super(scene, x, y, texture);
    this.damage = damage;
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    (this.body as Phaser.Physics.Arcade.Body).setSize(6, 6).setOffset(1, 1);
    this.setVelocity(velocityX, velocityY);
    this.setRotation(Math.atan2(velocityY, velocityX));
    this.setDepth(1_000_000); // siempre por encima de personajes y enemigos
  }

  hasExpired(): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, this.startX, this.startY) > this.maxDistance;
  }
}
