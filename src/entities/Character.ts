import Phaser from 'phaser';
import type { CharacterAction, CharacterDefinition } from '../characters/CharacterDefinition';
import { TEXTURES } from '../config/assetKeys';
import { DIRECTION_ANGLES, Direction, directionFromVector } from '../core/direction';
import { CharacterAnimator } from '../systems/AnimationSystem';
import { MovementSystem } from '../systems/MovementSystem';

/**
 * Entidad base de todos los personajes jugables.
 * Toda la lógica común (movimiento, orientación, animación, vida, sombra, colisión) vive acá;
 * cada personaje solo aporta su CharacterDefinition y, más adelante, sus habilidades.
 */
export class Character extends Phaser.Physics.Arcade.Sprite {
  readonly definition: CharacterDefinition;
  maxHealth: number;
  /** Daño que se resta a cada golpe (mínimo 1 de daño). */
  armor = 0;

  private readonly movement: MovementSystem;
  private readonly animator: CharacterAnimator;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Copia visual elevada durante el vuelo; el sprite físico queda en el suelo para colisiones. */
  private readonly flightSprite: Phaser.GameObjects.Sprite;

  private facing: Direction = Direction.Down;
  private action: CharacterAction = 'idle';
  private currentHealth: number;
  private invulnerableUntil = 0;
  /** Embestida (ulti del Capitán): mientras existe, la velocidad la fija ella y no el teclado. */
  private dash: { vx: number; vy: number } | null = null;
  private speed: number;
  private flightHeight = 0;
  private visualAction: CharacterAction | null = null;
  private visualDirection = Direction.Down;
  private visualUntil = 0;
  private locomotionAction: CharacterAction | null = null;

  /** Pose sostenida de una habilidad; conserva la orientación y el movimiento normal. */
  setLocomotionAction(action: CharacterAction | null): void {
    this.locomotionAction = action && this.definition.sheets[action] ? action : null;
  }

  /** Solo presenta el ataque existente; no agrega controles ni cambia su daño/cadencia. */
  animateAction(action: CharacterAction, dx: number, dy: number, durationMs: number, initialFrame?: number): void {
    if (!this.definition.sheets[action] || this.isDead) return;
    if (this.visualAction === 'beam' && action !== 'beam' && this.scene.time.now < this.visualUntil) return;
    if (this.visualAction === 'hurt' && action === 'attack' && this.scene.time.now < this.visualUntil) return;
    this.visualAction = action;
    this.visualDirection = directionFromVector(dx, dy);
    this.visualUntil = this.scene.time.now + durationMs;
    this.action = action;
    this.animator.play(action, this.visualDirection, initialFrame);
  }

  get elevation(): number { return this.flightHeight; }

  getAttackOrigin(_action: 'attack' | 'beam', _direction: Direction, _frame = 3): { x: number; y: number } {
    return { x: this.x, y: this.y - 14 };
  }

