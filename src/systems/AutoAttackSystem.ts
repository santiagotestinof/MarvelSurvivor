import Phaser from 'phaser';
import type { AttackDefinition } from '../characters/CharacterDefinition';
import { BASIC_ATTACK_LIMITS, EVOLUTION } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { activeEnemies, damageArea } from './areaDamage';
import type { PlayerStats } from '../progression/PlayerStats';
import { AuraVisual } from './AuraVisual';

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
  private lastUpdateAt = 0;
  private readonly aura: AuraVisual | null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly owner: Character,
    private readonly attack: AttackDefinition,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly stats: PlayerStats,
    private readonly props: () => Iterable<BreakableProp>,
  ) {
    this.projectiles = scene.physics.add.group({ allowGravity: false });
    this.aura = attack.kind === 'aura' ? new AuraVisual(scene, owner) : null;
    if (this.aura) scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.aura?.destroy());
  }

  /** Radio actual del aura: crece con Área. */
  private auraRadius(): number {
    const evolved = this.stats.evolved ? EVOLUTION.strangeRadiusMult : 1;
    return (this.attack.radius ?? 60) * this.stats.areaMult * this.stats.mainAreaMult * this.stats.rangeMult * evolved;
  }

  update(now: number): void {
    this.removeExpiredProjectiles();
    const delta = Math.max(0, now - this.lastUpdateAt);
    this.lastUpdateAt = now;
    this.aura?.update(delta, this.auraRadius());
    if (now - this.lastShotAt < this.attack.cooldownMs * this.stats.cooldownMult) return;

    const fired =
      this.attack.kind === 'aura'
        ? this.pulseAura()
        : this.attack.kind === 'hammer'
          ? this.slam()
          : this.attack.kind === 'fan'
            ? this.swipe()
            : this.fireNearest();
    if (fired) this.lastShotAt = now;
  }

  /** Doctor Strange: daña a todo lo que esté dentro del círculo de runas. */
  private pulseAura(): boolean {
    const { damage } = this.rollDamage();
    const radius = this.auraRadius();
    // Aura evolucionada (Dimensión lenta): además ralentiza a todos los que están adentro.
    if (this.stats.evolved) {
      for (const enemy of activeEnemies(this.enemies)) {
        if ((enemy.x - this.owner.x) ** 2 + (enemy.y - 6 - (this.owner.y - 4)) ** 2 <= radius * radius) {
          enemy.applySlow(EVOLUTION.strangeSlowMs, EVOLUTION.strangeSlowFactor);
        }
      }
    }
    const hits = damageArea(this.enemies, this.props(), this.owner.x, this.owner.y - 4, radius, damage);
    if (hits > 0) this.aura?.pulse();
    return true;
  }

  private fireNearest(): boolean {
    const enemyTarget = this.findNearestEnemy();
    const target = enemyTarget ?? this.findNearestProp();
    if (!target) return false;
    this.fireAt(target, enemyTarget !== null);
    return true;
  }

  private rollDamage(): { damage: number; critical: boolean } {
    const critical = Math.random() < this.stats.critChance;
    const damage = this.attack.damage * this.stats.damageMult * (critical ? this.stats.critMult : 1);
    return { damage, critical };
  }

  /** Thor: una onda de choque por cada disparo disponible, hacia enemigos al azar que estén en pantalla (o una caja si no hay). */
  private slam(): boolean {
    const count = this.stats.projectileCount;
    const view = this.scene.cameras.main.worldView;
    const pool = activeEnemies(this.enemies).filter((enemy) => view.contains(enemy.x, enemy.y));
    Phaser.Utils.Array.Shuffle(pool);
    const targets: AimPoint[] = pool.slice(0, count).map((enemy) => ({ x: enemy.x, y: enemy.y - 6 }));
    if (targets.length === 0) {
      const prop = this.findNearestProp();
      if (!prop) return false;
      targets.push(prop);
    }
    for (const target of targets) this.shockLine(target);
    return true;
  }

  /** Thor: onda de choque en línea desde Thor hacia `target`; daña a todo lo que toca. */
  private shockLine(target: AimPoint): void {
    const x1 = this.owner.x;
    const y1 = this.owner.y - 8;
    const angle = Math.atan2(target.y - y1, target.x - x1);
    // Corta al principio: crece con los niveles de área del arma (a nivel 7 llega a ~190 px).
    const length = EVOLUTION.thorLineLength * (1 + (this.stats.mainAreaMult - 1) * 1.4);
    const width = EVOLUTION.thorLineWidth * this.stats.areaMult * this.stats.mainAreaMult;
    const x2 = x1 + Math.cos(angle) * length;
    const y2 = y1 + Math.sin(angle) * length;
    const { damage, critical } = this.rollDamage();

    const near = (px: number, py: number, extra: number): boolean => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)) <= width / 2 + extra;
    };
    for (const enemy of activeEnemies(this.enemies)) if (near(enemy.x, enemy.y - 6, 6)) enemy.takeDamage(damage);
    for (const prop of this.props()) if (!prop.isBroken && near(prop.x, prop.y, 4)) prop.takeDamage(damage);

    // El piso se rompe: una grieta que avanza desde Thor con ramas, trozos de tierra que saltan y polvo.
    const g = this.scene.add.graphics().setDepth(999_997);
    const points: { x: number; y: number }[] = [];
    const steps = Math.max(4, Math.round(length / 14));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === 0 ? 0 : Phaser.Math.Between(-5, 5);
      points.push({ x: x1 + (x2 - x1) * t - Math.sin(angle) * jitter, y: y1 + (y2 - y1) * t + Math.cos(angle) * jitter });
    }
    g.lineStyle(width, 0x2a1d12, 0.85).strokePoints(points);
    g.lineStyle(Math.max(2, width * 0.45), 0x120b06, 0.95).strokePoints(points);
    // Ramas más finas que salen de la grieta.
    for (let i = 2; i < points.length - 1; i += 2) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const branch = angle + side * Phaser.Math.FloatBetween(0.6, 1.1);
      const len = Phaser.Math.Between(8, 16);
      g.lineStyle(Math.max(2, width * 0.2), 0x120b06, 0.85)
        .lineBetween(points[i].x, points[i].y, points[i].x + Math.cos(branch) * len, points[i].y + Math.sin(branch) * len);
    }
    g.lineStyle(Math.max(1.5, width * 0.15), critical ? 0xffe272 : 0xcfeeff, 0.9).strokePoints(points);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 900, delay: 250, onComplete: () => g.destroy() });

    // Trozos de tierra y piedra que saltan de la grieta.
    for (let i = 0; i < Math.max(6, Math.round(length / 14)); i++) {
      const p = points[Phaser.Math.Between(1, points.length - 1)];
      const size = Phaser.Math.Between(2, 4);
      const chunk = this.scene.add.rectangle(p.x, p.y, size, size, Phaser.Math.RND.pick([0x5b4630, 0x3a2a1c, 0x7d6a4f])).setDepth(999_998);
      this.scene.tweens.add({
        targets: chunk,
        x: p.x + Phaser.Math.Between(-14, 14),
        y: [p.y - Phaser.Math.Between(10, 22), p.y + Phaser.Math.Between(0, 6)],
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(380, 620),
        ease: 'Quad.easeOut',
        onComplete: () => chunk.destroy(),
      });
    }
    this.scene.cameras.main.shake(70, 0.002);
  }

  /** Hulk: zarpazo en abanico fino hacia el enemigo más cercano; con más disparos, abanicos repartidos alrededor. */
  private swipe(): boolean {
    const { stats } = this;
    const target = this.findNearestEnemy() ?? this.findNearestProp();
    if (!target) return false;
    const originX = this.owner.x;
    const originY = this.owner.y - 8;
    const aim = Math.atan2(target.y - originY, target.x - originX);
    // Furia circular (evolución): el abanico pasa a ser un círculo completo alrededor de Hulk.
    const count = stats.evolved ? 1 : stats.projectileCount;
    const reach = this.attack.maxDistance * stats.rangeMult * stats.fanReachMult;
    const arc = stats.evolved
      ? Math.PI * 2
      : Math.min(Math.PI * 2, Phaser.Math.DegToRad(this.attack.arcDegrees ?? 40) * stats.fanAngleMult * Math.sqrt(stats.areaMult));
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

  /** Enemigo más cercano a (x, y), sin contar `exclude` (para los rebotes del escudo). */
  private nearestEnemyFrom(x: number, y: number, exclude: object | null): Enemy | null {
    let best: Enemy | null = null;
    let bestSq = (this.attack.aimRange * this.stats.rangeMult * 1.4) ** 2;
    for (const enemy of activeEnemies(this.enemies)) {
      if (enemy === exclude) continue;
      const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
      if (d < bestSq) {
        bestSq = d;
        best = enemy;
      }
    }
    return best;
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
  private fireAt(target: AimPoint, targetIsEnemy = true): void {
    const { stats } = this;
    const originX = this.owner.x;
    const originY = this.owner.y - 14; // a la altura del pecho
    const aim = Math.atan2(target.y - originY, target.x - originX);
    const speed = this.attack.projectileSpeed * stats.projectileSpeedMult;
    const count = stats.projectileCount;

    // Escudo rebotador (evolución del Capitán): salta de un enemigo al próximo en vez de ir y volver.
    const bounces = this.attack.kind === 'shield' && stats.evolved && targetIsEnemy;
    // Telaraña inmovilizadora (evolución de Spider-Man): deja al enemigo sin moverse unos segundos.
    const freeze = this.attack.kind === 'web' && stats.evolved;

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
          boomerang: this.attack.kind === 'shield' && !bounces ? this.owner : undefined,
          bounce: bounces
            ? { count: EVOLUTION.shieldBounces + stats.bounceBonus, find: (x, y, exclude) => this.nearestEnemyFrom(x, y, exclude) }
            : undefined,
          slow: freeze
            ? { ms: EVOLUTION.webFreezeMs, factor: 0 }
            : this.attack.slowMs
              ? { ms: this.attack.slowMs, factor: this.attack.slowFactor ?? 0.6 }
              : undefined,
        },
      );
      if (freeze) projectile.setTint(0x9fe8ff);
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
