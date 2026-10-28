import Phaser from 'phaser';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { PlayerStats } from '../progression/PlayerStats';
import { activeEnemies, damageArea, drawThunder } from './areaDamage';

/** Habilidad especial de un héroe (tecla E / botón ULT). Doctor Strange e Iron Man tienen las suyas aparte. */
export interface HeroUltimate {
  readonly cooldownMs: number;
  readonly label: string;
  start(now: number): void;
  /** Se llama cada cuadro; devuelve true en el cuadro en que termina (ahí empieza el enfriamiento). */
  update(now: number): boolean;
  isActive(now: number): boolean;
  remainingMs(now: number): number;
}

export interface HeroUltimateDeps {
  scene: Phaser.Scene;
  player: Character;
  enemies: Phaser.Physics.Arcade.Group;
  props: () => Iterable<BreakableProp>;
  stats: PlayerStats;
  projectiles: Phaser.Physics.Arcade.Group;
  projectileTexture: string;
}

abstract class TimedUltimate implements HeroUltimate {
  abstract readonly cooldownMs: number;
  abstract readonly label: string;
  protected abstract readonly durationMs: number;
  private endsAt = 0;

  constructor(protected readonly deps: HeroUltimateDeps) {}

  start(now: number): void {
    this.endsAt = now + this.durationMs;
    this.onStart(now);
  }

  update(now: number): boolean {
    if (this.endsAt <= 0) return false;
    if (now >= this.endsAt) {
      this.endsAt = 0;
      this.onEnd();
      return true;
    }
    this.onTick(now);
    return false;
  }

  isActive(now: number): boolean {
    return this.endsAt > 0 && now < this.endsAt;
  }

  remainingMs(now: number): number {
    return this.isActive(now) ? this.endsAt - now : 0;
  }

  protected abstract onStart(now: number): void;
  protected onTick(_now: number): void {}
  protected onEnd(): void {}

  /** Enemigos que se ven en la pantalla ahora. */
  protected onScreen(): Enemy[] {
    const view = this.deps.scene.cameras.main.worldView;
    return activeEnemies(this.deps.enemies).filter((enemy) => view.contains(enemy.x, enemy.y));
  }

  protected ring(x: number, y: number, radius: number, color: number): void {
    const { scene } = this.deps;
    const ring = scene.add.circle(x, y, radius, color, 0.22).setStrokeStyle(4, color, 0.9).setDepth(999_998).setScale(0.2);
    scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }
}

/** Capitán América: "¡Carga!" embiste hacia donde mira, sin recibir daño, y se lleva puesto a todo lo que toca. */
export class ShieldCharge extends TimedUltimate {
  readonly cooldownMs = 30_000;
  readonly label = 'CARGA';
  protected readonly durationMs = 800;
  private nextHitAt = 0;
  private nextTrailAt = 0;

  protected onStart(now: number): void {
    const { player } = this.deps;
    const dir = player.facingVector();
    const speed = 420;
    player.setDash({ vx: dir.x * speed, vy: dir.y * speed });
    player.protectUntil(this.deps.scene.time.now + this.durationMs + 150);
    this.nextHitAt = now;
    this.nextTrailAt = now;
    this.ring(player.x, player.y, 50, 0x2f6fe0);
  }

  protected onTick(now: number): void {
    const { scene, player, enemies, props, stats } = this.deps;
    if (now >= this.nextHitAt) {
      this.nextHitAt = now + 60;
      damageArea(enemies, props(), player.x, player.y - 4, 30, 18 * stats.damageMult, 130);
    }
    if (now >= this.nextTrailAt) {
      this.nextTrailAt = now + 45;
      const trail = scene.add.circle(player.x, player.y - 6, 11, 0x5aa0ff, 0.45).setDepth(player.y - 1);
      scene.tweens.add({ targets: trail, alpha: 0, scale: 0.3, duration: 320, onComplete: () => trail.destroy() });
    }
  }

  protected onEnd(): void {
    this.deps.player.setDash(null);
  }
}

/** Spider-Man: "Red gigante" pega a todos los enemigos de la pantalla y los deja casi inmóviles 4 s. */
export class GiantWeb extends TimedUltimate {
  readonly cooldownMs = 36_000;
  readonly label = 'RED';
  protected readonly durationMs = 1;

  protected onStart(): void {
    const { scene, player, stats } = this.deps;
    for (const enemy of this.onScreen()) {
      enemy.takeDamage(25 * stats.damageMult);
      if (enemy.dying) continue;
      enemy.applySlow(4000, enemy.kind.id === 'overlord' ? 0.5 : 0);
      const web = scene.add.graphics().setDepth(enemy.y + 1);
      web.lineStyle(1, 0xffffff, 0.9);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        web.lineBetween(enemy.x - Math.cos(a) * 11, enemy.y - 6 - Math.sin(a) * 11, enemy.x + Math.cos(a) * 11, enemy.y - 6 + Math.sin(a) * 11);
      }
      web.strokeCircle(enemy.x, enemy.y - 6, 6).strokeCircle(enemy.x, enemy.y - 6, 11);
      scene.tweens.add({ targets: web, alpha: 0, delay: 3200, duration: 800, onComplete: () => web.destroy() });
    }
    this.ring(player.x, player.y, 180, 0xffffff);
  }
}

/** Thor: "Dios del trueno" desata 4 s de rayos fuertes sobre los enemigos de la pantalla. */
export class GodOfThunder extends TimedUltimate {
  readonly cooldownMs = 40_000;
  readonly label = 'TRUENO';
  protected readonly durationMs = 4000;
  private nextBolt = 0;

  protected onStart(now: number): void {
    this.nextBolt = now;
    this.ring(this.deps.player.x, this.deps.player.y, 120, 0x6fd8ff);
  }

  protected onTick(now: number): void {
    if (now < this.nextBolt) return;
    this.nextBolt = now + 140;
    const { scene, player, enemies, props, stats } = this.deps;
    const pool = this.onScreen();
    for (let i = 0; i < 2; i++) {
      const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      const x = target ? target.x : player.x + Phaser.Math.Between(-140, 140);
      const y = target ? target.y - 6 : player.y + Phaser.Math.Between(-90, 90);
      damageArea(enemies, props(), x, y, 36, 40 * stats.damageMult);
      drawThunder(scene, x, y, 36);
    }
  }
}

/** Hulk: "¡HULK APLASTA!" golpea el piso con una onda enorme que daña mucho y manda lejos a todos. */
export class HulkSmash extends TimedUltimate {
  readonly cooldownMs = 42_000;
  readonly label = 'APLASTAR';
  protected readonly durationMs = 1;

  protected onStart(): void {
    const { scene, player, enemies, props, stats } = this.deps;
    damageArea(enemies, props(), player.x, player.y - 4, 190, 110 * stats.damageMult, 420);
    this.ring(player.x, player.y, 190, 0x8be05a);
    scene.cameras.main.shake(200, 0.004);
  }
}

export function createHeroUltimate(heroId: string, deps: HeroUltimateDeps): HeroUltimate | null {
  switch (heroId) {
    case 'capitan':
      return new ShieldCharge(deps);
    case 'spiderman':
      return new GiantWeb(deps);
    case 'thor':
      return new GodOfThunder(deps);
    case 'hulk':
      return new HulkSmash(deps);
    default:
      return null;
  }
}
