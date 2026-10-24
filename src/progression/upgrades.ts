import { BASIC_ATTACK_LIMITS, EVOLUTION, FIRE, PROGRESSION, UPGRADE_RARITY } from '../config/gameplayConfig';
import type { AttackKind } from '../characters/CharacterDefinition';
import type { Character } from '../entities/Character';
import type { Rarity } from '../characters/CharacterDefinition';
import { RARITY_ORDER } from '../characters/rarity';
import { HERO_WEAPONS, HERO_WEAPON_MAX_LEVEL, type HeroWeapon } from '../systems/HeroWeapons';
import type { FireUpgrade, MissileWeapon } from '../systems/MissileWeapon';
import type { PlayerStats } from './PlayerStats';

export interface UpgradeContext {
  stats: PlayerStats;
  player: Character;
  missiles: MissileWeapon;
  /** Cuántas veces se eligió cada mejora en esta ronda (por `id`). */
  taken: Readonly<Record<string, number>>;
  /** Cómo ataca el héroe: algunas mejoras del ataque básico no sirven para todos. */
  basicKind: AttackKind;
  /** Héroe elegido: algunas mejoras son exclusivas de uno. */
  heroId: string;
  /** Arma secundaria exclusiva del héroe (si tiene). */
  heroWeapon: HeroWeapon | null;
}

/** Tipo de tarjeta, como en Vampire Survivors: mejora de un arma o mejora pasiva. */
export function upgradeKind(upgrade: UpgradeDefinition): { label: string; color: number } {
  return upgrade.passive ? { label: 'PASIVA', color: 0x37b6ff } : { label: 'ARMA', color: 0xff6b4a };
}

/**
 * Una mejora que se puede elegir al subir de nivel. Para sumar otra: agregar una entrada a UPGRADES
 * y su ícono (mismo `id`) en `ui/upgradeIcons.ts`.
 */
export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  apply: (ctx: UpgradeContext) => void;
  /** Texto según el estado actual (reemplaza a `description` en la tarjeta). */
  describe?: (ctx: UpgradeContext) => string;
  /** Si devuelve false no se ofrece (por ejemplo, un arma al nivel máximo). */
  isAvailable?: (ctx: UpgradeContext) => boolean;
  /**
   * Mejora pasiva (no ligada a un arma): en una ronda solo se pueden tener `PROGRESSION.maxPassiveTypes`
   * tipos distintos; los que ya se tienen se pueden seguir mejorando.
   */
  passive?: boolean;
  /** Si está, la mejora solo le sale a esos héroes. */
  exclusiveTo?: readonly string[];
  /** Peso al sortear las 3 opciones (1 por defecto). Más alto = sale más seguido. */
  weight?: number;
  /** Valores por rareza: al ofrecerla se sortea la rareza y la tarjeta muestra y aplica el valor de esa rareza. */
  tiers?: RarityTiers;
  /** Rareza sorteada (solo en las copias que se ofrecen al jugador). */
  rarity?: Rarity;
}

/** Valores de una mejora según su rareza: [común, rara, épica, legendaria]. */
export interface RarityTiers {
  values: readonly [number, number, number, number];
  apply: (ctx: UpgradeContext, value: number) => void;
  text: (value: number, ctx: UpgradeContext) => string;
}

/** Mejora con rareza: sin sorteo (o en los datos base) vale como la legendaria. */
function tiered(def: Omit<UpgradeDefinition, 'apply' | 'description'> & { tiers: RarityTiers }): UpgradeDefinition {
  const top = def.tiers.values[3];
  return { ...def, description: def.tiers.text(top, {} as UpgradeContext), apply: (ctx) => def.tiers.apply(ctx, top) };
}

const num = (value: number): string => String(value).replace('.', ',');

/** Sortea la rareza; la Suerte vuelve más probables las raras. */
export function rollRarity(luck: number): Rarity {
  const { weights, luckBoost } = UPGRADE_RARITY;
  const w = [
    weights.common,
    weights.rare * (1 + luckBoost.rare * luck),
    weights.epic * (1 + luckBoost.epic * luck),
    weights.legendary * (1 + luckBoost.legendary * luck),
  ];
  let roll = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((roll -= w[i]) <= 0) return RARITY_ORDER[i];
  return 'common';
}

