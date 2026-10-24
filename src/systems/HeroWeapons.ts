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

/**
 * Qué suma cada nivel de un arma (como en Vampire Survivors): el nivel 1 la desbloquea con sus valores base y cada nivel
 * siguiente da un bono fijo y distinto. La cadencia, el daño, etc. NO suben solos: solo por esta tabla o por las mejoras comunes.
 */
export interface LevelBonus {
  /** Unidades extra (portales, escudos, telarañas, rayos). */
  amount?: number;
  /** Multiplicador del tiempo entre disparos / activaciones (0,8 = 20 % más rápido). */
  cooldown?: number;
  damage?: number;
  area?: number;
  duration?: number;
  /** Velocidad de giro (escudos). */
  spin?: number;
  /** Empuje (onda de choque). */
  knockback?: number;
}

/** Bonos acumulados hasta `level` (el nivel 1 no suma nada). */
function accumulate(table: Partial<Record<number, LevelBonus>>, level: number): Required<LevelBonus> {
  const total = { amount: 0, cooldown: 1, damage: 1, area: 1, duration: 1, spin: 1, knockback: 1 };
  for (let l = 2; l <= level; l++) {
    const b = table[l];
    if (!b) continue;
    total.amount += b.amount ?? 0;
    total.cooldown *= b.cooldown ?? 1;
    total.damage *= b.damage ?? 1;
    total.area *= b.area ?? 1;
    total.duration *= b.duration ?? 1;
    total.spin *= b.spin ?? 1;
    total.knockback *= b.knockback ?? 1;
  }
  return total;
}

abstract class LeveledWeapon implements HeroWeapon {
  level = 0;
  protected abstract readonly table: Partial<Record<number, LevelBonus>>;

  constructor(protected readonly deps: HeroWeaponDeps) {}

  get maxed(): boolean {
    return this.level >= HERO_WEAPON_MAX_LEVEL;
  }

  levelUp(): void {
    this.level = Math.min(HERO_WEAPON_MAX_LEVEL, this.level + 1);
  }

  /** Bonos fijos del nivel actual. */
  protected get bonus(): Required<LevelBonus> {
    return accumulate(this.table, this.level);
  }

  abstract update(now: number, delta: number): void;
}

/** Capitán América: escudos que giran a su alrededor y golpean a todo el que toquen. */
export const ORBIT_SHIELDS_LEVELS = ['+1 escudo', 'Giran más rápido', '+1 escudo', 'Más daño y área'];
export class OrbitShields extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { spin: 1.3 },
    4: { amount: 1 },
    5: { damage: 1.4, area: 1.2 },
  };
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private angle = 0;
  private readonly nextHit = new WeakMap<Enemy, number>();

  update(now: number, delta: number): void {
    const { scene, owner, enemies, stats } = this.deps;
    const b = this.bonus;
    const count = this.level > 0 ? 2 + b.amount + stats.amountBonus : 0;
    while (this.sprites.length < count) this.sprites.push(scene.add.image(0, 0, TEXTURES.shield).setDepth(999_990));
    while (this.sprites.length > count) this.sprites.pop()?.destroy();
    if (count === 0) return;

    this.angle += (delta / 1000) * 2.85 * b.spin;
    const radius = 33 * b.area * stats.areaMult;
    const damage = 8 * b.damage * stats.damageMult;
    const scale = 1 + 0.15 * stats.areaMult * b.area;
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
export const WEB_TRAPS_LEVELS = ['+1 telaraña', 'Telarañas más grandes', 'Duran más', '+1 telaraña y más daño'];
export class WebTraps extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { area: 1.25 },
    4: { duration: 1.3 },
    5: { amount: 1, damage: 1.5 },
  };
  private readonly webs: { g: Phaser.GameObjects.Graphics; x: number; y: number; radius: number; until: number; nextTick: number; damage: number }[] = [];
  private nextDrop = 0;

  update(now: number): void {
    if (this.level === 0) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    const b = this.bonus;

    if (now >= this.nextDrop) {
      this.nextDrop = now + 3000 * b.cooldown * stats.cooldownMult;
      const near = activeEnemies(enemies).filter((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 170 * 170);
      const amount = 1 + b.amount + stats.amountBonus;
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
    const b = this.bonus;
    const radius = 28 * b.area * stats.areaMult;
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
      until: now + 4100 * b.duration * stats.durationMult,
      nextTick: now + 350,
      damage: 4.5 * b.damage * stats.damageMult,
    });
  }
}

