import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Character } from '../entities/Character';
import type { PlayerStats } from '../progression/PlayerStats';
import { activeEnemies, damageArea, drawThunder } from './areaDamage';
import type { Enemy } from '../entities/Enemy';

/**
 * Arma secundaria exclusiva de un héroe: arranca bloqueada (nivel 0) y se desbloquea y sube de nivel
 * con una mejora que solo le sale a ese héroe (ver `HERO_WEAPONS` y `upgrades.ts`).
 */
export interface HeroWeapon {
  readonly level: number;
  readonly maxed: boolean;
  levelUp(): void;
  /** `now` y `delta` en ms, con el reloj de la ronda (no avanza en pausa). */
  update(now: number, delta: number): void;
}

export const HERO_WEAPON_MAX_LEVEL = 5;

export interface HeroWeaponDeps {
  scene: Phaser.Scene;
  owner: Character;
  enemies: Phaser.Physics.Arcade.Group;
  stats: PlayerStats;
  props: () => Iterable<BreakableProp>;
}

abstract class LeveledWeapon implements HeroWeapon {
  level = 0;

  constructor(protected readonly deps: HeroWeaponDeps) {}

  get maxed(): boolean {
    return this.level >= HERO_WEAPON_MAX_LEVEL;
  }

  levelUp(): void {
    this.level = Math.min(HERO_WEAPON_MAX_LEVEL, this.level + 1);
  }

  abstract update(now: number, delta: number): void;
}

/** Capitán América: escudos que giran a su alrededor y golpean a todo el que toquen. */
export class OrbitShields extends LeveledWeapon {
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private angle = 0;
  private readonly nextHit = new WeakMap<Enemy, number>();

  update(now: number, delta: number): void {
    const { scene, owner, enemies, stats } = this.deps;
    const count = this.level > 0 ? this.level + 1 + stats.amountBonus : 0;
    while (this.sprites.length < count) this.sprites.push(scene.add.image(0, 0, TEXTURES.shield).setDepth(999_990));
    while (this.sprites.length > count) this.sprites.pop()?.destroy();
    if (count === 0) return;

    this.angle += (delta / 1000) * (2.6 + this.level * 0.25);
    const radius = (30 + this.level * 3) * stats.areaMult;
    const damage = (6 + this.level * 2) * stats.damageMult;
    const scale = 1 + 0.15 * stats.areaMult;
    const list = activeEnemies(enemies);
    this.sprites.forEach((sprite, i) => {
      const a = this.angle + (i * Math.PI * 2) / count;
      sprite.setPosition(owner.x + Math.cos(a) * radius, owner.y - 8 + Math.sin(a) * radius * 0.8).setRotation(a * 2).setScale(scale);
      for (const enemy of list) {
        if (enemy.dying || (this.nextHit.get(enemy) ?? 0) > now) continue;
        if ((enemy.x - sprite.x) ** 2 + (enemy.y - 6 - sprite.y) ** 2 > 14 * 14 * scale) continue;
        this.nextHit.set(enemy, now + 450);
        enemy.takeDamage(damage);
        if (!enemy.dying && enemy.kind.id !== 'overlord') enemy.knockback(enemy.x - owner.x, enemy.y - owner.y, 70, 80);
      }
    });
  }
}

/** Spider-Man: deja telarañas en el piso que frenan y lastiman a los enemigos que las pisan. */
export class WebTraps extends LeveledWeapon {
  private readonly webs: { g: Phaser.GameObjects.Graphics; x: number; y: number; radius: number; until: number; nextTick: number; damage: number }[] = [];
  private nextDrop = 0;

