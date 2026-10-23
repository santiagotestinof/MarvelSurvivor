import Phaser from 'phaser';
import type { CharacterAction, CharacterDefinition } from '../characters/CharacterDefinition';
import { TEXTURES } from '../config/assetKeys';
import { PLAYER_HIT } from '../config/gameplayConfig';
import { Direction, directionFromVector } from '../core/direction';
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
  private speed: number;
  private flightHeight = 0;

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
    const moving = this.movement.apply(this.body as Phaser.Physics.Arcade.Body, moveIntent);

    // Al detenerse no se toca `facing`: conserva la última orientación.
    if (moving) this.facing = directionFromVector(moveIntent.x, moveIntent.y);

    this.action = moving ? 'walk' : 'idle';
    this.animator.play(this.action, this.facing);
  }

  /** Aplica daño salvo durante la invulnerabilidad posterior a un golpe. Devuelve true si lo recibió. */
  takeDamage(amount: number): boolean {
    const now = this.scene.time.now;
    if (this.isDead || now < this.invulnerableUntil) return false;

    this.currentHealth = Math.max(0, this.currentHealth - Math.max(1, amount - this.armor));
    this.invulnerableUntil = now + PLAYER_HIT.invulnerabilityMs;

    this.setTintFill(0xff3b30);
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.isDead) this.clearTint();
    });
    this.scene.tweens.add({
      targets: this,
      alpha: 0.4,
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (this.active) this.setAlpha(1);
      },
    });
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
        .setDepth(groundY + 0.1);
    }
  }
}
