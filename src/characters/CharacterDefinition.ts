/**
 * Acciones animables de un personaje. Hoy existen idle y walk; para sumar una acción nueva
 * (ataque, vuelo, daño, muerte, habilidad...) basta con agregar su nombre acá, dibujar su
 * spritesheet y declararla en `sheets` de la definición del personaje.
 */
export type CharacterAction = 'idle' | 'walk' | 'attack' | 'beam' | 'hurt' | 'death';
// Futuras: | 'attack' | 'fly' | 'hurt' | 'death' | 'ability'

/**
 * Un spritesheet por acción. Convención: UNA FILA POR DIRECCIÓN (orden de core/direction.ts)
 * y una columna por cuadro de animación.
 */
export interface ActionSheet {
  textureKey: string;
  /** Ruta relativa a /public. */
  path: string;
  frameCount: number;
  frameRate: number;
  loop: boolean;
}

/** Rarezas de los héroes (de más común a más rara). */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Cómo ataca el héroe:
 * - bolt: disparo recto (repulsor) · shield: escudo que rebota y vuelve · web: telaraña que frena
 * - hammer: onda de choque en línea larga que lanza el martillo de Thor sobre enemigos al azar de la pantalla · fan: abanico fino cuerpo a cuerpo (Hulk)
 * - aura: círculo de runas alrededor del héroe que daña seguido a todo lo que entra (Doctor Strange; `radius` es el radio)
 */
export type AttackKind = 'bolt' | 'shield' | 'web' | 'hammer' | 'fan' | 'aura';

/** Ataque automático básico: dispara al enemigo más cercano dentro de `aimRange`. */
export interface AttackDefinition {
  kind: AttackKind;
  /** (sin uso hoy) radio de daño en área (px). */
  radius?: number;
  /** fan: ángulo del abanico en grados (el alcance es `maxDistance`). */
  arcDegrees?: number;
  /** web: cuánto dura el frenado (ms) y qué fracción de su velocidad conserva el enemigo. */
  slowMs?: number;
  slowFactor?: number;
  cooldownMs: number;
  damage: number;
  projectileTexture: string;
  /** Píxeles por segundo. */
  projectileSpeed: number;
  /** Distancia máxima a la que elige objetivo. */
  aimRange: number;
  /** Distancia máxima que recorre el disparo. */
  maxDistance: number;
}

export interface CharacterDefinition {
  id: string;
  displayName: string;
  rarity: Rarity;
  /** Frase corta con lo que hace el arma, para el menú. */
  weaponText: string;
  /** Tamaño de cada cuadro. Debe ser igual en todas las acciones del personaje. */
  frame: { width: number; height: number };
  /** Punto de anclaje (0..1) dentro del cuadro: los pies. Igual para todas las animaciones. */
  origin: { x: number; y: number };
  /** Caja de colisión (solo los pies), en píxeles desde la esquina superior izquierda del cuadro. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  stats: { moveSpeed: number; maxHealth: number; attack: AttackDefinition };
  /** Bono propio del héroe sobre las estadísticas base (todos tienen las mismas, ver `HERO_BASE`). */
  statBonus?: { areaMult?: number; regenPerSecond?: number; moveSpeedMult?: number; maxHealthMult?: number };
  sheets: Record<'idle' | 'walk', ActionSheet> & Partial<Record<CharacterAction, ActionSheet>>;
}
