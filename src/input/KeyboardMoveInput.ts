import Phaser from 'phaser';
import { KEY_BINDINGS } from '../config/controlsConfig';
import type { MoveInput } from './MoveInput';

type Axis = keyof typeof KEY_BINDINGS;

export class KeyboardMoveInput implements MoveInput {
  private readonly keys: Record<Axis, Phaser.Input.Keyboard.Key[]>;
  private readonly vector = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('El teclado no está disponible en este dispositivo.');

    const bind = (names: readonly string[]) => names.map((name) => keyboard.addKey(name));
    this.keys = {
      up: bind(KEY_BINDINGS.up),
      down: bind(KEY_BINDINGS.down),
      left: bind(KEY_BINDINGS.left),
      right: bind(KEY_BINDINGS.right),
    };
  }

  getVector(): Phaser.Math.Vector2 {
    const x = this.axis('right') - this.axis('left');
    const y = this.axis('down') - this.axis('up');
    return this.vector.set(x, y);
  }

  private axis(name: Axis): number {
    return this.keys[name].some((key) => key.isDown) ? 1 : 0;
  }
}