  update(now: number): void {
    if (this.level === 0) return;
    const { scene, owner, enemies, stats, props } = this.deps;

    if (now >= this.nextDrop) {
      this.nextDrop = now + (3400 - this.level * 350) * stats.cooldownMult;
      const near = activeEnemies(enemies).filter((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 170 * 170);
      const amount = 1 + Math.floor(this.level / 2) + stats.amountBonus;
      for (let i = 0; i < amount; i++) {
        const target = near.length > 0 ? near[Math.floor(Math.random() * near.length)] : null;
        const x = target ? target.x : owner.x + Phaser.Math.Between(-60, 60);
        const y = target ? target.y : owner.y + Phaser.Math.Between(-40, 40);
        this.spawn(x, y, now);
      }
    }

    for (let i = this.webs.length - 1; i >= 0; i--) {
      const web = this.webs[i];
      if (now >= web.until) {
        const g = web.g;
        scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
        this.webs.splice(i, 1);
        continue;
      }
      if (now < web.nextTick) continue;
      web.nextTick = now + 350;
      for (const enemy of activeEnemies(enemies)) {
        if ((enemy.x - web.x) ** 2 + (enemy.y - 6 - web.y) ** 2 > web.radius * web.radius) continue;
        enemy.applySlow(500, 0.35);
        enemy.takeDamage(web.damage);
      }
      for (const prop of props()) if (!prop.isBroken && (prop.x - web.x) ** 2 + (prop.y - web.y) ** 2 <= web.radius * web.radius) prop.takeDamage(web.damage);
    }
  }

  private spawn(x: number, y: number, now: number): void {
    const { scene, stats } = this.deps;
    const radius = (24 + this.level * 4) * stats.areaMult;
    const g = scene.add.graphics().setDepth(2);
    g.fillStyle(0xf2f2f2, 0.12).fillCircle(x, y, radius);
    g.lineStyle(1.5, 0xf2f2f2, 0.85);
    for (const r of [0.35, 0.7, 1]) g.strokeCircle(x, y, radius * r);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    this.webs.push({
      g,
      x,
      y,
      radius,
      until: now + (3500 + this.level * 600) * stats.durationMult,
      nextTick: now + 350,
      damage: (3 + this.level * 1.5) * stats.damageMult,
    });
  }
}

/** Thor: cada tanto, una tormenta hace caer rayos sobre enemigos al azar alrededor. */
export class ThunderStorm extends LeveledWeapon {
  private nextStorm = 0;

  update(now: number): void {
    if (this.level === 0 || now < this.nextStorm) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    this.nextStorm = now + (4300 - this.level * 350) * stats.cooldownMult;

    const pool = activeEnemies(enemies).filter((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 260 * 260);
    const bolts = 2 + this.level + stats.amountBonus;
    const radius = 30 * stats.areaMult;
    const damage = (14 + this.level * 3) * stats.damageMult;
    for (let i = 0; i < bolts; i++) {
      const target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      const x = target ? target.x : owner.x + Phaser.Math.Between(-120, 120);
      const y = target ? target.y - 6 : owner.y + Phaser.Math.Between(-80, 80);
      scene.time.delayedCall(i * 110, () => {
        damageArea(enemies, props(), x, y, radius, damage);
        drawThunder(scene, x, y, radius);
      });
    }
  }
}

/** Hulk: golpea el piso y una onda de choque daña y empuja a todos los que lo rodean. */
export class Shockwave extends LeveledWeapon {
  private nextWave = 0;