  constructor(scene: Phaser.Scene, x: number, y: number, definition: CharacterDefinition) {
    super(scene, x, y, definition.sheets.idle.textureKey, 0);
    this.definition = definition;
    this.maxHealth = definition.stats.maxHealth;
    this.currentHealth = this.maxHealth;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(definition.origin.x, definition.origin.y);
    this.setCollideWorldBounds(true);

    const { width, height, offsetX, offsetY } = definition.body;
    (this.body as Phaser.Physics.Arcade.Body).setSize(width, height).setOffset(offsetX, offsetY);

    this.shadow = scene.add.image(x, y, TEXTURES.shadow);
    this.flightSprite = scene.add.sprite(x, y, definition.sheets.idle.textureKey, 0)
      .setOrigin(definition.origin.x, definition.origin.y)
      .setVisible(false);
    this.speed = definition.stats.moveSpeed;
    this.movement = new MovementSystem(this.speed);
    this.animator = new CharacterAnimator(this, definition);
    this.animator.play(this.action, this.facing);

    // El cuerpo físico se sincroniza con el sprite después de la actualización de la escena,
    // por eso la sombra y la profundidad se actualizan en POST_UPDATE.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncVisuals, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncVisuals, this);
      this.shadow.destroy();
      this.flightSprite.destroy();
    });
  }

  get moveSpeed(): number {
    return this.speed;
  }

  setMoveSpeed(value: number): void {
    this.speed = value;
    this.movement.setMoveSpeed(value);
  }

  /** Eleva visualmente al personaje sin cambiar el punto de referencia de la sombra. */
  setFlightHeight(height: number): void {
    this.flightHeight = Math.max(0, height);
  }

  addMaxHealth(amount: number): void {
    this.maxHealth += amount;
    this.currentHealth += amount;
  }

  heal(amount: number): void {
    if (!this.isDead) this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  get direction(): Direction {
    return this.facing;
  }

  get currentAction(): CharacterAction {
    return this.action;
  }

  get health(): number {
    return this.currentHealth;
  }

  get isDead(): boolean {
    return this.currentHealth <= 0;
  }

  /** Avanza un cuadro de lógica: mueve, actualiza la orientación y elige la animación. */
  step(moveIntent: Phaser.Math.Vector2): void {
    if (this.dash) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.dash.vx, this.dash.vy);
      this.facing = directionFromVector(this.dash.vx, this.dash.vy);
      this.action = 'walk';
      this.animator.play(this.action, this.facing);
      return;
    }
    const moving = this.movement.apply(this.body as Phaser.Physics.Arcade.Body, moveIntent);

    // Al detenerse no se toca `facing`: conserva la última orientación.
    if (moving) this.facing = directionFromVector(moveIntent.x, moveIntent.y);

    this.action = this.locomotionAction ?? (moving ? 'walk' : 'idle');
    if (this.visualAction && this.scene.time.now < this.visualUntil) {
      this.action = this.visualAction;
      this.animator.play(this.action, this.visualDirection);
      return;
    }
    this.visualAction = null;
    this.animator.play(this.action, this.facing);
  }

  /** Empieza o termina una embestida (`null` la corta). */
  setDash(velocity: { vx: number; vy: number } | null): void {
    this.dash = velocity;
  }

  /** Vector unitario hacia donde mira (o hacia donde se mueve). */
  facingVector(): { x: number; y: number } {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const len = Math.hypot(body.velocity.x, body.velocity.y);
    if (len > 1) return { x: body.velocity.x / len, y: body.velocity.y / len };
    const a = DIRECTION_ANGLES[this.facing];
    return { x: Math.cos(a), y: Math.sin(a) };
  }

  /** Sin daño hasta `until` (reloj de la escena). */
  protectUntil(until: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, until);
  }

  /** Aplica daño (no hay inmunidad tras un golpe; solo la protección al revivir). Devuelve true si lo recibió. */
  takeDamage(amount: number): boolean {
    const now = this.scene.time.now;
    if (this.isDead || now < this.invulnerableUntil) return false;

    const dealt = Math.max(1, amount - this.armor);
    this.currentHealth = Math.max(0, this.currentHealth - dealt);
    // Aviso al juego y al HUD: viñeta roja y gotas de sangre (ver GameScene y HudScene).
    this.scene.events.emit('player-hurt', dealt, this.maxHealth);
    const angle = DIRECTION_ANGLES[this.facing];
    this.animateAction('hurt', Math.cos(angle), Math.sin(angle), 200, 0);
    return true;
  }

  /** Vuelve a la vida con `fraction` de la vida máxima y unos segundos sin recibir daño. */
  revive(fraction: number, protectedMs: number): void {
    this.currentHealth = Math.max(1, Math.round(this.maxHealth * fraction));
    this.invulnerableUntil = this.scene.time.now + protectedMs;
    this.clearTint();
    this.setAlpha(1);
    this.scene.tweens.add({ targets: this, alpha: 0.4, duration: 120, yoyo: true, repeat: Math.floor(protectedMs / 240) });
  }

  /** Congela al personaje cuando termina la ronda (derrota). */
  defeat(): void {
    this.setVelocity(0, 0);
    if (this.definition.sheets.death) {
      this.animator.play('death', this.facing, 0);
      this.setAlpha(1).clearTint();
      return;
    }
    this.anims.pause();
    this.setAlpha(1);
    this.setTint(0x555555);
  }

  private syncVisuals(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const groundY = body.center.y;
    this.setDepth(groundY);
    this.shadow.setPosition(this.x, groundY - 1).setDepth(groundY - 0.5);

    // No movemos el sprite con cuerpo físico: una copia visual sube mientras las colisiones
    // y la sombra siguen en el suelo.
    const flying = this.flightHeight > 0;
    this.setVisible(!flying);
    this.flightSprite.setVisible(flying && this.active);
    if (flying) {
      this.flightSprite
        .setTexture(this.texture.key, this.frame.name)
        .setPosition(this.x, groundY - this.flightHeight)
        .setScale(this.scaleX, this.scaleY)
        .setFlip(this.flipX, this.flipY)
        .setAlpha(this.alpha)
        .setTint(0xb9f4ff)
        .setDepth(999_990);
    }
  }
}
