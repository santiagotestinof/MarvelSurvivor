/**
 * Logros: se cumplen jugando y cada uno desbloquea una mejora pasiva de la ronda.
 * Las pasivas de esta lista NO salen al subir de nivel hasta que se cumple su logro; las demás están desde el principio.
 * (Más adelante los logros también podrán desbloquear mapas nuevos.)
 */
export interface LifetimeStats {
  /** Enemigos derrotados en total. */
  kills: number;
  /** Oro juntado en total (el de las rondas, antes de repartir). */
  gold: number;
  wins: number;
  /** Mini jefes derrotados. */
  miniBosses: number;
  /** Nivel más alto alcanzado en una ronda. */
  bestLevel: number;
  /** Minutos más largos aguantados en una ronda. */
  bestMinutes: number;
}

export interface RoundSummary {
  kills: number;
  elapsedMs: number;
  level: number;
  gold: number;
  won: boolean;
  miniBossKilled: boolean;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Id de la mejora pasiva que desbloquea. */
  passiveId: string;
  target: number;
  value: (stats: LifetimeStats) => number;
  /** Cómo se muestra el progreso (por defecto, el número). */
  unit?: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'wall', name: 'Muro de acero', description: 'Aguantá 10 minutos en una ronda', passiveId: 'armor', target: 10, value: (s) => s.bestMinutes, unit: 'min' },
  { id: 'collector', name: 'Coleccionista', description: 'Juntá 300 de oro en total', passiveId: 'magnet', target: 300, value: (s) => s.gold },
  { id: 'master-blow', name: 'Golpe maestro', description: 'Derrotá a un mini jefe', passiveId: 'crit', target: 1, value: (s) => s.miniBosses },
  { id: 'lucky', name: 'Con suerte', description: 'Llegá al nivel 15 en una ronda', passiveId: 'luck', target: 15, value: (s) => s.bestLevel },
  { id: 'apprentice', name: 'Aprendiz', description: 'Ganá una ronda', passiveId: 'growth', target: 1, value: (s) => s.wins },
  { id: 'greedy', name: 'Codicia', description: 'Juntá 2000 de oro en total', passiveId: 'greed', target: 2000, value: (s) => s.gold },
  { id: 'brave', name: 'Valiente', description: 'Aguantá 14 minutos en una ronda', passiveId: 'curse', target: 14, value: (s) => s.bestMinutes, unit: 'min' },
];

/** Pasivas bloqueadas hasta cumplir su logro. */
export const LOCKED_PASSIVES: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.passiveId));

export function emptyLifetimeStats(): LifetimeStats {
  return { kills: 0, gold: 0, wins: 0, miniBosses: 0, bestLevel: 0, bestMinutes: 0 };
}

export function applyRound(stats: LifetimeStats, round: RoundSummary): LifetimeStats {
  return {
    kills: stats.kills + Math.max(0, round.kills),
    gold: stats.gold + Math.max(0, Math.floor(round.gold)),
    wins: stats.wins + (round.won ? 1 : 0),
    miniBosses: stats.miniBosses + (round.miniBossKilled ? 1 : 0),
    bestLevel: Math.max(stats.bestLevel, round.level),
    bestMinutes: Math.max(stats.bestMinutes, Math.floor(round.elapsedMs / 60_000)),
  };
}