const IRON_MAN_ONLY = ['ironman'] as const;
const times = (ctx: UpgradeContext, id: string): number => ctx.taken[id] ?? 0;
const pct = (value: number): string => `${Math.round(value * 100)}%`;

/** Mejora de fuego: solo existe después de evolucionar los misiles. */
function fireUpgrade(kind: FireUpgrade, id: string, name: string, text: string): UpgradeDefinition {
  return {
    id,
    name,
    description: text,
    exclusiveTo: IRON_MAN_ONLY,
    describe: ({ missiles }) => `${text} (nv ${missiles.fireLevels[kind]} → ${missiles.fireLevels[kind] + 1})`,
    isAvailable: ({ missiles }) => missiles.evolved && missiles.fireLevels[kind] < FIRE.upgradeMaxLevel,
    apply: ({ missiles }) => missiles.upgradeFire(kind),
  };
}

/** Evolución del arma principal de cada héroe y la pasiva que hay que haber tomado `EVOLUTION.passivePicks` veces. */
const EVOLUTIONS = [
  { hero: 'ironman', id: 'missiles-evolution', name: 'Misiles incendiarios', requires: 'fire-rate', text: 'Las explosiones de los minimisiles dejan fuego que quema' },
  { hero: 'capitan', id: 'evolution-capitan', name: 'Escudo rebotador', requires: 'amount', text: 'El escudo se lanza a un enemigo y rebota entre ellos (5 rebotes)' },
  { hero: 'spiderman', id: 'evolution-spiderman', name: 'Telaraña inmovilizadora', requires: 'duration', text: 'Las telarañas inmovilizan unos segundos al enemigo que pegan' },
  { hero: 'thor', id: 'evolution-thor', name: 'Martillo sísmico', requires: 'range', text: 'Además de los rayos, el martillo lanza una onda que rompe el piso en una línea larga' },
  { hero: 'hulk', id: 'evolution-hulk', name: 'Furia circular', requires: 'damage', text: 'El zarpazo pasa a ser un círculo completo alrededor de Hulk' },
  { hero: 'strange', id: 'evolution-strange', name: 'Dimensión lenta', requires: 'area', text: 'El aura se vuelve enorme y ralentiza a los enemigos que entran' },
] as const;

