import type Phaser from 'phaser';
import { Character } from '../../entities/Character';
import { ironManDefinition } from './ironManDefinition';

/**
 * Iron Man. Hoy hereda todo de Character; acá irán sus habilidades propias
 * (repulsores, rayo del reactor ARC, vuelo) cuando lleguen las siguientes fases.
 */
export class IronMan extends Character {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ironManDefinition);
  }
}
