import Phaser from 'phaser';
import type { AttackDefinition } from '../characters/CharacterDefinition';
import { BASIC_ATTACK_LIMITS } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Enemy } from '../entities/Enemy';
import { TEXTURES } from '../config/assetKeys';
import { Projectile } from '../entities/Projectile';
import type { PlayerStats } from '../progression/PlayerStats';

/** Punto al que se apunta un disparo. */
interface AimPoint {
  x: number;
  y: number;
}

/**
 * Dispara automáticamente al enemigo más cercano dentro del alcance de puntería.
 * Si no hay enemigos cerca, apunta a la caja o roca más cercana (para sacar oro).
 */
export class AutoAttackSystem {
  readonly projectiles: Phaser.Physics.Arcade.Group;
  private lastShotAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly attack: AttackDefinition,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
    private readonly props: () => Iterable<BreakableProp>,
  ) {
    this.projectiles = scene.physics.add.group({ allowGravity: false });
  }

  update(now: number): void {
    this.removeExpiredProjectiles();
    if (now - this.lastShotAt < this.attack.cooldownMs * this.stats.cooldownMult) return;

    const fired =
      this.attack.kind === 'thunder' ? this.strike() : this.attack.kind === 'quake' ? this.quake() : this.fireNearest();
    if (fired) this.lastShotAt = now;
  }

  private fireNearest(): boolean {
    const target = this.findNearestEnemy() ?? this.findNearestProp();
    if (!target) return false;
    this.fireAt(target);
    return true;
  }

  private rollDamage(): { damage: number; critical: boolean } {
    const critical = Math.random() < this.stats.critChance;
    const damage = this.attack.damage * this.stats.damageMult * (critical ? this.stats.critMult : 1);
    return { damage, critical };
  }

  private activeEnemies(): Enemy[] {
    return (this.enemies.getChildren() as Enemy[]).filter((enemy) => enemy.active && !enemy.dying);
  }

  /** Daña a todo lo que esté a `radius` de (x, y): enemigos y cajas/rocas. Devuelve cuántos enemigos tocó. */
  private damageArea(x: number, y: number, radius: number, damage: number, knockback = 0): number {
    const radiusSq = radius * radius;
    let hits = 0;
    for (const enemy of this.activeEnemies()) {
      const dx = enemy.x - x;
      const dy = enemy.y - 6 - y;
      if (dx * dx + dy * dy > radiusSq) continue;
      enemy.takeDamage(damage);
      hits++;
      if (knockback > 0 && !enemy.dying && enemy.kind.id !== 'overlord') enemy.knockback(dx, dy, knockback, 140);
    }
    for (const prop of this.props()) {
      if (prop.isBroken) continue;
      if ((prop.x - x) ** 2 + (prop.y - y) ** 2 <= radiusSq) prop.takeDamage(damage);
    }
    return hits;
  }

  /** Thor: un rayo por cada disparo disponible, sobre los enemigos más cercanos (o una caja si no hay). */
  private strike(): boolean {
    const range = this.attack.aimRange * this.stats.rangeMult;
    const count = this.stats.projectileCount + this.stats.amountBonus;
    const targets: AimPoint[] = this.activeEnemies()
      .map((enemy) => ({ x: enemy.x, y: enemy.y - 6, d: (enemy.x - this.owner.x) ** 2 + (enemy.y - this.owner.y) ** 2 }))
      .filter((t) => t.d <= range * range)
      .sort((a, b) => a.d - b.d)
      .slice(0, count);
    if (targets.length === 0) {
      const prop = this.findNearestProp();
      if (!prop) return false;
      targets.push(prop);
    }
    const radius = (this.attack.radius ?? 24) * this.stats.areaMult;
    for (const target of targets) {
      const { damage, critical } = this.rollDamage();
      this.damageArea(target.x, target.y, radius, damage);
      this.drawThunder(target.x, target.y, radius, critical);
    }
    return true;
  }

  private drawThunder(x: number, y: number, radius: number, critical: boolean): void {
    const depth = 999_999;
    const bolt = this.scene.add.image(x, y + 6, TEXTURES.thunder).setOrigin(0.5, 1).setDepth(depth);
    const flash = this.scene.add.circle(x, y, radius, critical ? 0xffe272 : 0x6fd8ff, 0.45).setDepth(depth - 1);
    this.scene.tweens.add({ targets: [bolt, flash], alpha: 0, duration: 220, onComplete: () => { bolt.destroy(); flash.destroy(); } });
  }

  /** Hulk: golpea el piso. Solo ataca si hay algo cerca; daña y empuja a todos alrededor. */
  private quake(): boolean {
    const radius = (this.attack.radius ?? 50) * this.stats.areaMult;
    const trigger = radius * 1.2;
    const near =
      this.activeEnemies().some((e) => (e.x - this.owner.x) ** 2 + (e.y - this.owner.y) ** 2 <= trigger * trigger) ||
      [...this.props()].some((p) => !p.isBroken && (p.x - this.owner.x) ** 2 + (p.y - this.owner.y) ** 2 <= trigger * trigger);
    if (!near) return false;
    const { damage, critical } = this.rollDamage();
    this.damageArea(this.owner.x, this.owner.y - 4, radius, damage, 170);
    const ring = this.scene.add
      .circle(this.owner.x, this.owner.y - 2, radius, critical ? 0xffe272 : 0x8be05a, 0.3)
      .setStrokeStyle(3, critical ? 0xffffff : 0xc8ff9a, 0.9)
      .setDepth(999_998)
      .setScale(0.25);
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.scene.cameras.main.shake(80, 0.003);
    return true;
  }

  private findNearestEnemy(): AimPoint | null {
    let nearest: Enemy | null = null;
    let nearestSq = (this.attack.aimRange * this.stats.rangeMult) ** 2;

    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (!enemy.active || enemy.dying) continue;
      const dx = enemy.x - this.owner.x;
      const dy = enemy.y - this.owner.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestSq) {
        nearestSq = distSq;
        nearest = enemy;
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y - 8 } : null;
  }

  private findNearestProp(): AimPoint | null {
    let nearest: AimPoint | null = null;
    let nearestSq = (this.attack.aimRange * this.stats.rangeMult) ** 2;
    for (const prop of this.props()) {
      const dx = prop.x - this.owner.x;
      const dy = prop.y - this.owner.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestSq) {
        nearestSq = distSq;
        nearest = { x: prop.x, y: prop.y };
      }
    }
    return nearest;
  }

  /** Dispara `projectileCount` disparos en abanico, centrados en la dirección del objetivo. */
  private fireAt(target: AimPoint): void {
    const { stats } = this;
    const originX = this.owner.x;
    const originY = this.owner.y - 14; // a la altura del pecho
    const aim = Math.atan2(target.y - originY, target.x - originX);
    const speed = this.attack.projectileSpeed * stats.projectileSpeedMult;
    const count = stats.projectileCount + stats.amountBonus;

    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * BASIC_ATTACK_LIMITS.spread;
      const critical = Math.random() < stats.critChance;
      const damage = this.attack.damage * stats.damageMult * (critical ? stats.critMult : 1);
      const projectile = new Projectile(
        this.scene,
        originX,
        originY,
        this.attack.projectileTexture,
        damage,
        this.attack.maxDistance * stats.rangeMult,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        {
          pierce: this.attack.kind === 'shield' ? 999 : stats.pierce,
          critical,
          boomerang: this.attack.kind === 'shield' ? this.owner : undefined,
          slow: this.attack.slowMs ? { ms: this.attack.slowMs, factor: this.attack.slowFactor ?? 0.6 } : undefined,
        },
      );
      projectile.setScale(projectile.scaleX * stats.areaMult);
      this.projectiles.add(projectile);
      // `group.add` reinicia la velocidad del cuerpo: se vuelve a aplicar.
      projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  private removeExpiredProjectiles(): void {
    for (const child of this.projectiles.getChildren() as Projectile[]) {
      child.step();
      if (child.hasExpired()) child.destroy();
    }
  }
}