export const UPGRADES: readonly UpgradeDefinition[] = [
  // ---- Stats generales
  tiered({
    id: 'damage',
    passive: true,
    name: 'Más daño',
    tiers: {
      values: [0.03, 0.07, 0.12, 0.2],
      apply: ({ stats }, v) => (stats.damageMult *= 1 + v),
      text: (v) => `+${pct(v)} de daño`,
    },
  }),
  tiered({
    id: 'fire-rate',
    passive: true,
    name: 'Cadencia',
    tiers: {
      values: [0.02, 0.05, 0.09, 0.15],
      apply: ({ stats }, v) => (stats.cooldownMult /= 1 + v),
      text: (v) => `+${pct(v)} de velocidad de disparo`,
    },
  }),
  tiered({
    id: 'duration',
    passive: true,
    name: 'Duración',
    tiers: {
      values: [0.02, 0.05, 0.09, 0.15],
      apply: ({ stats }, v) => (stats.durationMult *= 1 + v),
      text: (v) => `+${pct(v)} de duración de los efectos (portales, fuego, misiles)`,
    },
  }),
  {
    id: 'amount',
    passive: true,
    name: 'Cantidad',
    description: '+1 unidad en tu arma especial (portal, escudo, trampa, rayo, Unibeam)',
    describe: ({ stats }) => `+1 unidad en tu arma especial (portal, escudo, trampa, rayo, Unibeam) (${stats.amountBonus} → ${stats.amountBonus + 1})`,
    isAvailable: (ctx) => times(ctx, 'amount') < 3,
    apply: ({ stats }) => stats.amountBonus++,
  },
  tiered({
    id: 'area',
    passive: true,
    name: 'Área',
    tiers: {
      values: [0.02, 0.05, 0.09, 0.15],
      apply: ({ stats }, v) => (stats.areaMult *= 1 + v),
      text: (v) => `+${pct(v)} de área de las armas (aura, explosiones, rayos)`,
    },
  }),
  tiered({
    id: 'speed',
    passive: true,
    name: 'Velocidad',
    tiers: {
      values: [0.02, 0.04, 0.07, 0.1],
      apply: ({ player }, v) => player.setMoveSpeed(player.moveSpeed * (1 + v)),
      text: (v) => `+${pct(v)} de velocidad de movimiento`,
    },
  }),
  tiered({
    id: 'health',
    passive: true,
    name: 'Vida máxima',
    tiers: {
      values: [5, 10, 16, 25],
      apply: ({ player }, v) => player.addMaxHealth(v),
      text: (v) => `+${v} de vida máxima y cura ${v}`,
    },
  }),
  tiered({
    id: 'armor',
    passive: true,
    name: 'Armadura',
    tiers: {
      values: [0.5, 1, 1.5, 2],
      apply: ({ player }, v) => (player.armor += v),
      text: (v) => `Cada golpe hace ${num(v)} menos de daño (mínimo 1)`,
    },
  }),
  tiered({
    id: 'repair',
    name: 'Reparación',
    tiers: {
      values: [10, 20, 30, 40],
      apply: ({ player }, v) => player.heal(v),
      text: (v) => `Recupera ${v} de vida`,
    },
  }),
  tiered({
    id: 'magnet',
    passive: true,
    name: 'Imán',
    tiers: {
      values: [0.08, 0.16, 0.26, 0.4],
      apply: ({ stats }, v) => (stats.pickupRadius *= 1 + v),
      text: (v) => `+${pct(v)} de radio para juntar gemas`,
    },
  }),
  tiered({
    id: 'range',
    passive: true,
    name: 'Alcance',
    tiers: {
      values: [0.03, 0.07, 0.12, 0.2],
      apply: ({ stats }, v) => (stats.rangeMult *= 1 + v),
      text: (v) => `+${pct(v)} de alcance de disparo`,
    },
  }),
  tiered({
    id: 'luck',
    passive: true,
    name: 'Suerte',
    tiers: {
      values: [0.5, 1, 2, 3],
      apply: ({ stats }, v) => {
        stats.luck += v;
        stats.critChance += v * 0.02;
        stats.goldChanceMult += v * 0.1;
      },
      text: (v) => `+${v} de suerte: mejoras más raras, más crítico y más oro`,
    },
  }),
  tiered({
    id: 'growth',
    passive: true,
    name: 'Crecimiento',
    tiers: {
      values: [0.05, 0.1, 0.17, 0.25],
      apply: ({ stats }, v) => (stats.xpMult += v),
      text: (v) => `+${pct(v)} de experiencia`,
    },
  }),
  tiered({
    id: 'greed',
    passive: true,
    name: 'Codicia',
    tiers: {
      values: [0.1, 0.2, 0.35, 0.5],
      apply: ({ stats }, v) => (stats.goldMult += v),
      text: (v) => `+${pct(v)} de oro`,
    },
  }),
  tiered({
    id: 'curse',
    passive: true,
    name: 'Maldición',
    tiers: {
      values: [0.05, 0.1, 0.15, 0.25],
      apply: ({ stats }, v) => (stats.curseMult += v),
      text: (v) => `+${pct(v)} de velocidad, vida y cantidad de enemigos (más XP y oro)`,
    },
  }),

  // ---- Ataque básico (repulsor)
  {
    id: 'multishot',
    name: 'Disparo múltiple',
    description: '+1 disparo en abanico',
    describe: ({ stats, basicKind }) =>
      `${basicKind === 'fan' ? '+1 zarpazo en otra dirección' : basicKind === 'thunder' ? '+1 rayo por ataque' : basicKind === 'rocket' ? '+1 misil por ráfaga' : '+1 disparo en abanico'} (${stats.projectileCount} → ${stats.projectileCount + 1})`,
    isAvailable: ({ stats, basicKind }) =>
      basicKind !== 'aura' && !(basicKind === 'fan' && stats.evolved) && stats.projectileCount < BASIC_ATTACK_LIMITS.maxProjectiles,
    apply: ({ stats }) => stats.projectileCount++,
  },
  {
    id: 'pierce',
    name: 'Perforación',
    description: 'El disparo atraviesa +1 enemigo',
    describe: ({ stats }) => `El disparo atraviesa +1 enemigo (${stats.pierce} → ${stats.pierce + 1})`,
    isAvailable: ({ stats, basicKind, heroWeapon }) =>
      (basicKind === 'bolt' || basicKind === 'web' || (basicKind === 'aura' && (heroWeapon?.level ?? 0) > 0)) &&
      stats.pierce < BASIC_ATTACK_LIMITS.maxPierce,
    apply: ({ stats }) => stats.pierce++,
  },
  {
    id: 'shot-speed',
    name: 'Velocidad del disparo',
    description: '+25% de velocidad de los disparos',
    isAvailable: (ctx) =>
      (ctx.basicKind === 'bolt' ||
        ctx.basicKind === 'rocket' ||
        ctx.basicKind === 'web' ||
        ctx.basicKind === 'shield' ||
        (ctx.basicKind === 'aura' && (ctx.heroWeapon?.level ?? 0) > 0)) &&
      times(ctx, 'shot-speed') < BASIC_ATTACK_LIMITS.maxSpeedUpgrades,
    apply: ({ stats }) => (stats.projectileSpeedMult *= 1.25),
  },
  tiered({
    id: 'crit',
    name: 'Crítico',
    isAvailable: ({ stats }) => stats.critChance < BASIC_ATTACK_LIMITS.maxCritChance - 1e-6,
    tiers: {
      values: [0.02, 0.04, 0.07, 0.1],
      apply: ({ stats }, v) => (stats.critChance = Math.min(BASIC_ATTACK_LIMITS.maxCritChance, stats.critChance + v)),
      text: (v, { stats }) => (stats ? `+${pct(v)} de probabilidad de doble daño (${pct(stats.critChance)} → ${pct(stats.critChance + v)})` : `+${pct(v)} de probabilidad de doble daño`),
    },
  }),

  // ---- Evoluciones del arma principal: una por héroe, piden tomar varias veces una pasiva relacionada
  ...EVOLUTIONS.map(
    (evo): UpgradeDefinition => ({
      id: evo.id,
      name: evo.name,
      description: evo.text,
      describe: () => `EVOLUCIÓN: ${evo.text}`,
      exclusiveTo: [evo.hero],
      isAvailable: (ctx) => !ctx.stats.evolved && times(ctx, evo.requires) >= EVOLUTION.passivePicks,
      apply: (ctx) => {
        ctx.stats.evolved = true;
        if (evo.hero === 'ironman') ctx.missiles.evolve();
      },
      // Es la recompensa de juntar el requisito: que no tarde en salir.
      weight: 4,
    }),
  ),
  {
    id: 'shield-bounces',
    name: 'Más rebotes',
    description: '+1 rebote del escudo',
    exclusiveTo: ['capitan'],
    describe: ({ stats }) => {
      const now = EVOLUTION.shieldBounces + stats.bounceBonus;
      return `+1 rebote del escudo (${now} → ${now + 1})`;
    },
    isAvailable: ({ stats }) => stats.evolved && stats.bounceBonus < EVOLUTION.shieldMaxExtra,
    apply: ({ stats }) => stats.bounceBonus++,
  },
  fireUpgrade('duration', 'burn-duration', 'Fuego duradero', '+30% de duración del fuego'),
  fireUpgrade('damage', 'burn-damage', 'Fuego intenso', '+30% de daño del fuego'),
  fireUpgrade('rate', 'burn-rate', 'Fuego voraz', 'Quema 18% más seguido'),
  fireUpgrade('size', 'burn-size', 'Fuego expansivo', '+20% de tamaño del área'),

  // ---- Armas exclusivas de cada héroe (solo le salen a ese héroe)
  ...Object.entries(HERO_WEAPONS).map(
    ([heroId, weapon]): UpgradeDefinition => ({
      id: weapon.upgradeId,
      name: weapon.name,
      description: weapon.text,
      exclusiveTo: [heroId],
      describe: ({ heroWeapon }) => {
        const level = heroWeapon?.level ?? 0;
        return level === 0 ? `ARMA NUEVA: ${weapon.text}` : `${weapon.levels[level - 1]} (nv ${level} → ${level + 1})`;
      },
      isAvailable: ({ heroWeapon }) => !!heroWeapon && !heroWeapon.maxed,
      apply: ({ heroWeapon }) => heroWeapon?.levelUp(),
    }),
  ),

  // ---- Zarpazo de Hulk (abanico)
  {
    id: 'fan-width',
    name: 'Abanico ancho',
    description: '+25% de ángulo del zarpazo',
    exclusiveTo: ['hulk'],
    describe: (ctx) => `+25% de ángulo del zarpazo (nv ${times(ctx, 'fan-width')} → ${times(ctx, 'fan-width') + 1})`,
    isAvailable: (ctx) => !ctx.stats.evolved && times(ctx, 'fan-width') < HERO_WEAPON_MAX_LEVEL,
    apply: ({ stats }) => (stats.fanAngleMult *= 1.25),
  },
  {
    id: 'fan-reach',
    name: 'Brazos largos',
    description: '+20% de alcance del zarpazo',
    exclusiveTo: ['hulk'],
    describe: (ctx) => `+20% de alcance del zarpazo (nv ${times(ctx, 'fan-reach')} → ${times(ctx, 'fan-reach') + 1})`,
    isAvailable: (ctx) => times(ctx, 'fan-reach') < HERO_WEAPON_MAX_LEVEL,
    apply: ({ stats }) => (stats.fanReachMult *= 1.2),
  },
];


