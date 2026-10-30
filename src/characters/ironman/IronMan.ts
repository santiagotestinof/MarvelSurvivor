import type Phaser from 'phaser';
import { Character } from '../../entities/Character';
import { ironManDefinition, IRON_MAN_SCALE } from './ironManDefinition';
import { DIRECTION_ANGLES, type Direction } from '../../core/direction';

/**
 * Iron Man. Hoy hereda todo de Character; acá irán sus habilidades propias
 * (repulsores, rayo del reactor ARC, vuelo) cuando lleguen las siguientes fases.
 */
export class IronMan extends Character {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ironManDefinition);
    // Mantener el tamaño en el mapa sin descartar píxeles de las hojas originales.
    this.setScale(IRON_MAN_SCALE);
  }
  override getAttackOrigin(_action: 'attack' | 'beam', direction: Direction, _frame = 3): { x: number; y: number } {
    const angle = DIRECTION_ANGLES[direction];
    return {
      x: this.x + Math.cos(angle) * 19 * this.scaleX,
      y: this.y + (-27 + Math.sin(angle) * 8) * this.scaleY - this.elevation,
    };
  }
}
