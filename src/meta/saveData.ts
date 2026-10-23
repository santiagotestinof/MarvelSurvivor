/**
 * Progreso permanente (oro y mejoras compradas), guardado en el navegador (localStorage).
 * Es por dispositivo: si se borran los datos del sitio, se pierde. Si el navegador no permite
 * guardar (modo privado, por ejemplo), el progreso vale solo mientras la página siga abierta.
 */
const STORAGE_KEY = 'marvel-survivors-save-v1';

interface SaveShape {
  gold: number;
  /** Nivel comprado de cada mejora permanente, por id. */
  upgrades: Record<string, number>;
}

function emptySave(): SaveShape {
  return { gold: 0, upgrades: {} };
}

function sanitize(raw: unknown): SaveShape {
  const save = emptySave();
  if (typeof raw !== 'object' || raw === null) return save;
  const { gold, upgrades } = raw as Partial<SaveShape>;
  if (typeof gold === 'number' && Number.isFinite(gold) && gold > 0) save.gold = Math.floor(gold);
  if (typeof upgrades === 'object' && upgrades !== null) {
    for (const [id, level] of Object.entries(upgrades)) {
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) save.upgrades[id] = Math.floor(level);
    }
  }
  return save;
}

class SaveData {
  private data: SaveShape = this.load();

  get gold(): number {
    return this.data.gold;
  }

  levelOf(id: string): number {
    return this.data.upgrades[id] ?? 0;
  }

  addGold(amount: number): void {
    if (amount <= 0) return;
    this.data.gold += Math.floor(amount);
    this.persist();
  }

  /** Gasta `cost` de oro y sube un nivel de la mejora. Devuelve false si no alcanza el oro. */
  purchase(id: string, cost: number): boolean {
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    this.data.upgrades[id] = this.levelOf(id) + 1;
    this.persist();
    return true;
  }

  private load(): SaveShape {
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      return text ? sanitize(JSON.parse(text)) : emptySave();
    } catch {
      return emptySave();
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento disponible: el progreso queda solo en memoria.
    }
  }
}

export const saveData = new SaveData();
