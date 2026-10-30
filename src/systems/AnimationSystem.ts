import type Phaser from 'phaser';
import type { CharacterAction, CharacterDefinition } from '../characters/CharacterDefinition';
import { ALL_DIRECTIONS, DIRECTION_NAMES, type Direction } from '../core/direction';

declare const __BUILD_ID__: string;

export function animationKey(characterId: string, action: CharacterAction, direction: Direction): string {
  return `${characterId}:${action}:${DIRECTION_NAMES[direction]}`;
}

/** Encola la carga de todos los spritesheets de un personaje (llamar desde preload). */
export function loadCharacterAssets(scene: Phaser.Scene, definition: CharacterDefinition): void {
  for (const sheet of Object.values(definition.sheets)) {
    scene.load.spritesheet(sheet.textureKey, `${sheet.path}?v=${__BUILD_ID__}`, {
      frameWidth: definition.frame.width,
      frameHeight: definition.frame.height,
    });
  }
}

/** Crea una animación por cada combinación acción × dirección (llamar una vez, tras la carga). */
export function registerCharacterAnimations(scene: Phaser.Scene, definition: CharacterDefinition): void {
  for (const [action, sheet] of Object.entries(definition.sheets) as [CharacterAction, (typeof definition.sheets)['idle']][]) {
    for (const direction of ALL_DIRECTIONS) {
      const key = animationKey(definition.id, action, direction);
      if (scene.anims.exists(key)) continue;

      const start = direction * sheet.frameCount; // fila = dirección
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(sheet.textureKey, {
          start,
          end: start + sheet.frameCount - 1,
        }),
        frameRate: sheet.frameRate,
        repeat: sheet.loop ? -1 : 0,
      });
    }
  }
}

/** Reproduce la animación correcta según acción y dirección. */
export class CharacterAnimator {
  private currentAction: CharacterAction | null = null;
  private locomotionPhase: Partial<Record<'idle' | 'walk', { frame: number; accumulator: number; nextTick: number }>> = {};

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly definition: CharacterDefinition,
  ) {}

  play(action: CharacterAction, direction: Direction, initialFrame?: number): void {
    // Si la acción no existe para este personaje se cae a idle.
    const resolved: CharacterAction = this.definition.sheets[action] ? action : 'idle';
    const sheet = this.definition.sheets[resolved];
    if (!sheet) return;

    const key = animationKey(this.definition.id, resolved, direction);
    const anims = this.sprite.anims;
    if (initialFrame === undefined && anims.currentAnim?.key === key && (anims.isPlaying || !sheet.loop)) return;

    // El disparo automático interrumpe el vuelo: al volver no debe reiniciar siempre F1.
    const studioHero = this.definition.id === 'ironman';
    if (studioHero && resolved !== this.currentAction && anims.currentFrame &&
        (this.currentAction === 'idle' || this.currentAction === 'walk')) {
      this.locomotionPhase[this.currentAction] = {
        frame: anims.currentFrame.index - 1,
        accumulator: anims.accumulator,
        nextTick: anims.nextTick,
      };
    }
    const resumedPhase = studioHero && initialFrame === undefined && resolved !== this.currentAction &&
      (resolved === 'idle' || resolved === 'walk') ? this.locomotionPhase[resolved] : undefined;

    // Al girar mientras camina se conserva el cuadro actual para que el paso no se reinicie.
    let startFrame = initialFrame ?? resumedPhase?.frame ?? 0;
    if (initialFrame === undefined && resolved === this.currentAction && anims.currentFrame) {
      startFrame = Math.min(anims.currentFrame.index - 1, sheet.frameCount - 1);
    }

    // Iron Man mantiene también el tiempo dentro del cuadro al girar: sus propulsores
    // no se congelan en el primer instante cuando cambia de dirección continuamente.
    const preserveTiming = studioHero && resolved === this.currentAction && anims.isPlaying;
    const accumulator = resumedPhase?.accumulator ?? anims.accumulator;
    const nextTick = resumedPhase?.nextTick ?? anims.nextTick;
    anims.play({ key, startFrame }, true);
    if (preserveTiming || resumedPhase) {
      anims.accumulator = accumulator;
      anims.nextTick = nextTick;
    }
    this.currentAction = resolved;
  }
}
