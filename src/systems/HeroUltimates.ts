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
  cancel(now: number): boolean;
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
  anchors: () => Phaser.GameObjects.Rectangle[];
  obstacles: () => Phaser.GameObjects.Rectangle[];
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
    return this.endsAt <= 0;
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

  cancel(_now: number): boolean { return false; }

  protected finishEarly(): boolean {
    if (this.endsAt <= 0) return false;
    this.endsAt = 0;
    this.onEnd();
    return true;
  }

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

/** Spider-Man: se engancha a un punto cercano y gira alrededor mientras sus telarañas siguen atacando. */
export class WebSwing extends TimedUltimate {
  readonly cooldownMs = 25_000;
  readonly label = 'TELARAÑA';
  protected readonly durationMs = 2500;
  private anchorX = 0;
  private anchorY = 0;
  private radius = 0;
  private anchorObstacle: Phaser.GameObjects.Rectangle | null = null;
  private startAngle = 0;
  private lastTickAt = 0;
  private nextHitAt = 0;
  private readonly swingSpeed = 380;
  private line: Phaser.GameObjects.Graphics | null = null;
  private readonly lastHitAt = new Map<Enemy, number>();

  protected onStart(now: number): void {
    const { scene, player, anchors } = this.deps;
    const target = anchors().map((object) => {
      const body = object.body as Phaser.Physics.Arcade.StaticBody;
      const x = body.center.x;
      const y = body.center.y;
      const anchorY = y - 12;
      const distance = Phaser.Math.Distance.Between(player.x, player.y, x, anchorY);
      return { object, x, y: anchorY, distance };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (!target) { this.finishEarly(); return; }
    this.anchorObstacle = target.object;
    this.anchorX = target.x;
    this.anchorY = target.y;
    this.radius = Math.max(8, target.distance);
    this.startAngle = Math.atan2(player.y - this.anchorY, player.x - this.anchorX);
    this.lastTickAt = now;
    this.nextHitAt = now;
    this.lastHitAt.clear();
    this.line?.destroy();
    this.line = scene.add.graphics().setDepth(999_989);
    this.drawWeb(player.x, player.y);
    this.ring(this.anchorX, this.anchorY, 8, 0xffffff);
  }

  cancel(_now: number): boolean { return this.finishEarly(); }

  protected onTick(now: number): void {
    const { player, enemies, stats } = this.deps;
    const delta = Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;
    // La velocidad tangencial se mantiene constante, independientemente del radio.
    this.startAngle += (delta * this.swingSpeed / 1000) / this.radius;
    const angle = this.startAngle;
    const x = this.anchorX + Math.cos(angle) * this.radius;
    const y = this.anchorY + Math.sin(angle) * this.radius;
    const body = player.body as Phaser.Physics.Arcade.Body;
    const bounds = this.deps.scene.physics.world.bounds;
    const candidate = new Phaser.Geom.Rectangle(x - body.width / 2, y - body.height / 2, body.width, body.height);
    const hitBoundary = candidate.left <= bounds.left || candidate.top <= bounds.top ||
      candidate.right >= bounds.right || candidate.bottom >= bounds.bottom;
    const blocked = this.deps.obstacles().some((object) => object !== this.anchorObstacle && object.body &&
      Phaser.Geom.Intersects.RectangleToRectangle(candidate, new Phaser.Geom.Rectangle(
        (object.body as Phaser.Physics.Arcade.StaticBody).x,
        (object.body as Phaser.Physics.Arcade.StaticBody).y,
        (object.body as Phaser.Physics.Arcade.StaticBody).width,
        (object.body as Phaser.Physics.Arcade.StaticBody).height,
      )));
    if (hitBoundary || blocked) { this.finishEarly(); return; }
    player.setPosition(x, y);
    player.setVelocity(0, 0);
    (player.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
    this.drawWeb(x, y);

    if (now < this.nextHitAt) return;
    this.nextHitAt = now + 300;
    for (const enemy of activeEnemies(enemies)) {
      if (enemy.dying || Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > 28) continue;
      const previousHit = this.lastHitAt.get(enemy) ?? 0;
      if (now - previousHit < 600) continue;
      enemy.takeDamage(6 * stats.damageMult);
      this.lastHitAt.set(enemy, now);
    }
  }

  protected onEnd(): void {
    this.line?.destroy();
    this.line = null;
    this.anchorObstacle = null;
    this.deps.player.setVelocity(0, 0);
    this.lastHitAt.clear();
  }

  private drawWeb(x: number, y: number): void {
    if (!this.line) return;
    this.line.clear();
    this.line.lineStyle(2, 0xffffff, 0.88);
    this.line.lineBetween(this.anchorX, this.anchorY, x, y);
    this.line.fillStyle(0xffffff, 0.9);
    this.line.fillCircle(this.anchorX, this.anchorY, 3);
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
      return new WebSwing(deps);
    case 'thor':
      return new GodOfThunder(deps);
    case 'hulk':
      return new HulkSmash(deps);
    default:
      return null;
  }
}
