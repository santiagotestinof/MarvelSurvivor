import type Phaser from 'phaser';

/** Datos de un tipo de enemigo. Para sumar uno nuevo: spritesheet + una entrada acá. */
export interface EnemyKind {
  id: string;
  texture: string;
  /** Ruta relativa a /public. */
  path: string;
  frame: { width: number; height: number };
  frameCount: number;
  frameRate: number;
  origin: { x: number; y: number };
  /** Caja de colisión en píxeles desde la esquina superior izquierda del cuadro. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  health: number;
  speed: number;
  contactDamage: number;
}

export const DRONE: EnemyKind = {
  id: 'drone',
  texture: 'enemy-drone',
  path: 'assets/enemies/drone.png',
  frame: { width: 24, height: 24 },
  frameCount: 2,
  frameRate: 5,
  origin: { x: 0.5, y: 0.9 },
  body: { width: 12, height: 10, offsetX: 6, offsetY: 10 },
  health: 20,
  speed: 38,
  contactDamage: 8,
};

export const OVERLORD: EnemyKind = {
  id: 'overlord',
  texture: 'enemy-overlord',
  path: 'assets/enemies/overlord.png',
  frame: { width: 48, height: 48 },
  frameCount: 2,
  frameRate: 3,
  origin: { x: 0.5, y: 0.9 },
  body: { width: 26, height: 20, offsetX: 11, offsetY: 22 },
  health: 400,
  speed: 30,
  contactDamage: 20,
};

export const ENEMY_KINDS: readonly EnemyKind[] = [DRONE, OVERLORD];

export function enemyAnimationKey(kind: EnemyKind): string {
  return `${kind.id}:walk`;
}

/** Encola la carga de los spritesheets de enemigos (llamar desde preload). */
export function loadEnemyAssets(scene: Phaser.Scene): void {
  for (const kind of ENEMY_KINDS) {
    scene.load.spritesheet(kind.texture, kind.path, {
      frameWidth: kind.frame.width,
      frameHeight: kind.frame.height,
    });
  }
}

export function registerEnemyAnimations(scene: Phaser.Scene): void {
  for (const kind of ENEMY_KINDS) {
    const key = enemyAnimationKey(kind);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(kind.texture, { start: 0, end: kind.frameCount - 1 }),
      frameRate: kind.frameRate,
      repeat: -1,
    });
  }
}
