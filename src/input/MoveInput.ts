import type Phaser from 'phaser';

/**
 * Fuente de movimiento del jugador. Teclado hoy; un joystick virtual táctil
 * puede implementar la misma interfaz mañana sin tocar el resto del juego.
 */
export interface MoveInput {
  /**
   * Vector de intención de movimiento en coordenadas de pantalla (x derecha, y abajo).
   * No hace falta que venga normalizado: MovementSystem se encarga.
   * Se reutiliza la misma instancia entre llamadas.
   */
  getVector(): Phaser.Math.Vector2;
}
