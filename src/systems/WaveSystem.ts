import Phaser from 'phaser';
import { MINIBOSS_CONFIG, ROUND, SPECIAL_WAVES, WAVES } from '../config/gameplayConfig';
import { BRUTE, MINIBOSS, pickWaveEnemy, type EnemyKind } from '../enemies/enemyKinds';
import type { Character } from '../entities/Character';
import { Enemy, type EnemyScaling } from '../entities/Enemy';
import type { WorldRect } from '../world/BossArena';
import type { PlayerStats } from '../progression/PlayerStats';

/** Genera enemigos fuera de la pantalla, cada vez más seguido y más fuertes/rápidos a medida que avanza el tiempo. */
export class WaveSystem {
  private nextSpawnAt = 0;
  private nextRelocateAt = 0;
  stopped = false;
  private nextSpecialAtMs = -1;
  private nextMiniBossAtMs = -1;
  private readonly quickMiniBoss = new URLSearchParams(window.location.search).has('minijefe');
  private nextSpecialIsHorde = Math.random() < 0.5;
  private readonly quickSpecials = new URLSearchParams(window.location.search).has('oleada');

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly player: Character,
    private readonly world: WorldRect,
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
    this.updateMiniBoss(progress);
    this.relocateStragglers(now);
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

  /** Mini jefe: aparece una sola vez, a los 10 min de una ronda de 15, fuera de pantalla, sin contar para el tope de enemigos. */
  private updateMiniBoss(progress: number): void {
    const elapsed = progress * ROUND.durationMs;
    if (this.nextMiniBossAtMs < 0) this.nextMiniBossAtMs = this.quickMiniBoss ? 8_000 : Math.min(MINIBOSS_CONFIG.atMs, (ROUND.durationMs * 2) / 3);
    if (elapsed < this.nextMiniBossAtMs || progress >= 0.999) return;
    // Con `?minijefe` se repite cada 30 s para probar; en una ronda normal sale una sola vez.
    this.nextMiniBossAtMs = this.quickMiniBoss ? this.nextMiniBossAtMs + 30_000 : Number.POSITIVE_INFINITY;
    const { x, y } = this.pickSpawnPoint();
    this.spawnEnemyAt(MINIBOSS, this.getScaling(progress), x, y);
    this.scene.events.emit('special-wave', '¡MINI JEFE!');
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
      // Manada: un frente ancho que cruza la pantalla en línea recta, pasa por donde está el jugador y se va por el otro lado.
      const side = Math.floor(Math.random() * 4);
      const cx = side === 2 ? view.left - margin - 30 : side === 3 ? view.right + margin + 30 : view.centerX;
      const cy = side === 0 ? view.top - margin - 30 : side === 1 ? view.bottom + margin + 30 : view.centerY;
      const length = Math.hypot(this.player.x - cx, this.player.y - cy) || 1;
      const dx = (this.player.x - cx) / length;
      const dy = (this.player.y - cy) / length;
      const px = -dy;
      const py = dx;
      const columns = Math.min(total, Math.max(6, Math.round(total / 3)));
      const exit = Math.hypot(view.width, view.height) / 2 + margin + 40;
      for (let i = 0; i < total; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const across = (col - (columns - 1) / 2) * 20 + Phaser.Math.Between(-3, 3);
        const behind = row * 20 + Phaser.Math.Between(-3, 3);
        const enemy = this.spawnEnemyAt(kind, scaling, cx + px * across - dx * behind, cy + py * across - dy * behind, false);
        enemy.startStampede(dx, dy, exit);
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

  private spawnEnemyAt(kind: EnemyKind, scaling: EnemyScaling, x: number, y: number, clampToWorld = true): Enemy {
    const enemy = new Enemy(
      this.scene,
      clampToWorld ? Phaser.Math.Clamp(x, this.world.x + 10, this.world.x + this.world.width - 10) : x,
      clampToWorld ? Phaser.Math.Clamp(y, this.world.y + 10, this.world.y + this.world.height - 10) : y,
      kind,
      scaling,
    );
    if (kind.spawn && Math.random() < this.stats.defangChance) enemy.defang();
    this.enemies.add(enemy);
    enemy.once('died', this.onEnemyDied);
    return enemy;
  }

  /** Genera un enemigo en un punto exacto (el jefe en la arena). */
  spawnAt(kind: EnemyKind, scaling: EnemyScaling, x: number, y: number): Enemy {
    return this.spawnEnemyAt(kind, scaling, x, y);
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

  /** Dirección (unitaria) en la que se mueve el jugador, o null si está casi quieto. */
  private moveDirection(): { x: number; y: number } | null {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return null;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    return speed > 5 ? { x: body.velocity.x / speed, y: body.velocity.y / speed } : null;
  }

  /**
   * Los enemigos que quedaron muy atrás (lejos y fuera de pantalla) reaparecen fuera de la vista, del lado
   * hacia donde se mueve el jugador: así parece que siempre vienen de todos lados.
   */
  private relocateStragglers(now: number): void {
    if (now < this.nextRelocateAt) return;
    this.nextRelocateAt = now + WAVES.relocateCheckMs;
    const view = this.scene.cameras.main.worldView;
    const far = Math.hypot(view.width, view.height) / 2 + WAVES.spawnMargin + WAVES.relocateExtra;
    let moved = 0;
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (moved >= WAVES.relocatePerCheck) break;
      if (!enemy.active || enemy.dying || enemy.isStampeding || enemy.frozen || !enemy.kind.spawn || enemy.kind.id === MINIBOSS.id) continue;
      if (Math.hypot(enemy.x - view.centerX, enemy.y - view.centerY) < far) continue;
      const { x, y } = this.pickSpawnPoint();
      enemy.setPosition(x, y);
      enemy.setVelocity(0, 0);
      moved++;
    }
  }

  /** Punto justo fuera de lo que se ve en pantalla, dentro de los límites del mapa. */
  private pickSpawnPoint(): { x: number; y: number } {
    const view = this.scene.cameras.main.worldView;
    const margin = WAVES.spawnMargin;
    let point = { x: this.player.x, y: this.player.y };

    const dir = this.moveDirection();

    for (let attempt = 0; attempt < 8; attempt++) {
      const side = Math.floor(Math.random() * 4);
      let x: number;
      let y: number;
      if (dir && Math.random() < WAVES.aheadChance) {
        // Delante del jugador: un punto del borde de la pantalla (más el margen) en un ángulo cercano a su dirección.
        const angle = Math.atan2(dir.y, dir.x) + Phaser.Math.FloatBetween(-1, 1) * WAVES.aheadSpread;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const hw = view.width / 2 + margin;
        const hh = view.height / 2 + margin;
        const t = Math.min(Math.abs(cos) < 1e-6 ? Infinity : hw / Math.abs(cos), Math.abs(sin) < 1e-6 ? Infinity : hh / Math.abs(sin));
        x = view.centerX + cos * t;
        y = view.centerY + sin * t;
      } else if (side === 0) {
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
      x = Phaser.Math.Clamp(x, this.world.x + 10, this.world.x + this.world.width - 10);
      y = Phaser.Math.Clamp(y, this.world.y + 10, this.world.y + this.world.height - 10);
      point = { x, y };
      if (!view.contains(x, y)) break;
    }
    return point;
  }
}
