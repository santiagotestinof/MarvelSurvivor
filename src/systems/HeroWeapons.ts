import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import type { BreakableProp } from '../entities/BreakableProp';
import type { Character } from '../entities/Character';
import type { PlayerStats } from '../progression/PlayerStats';
import { activeEnemies, damageArea, drawThunder } from './areaDamage';
import { Projectile } from '../entities/Projectile';

/**
 * Arma secundaria exclusiva de un héroe: arranca bloqueada (nivel 0) y se desbloquea y sube de nivel
 * con una mejora que solo le sale a ese héroe (ver `HERO_WEAPONS` y `upgrades.ts`).
 */
export interface HeroWeapon {
  readonly level: number;
  readonly maxed: boolean;
  /** Unidades que tiene el arma ahora (escudos, trampas, rayos, portales, misiles), con Cantidad incluida. */
  readonly units: number;
  levelUp(): void;
  /** `now` y `delta` en ms, con el reloj de la ronda (no avanza en pausa). */
  update(now: number, delta: number): void;
}

export const HERO_WEAPON_MAX_LEVEL = 7;

export interface HeroWeaponDeps {
  scene: Phaser.Scene;
  owner: Character;
  enemies: Phaser.Physics.Arcade.Group;
  stats: PlayerStats;
  props: () => Iterable<BreakableProp>;
  /** Grupo de disparos del héroe y su textura (para armas que lanzan proyectiles, como la ráfaga de escudos). */
  projectiles: Phaser.Physics.Arcade.Group;
  projectileTexture: string;
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
  /** Las armas sin unidades (la onda de Hulk) no las cuentan. */
  get units(): number {
    return 0;
  }

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

/** Capitán América: cada tanto lanza escudos en todas las direcciones; atraviesan a todos los enemigos. */
export const SHIELD_STORM_LEVELS = ['+2 escudos', 'Lanza más seguido', '+2 escudos', 'Más daño y alcance', 'Lanza más seguido', '+2 escudos y más daño'];
export class ShieldStorm extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 2 },
    3: { cooldown: 0.85 },
    4: { amount: 2 },
    5: { damage: 1.4, area: 1.2 },
    6: { cooldown: 0.85 },
    7: { amount: 2, damage: 1.3 },
  };
  private nextThrow = 0;

  get units(): number {
    return this.level > 0 ? 4 + this.bonus.amount + this.deps.stats.amountBonus : 0;
  }

  update(now: number): void {
    if (this.level === 0 || now < this.nextThrow) return;
    const { scene, owner, enemies, stats, projectiles, projectileTexture } = this.deps;
    // Solo lanza si hay algo para golpear cerca.
    if (!activeEnemies(enemies).some((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 260 * 260)) return;

    const b = this.bonus;
    this.nextThrow = now + 5000 * b.cooldown * stats.cooldownMult;
    const count = this.units;
    const turn = Math.random() * Math.PI * 2;
    const damage = 12 * b.damage * stats.damageMult;
    const distance = 170 * b.area * stats.areaMult;
    for (let i = 0; i < count; i++) {
      const angle = turn + (i / count) * Math.PI * 2;
      const vx = Math.cos(angle) * 280;
      const vy = Math.sin(angle) * 280;
      const shield = new Projectile(scene, owner.x, owner.y - 14, projectileTexture, damage, distance, vx, vy, { pierce: 999 });
      shield.setScale(1.2);
      projectiles.add(shield);
      shield.setVelocity(vx, vy);
    }
  }
}

/** Spider-Man: deja telarañas en el piso que frenan y lastiman a los enemigos que las pisan. */
export const WEB_TRAPS_LEVELS = ['+1 telaraña', 'Telarañas más grandes', 'Duran más', '+1 telaraña y más daño', '+1 telaraña', 'Más daño y más área'];
export class WebTraps extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { area: 1.25 },
    4: { duration: 1.3 },
    5: { amount: 1, damage: 1.5 },
    6: { amount: 1 },
    7: { damage: 1.4, area: 1.2 },
  };
  private readonly webs: { g: Phaser.GameObjects.Graphics; x: number; y: number; radius: number; until: number; nextTick: number; damage: number }[] = [];
  private nextDrop = 0;

  get units(): number {
    return this.level > 0 ? 1 + this.bonus.amount + this.deps.stats.amountBonus : 0;
  }

  update(now: number): void {
    if (this.level === 0) return;
    const { scene, owner, enemies, stats, props } = this.deps;
    const b = this.bonus;

    if (now >= this.nextDrop) {
      this.nextDrop = now + 3000 * b.cooldown * stats.cooldownMult;
      const near = activeEnemies(enemies).filter((e) => (e.x - owner.x) ** 2 + (e.y - owner.y) ** 2 < 170 * 170);
      const amount = this.units;
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
      damage: 2.25 * b.damage * stats.damageMult,
    });
  }
}

