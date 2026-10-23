import type Phaser from 'phaser';

declare const __BUILD_ID__: string;

/**
 * Las 8 orientaciones de los enemigos con vista por lado y diagonales 3/4.
 * El orden coincide exactamente con `DIRECTIONS` en `tools/generate-sprites.mjs` y `Direction` en `core/direction.ts`.
 */
export type EnemyDirection =
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left'
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right';

export const ENEMY_DIRECTIONS: readonly EnemyDirection[] = [
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
  'right',
  'down-right',
];

// Sectores de 45° empezando en "right" (0 rad) y girando en sentido horario (Y crece hacia abajo).
const SECTOR_TO_ENEMY_DIR: readonly EnemyDirection[] = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
];

const SECTOR_ANGLES: Record<EnemyDirection, number> = {
  right: 0,
  'down-right': Math.PI / 4,
  down: Math.PI / 2,
  'down-left': (3 * Math.PI) / 4,
  left: Math.PI,
  'up-left': -(3 * Math.PI) / 4,
  up: -Math.PI / 2,
  'up-right': -Math.PI / 4,
};

/**
 * Convierte un ángulo (radianes) en una de las 8 direcciones, con histéresis respecto a la dirección actual
 * para que no titile en el borde entre dos sectores y pase suavemente por las vistas diagonales (3/4).
 */
export function enemyDirectionFromAngle(angle: number, current?: EnemyDirection): EnemyDirection {
  if (current) {
    const currentCenter = SECTOR_ANGLES[current];
    let diff = angle - currentCenter;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Un sector mide 45° (±22.5° = ±0.3927 rad). Mantenemos el actual hasta ±29° (0.51 rad).
    if (Math.abs(diff) <= 0.51) return current;
  }
  const sector = Math.round(angle / (Math.PI / 4));
  return SECTOR_TO_ENEMY_DIR[((sector % 8) + 8) % 8];
}

/** Elige cuál de las 8 vistas mostrar según el vector de movimiento (dx, dy). */
export function enemyDirectionFromVector(dx: number, dy: number, current?: EnemyDirection): EnemyDirection {
  return enemyDirectionFromAngle(Math.atan2(dy, dx), current);
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
  /** Si tiene las 8 filas direccionales (frente, costado, espalda y las 4 diagonales 3/4). */
  directional?: boolean;
  /** Escala visual del sprite (por defecto 1). */
  scale?: number;
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
  spawn?: { fromProgress: number; weight: number; maxAlive?: number };
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

/** Chitauri tirador: se frena 1 s para marcar y disparar desde lejos, tiene poca vida y aparece en poca cantidad. */
export const SENTINEL: EnemyKind = {
  id: 'sentinel',
  texture: 'enemy-sentinel',
  path: 'assets/enemies/sentinel.png',
  frame: { width: 32, height: 32 },
  frameCount: 4,
  frameRate: 6,
  directional: true,
  origin: { x: 0.5, y: 0.94 },
  body: { width: 14, height: 12, offsetX: 9, offsetY: 18 },
  health: 12,
  speed: 24.2,
  contactDamage: 4,
  xpValue: 2,
  gold: { chance: 0.1, value: 1 },
  rangedAttack: { range: 250, cooldownMs: 2600, damage: 6, projectileSpeed: 165 },
  spawn: { fromProgress: 0.25, weight: 0.45, maxAlive: 3 },
};

/** Outrider (súbdito de Thanos en Endgame): rápido y frágil, conserva la velocidad, vida y daño originales. */
export const SCOUT: EnemyKind = {
  id: 'scout',
  texture: 'enemy-scout',
  path: 'assets/enemies/scout.png',
  frame: { width: 32, height: 32 },
  frameCount: 4,
  frameRate: 10,
  directional: true,
  origin: { x: 0.5, y: 0.94 },
  body: { width: 13, height: 11, offsetX: 9, offsetY: 19 },
  health: 10,
  speed: 64,
  contactDamage: 5,
  xpValue: 1,
  gold: { chance: 0.05, value: 1 },
  spawn: { fromProgress: 0.15, weight: 3 },
};

/** Doombot (tanque pesado): más lento, menos daño por contacto, pero mucha más vida y giro suave en 8 direcciones. */
export const BRUTE: EnemyKind = {
  id: 'brute',
  texture: 'enemy-brute',
  path: 'assets/enemies/brute.png',
  frame: { width: 32, height: 32 },
  frameCount: 4,
  frameRate: 5,
  directional: true,
  origin: { x: 0.5, y: 0.94 },
  body: { width: 18, height: 12, offsetX: 7, offsetY: 18 },
  health: 110,
  speed: 25,
  contactDamage: 8,
  xpValue: 4,
  gold: { chance: 0.2, value: 3 },
  spawn: { fromProgress: 0.4, weight: 1.5 },
};

/** Cráneo Rojo (Red Skull): primer jefe gigante, 8 direcciones con gabardina de HYDRA y 3 ataques principales. */
export const OVERLORD: EnemyKind = {
  id: 'overlord',
  texture: 'enemy-overlord',
  path: 'assets/enemies/overlord.png',
  frame: { width: 48, height: 48 },
  frameCount: 4,
  frameRate: 6,
  directional: true,
  scale: 1.65,
  origin: { x: 0.5, y: 0.92 },
  body: { width: 22, height: 18, offsetX: 13, offsetY: 26 },
  health: 440,
  speed: 33,
  contactDamage: 20,
  xpValue: 0,
};

export const ENEMY_KINDS: readonly EnemyKind[] = [DRONE, SENTINEL, SCOUT, BRUTE, OVERLORD];

/** Elige al azar (por peso) uno de los enemigos de oleada disponibles en este punto de la ronda. */
export function pickWaveEnemy(progress: number, countByKind?: (id: string) => number): EnemyKind {
  const available = ENEMY_KINDS.filter((kind) => {
    if (!kind.spawn || progress < kind.spawn.fromProgress) return false;
    if (kind.spawn.maxAlive !== undefined && countByKind && countByKind(kind.id) >= kind.spawn.maxAlive) return false;
    return true;
  });
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
