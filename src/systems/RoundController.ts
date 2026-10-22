import type Phaser from 'phaser';
import { ROUND } from '../config/gameplayConfig';
import { OVERLORD } from '../enemies/enemyKinds';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { WaveSystem } from './WaveSystem';

/**
 * waves: oleadas hasta que se acaba el tiempo · boss: pelea contra el jefe
 * won: se venció al jefe · lost: murió el jugador
 */
export type RoundPhase = 'waves' | 'boss' | 'won' | 'lost';

/** Lo que el HUD necesita saber de la ronda. */
export interface HudState {
  phase: RoundPhase;
  health: number;
  maxHealth: number;
  remainingMs: number;
  elapsedMs: number;
  kills: number;
  bossHealth: number;
  bossMaxHealth: number;
}

/** Reglas de una ronda: oleadas durante `ROUND.durationMs`, después el jefe; se gana al vencerlo. */
export class RoundController {
  phase: RoundPhase = 'waves';
  kills = 0;

  private boss: Enemy | null = null;
  private readonly startedAt: number;
  private endedAt = 0;

  constructor(
    startedAt: number,
    private readonly player: Character,
    private readonly waves: WaveSystem,
    private readonly enemies: Phaser.Physics.Arcade.Group,
  ) {
    this.startedAt = startedAt;
  }

  get ended(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  update(now: number): void {
    if (this.ended) return;

    if (this.player.isDead) {
      this.finish('lost', now);
      return;
    }

    if (this.phase === 'waves') {
      const elapsed = now - this.startedAt;
      if (elapsed >= ROUND.durationMs) {
        this.phase = 'boss';
        this.waves.stopped = true;
        this.boss = this.waves.spawnEnemy(OVERLORD, { health: 1, speed: 1 });
      } else {
        this.waves.update(now, elapsed / ROUND.durationMs);
      }
    }
  }

  /** Se llama cuando muere cualquier enemigo. */
  onEnemyKilled = (enemy: Enemy): void => {
    if (this.ended) return;
    this.kills++;
    if (enemy === this.boss) this.finish('won', enemy.scene.time.now);
  };

  getHudState(now: number): HudState {
    const elapsed = (this.ended ? this.endedAt : now) - this.startedAt;
    return {
      phase: this.phase,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      remainingMs: Math.max(0, ROUND.durationMs - elapsed),
      elapsedMs: elapsed,
      kills: this.kills,
      bossHealth: this.boss ? Math.max(0, this.boss.health) : 0,
      bossMaxHealth: this.boss ? this.boss.maxHealth : 0,
    };
  }

  private finish(result: 'won' | 'lost', now: number): void {
    this.phase = result;
    this.endedAt = now;
    this.waves.stopped = true;

    if (result === 'won') {
      // Al vencer al jefe caen también los enemigos que quedaban.
      for (const enemy of this.enemies.getChildren() as Enemy[]) enemy.takeDamage(Number.MAX_SAFE_INTEGER);
    }
  }
}
