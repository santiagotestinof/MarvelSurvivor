import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import type { Enemy } from './Enemy';

/** Minimisil que gira de a poco hacia su objetivo; si el objetivo muere, busca otro. */
export class HomingMissile extends Phaser.Physics.Arcade.Image {
  target: Enemy | null;
  /** Sin enemigos, el misil va hacia este punto (una caja o roca) y explota al llegar. */
  aimPoint: { x: number; y: number } | null = null;

  private heading: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    heading: number,
    target: Enemy | null,
    private readonly speed: number,
    private readonly turnRate: number,
    readonly expiresAt: number,
  ) {
    super(scene, x, y, TEXTURES.missile);
    this.heading = heading;
    this.target = target;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setSize(6, 6).setOffset(3, 1);
    this.setDepth(1_000_000);
    this.applyHeading();
  }

  /** Gira hacia el objetivo (o el que devuelva `retarget` si el actual ya no sirve). */
  steer(deltaMs: number, retarget: () => Enemy | null): void {
    if (!this.target || !this.target.active || this.target.dying) this.target = retarget();
    if (this.target) {
      const desired = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y - 8);
      this.heading = Phaser.Math.Angle.RotateTo(this.heading, desired, (this.turnRate * deltaMs) / 1000);
    } else if (this.aimPoint) {
      const desired = Phaser.Math.Angle.Between(this.x, this.y, this.aimPoint.x, this.aimPoint.y);
      this.heading = Phaser.Math.Angle.RotateTo(this.heading, desired, (this.turnRate * deltaMs) / 1000);
    }
    this.applyHeading();
  }

  private applyHeading(): void {
    this.setVelocity(Math.cos(this.heading) * this.speed, Math.sin(this.heading) * this.speed);
    this.setRotation(this.heading);
  }
}