  update(now: number): void {
    if (this.level === 0 || now < this.nextWave) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    const radius = (46 + this.level * 12) * stats.areaMult;
    const trigger = radius * 1.15;
    const near = activeEnemies(enemies).some((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 <= trigger * trigger);
    if (!near) return;
    this.nextWave = now + (3600 - this.level * 350) * stats.cooldownMult;

    damageArea(enemies, props(), owner.x, owner.y - 4, radius, (14 + this.level * 4) * stats.damageMult, 210);
    const ring = scene.add
      .circle(owner.x, owner.y - 2, radius, 0x8be05a, 0.3)
      .setStrokeStyle(3, 0xc8ff9a, 0.9)
      .setDepth(999_998)
      .setScale(0.25);
    scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
    scene.cameras.main.shake(90, 0.003);
  }
}


/** Valores base de los portales de Strange: no cambian con el nivel del arma (solo con las mejoras comunes). */
const PORTAL = { openEveryMs: 7000, shotEveryMs: 520, durationMs: 4000, sparkDamage: 7, sparkSpeed: 200 } as const;

interface Portal {
  g: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Image;
  x: number;
  y: number;
  until: number;
  nextShot: number;
}

interface Spark {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  left: number;
  damage: number;
  critical: boolean;
  hits: number;
  hitSet: Set<unknown>;
}

/**
 * Doctor Strange: abre portales fijos en puntos al azar a su alrededor; cada uno dispara chispas al enemigo más cercano
 * mientras dura. Usa las mejoras comunes: daño, enfriamiento, duración, área, cantidad, velocidad del disparo, perforación y crítico.
 */
export class Portals extends LeveledWeapon {
  private readonly portals: Portal[] = [];
  private readonly sparks: Spark[] = [];
  private nextOpen = 0;

  update(now: number, delta: number): void {
    this.updateSparks(delta);
    if (this.level === 0) return;
    const { scene, owner, stats } = this.deps;

    if (now >= this.nextOpen) {
      // Cadencia = velocidad de las chispas; Duración = cuánto quedan abiertos. Cada cuánto se abre uno nuevo no depende de ninguna.
      this.nextOpen = now + PORTAL.openEveryMs;
      // El nivel del arma SOLO suma portales (hasta 3) y chispas por ráfaga (nv 4 y 5); lo demás sube únicamente con las mejoras comunes.
      const amount = Math.min(this.level, 3) + stats.amountBonus;
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(40, 95) * stats.rangeMult;
        this.open(owner.x + Math.cos(angle) * dist, owner.y - 6 + Math.sin(angle) * dist * 0.8, now);
      }
    }

