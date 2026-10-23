import { CHARACTER_REGISTRY, STARTER_ID } from '../characters/registry';

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
  /** Héroes desbloqueados (el inicial siempre). */
  unlocked: string[];
  /** Héroe elegido para jugar. */
  selected: string;
  /** Tiradas seguidas del gacha sin sacar un héroe épico o mejor (para la garantía). */
  pity: number;
}

function emptySave(): SaveShape {
  return { gold: 0, upgrades: {}, unlocked: [STARTER_ID], selected: STARTER_ID, pity: 0 };
}

function sanitize(raw: unknown): SaveShape {
  const save = emptySave();
  if (typeof raw !== 'object' || raw === null) return save;
  const { gold, upgrades, unlocked, selected, pity } = raw as Partial<SaveShape>;
  if (typeof gold === 'number' && Number.isFinite(gold) && gold > 0) save.gold = Math.floor(gold);
  if (typeof upgrades === 'object' && upgrades !== null) {
    for (const [id, level] of Object.entries(upgrades)) {
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) save.upgrades[id] = Math.floor(level);
    }
  }
  if (Array.isArray(unlocked)) {
    for (const id of unlocked) if (typeof id === 'string' && id in CHARACTER_REGISTRY && !save.unlocked.includes(id)) save.unlocked.push(id);
  }
  if (typeof selected === 'string' && save.unlocked.includes(selected)) save.selected = selected;
  if (typeof pity === 'number' && Number.isFinite(pity) && pity > 0) save.pity = Math.floor(pity);
  return save;
}

/** Atajos para probar: `?todos` desbloquea todos los héroes y `?oro=5000` suma oro (se guardan junto con el progreso). */
function applyTestParams(data: SaveShape): SaveShape {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('todos')) for (const id of Object.keys(CHARACTER_REGISTRY)) if (!data.unlocked.includes(id)) data.unlocked.push(id);
    const gold = Number(params.get('oro'));
    if (Number.isFinite(gold) && gold > 0) data.gold += Math.floor(gold);
  } catch {
    // Sin ventana o sin parámetros: se usa el progreso tal cual.
  }
  return data;
}

class SaveData {
  private data: SaveShape = this.load();

  get gold(): number {
    return this.data.gold;
  }

  get selectedCharacter(): string {
    return this.data.selected;
  }

  get pity(): number {
    return this.data.pity;
  }

  isUnlocked(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  select(id: string): void {
    if (!this.isUnlocked(id)) return;
    this.data.selected = id;
    this.persist();
  }

  /** Gasta oro sin comprar una mejora (por ejemplo, una tirada del gacha). Devuelve false si no alcanza. */
  spend(amount: number): boolean {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.persist();
    return true;
  }

  /** Desbloquea un héroe. Devuelve false si ya lo tenía. */
  unlock(id: string): boolean {
    if (this.isUnlocked(id)) return false;
    this.data.unlocked.push(id);
    this.persist();
    return true;
  }

  setPity(value: number): void {
    this.data.pity = Math.max(0, Math.floor(value));
    this.persist();
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

  /** Quita todas las mejoras compradas y suma `gold` al oro (reembolso). */
  refund(gold: number): void {
    this.data.upgrades = {};
    this.data.gold += Math.max(0, Math.floor(gold));
    this.persist();
  }

  private load(): SaveShape {
    let data: SaveShape;
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      data = text ? sanitize(JSON.parse(text)) : emptySave();
    } catch {
      data = emptySave();
    }
    return applyTestParams(data);
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
