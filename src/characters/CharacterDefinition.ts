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

export interface CharacterDefinition {
  id: string;
  displayName: string;
  /** Tamaño de cada cuadro. Debe ser igual en todas las acciones del personaje. */
  frame: { width: number; height: number };
  /** Punto de anclaje (0..1) dentro del cuadro: los pies. Igual para todas las animaciones. */
  origin: { x: number; y: number };
  /** Caja de colisión (solo los pies), en píxeles desde la esquina superior izquierda del cuadro. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  stats: { moveSpeed: number };
  sheets: Record<'idle' | 'walk', ActionSheet> & Partial<Record<CharacterAction, ActionSheet>>;
}