/** Thor: rayos que caen sobre enemigos al azar de la pantalla (antes era su ataque principal). */
export const THUNDER_STORM_LEVELS = ['+1 rayo', 'Rayos más seguidos', '+1 rayo', 'Más daño y área', '+1 rayo', 'Más daño y rayos más seguidos'];
export class ThunderStorm extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { cooldown: 0.8 },
    4: { amount: 1 },
    5: { damage: 1.3, area: 1.25 },
    6: { amount: 1 },
    7: { damage: 1.3, cooldown: 0.85 },
  };
  private nextStorm = 0;

  get units(): number {
    return this.level > 0 ? 1 + this.bonus.amount + this.deps.stats.amountBonus : 0;
  }

  update(now: number): void {
    if (this.level === 0 || now < this.nextStorm) return;
    const { scene, enemies, stats, props } = this.deps;
    const b = this.bonus;

    const view = scene.cameras.main.worldView;
    const pool = activeEnemies(enemies).filter((e) => view.contains(e.x, e.y));
    if (pool.length === 0) return;
    this.nextStorm = now + 1800 * b.cooldown * stats.cooldownMult;
    Phaser.Utils.Array.Shuffle(pool);
    const bolts = this.units;
    const radius = 26 * b.area * stats.areaMult;
    const damage = 16 * b.damage * stats.damageMult;
    for (let i = 0; i < bolts; i++) {
      const target = pool[i % pool.length];
      const x = target.x;
      const y = target.y - 6;
      scene.time.delayedCall(i * 110, () => {
        damageArea(enemies, props(), x, y, radius, damage);
        drawThunder(scene, x, y, radius);
      });
    }
  }
}

/** Hulk: golpea el piso y una onda de choque daña y empuja a todos los que lo rodean. */
export const SHOCKWAVE_LEVELS = ['Onda más grande', 'Golpea más seguido', 'Más daño', 'Más área y más empuje', 'Golpea más seguido', 'Más daño y más área'];
export class Shockwave extends LeveledWeapon {
  protected readonly table = {
    2: { area: 1.2 },
    3: { cooldown: 0.8 },
    4: { damage: 1.35 },
    5: { area: 1.2, knockback: 1.3 },
    6: { cooldown: 0.85 },
    7: { damage: 1.3, area: 1.15 },
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
const PORTAL = { openEveryMs: 7000, shotEveryMs: 600, durationMs: 4500, sparkDamage: 8, sparkSpeed: 200 } as const;

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
export const PORTALS_LEVELS = ['+1 portal', 'Disparan más rápido', '+1 portal', 'Más daño', '+1 portal', 'Más daño y disparan más rápido'];
export class Portals extends LeveledWeapon {
  protected readonly table = {
    2: { amount: 1 },
    3: { cooldown: 0.78 },
    4: { amount: 1 },
    5: { damage: 1.4 },
    6: { amount: 1 },
    7: { damage: 1.3, cooldown: 0.85 },
  };
  private readonly portals: Portal[] = [];
  private readonly sparks: Spark[] = [];
  private nextOpen = 0;

  get units(): number {
    return this.level > 0 ? 1 + this.bonus.amount + this.deps.stats.amountBonus : 0;
  }

  update(now: number, delta: number): void {
    this.updateSparks(delta);
    if (this.level === 0) return;
    const { scene, owner, stats } = this.deps;

    if (now >= this.nextOpen) {
      // Cadencia = velocidad de las chispas; Duración = cuánto quedan abiertos. Cada cuánto se abre uno nuevo no depende de ninguna.
      this.nextOpen = now + PORTAL.openEveryMs;
      const amount = this.units;
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

/** Textos de los niveles 2 a 7 de los minimisiles de Iron Man (los bonos están en `MissileWeapon.ts`). */
export const MISSILES_LEVELS = ['+1 misil por ráfaga', '+25 % de daño', 'Más área: explosiones y alcance de la ráfaga +20 %', '+1 misil por ráfaga', '+30 % de daño', '+1 misil y +25 % de área'];

/** Qué arma secundaria exclusiva tiene cada héroe (por id de héroe). */
export const HERO_WEAPONS: Record<
  string,
  { upgradeId: string; name: string; text: string; levels: string[]; create: (deps: HeroWeaponDeps) => HeroWeapon | null }
> = {
  ironman: {
    upgradeId: 'missiles',
    name: 'Minimisiles',
    text: 'Misiles que cubren el área alrededor tuyo y explotan',
    levels: MISSILES_LEVELS,
    // Los minimisiles necesitan más dependencias: los crea `GameScene` (`MissileWeapon`).
    create: () => null,
  },
  capitan: {
    upgradeId: 'shield-storm',
    name: 'Ráfaga de escudos',
    text: 'Lanza escudos en todas las direcciones que atraviesan a los enemigos',
    levels: SHIELD_STORM_LEVELS,
    create: (deps) => new ShieldStorm(deps),
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
    name: 'Rayos',
    text: 'Rayos que caen sobre los enemigos de la pantalla',
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
