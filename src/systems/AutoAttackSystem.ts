import Phaser from 'phaser';
import type { AttackDefinition } from '../characters/CharacterDefinition';
import { BASIC_ATTACK_LIMITS } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { activeEnemies, damageArea, drawThunder } from './areaDamage';
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
      this.attack.kind === 'thunder' ? this.strike() : this.attack.kind === 'fan' ? this.swipe() : this.fireNearest();
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

  /** Thor: un rayo por cada disparo disponible, sobre los enemigos más cercanos (o una caja si no hay). */
  private strike(): boolean {
    const range = this.attack.aimRange * this.stats.rangeMult;
    const count = this.stats.projectileCount + this.stats.amountBonus;
    const targets: AimPoint[] = activeEnemies(this.enemies)
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
      damageArea(this.enemies, this.props(), target.x, target.y, radius, damage);
      drawThunder(this.scene, target.x, target.y, radius, critical);
    }
    return true;
  }

  /** Hulk: zarpazo en abanico fino hacia el enemigo más cercano; con más disparos, abanicos repartidos alrededor. */
  private swipe(): boolean {
    const { stats } = this;
    const target = this.findNearestEnemy() ?? this.findNearestProp();
    if (!target) return false;
    const originX = this.owner.x;
    const originY = this.owner.y - 8;
    const aim = Math.atan2(target.y - originY, target.x - originX);
    const count = stats.projectileCount + stats.amountBonus;
    const reach = this.attack.maxDistance * stats.rangeMult * stats.fanReachMult;
    const arc = Math.min(Math.PI * 2, Phaser.Math.DegToRad(this.attack.arcDegrees ?? 40) * stats.fanAngleMult * Math.sqrt(stats.areaMult));
    const { damage, critical } = this.rollDamage();

    for (let i = 0; i < count; i++) {
      const angle = aim + (i * Math.PI * 2) / count;
      this.hitSector(originX, originY, angle, arc, reach, damage);
      this.drawSector(originX, originY, angle, arc, reach, critical);
    }
    return true;
  }

  /** Daña a enemigos y cajas dentro del sector (ángulo `arc` centrado en `angle`, hasta `reach`). */
  private hitSector(x: number, y: number, angle: number, arc: number, reach: number, damage: number): void {
    const half = arc / 2;
    const inside = (px: number, py: number): boolean => {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > reach * reach) return false;
      return arc >= Math.PI * 2 || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle)) <= half;
    };
    for (const enemy of activeEnemies(this.enemies)) {
      if (!inside(enemy.x, enemy.y - 8)) continue;
      enemy.takeDamage(damage);
      if (!enemy.dying && enemy.kind.id !== 'overlord') enemy.knockback(enemy.x - x, enemy.y - y, 90, 90);
    }
    for (const prop of this.props()) if (!prop.isBroken && inside(prop.x, prop.y)) prop.takeDamage(damage);
  }

  private drawSector(x: number, y: number, angle: number, arc: number, reach: number, critical: boolean): void {
    const g = this.scene.add.graphics().setDepth(999_998);
    const color = critical ? 0xffe272 : 0x8be05a;
    g.fillStyle(color, 0.4).slice(x, y, reach, angle - arc / 2, angle + arc / 2, false).fillPath();
    g.lineStyle(3, 0xeaffd0, 0.9).beginPath().arc(x, y, reach, angle - arc / 2, angle + arc / 2, false).strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
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
      const baseScale = this.attack.kind === 'shield' ? 0.35 : 1;
      projectile.setScale(projectile.scaleX * baseScale * stats.areaMult);
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
