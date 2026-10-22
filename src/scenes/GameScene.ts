import Phaser from 'phaser';
import { createCharacter } from '../characters/registry';
import { IRON_MAN_ID } from '../characters/ironman/ironManDefinition';
import type { Character } from '../entities/Character';
import { KeyboardMoveInput } from '../input/KeyboardMoveInput';
import type { MoveInput } from '../input/MoveInput';
import { CameraRig } from '../systems/CameraRig';
import { TestMap } from '../world/TestMap';

/** Escena de pruebas de la fase 1: mapa, Iron Man, controles, cámara y colisiones. */
export class GameScene extends Phaser.Scene {
  private player!: Character;
  private moveInput!: MoveInput;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const map = new TestMap(this);
    map.build();

    // Límites del mundo: el personaje no puede salir del mapa.
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = createCharacter(this, IRON_MAN_ID, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, map.obstacles);

    this.moveInput = new KeyboardMoveInput(this);
    new CameraRig(this, this.player, { width: map.widthPx, height: map.heightPx });
  }

  update(): void {
    this.player.step(this.moveInput.getVector());
  }
}
