import type Phaser from 'phaser';

export interface EnemyKind {
  id: string;
  texture: string;
  path: string;
  frame: { width: number; height: number };
  frameCount: number;
  frameRate: number;
  origin: { x: number; y: number };
  body: { width: number; height: number; offsetX: number; offsetY: number };
  health: number;
  speed: number;
  contactDamage: number;
  xpValue: number;
  rangedAttack?: { range: number; cooldownMs: number; damage: number; projectileSpeed: number };
  spawn?: { fromProgress: number; weight: number };
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
  xpValue: 1,
  spawn: { fromProgress: 0, weight: 6 },
};

export const SENTINEL: EnemyKind = {
  id: 'sentinel',
  texture: 'enemy-sentinel',
  path: 'assets/enemies/drone.png',
  frame: { width: 24, height: 24 },
  frameCount: 2,
  frameRate: 5,
  origin: { x: 0.5, y: 0.9 },
  body: { width: 12, height: 10, offsetX: 6, offsetY: 10 },
  health: 24,
  speed: 22,
  contactDamage: 4,
  xpValue: 2,
  rangedAttack: { range: 260, cooldownMs: 2200, damage: 5, projectileSpeed: 110 },
  spawn: { fromProgress: 0.3, weight: 1.4 },
};

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
  spawn: { fromProgress: 0.15, weight: 3 },
};

export const BRUTE: EnemyKind = {
  id: 'brute',
  texture: 'enemy-brute',
  path: 'assets/enemies/brute.png',
  frame: { width: 32, height: 32 },
  frameCount: 2,
  frameRate: 3,
  origin: { x: 0.5, y: 0.92 },
  body: { width: 18, height: 10, offsetX: 7, offsetY: 20 },
  health: 80,
  speed: 24,
  contactDamage: 14,
  xpValue: 4,
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
  health: 400,
  speed: 30,
  contactDamage: 20,
  xpValue: 0,
};

export const ENEMY_KINDS: readonly EnemyKind[] = [DRONE, SENTINEL, SCOUT, BRUTE, OVERLORD];

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

export function enemyAnimationKey(kind: EnemyKind): string {
  return `${kind.id}:walk`;
}

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
