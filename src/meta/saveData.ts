import { ACHIEVEMENTS, LOCKED_PASSIVES, applyRound, emptyLifetimeStats, type LifetimeStats, type RoundSummary } from './achievements';
import { CHARACTER_REGISTRY, COMMON_HEROES, STARTER_ID } from '../characters/registry';

/**
 * Progreso permanente (oro y mejoras compradas), guardado en el navegador (localStorage).
 * Es por dispositivo: si se borran los datos del sitio, se pierde. Si el navegador no permite
 * guardar (modo privado, por ejemplo), el progreso vale solo mientras la página siga abierta.
 */
const STORAGE_KEY = 'marvel-survivors-save-v1';

interface SaveShape {
  gold: number;
  /** Nivel comprado de cada mejora permanente, por héroe y por id (cada héroe tiene su propio progreso). */
  heroUpgrades: Record<string, Record<string, number>>;
  /** Guardado viejo: mejoras comunes a todos los héroes. Se reembolsa en oro y queda vacío (ver `migrateLegacy`). */
  upgrades: Record<string, number>;
  /** Héroes comprados (la primera vez se regala uno común al azar). */
  unlocked: string[];
  /** Héroe elegido para jugar. */
  selected: string;
  /** Logros cumplidos. */
  achievements: string[];
  /** Totales para los logros. */
  stats: LifetimeStats;
  /** Easter egg: ya se encontró el libro escondido en el mapa (muestra las combinaciones de evolución). */
  book: boolean;
}

/** Progreso de alguien que entra por primera vez: sin oro y con un héroe común al azar de regalo. */
function emptySave(): SaveShape {
  const pool = COMMON_HEROES.length > 0 ? COMMON_HEROES : [STARTER_ID];
  const gift = pool[Math.floor(Math.random() * pool.length)];
  return { gold: 0, heroUpgrades: {}, upgrades: {}, unlocked: [gift], selected: gift, achievements: [], stats: emptyLifetimeStats(), book: false };
}

function sanitize(raw: unknown): SaveShape {
  if (typeof raw !== 'object' || raw === null) return emptySave();
  const save: SaveShape = { gold: 0, heroUpgrades: {}, upgrades: {}, unlocked: [], selected: '', achievements: [], stats: emptyLifetimeStats(), book: false };
  const { gold, upgrades, heroUpgrades, unlocked, selected, achievements, stats, book } = raw as Partial<SaveShape>;
  save.book = book === true;
  if (Array.isArray(achievements)) {
    for (const id of achievements) if (typeof id === 'string' && ACHIEVEMENTS.some((a) => a.id === id) && !save.achievements.includes(id)) save.achievements.push(id);
  }
  if (typeof stats === 'object' && stats !== null) {
    for (const key of Object.keys(save.stats) as (keyof LifetimeStats)[]) {
      const value = (stats as Partial<LifetimeStats>)[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) save.stats[key] = Math.floor(value);
    }
  }
  if (typeof gold === 'number' && Number.isFinite(gold) && gold > 0) save.gold = Math.floor(gold);
  if (typeof upgrades === 'object' && upgrades !== null) {
    for (const [id, level] of Object.entries(upgrades)) {
      if (typeof level === 'number' && Number.isFinite(level) && level > 0) save.upgrades[id] = Math.floor(level);
    }
  }
  if (typeof heroUpgrades === 'object' && heroUpgrades !== null) {
    for (const [hero, levels] of Object.entries(heroUpgrades)) {
      if (!(hero in CHARACTER_REGISTRY) || typeof levels !== 'object' || levels === null) continue;
      const clean: Record<string, number> = {};
      for (const [id, level] of Object.entries(levels)) {
        if (typeof level === 'number' && Number.isFinite(level) && level > 0) clean[id] = Math.floor(level);
      }
      save.heroUpgrades[hero] = clean;
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
  /** `?todos` también deja todos los logros como cumplidos (solo en esta carga, no se guarda). */
  private readonly allAchievements = new URLSearchParams(window.location.search).has('todos');

  private readonly forceBook = /[?&](todos|libro)(&|=|$)/.test(window.location.search);

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

  /** ¿Ya se encontró el libro secreto? (`?todos` o `?libro` lo dan por encontrado solo en esa carga.) */
  get hasBook(): boolean {
    return this.forceBook || this.data.book;
  }

  /** Guarda para siempre que se encontró el libro. */
  findBook(): void {
    if (this.data.book) return;
    this.data.book = true;
    this.persist();
  }

  get lifetime(): Readonly<LifetimeStats> {
    return this.data.stats;
  }

  isAchievementDone(id: string): boolean {
    return this.allAchievements || this.data.achievements.includes(id);
  }

  /** ¿Se puede ofrecer esta pasiva en la ronda? Algunas esperan a que se cumpla su logro. */
  isPassiveUnlocked(passiveId: string): boolean {
    if (!LOCKED_PASSIVES.has(passiveId)) return true;
    const achievement = ACHIEVEMENTS.find((a) => a.passiveId === passiveId);
    return !achievement || this.isAchievementDone(achievement.id);
  }

  /** Suma una ronda terminada a los totales y devuelve los logros que se cumplieron recién. */
  recordRound(round: RoundSummary): string[] {
    this.data.stats = applyRound(this.data.stats, round);
    const fresh: string[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (this.data.achievements.includes(achievement.id)) continue;
      if (achievement.value(this.data.stats) >= achievement.target) {
        this.data.achievements.push(achievement.id);
        fresh.push(achievement.id);
      }
    }
    this.persist();
    return fresh;
  }

  /** Nivel de una mejora permanente para un héroe (por defecto el elegido). */
  levelOf(id: string, hero: string = this.data.selected): number {
    return this.data.heroUpgrades[hero]?.[id] ?? 0;
  }

  /** Mejoras del guardado viejo (comunes a todos), para reembolsarlas. */
  get legacyUpgrades(): Readonly<Record<string, number>> {
    return this.data.upgrades;
  }

  /** Devuelve en oro las mejoras del guardado viejo y las borra: desde ahora cada héroe tiene las suyas. */
  migrateLegacy(refundGold: number): void {
    this.data.gold += Math.max(0, Math.floor(refundGold));
    this.data.upgrades = {};
    this.persist();
  }

  addGold(amount: number): void {
    if (amount <= 0) return;
    this.data.gold += Math.floor(amount);
    this.persist();
  }

  /** Gasta `cost` de oro y sube un nivel de la mejora. Devuelve false si no alcanza el oro. */
  purchase(id: string, cost: number, hero: string = this.data.selected): boolean {
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    (this.data.heroUpgrades[hero] ??= {})[id] = this.levelOf(id, hero) + 1;
    this.persist();
    return true;
  }

  /** Quita todas las mejoras compradas de un héroe (por defecto el elegido) y suma `gold` al oro (reembolso). */
  refund(gold: number, hero: string = this.data.selected): void {
    this.data.heroUpgrades[hero] = {};
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
