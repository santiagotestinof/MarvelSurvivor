import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';

export type PickupKind = 'xp' | 'gold' | 'magnet';

const TEXTURE_OF: Record<PickupKind, string> = { xp: TEXTURES.gem, gold: TEXTURES.coin, magnet: TEXTURES.magnet };

/** Objeto que se junta: gema de experiencia, moneda de oro o imán (atrae toda la experiencia del mapa). Va hacia el jugador cuando éste se acerca. */
export class Pickup extends Phaser.GameObjects.Image {
  readonly kind: PickupKind;
  readonly value: number;
  private magnetized = false;
  private pull = 60;
  private readonly bob: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind, value: number) {
    super(scene, x, y, TEXTURE_OF[kind]);
    this.kind = kind;
    this.value = value;
    scene.add.existing(this);
    this.setDepth(y - 1);
    // Las gemas que valen más (de enemigos grandes) son más grandes y verdes; las monedas grandes, más grandes.
    if (value > 1 || kind === 'magnet') this.setScale(1.5);
    if (kind === 'xp' && value > 1) this.setTint(0x7dff9a);
    this.bob = scene.tweens.add({ targets: this, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  get isMagnetized(): boolean {
    return this.magnetized;
  }

  /** Empieza a ir hacia el jugador. Corta el flote: si no, el tween pisa `y` y solo se mueve en `x`. */
  magnetize(): void {
    this.magnetized = true;
    this.bob.remove();
  }

  /** Mueve el objeto hacia el jugador (cada vez más rápido). Devuelve true si llegó. */
  moveToward(targetX: number, targetY: number, deltaMs: number): boolean {
    this.pull += deltaMs * 0.45;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.pull * deltaMs) / 1000;
    if (distance <= step + 3) return true;
    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
    return false;
  }
}
