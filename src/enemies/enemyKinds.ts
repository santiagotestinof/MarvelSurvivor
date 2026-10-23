import type Phaser from 'phaser';

declare const __BUILD_ID__: string;

/** Las 4 orientaciones de los enemigos con vista por lado (coincide con el orden de filas en su spritesheet). */
export type EnemyDirection = 'down' | 'left' | 'right' | 'up';

export const ENEMY_DIRECTIONS: readonly EnemyDirection[] = ['down', 'left', 'right', 'up'];

/** Elige cuál de los 4 lados mostrar según hacia dónde camina el enemigo. */
export function enemyDirectionFromVector(dx: number, dy: number): EnemyDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** Datos de un tipo de enemigo. Para sumar uno nuevo: spritesheet + una entrada acá. */
export interface EnemyKind {
  id: string;
  texture: string;
  /** Ruta relativa a /public. */
  path: string;
  frame: { width: number; height: number };
  frameCount: number;
  frameRate: number;
  /** Si tiene 4 filas (abajo, izquierda, derecha, arriba) para cambiar de vista según hacia dónde camina. */
  directional?: boolean;
  origin: { x: number; y: number };
  /** Caja de colisión en píxeles desde la esquina superior izquierda del cuadro. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  health: number;
  speed: number;
  contactDamage: number;
  /** Experiencia que suelta al morir (0 = nada). */
  xpValue: number;
  /** Probabilidad de soltar una moneda al morir y valor de esa moneda (sin `gold` no suelta nada). */
  gold?: { chance: number; value: number };
  /** Parámetros de ataque a distancia, si corresponde. */
  rangedAttack?: { range: number; cooldownMs: number; damage: number; projectileSpeed: number };
  /**
   * Cómo aparece en las oleadas: desde qué punto de la ronda (0 = inicio, 1 = jefe) y con qué peso
   * relativo frente a los demás disponibles. Sin `spawn` no sale en oleadas (por ejemplo, el jefe).
   */
  spawn?: { fromProgress: number; weight: number };
}

export const DRONE: EnemyKind = {
  id: 'drone',
  texture: 'enemy-drone',
  path: 'assets/enemies/drone.png',
  frame: { width: 32, height: 32 },
  frameCount: 4,
  frameRate: 7,
  directional: true,
  origin: { x: 0.5, y: 0.94 },
  body: { width: 14, height: 12, offsetX: 9, offsetY: 18 },
  health: 30,
  speed: 41.8,
  contactDamage: 13,
  xpValue: 1,
  gold: { chance: 0.05, value: 1 },
  spawn: { fromProgress: 0, weight: 6 },
};

/** Enemigo de apoyo: dispara desde lejos y tiene poca presión por contacto. */
export const SENTINEL: EnemyKind = {
  id: 'sentinel',
  texture: 'enemy-sentinel',
  path: 'assets/enemies/drone.png',
  frame: { width: 32, height: 32 },
  frameCount: 4,
  frameRate: 6,
  directional: true,
  origin: { x: 0.5, y: 0.94 },
  body: { width: 14, height: 12, offsetX: 9, offsetY: 18 },
  health: 24,
  speed: 24.2,
  contactDamage: 4,
  xpValue: 2,
  rangedAttack: { range: 260, cooldownMs: 2200, damage: 5, projectileSpeed: 150 },
  spawn: { fromProgress: 0.3, weight: 1.4 },
};

/** Rápido y frágil: obliga a moverse aunque muera de un par de disparos. */
export const SCOUT: EnemyKind = {
  id: 'scout',
  texture: 'enemy-scout',
  path: 'assets/enemies/scout.png',
  frame: { width: 20, height: 20 },
  frameCount: 2,
  frameRate: 10,
  origin: { x: 0.5, y: 0.85 },
  body: { width: 10, height: 8, offsetX: 5, offsetY: 9 },
  health: 10,
  speed: 64,
  contactDamage: 5,
  xpValue: 1,
  gold: { chance: 0.05, value: 1 },
  spawn: { fromProgress: 0.15, weight: 3 },
};

/** Lento y resistente: pega fuerte y suelta más experiencia. */
export const BRUTE: EnemyKind = {
  id: 'brute',
  texture: 'enemy-brute',
  path: 'assets/enemies/brute.png',
  frame: { width: 32, height: 32 },
  frameCount: 2,
  frameRate: 3,
  origin: { x: 0.5, y: 0.92 },
  body: { width: 18, height: 10, offsetX: 7, offsetY: 20 },
  health: 100,
  speed: 26.4,
  contactDamage: 14,
  xpValue: 4,
  gold: { chance: 0.2, value: 3 },
  spawn: { fromProgress: 0.4, weight: 1.5 },
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
  health: 440,
  speed: 33,
  contactDamage: 20,
  xpValue: 0,
};

export const ENEMY_KINDS: readonly EnemyKind[] = [DRONE, SENTINEL, SCOUT, BRUTE, OVERLORD];

/** Elige al azar (por peso) uno de los enemigos de oleada disponibles en este punto de la ronda. */
export function pickWaveEnemy(progress: number): EnemyKind {
  const available = ENEMY_KINDS.filter((kind) => kind.spawn && progress >= kind.spawn.fromProgress);
  const total = available.reduce((sum, kind) => sum + (kind.spawn?.weight ?? 0), 0);
  let roll = Math.random() * total;
  for (const kind of available) {
    roll -= kind.spawn?.weight ?? 0;
    if (roll <= 0) return kind;
  }
  return available[available.length - 1] ?? DRONE;
}

export function enemyAnimationKey(kind: EnemyKind, dir: EnemyDirection = 'down'): string {
  return kind.directional ? `${kind.id}:walk:${dir}` : `${kind.id}:walk`;
}

/** Encola la carga de los spritesheets de enemigos (llamar desde preload). */
export function loadEnemyAssets(scene: Phaser.Scene): void {
  for (const kind of ENEMY_KINDS) {
    scene.load.spritesheet(kind.texture, `${kind.path}?v=${__BUILD_ID__}`, {
      frameWidth: kind.frame.width,
      frameHeight: kind.frame.height,
    });
  }
}

export function registerEnemyAnimations(scene: Phaser.Scene): void {
  for (const kind of ENEMY_KINDS) {
    if (kind.directional) {
      ENEMY_DIRECTIONS.forEach((dir, row) => {
        const key = enemyAnimationKey(kind, dir);
        if (scene.anims.exists(key)) return;
        const start = row * kind.frameCount;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(kind.texture, { start, end: start + kind.frameCount - 1 }),
          frameRate: kind.frameRate,
          repeat: -1,
        });
      });
      continue;
    }
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