    for (let i = this.portals.length - 1; i >= 0; i--) {
      const portal = this.portals[i];
      portal.ring.rotation += delta * 0.003;
      if (now >= portal.until) {
        const g = portal.g;
        scene.tweens.add({ targets: g, scale: 0, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        this.portals.splice(i, 1);
        continue;
      }
      if (now < portal.nextShot) continue;
      const target = this.nearestTarget(portal.x, portal.y);
      if (!target) continue;
      portal.nextShot = now + PORTAL.shotEveryMs * stats.cooldownMult;
      const volley = 1 + Math.max(0, this.level - 3);
      for (let k = 0; k < volley; k++) this.shoot(portal.x, portal.y, target.x, target.y, (k - (volley - 1) / 2) * 0.22);
    }
  }

  private open(x: number, y: number, now: number): void {
    const { scene, stats } = this.deps;
    const radius = 15 * Math.sqrt(stats.areaMult);
    const hole = scene.add.ellipse(0, 0, radius * 2, radius * 2, 0x1a0a28, 0.85);
    const ring = scene.add.image(0, 0, TEXTURES.auraInner).setBlendMode(Phaser.BlendModes.ADD).setScale((radius * 2) / 80);
    const glow = scene.add.circle(0, 0, radius * 1.15, 0xff9a2e, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    const g = scene.add.container(x, y, [glow, hole, ring]).setDepth(y - 0.8).setScale(0.1);
    scene.tweens.add({ targets: g, scale: 1, duration: 180, ease: 'Back.Out' });
    this.portals.push({ g, ring, x, y, until: now + PORTAL.durationMs * stats.durationMult, nextShot: now + 250 });
  }

  private nearestTarget(x: number, y: number): { x: number; y: number } | null {
    const { enemies, props } = this.deps;
    let best: { x: number; y: number } | null = null;
    let bestSq = 230 * 230;
    for (const enemy of activeEnemies(enemies)) {
      const d = (enemy.x - x) ** 2 + (enemy.y - 8 - y) ** 2;
      if (d < bestSq) {
        bestSq = d;
        best = { x: enemy.x, y: enemy.y - 8 };
      }
    }
    if (best) return best;
    bestSq = 130 * 130;
    for (const prop of props()) {
      if (prop.isBroken) continue;
      const d = (prop.x - x) ** 2 + (prop.y - y) ** 2;
      if (d < bestSq) {
        bestSq = d;
        best = { x: prop.x, y: prop.y };
      }
    }
    return best;
  }

  private shoot(x: number, y: number, tx: number, ty: number, spread = 0): void {
    const { scene, stats } = this.deps;
    const angle = Math.atan2(ty - y, tx - x) + spread + Phaser.Math.FloatBetween(-0.06, 0.06);
    const speed = PORTAL.sparkSpeed * stats.projectileSpeedMult;
    const critical = Math.random() < stats.critChance;
    const damage = PORTAL.sparkDamage * stats.damageMult * (critical ? stats.critMult : 1);
    const sprite = scene.add.image(x, y, TEXTURES.spark).setDepth(999_980).setRotation(angle).setScale(stats.areaMult ** 0.5);
    this.sparks.push({
      sprite,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      left: 280 * stats.rangeMult,
      damage,
      critical,
      hits: 1 + stats.pierce,
      hitSet: new Set(),
    });
  }

  private updateSparks(delta: number): void {
    const { enemies, props } = this.deps;
    const list = activeEnemies(enemies);
    const breakables = [...props()];
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      const dx = (s.vx * delta) / 1000;
      const dy = (s.vy * delta) / 1000;
      s.sprite.x += dx;
      s.sprite.y += dy;
      s.left -= Math.hypot(dx, dy);
      s.sprite.rotation += delta * 0.01;
      let spent = s.left <= 0;
      const reach = 11 * s.sprite.scaleX;
      for (const enemy of list) {
        if (spent) break;
        if (enemy.dying || s.hitSet.has(enemy)) continue;
        if ((enemy.x - s.sprite.x) ** 2 + (enemy.y - 8 - s.sprite.y) ** 2 > reach * reach) continue;
        s.hitSet.add(enemy);
        enemy.takeDamage(s.damage);
        if (--s.hits <= 0) spent = true;
      }
      for (const prop of breakables) {
        if (spent) break;
        if (prop.isBroken || s.hitSet.has(prop)) continue;
        if ((prop.x - s.sprite.x) ** 2 + (prop.y - s.sprite.y) ** 2 > (reach + 6) ** 2) continue;
        s.hitSet.add(prop);
        prop.takeDamage(s.damage);
        if (--s.hits <= 0) spent = true;
      }
      if (spent) {
        s.sprite.destroy();
        this.sparks.splice(i, 1);
      }
    }
  }
}

/** Qué arma secundaria exclusiva tiene cada héroe (por id de héroe). */
export const HERO_WEAPONS: Record<
  string,
  { upgradeId: string; name: string; text: string; create: (deps: HeroWeaponDeps) => HeroWeapon }
> = {
  capitan: {
    upgradeId: 'orbit-shields',
    name: 'Escudos orbitales',
    text: 'Escudos que giran a tu alrededor y golpean a todos',
    create: (deps) => new OrbitShields(deps),
  },
  spiderman: {
    upgradeId: 'web-traps',
    name: 'Trampas de telaraña',
    text: 'Telarañas en el piso que frenan y lastiman',
    create: (deps) => new WebTraps(deps),
  },
  thor: {
    upgradeId: 'thunder-storm',
    name: 'Tormenta',
    text: 'Una lluvia de rayos cae sobre los enemigos',
    create: (deps) => new ThunderStorm(deps),
  },
  strange: {
    upgradeId: 'portals',
    name: 'Portales',
    text: 'Abre portales alrededor que disparan chispas',
    create: (deps) => new Portals(deps),
  },
  hulk: {
    upgradeId: 'shockwave',
    name: 'Onda de choque',
    text: 'Golpe al piso: daña y empuja a todos alrededor',
    create: (deps) => new Shockwave(deps),
  },
};