/** Thor: cada tanto, una tormenta hace caer rayos sobre enemigos al azar alrededor. */
export const THUNDER_STORM_LEVELS = ['+1 rayo', 'Tormenta más seguida', '+1 rayo', 'Más daño y área'];
export class ThunderStorm extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { cooldown: 0.8 },
    4: { amount: 1 },
    5: { damage: 1.3, area: 1.25 },
  };
  private nextStorm = 0;

  update(now: number): void {
    if (this.level === 0 || now < this.nextStorm) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    const b = this.bonus;
    this.nextStorm = now + 4000 * b.cooldown * stats.cooldownMult;

    const pool = activeEnemies(enemies).filter((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 260 * 260);
    const bolts = 3 + b.amount + stats.amountBonus;
    const radius = 30 * b.area * stats.areaMult;
    const damage = 17 * b.damage * stats.damageMult;
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
export const SHOCKWAVE_LEVELS = ['Onda más grande', 'Golpea más seguido', 'Más daño', 'Más área y más empuje'];
export class Shockwave extends LeveledWeapon {
  protected readonly table = {
    2: { area: 1.2 },
    3: { cooldown: 0.8 },
    4: { damage: 1.35 },
    5: { area: 1.2, knockback: 1.3 },
  };
  private nextWave = 0;

  update(now: number): void {
    if (this.level === 0 || now < this.nextWave) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    const b = this.bonus;
    const radius = 58 * b.area * stats.areaMult;
    const trigger = radius * 1.15;
    const near = activeEnemies(enemies).some((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 <= trigger * trigger);
    if (!near) return;
    this.nextWave = now + 3600 * b.cooldown * stats.cooldownMult;

    damageArea(enemies, props(), owner.x, owner.y - 4, radius, 18 * b.damage * stats.damageMult, 210 * b.knockback);
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
const PORTAL = { openEveryMs: 5000, shotEveryMs: 420, durationMs: 4500, sparkDamage: 8, sparkSpeed: 200 } as const;

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
export const PORTALS_LEVELS = ['+1 portal', 'Disparan más rápido', '+1 portal', 'Más daño'];
export class Portals extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { cooldown: 0.78 },
    4: { amount: 1 },
    5: { damage: 1.4 },
  };
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
      const amount = 1 + this.bonus.amount + stats.amountBonus;
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
      portal.nextShot = now + PORTAL.shotEveryMs * this.bonus.cooldown * stats.cooldownMult;
      this.shoot(portal.x, portal.y, target.x, target.y);
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

  private shoot(x: number, y: number, tx: number, ty: number): void {
    const { scene, stats } = this.deps;
    const angle = Math.atan2(ty - y, tx - x) + Phaser.Math.FloatBetween(-0.06, 0.06);
    const speed = PORTAL.sparkSpeed * stats.projectileSpeedMult;
    const critical = Math.random() < stats.critChance;
    const damage = PORTAL.sparkDamage * this.bonus.damage * stats.damageMult * (critical ? stats.critMult : 1);
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

/** Valores base del Unibeam de Iron Man (solo cambian con la tabla de niveles y las mejoras comunes). */
const UNIBEAM = { everyMs: 4200, durationMs: 650, tickMs: 130, length: 210, width: 14, damage: 7, aimRange: 200 } as const;

interface Beam {
  angle: number;
  until: number;
  nextTick: number;
  width: number;
  damage: number;
  length: number;
  critical: boolean;
  g: Phaser.GameObjects.Graphics;
}

/**
 * Iron Man: dispara un rayo desde el reactor del pecho hacia los enemigos más cercanos; el rayo dura un instante y
 * daña seguido a todo lo que cruza en línea recta. Usa daño, enfriamiento, duración, área, alcance, cantidad y crítico.
 */
export const UNIBEAM_LEVELS = ['+1 rayo', 'Dispara más seguido', 'El rayo dura más', '+40 % de daño y rayo más ancho'];
export class Unibeam extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { cooldown: 0.8 },
    4: { duration: 1.4 },
    5: { damage: 1.4, area: 1.3 },
  };
  private nextShot = 0;
  private readonly beams: Beam[] = [];

  update(now: number): void {
    const { owner, stats } = this.deps;
    const ox = owner.x;
    const oy = owner.y - 16;

    for (const beam of this.beams) this.tickBeam(beam, now, ox, oy);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (now >= this.beams[i].until) {
        this.beams[i].g.destroy();
        this.beams.splice(i, 1);
      }
    }

    if (this.level === 0 || now < this.nextShot) return;
    const b = this.bonus;
    const count = 1 + b.amount + stats.amountBonus;
    const range = UNIBEAM.aimRange * stats.rangeMult;
    const targets = activeEnemies(this.deps.enemies)
      .map((e) => ({ e, d: (e.x - ox) ** 2 + (e.y - oy) ** 2 }))
      .filter(({ d }) => d <= range * range)
      .sort((a, c) => a.d - c.d)
      .slice(0, count);
    if (targets.length === 0) return;
    this.nextShot = now + UNIBEAM.everyMs * b.cooldown * stats.cooldownMult;

    for (const { e } of targets) {
      const critical = Math.random() < stats.critChance;
      this.beams.push({
        angle: Math.atan2(e.y - 8 - oy, e.x - ox),
        until: now + UNIBEAM.durationMs * b.duration * stats.durationMult,
        nextTick: now,
        width: UNIBEAM.width * b.area * stats.areaMult,
        damage: UNIBEAM.damage * b.damage * stats.damageMult * (critical ? stats.critMult : 1),
        length: UNIBEAM.length * stats.rangeMult,
        critical,
        g: this.deps.scene.add.graphics().setDepth(999_996),
      });
    }
  }

  private tickBeam(beam: Beam, now: number, ox: number, oy: number): void {
    const x2 = ox + Math.cos(beam.angle) * beam.length;
    const y2 = oy + Math.sin(beam.angle) * beam.length;
    const life = Math.max(0, (beam.until - now) / (UNIBEAM.durationMs * this.bonus.duration * this.deps.stats.durationMult));
    beam.g.clear();
    beam.g.lineStyle(beam.width, beam.critical ? 0xffe272 : 0x37d5ff, 0.45 * (0.4 + life)).lineBetween(ox, oy, x2, y2);
    beam.g.lineStyle(Math.max(3, beam.width * 0.45), 0xffffff, 0.9).lineBetween(ox, oy, x2, y2);
    if (now < beam.nextTick) return;
    beam.nextTick = now + UNIBEAM.tickMs;

    const dx = x2 - ox;
    const dy = y2 - oy;
    const near = (px: number, py: number, extra: number): boolean => {
      const t = Phaser.Math.Clamp(((px - ox) * dx + (py - oy) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(px - (ox + dx * t), py - (oy + dy * t)) <= beam.width / 2 + extra;
    };
    for (const enemy of activeEnemies(this.deps.enemies)) if (near(enemy.x, enemy.y - 6, 6)) enemy.takeDamage(beam.damage);
    for (const prop of this.deps.props()) if (!prop.isBroken && near(prop.x, prop.y, 4)) prop.takeDamage(beam.damage);
  }
}

/** Qué arma secundaria exclusiva tiene cada héroe (por id de héroe). */
export const HERO_WEAPONS: Record<
  string,
  { upgradeId: string; name: string; text: string; levels: string[]; create: (deps: HeroWeaponDeps) => HeroWeapon }
> = {
  ironman: {
    upgradeId: 'unibeam',
    name: 'Unibeam',
    text: 'Un rayo del reactor del pecho que atraviesa en línea a los enemigos',
    levels: UNIBEAM_LEVELS,
    create: (deps) => new Unibeam(deps),
  },
  capitan: {
    upgradeId: 'orbit-shields',
    name: 'Escudos orbitales',
    text: 'Escudos que giran a tu alrededor y golpean a todos',
    levels: ORBIT_SHIELDS_LEVELS,
    create: (deps) => new OrbitShields(deps),
  },
  spiderman: {
    upgradeId: 'web-traps',
    name: 'Trampas de telaraña',
    text: 'Telarañas en el piso que frenan y lastiman',
    levels: WEB_TRAPS_LEVELS,
    create: (deps) => new WebTraps(deps),
  },
  thor: {
    upgradeId: 'thunder-storm',
    name: 'Tormenta',
    text: 'Una lluvia de rayos cae sobre los enemigos',
    levels: THUNDER_STORM_LEVELS,
    create: (deps) => new ThunderStorm(deps),
  },
  strange: {
    upgradeId: 'portals',
    name: 'Portales',
    text: 'Abre portales alrededor que disparan chispas',
    levels: PORTALS_LEVELS,
    create: (deps) => new Portals(deps),
  },
  hulk: {
    upgradeId: 'shockwave',
    name: 'Onda de choque',
    text: 'Golpe al piso: daña y empuja a todos alrededor',
    levels: SHOCKWAVE_LEVELS,
    create: (deps) => new Shockwave(deps),
  },
};