/** Tipos distintos de mejoras pasivas que ya se tomaron en la ronda. */
export function passiveTypesTaken(taken: Readonly<Record<string, number>>): number {
  return UPGRADES.filter((upgrade) => upgrade.passive && (taken[upgrade.id] ?? 0) > 0).length;
}

/** Las mejoras pasivas tomadas en la ronda y cuántas veces se eligió cada una (en orden de aparición en `UPGRADES`). */
export function passivesTaken(taken: Readonly<Record<string, number>>): { id: string; count: number }[] {
  return UPGRADES.filter((upgrade) => upgrade.passive && (taken[upgrade.id] ?? 0) > 0).map((upgrade) => ({
    id: upgrade.id,
    count: taken[upgrade.id],
  }));
}

/** ¿Hay lugar para esta mejora? Las pasivas nuevas se bloquean al llegar al límite de tipos. */
function hasSlot(upgrade: UpgradeDefinition, taken: Readonly<Record<string, number>>): boolean {
  if (!upgrade.passive || (taken[upgrade.id] ?? 0) > 0) return true;
  return passiveTypesTaken(taken) < PROGRESSION.maxPassiveTypes;
}

/** Elige `count` mejoras distintas al azar (según su peso) entre las disponibles, con el texto según el estado. */
export function pickUpgradeChoices(
  count: number,
  ctx: UpgradeContext,
  banished: ReadonlySet<string> = new Set(),
): UpgradeDefinition[] {
  const pool = UPGRADES.filter(
    (upgrade) =>
      !banished.has(upgrade.id) &&
      (!upgrade.exclusiveTo || upgrade.exclusiveTo.includes(ctx.heroId)) &&
      hasSlot(upgrade, ctx.taken) &&
      (upgrade.isAvailable?.(ctx) ?? true),
  );
  const picked: UpgradeDefinition[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, upgrade) => sum + (upgrade.weight ?? 1), 0);
    let roll = Math.random() * total;
    let index = pool.findIndex((upgrade) => (roll -= upgrade.weight ?? 1) <= 0);
    if (index < 0) index = pool.length - 1;
    const upgrade = pool.splice(index, 1)[0];
    if (upgrade.tiers) {
      const rarity = rollRarity(ctx.stats.luck);
      const value = upgrade.tiers.values[RARITY_ORDER.indexOf(rarity)];
      const tiers = upgrade.tiers;
      picked.push({ ...upgrade, rarity, description: tiers.text(value, ctx), apply: (c) => tiers.apply(c, value) });
    } else {
      picked.push(upgrade.describe ? { ...upgrade, description: upgrade.describe(ctx) } : upgrade);
    }
  }
  return picked;
}
