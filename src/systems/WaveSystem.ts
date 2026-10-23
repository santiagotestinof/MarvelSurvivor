import Phaser from 'phaser';
import { WAVES } from '../config/gameplayConfig';
import { pickWaveEnemy, type EnemyKind } from '../enemies/enemyKinds';
import type { Character } from '../entities/Character';
import { Enemy, type EnemyScaling } from '../entities/Enemy';
import type { PlayerStats } from '../progression/PlayerStats';

/** Genera enemigos fuera de la pantalla, cada vez más seguido y más fuertes/rápidos a medida que avanza el tiempo. */
export class WaveSystem {
  private nextSpawnAt = 0;
  stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly player: Character,
    private readonly world: { width: number; height: number },
    private readonly onEnemyDied: (enemy: Enemy) => void,
    private readonly stats: PlayerStats,
  ) {}

  /** Multiplicadores de vida y velocidad según el progreso del tiempo (`0` al inicio, `1` al llegar al jefe y sigue subiendo). */
  getScaling(progress: number): EnemyScaling {
    const p = Math.max(0, progress);
    return {
      health: (1 + p * WAVES.healthGrowth) * this.stats.curseMult,
      speed: (1 + p * WAVES.speedGrowth) * this.stats.curseMult,
    };
  }

  /** `progress` va de 0 (inicio de la ronda) a 1 (aparece el jefe). */
  update(now: number, progress: number): void {
    if (this.stopped || now < this.nextSpawnAt) return;

    // Maldición y Encanto: más enemigos, y más seguido.
    const crowd = this.stats.curseMult * this.stats.spawnMult;
    const interval = Phaser.Math.Linear(WAVES.startIntervalMs, WAVES.endIntervalMs, progress) / crowd;
    this.nextSpawnAt = now + interval;
    const maxAlive = Math.round(WAVES.maxAlive * Math.max(1, crowd));
    if (this.aliveCount() >= maxAlive) return;

    // Entre 1 y N enemigos por aparición; N crece de 1 a WAVES.maxBatch durante la ronda.
    const maxBatch = Math.max(1, Math.round(Phaser.Math.Linear(1, WAVES.maxBatch, progress)));
    const batch = Math.max(1, Math.round(Phaser.Math.Between(1, maxBatch) * crowd));
    const scaling = this.getScaling(progress);
    for (let i = 0; i < batch && this.aliveCount() < maxAlive; i++) {
      this.spawnEnemy(pickWaveEnemy(progress), scaling);
    }
  }

  spawnEnemy(kind: EnemyKind, scaling: EnemyScaling): Enemy {
    const { x, y } = this.pickSpawnPoint();
    const enemy = new Enemy(this.scene, x, y, kind, scaling);
    if (kind.spawn && Math.random() < this.stats.defangChance) enemy.defang();
    this.enemies.add(enemy);
    enemy.once('died', this.onEnemyDied);
    return enemy;
  }

  aliveCount(): number {
    return this.enemies.countActive(true);
  }

  /** Punto justo fuera de lo que se ve en pantalla, dentro de los límites del mapa. */
  private pickSpawnPoint(): { x: number; y: number } {
    const view = this.scene.cameras.main.worldView;
    const margin = WAVES.spawnMargin;
    let point = { x: this.player.x, y: this.player.y };

    for (let attempt = 0; attempt < 8; attempt++) {
      const side = Math.floor(Math.random() * 4);
      let x: number;
      let y: number;
      if (side === 0) {
        x = Phaser.Math.FloatBetween(view.left - margin, view.right + margin);
        y = view.top - margin;
      } else if (side === 1) {
        x = Phaser.Math.FloatBetween(view.left - margin, view.right + margin);
        y = view.bottom + margin;
      } else if (side === 2) {
        x = view.left - margin;
        y = Phaser.Math.FloatBetween(view.top - margin, view.bottom + margin);
      } else {
        x = view.right + margin;
        y = Phaser.Math.FloatBetween(view.top - margin, view.bottom + margin);
      }
      x = Phaser.Math.Clamp(x, 10, this.world.width - 10);
      y = Phaser.Math.Clamp(y, 10, this.world.height - 10);
      point = { x, y };
      if (!view.contains(x, y)) break;
    }
    return point;
  }
}
