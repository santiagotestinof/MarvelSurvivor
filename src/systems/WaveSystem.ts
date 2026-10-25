import Phaser from 'phaser';
import { ROUND, SPECIAL_WAVES, WAVES } from '../config/gameplayConfig';
import { BRUTE, pickWaveEnemy, type EnemyKind } from '../enemies/enemyKinds';
import type { Character } from '../entities/Character';
import { Enemy, type EnemyScaling } from '../entities/Enemy';
import type { PlayerStats } from '../progression/PlayerStats';

/** Genera enemigos fuera de la pantalla, cada vez más seguido y más fuertes/rápidos a medida que avanza el tiempo. */
export class WaveSystem {
  private nextSpawnAt = 0;
  stopped = false;
  private nextSpecialAtMs = -1;
  private nextSpecialIsHorde = Math.random() < 0.5;
  private readonly quickSpecials = new URLSearchParams(window.location.search).has('oleada');

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly player: Character,
    private readonly world: { width: number; height: number },
    private readonly onEnemyDied: (enemy: Enemy) => void,
    private readonly stats: PlayerStats,
    private readonly forceDoombots = false,
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
    if (this.stopped) return;
    this.updateSpecial(progress);
    if (now < this.nextSpawnAt) return;

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
      const kind = this.forceDoombots ? BRUTE : pickWaveEnemy(progress, (id) => this.aliveCountOfKind(id));
      this.spawnEnemy(kind, scaling);
    }
  }

  /** Oleada especial: cuando llega su momento, suelta una manada o un círculo y avisa en pantalla. */
  private updateSpecial(progress: number): void {
    const elapsed = progress * ROUND.durationMs;
    if (this.nextSpecialAtMs < 0) this.nextSpecialAtMs = elapsed + (this.quickSpecials ? 5_000 : SPECIAL_WAVES.firstAtMs);
    if (elapsed < this.nextSpecialAtMs) return;
    this.nextSpecialAtMs = elapsed + (this.quickSpecials ? 15_000 : SPECIAL_WAVES.everyMs);

    const horde = this.nextSpecialIsHorde;
    this.nextSpecialIsHorde = !horde;
    const range = horde ? SPECIAL_WAVES.hordeCount : SPECIAL_WAVES.ringCount;
    const count = Math.round(Phaser.Math.Linear(range.from, range.to, Phaser.Math.Clamp(progress, 0, 1)));
    const kind = pickWaveEnemy(progress, (id) => this.aliveCountOfKind(id));
    const scaling = this.getScaling(progress);
    const room = Math.round(WAVES.maxAlive * Math.max(1, this.stats.curseMult * this.stats.spawnMult)) + SPECIAL_WAVES.extraAlive - this.aliveCount();
    const total = Math.max(0, Math.min(count, room));
    const view = this.scene.cameras.main.worldView;
    const margin = WAVES.spawnMargin;

    if (horde) {
      // Manada: un grupo apretado que entra por un costado.
      const side = Math.floor(Math.random() * 4);
      const cx = side === 2 ? view.left - margin - 30 : side === 3 ? view.right + margin + 30 : view.centerX;
      const cy = side === 0 ? view.top - margin - 30 : side === 1 ? view.bottom + margin + 30 : view.centerY;
      for (let i = 0; i < total; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * 38;
        this.spawnEnemyAt(kind, scaling, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      }
    } else {
      // Círculo: todos a la vez, justo fuera de la pantalla y alrededor del jugador.
      const radius = Math.hypot(view.width, view.height) / 2 + margin;
      const start = Math.random() * Math.PI * 2;
      for (let i = 0; i < total; i++) {
        const angle = start + (i / Math.max(1, total)) * Math.PI * 2;
        this.spawnEnemyAt(kind, scaling, this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius);
      }
    }
    this.scene.events.emit('special-wave', horde ? '¡MANADA!' : '¡TE RODEAN!');
  }

  private spawnEnemyAt(kind: EnemyKind, scaling: EnemyScaling, x: number, y: number): Enemy {
    const enemy = new Enemy(
      this.scene,
      Phaser.Math.Clamp(x, 10, this.world.width - 10),
      Phaser.Math.Clamp(y, 10, this.world.height - 10),
      kind,
      scaling,
    );
    if (kind.spawn && Math.random() < this.stats.defangChance) enemy.defang();
    this.enemies.add(enemy);
    enemy.once('died', this.onEnemyDied);
    return enemy;
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

  private aliveCountOfKind(kindId: string): number {
    let count = 0;
    for (const child of this.enemies.getChildren() as Enemy[]) {
      if (child.active && !child.dying && child.kind.id === kindId) count++;
    }
    return count;
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
