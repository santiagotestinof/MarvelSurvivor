import { CHARACTER_REGISTRY, COMMON_HEROES, STARTER_ID } from '../characters/registry';

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
  /** Héroes comprados (la primera vez se regala uno común al azar). */
  unlocked: string[];
  /** Héroe elegido para jugar. */
  selected: string;
}

/** Progreso de alguien que entra por primera vez: sin oro y con un héroe común al azar de regalo. */
function emptySave(): SaveShape {
  const pool = COMMON_HEROES.length > 0 ? COMMON_HEROES : [STARTER_ID];
  const gift = pool[Math.floor(Math.random() * pool.length)];
  return { gold: 0, upgrades: {}, unlocked: [gift], selected: gift };
}

function sanitize(raw: unknown): SaveShape {
  if (typeof raw !== 'object' || raw === null) return emptySave();
  const save: SaveShape = { gold: 0, upgrades: {}, unlocked: [], selected: '' };
  const { gold, upgrades, unlocked, selected } = raw as Partial<SaveShape>;
  if (typeof gold === 'number' && Number.isFinite(gold) && gold > 0) save.gold = Math.floor(gold);
  if (typeof upgrades === 'object' && upgrades !== null) {
    for (const [id, level] of Object.entries(upgrades)) {
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) save.upgrades[id] = Math.floor(level);
    }
  }
  if (Array.isArray(unlocked)) {
    for (const id of unlocked) if (typeof id === 'string' && id in CHARACTER_REGISTRY && !save.unlocked.includes(id)) save.unlocked.push(id);
  }
  // Un guardado sin ningún héroe (viejo o dañado) recibe el regalo de bienvenida, conservando el oro y las mejoras.
  if (save.unlocked.length === 0) save.unlocked = emptySave().unlocked;
  save.selected = typeof selected === 'string' && save.unlocked.includes(selected) ? selected : save.unlocked[0];
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

  constructor() {
    // Primera vez en este navegador: se guarda enseguida el héroe de regalo para que no cambie al recargar.
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === null) this.persist();
    } catch {
      // Sin almacenamiento: el regalo vale mientras la página siga abierta.
    }
  }

  get gold(): number {
    return this.data.gold;
  }

  get selectedCharacter(): string {
    return this.data.selected;
  }

  isUnlocked(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  select(id: string): void {
    if (!this.isUnlocked(id)) return;
    this.data.selected = id;
    this.persist();
  }

  /** Compra un héroe: gasta `price` de oro y lo desbloquea. Devuelve false si ya lo tenía o no alcanza el oro. */
  buyHero(id: string, price: number): boolean {
    if (this.isUnlocked(id) || !(id in CHARACTER_REGISTRY) || this.data.gold < price) return false;
    this.data.gold -= price;
    this.data.unlocked.push(id);
    this.persist();
    return true;
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
