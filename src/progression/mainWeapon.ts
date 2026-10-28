import type { AttackKind } from '../characters/CharacterDefinition';
import type { PlayerStats } from './PlayerStats';
import { BASIC_ATTACK_LIMITS } from '../config/gameplayConfig';

/** Nivel máximo del arma principal (el nivel 1 es el que tiene el héroe al empezar). */
export const MAIN_WEAPON_MAX_LEVEL = 7;

/** Lo que suma un nivel del arma principal. Los valores de `mult` se multiplican; el resto se suma. */
interface MainBonus {
  text: string;
  count?: number;
  pierce?: number;
  speedMult?: number;
  areaMult?: number;
  fanAngleMult?: number;
  fanReachMult?: number;
}

export interface MainWeaponDefinition {
  name: string;
  /** Bonos de los niveles 2 a 7, en orden (el nivel 1 no suma nada). */
  levels: readonly MainBonus[];
}

const SHOT_SPEED = 1.25;
const AREA = 1.12;

/**
 * Niveles fijos del arma principal de cada héroe (ver `docs/REGLAS_DE_NEGOCIO.md`).
 * Cada nivel da un bono específico, sin sorteo.
 */
export const MAIN_WEAPONS: Record<AttackKind, MainWeaponDefinition> = {
  shield: {
    name: 'Escudo',
    levels: [
      { text: '+1 escudo por lanzamiento', count: 1 },
      { text: '+25% de velocidad del escudo', speedMult: SHOT_SPEED },
      { text: '+1 escudo por lanzamiento', count: 1 },
      { text: '+25% de velocidad del escudo', speedMult: SHOT_SPEED },
      { text: '+1 escudo por lanzamiento', count: 1 },
      { text: '+25% de velocidad del escudo', speedMult: SHOT_SPEED },
    ],
  },
  web: {
    name: 'Telarañas',
    levels: [
      { text: '+1 telaraña por disparo', count: 1 },
      { text: 'La telaraña atraviesa +1 enemigo', pierce: 1 },
      { text: '+25% de velocidad de las telarañas', speedMult: SHOT_SPEED },
      { text: '+1 telaraña por disparo', count: 1 },
      { text: 'La telaraña atraviesa +1 enemigo', pierce: 1 },
      { text: '+1 telaraña por disparo', count: 1 },
    ],
  },
  hammer: {
    name: 'Martillo sísmico',
    levels: [
      { text: '+1 onda por ataque', count: 1 },
      { text: 'Ondas más largas y anchas (+12%)', areaMult: AREA },
      { text: '+1 onda por ataque', count: 1 },
      { text: 'Ondas más largas y anchas (+12%)', areaMult: AREA },
      { text: '+1 onda por ataque', count: 1 },
      { text: 'Ondas más largas y anchas (+25%)', areaMult: AREA * AREA },
    ],
  },
  fan: {
    name: 'Zarpazo',
    levels: [
      { text: '+25% de ángulo del zarpazo', fanAngleMult: 1.25 },
      { text: '+20% de alcance del zarpazo', fanReachMult: 1.2 },
      { text: '+1 zarpazo en otra dirección', count: 1 },
      { text: '+25% de ángulo del zarpazo', fanAngleMult: 1.25 },
      { text: '+20% de alcance del zarpazo', fanReachMult: 1.2 },
      { text: '+1 zarpazo y +25% de ángulo', count: 1, fanAngleMult: 1.25 },
    ],
  },
  aura: {
    name: 'Aura de runas',
    levels: [
      { text: '+12% de radio del aura', areaMult: AREA },
      { text: '+12% de radio del aura', areaMult: AREA },
      { text: '+12% de radio del aura', areaMult: AREA },
      { text: '+12% de radio del aura', areaMult: AREA },
      { text: '+12% de radio del aura', areaMult: AREA },
      { text: '+25% de radio del aura', areaMult: AREA * AREA },
    ],
  },
  bolt: {
    name: 'Repulsor',
    levels: [
      { text: '+1 disparo en abanico', count: 1 },
      { text: 'El disparo atraviesa +1 enemigo', pierce: 1 },
      { text: '+1 disparo en abanico', count: 1 },
      { text: '+25% de velocidad de los disparos', speedMult: SHOT_SPEED },
      { text: '+1 disparo en abanico', count: 1 },
      { text: 'El disparo atraviesa +1 enemigo y +25% de velocidad', pierce: 1, speedMult: SHOT_SPEED },
    ],
  },
};

/** Texto del bono del nivel `level` (2 a 7). */
export function mainLevelText(kind: AttackKind, level: number): string {
  return MAIN_WEAPONS[kind].levels[level - 2].text;
}

/** Sube el arma principal un nivel y aplica el bono de ese nivel. */
export function levelUpMainWeapon(kind: AttackKind, stats: PlayerStats): void {
  if (stats.mainLevel >= MAIN_WEAPON_MAX_LEVEL) return;
  stats.mainLevel++;
  const bonus = MAIN_WEAPONS[kind].levels[stats.mainLevel - 2];
  stats.projectileCount += bonus.count ?? 0;
  stats.pierce = Math.min(BASIC_ATTACK_LIMITS.maxPierce, stats.pierce + (bonus.pierce ?? 0));
  stats.projectileSpeedMult *= bonus.speedMult ?? 1;
  stats.mainAreaMult *= bonus.areaMult ?? 1;
  stats.fanAngleMult *= bonus.fanAngleMult ?? 1;
  stats.fanReachMult *= bonus.fanReachMult ?? 1;
}
