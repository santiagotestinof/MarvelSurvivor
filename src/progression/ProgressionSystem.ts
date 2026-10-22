import { PROGRESSION } from '../config/gameplayConfig';

export interface ProgressState {
  level: number;
  xp: number;
  xpToNext: number;
}

/** Experiencia y nivel del jugador en la ronda actual. */
export class ProgressionSystem {
  level = 1;
  xp = 0;
  /** Subidas de nivel todavía sin elegir mejora. */
  pendingLevelUps = 0;

  get xpToNext(): number {
    return PROGRESSION.baseXp + PROGRESSION.xpPerLevel * (this.level - 1);
  }

  addXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.pendingLevelUps++;
    }
  }

  getState(): ProgressState {
    return { level: this.level, xp: this.xp, xpToNext: this.xpToNext };
  }
}
