import type Phaser from 'phaser';
import type { MoveInput } from './MoveInput';

/** Combina varias fuentes (teclado, joystick táctil): manda la primera que esté moviendo. */
export class CompositeMoveInput implements MoveInput {
  constructor(private readonly sources: readonly MoveInput[]) {}

  getVector(): Phaser.Math.Vector2 {
    let last: Phaser.Math.Vector2 | null = null;
    for (const source of this.sources) {
      const vector = source.getVector();
      if (vector.lengthSq() > 0) return vector;
      last = vector;
    }
    return last as Phaser.Math.Vector2;
  }
}
