/**
 * Acciones animables de un personaje. Hoy existen idle y walk; para sumar una acción nueva
 * (ataque, vuelo, daño, muerte, habilidad...) basta con agregar su nombre acá, dibujar su
 * spritesheet y declararla en `sheets` de la definición del personaje.
 */
export type CharacterAction = 'idle' | 'walk';
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

/** Ataque automático básico: dispara al enemigo más cercano dentro de `aimRange`. */
export interface AttackDefinition {
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
  /** Tamaño de cada cuadro. Debe ser igual en todas las acciones del personaje. */
  frame: { width: number; height: number };
  /** Punto de anclaje (0..1) dentro del cuadro: los pies. Igual para todas las animaciones. */
  origin: { x: number; y: number };
  /** Caja de colisión (solo los pies), en píxeles desde la esquina superior izquierda del cuadro. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  stats: { moveSpeed: number; maxHealth: number; attack: AttackDefinition };
  sheets: Record<'idle' | 'walk', ActionSheet> & Partial<Record<CharacterAction, ActionSheet>>;
}
