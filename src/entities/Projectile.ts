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
  /** Boomerang (escudo): al llegar al máximo da la vuelta hacia `owner` y desaparece al alcanzarlo. */
  private readonly boomerang: { x: number; y: number } | null;
  private readonly boomerangSpeed: number;
  private returning = false;
  private returned = false;
  /** Rebote (escudo evolucionado del Capitán): va hacia un enemigo, le pega y salta al siguiente más cercano. */
  private readonly bounce: { find: (x: number, y: number, exclude: object | null) => (Phaser.GameObjects.GameObject & { x: number; y: number }) | null } | null;
  private bouncesLeft = 0;
  private bounceTarget: (Phaser.GameObjects.GameObject & { x: number; y: number }) | null = null;
  private lastBounced: object | null = null;
  private bounceDone = false;
  private readonly bounceExpiresAt: number;
  /** Frenado que deja al enemigo (telaraña). */
  readonly slow: { ms: number; factor: number } | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    damage: number,
    maxDistance: number,
    velocityX: number,
    velocityY: number,
    options: {
      pierce?: number;
      critical?: boolean;
      boomerang?: { x: number; y: number };
      slow?: { ms: number; factor: number };
      bounce?: { count: number; find: (x: number, y: number, exclude: object | null) => (Phaser.GameObjects.GameObject & { x: number; y: number }) | null };
    } = {},
  ) {
    super(scene, x, y, texture);
    this.damage = damage;
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance;
    this.pierceLeft = options.pierce ?? 0;
    this.critical = options.critical ?? false;
    this.boomerang = options.boomerang ?? null;
    this.boomerangSpeed = Math.hypot(velocityX, velocityY);
    this.slow = options.slow ?? null;
    this.bounce = options.bounce ?? null;
    this.bouncesLeft = options.bounce?.count ?? 0;
    this.bounceExpiresAt = scene.time.now + 8000;
    // El crítico se ve más grande y dorado.
    if (this.critical) this.setScale(1.5).setTint(0xffe272);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    const bw = Math.min(14, Math.max(6, Math.round(this.width * 0.65)));
    const bh = Math.min(14, Math.max(6, Math.round(this.height * 0.65)));
    body.setSize(bw, bh).setOffset((this.width - bw) / 2, (this.height - bh) / 2);
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

  get isBouncer(): boolean {
    return this.bounce !== null;
  }

  /** Le pegó a `target`: si quedan rebotes salta al próximo enemigo; si no, termina. */
  rebound(target: object): void {
    this.alreadyHit.clear();
    this.alreadyHit.add(target);
    this.lastBounced = target;
    this.bounceTarget = null;
    if (this.bouncesLeft <= 0) {
      this.bounceDone = true;
      this.setActive(false);
      return;
    }
    this.bouncesLeft--;
  }

  private stepBounce(): void {
    if (this.bounceDone || !this.bounce) return;
    if (this.scene.time.now > this.bounceExpiresAt) {
      this.bounceDone = true;
      return;
    }
    const alive = (t: { active?: boolean; dying?: boolean }): boolean => !!t.active && !t.dying;
    if (!this.bounceTarget || !alive(this.bounceTarget as never)) this.bounceTarget = this.bounce.find(this.x, this.y, this.lastBounced);
    if (!this.bounceTarget) {
      this.bounceDone = true;
      return;
    }
    const angle = Math.atan2(this.bounceTarget.y - 8 - this.y, this.bounceTarget.x - this.x);
    this.setVelocity(Math.cos(angle) * this.boomerangSpeed, Math.sin(angle) * this.boomerangSpeed);
    this.rotation += 0.35;
  }

  /** Avanza un cuadro: los boomerang dan la vuelta y vuelven; los rebotadores buscan el próximo enemigo. */
  step(): void {
    if (this.bounce) {
      if (this.active) this.stepBounce();
      return;
    }
    const owner = this.boomerang;
    if (!owner || !this.active) return;
    if (!this.returning && Phaser.Math.Distance.Between(this.x, this.y, this.startX, this.startY) > this.maxDistance) {
      this.returning = true;
      this.alreadyHit.clear(); // a la vuelta les pega de nuevo
    }
    if (this.returning) {
      const targetY = owner.y - 14;
      if (Phaser.Math.Distance.Between(this.x, this.y, owner.x, targetY) < 10) {
        this.returned = true;
        return;
      }
      const angle = Math.atan2(targetY - this.y, owner.x - this.x);
      this.setVelocity(Math.cos(angle) * this.boomerangSpeed, Math.sin(angle) * this.boomerangSpeed);
    }
    this.rotation += 0.40;
  }

  hasExpired(): boolean {
    if (this.bounce) return this.bounceDone;
    if (this.boomerang) return this.returned;
    return Phaser.Math.Distance.Between(this.x, this.y, this.startX, this.startY) > this.maxDistance;
  }
}
