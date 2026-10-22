import Phaser from 'phaser';
import type { CharacterAction, CharacterDefinition } from '../characters/CharacterDefinition';
import { TEXTURES } from '../config/assetKeys';
import { Direction, directionFromVector } from '../core/direction';
import { CharacterAnimator } from '../systems/AnimationSystem';
import { MovementSystem } from '../systems/MovementSystem';

/**
 * Entidad base de todos los personajes jugables.
 * Toda la lógica común (movimiento, orientación, animación, sombra, colisión) vive acá;
 * cada personaje solo aporta su CharacterDefinition y, más adelante, sus habilidades.
 */
export class Character extends Phaser.Physics.Arcade.Sprite {
  readonly definition: CharacterDefinition;

  private readonly movement: MovementSystem;
  private readonly animator: CharacterAnimator;
  private readonly shadow: Phaser.GameObjects.Image;

  private facing: Direction = Direction.Down;
  private action: CharacterAction = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, definition: CharacterDefinition) {
    super(scene, x, y, definition.sheets.idle.textureKey, 0);
    this.definition = definition;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(definition.origin.x, definition.origin.y);
    this.setCollideWorldBounds(true);

    const { width, height, offsetX, offsetY } = definition.body;
    (this.body as Phaser.Physics.Arcade.Body).setSize(width, height).setOffset(offsetX, offsetY);

    this.shadow = scene.add.image(x, y, TEXTURES.shadow);
    this.movement = new MovementSystem(definition.stats.moveSpeed);
    this.animator = new CharacterAnimator(this, definition);
    this.animator.play(this.action, this.facing);

    // El cuerpo físico se sincroniza con el sprite después de la actualización de la escena,
    // por eso la sombra y la profundidad se actualizan en POST_UPDATE.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncVisuals, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncVisuals, this);
      this.shadow.destroy();
    });
  }

  get direction(): Direction {
    return this.facing;
  }

  get currentAction(): CharacterAction {
    return this.action;
  }

  /** Avanza un cuadro de lógica: mueve, actualiza la orientación y elige la animación. */
  step(moveIntent: Phaser.Math.Vector2): void {
    const moving = this.movement.apply(this.body as Phaser.Physics.Arcade.Body, moveIntent);

    // Al detenerse no se toca `facing`: conserva la última orientación.
    if (moving) this.facing = directionFromVector(moveIntent.x, moveIntent.y);

    this.action = moving ? 'walk' : 'idle';
    this.animator.play(this.action, this.facing);
  }

  private syncVisuals(): void {
    this.setDepth(this.y); // orden de dibujo por altura: más abajo = más adelante
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 0.5);
  }
}
