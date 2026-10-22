import Phaser from 'phaser';

/**
 * Convierte la intención de movimiento en velocidad física.
 * Velocidad constante en cualquier dirección: el vector se normaliza, así la diagonal no es más rápida.
 */
export class MovementSystem {
  private readonly velocity = new Phaser.Math.Vector2();

  constructor(private moveSpeed: number) {}

  setMoveSpeed(moveSpeed: number): void {
    this.moveSpeed = moveSpeed;
  }

  /** Aplica el movimiento al cuerpo físico. Devuelve true si el personaje se está moviendo. */
  apply(body: Phaser.Physics.Arcade.Body, intent: Phaser.Math.Vector2): boolean {
    if (intent.lengthSq() === 0) {
      body.setVelocity(0, 0);
      return false;
    }

    this.velocity.copy(intent);
    // Se limita a longitud 1 (no se amplía): un joystick analógico puede dar menos de 1.
    if (this.velocity.lengthSq() > 1) this.velocity.normalize();
    this.velocity.scale(this.moveSpeed);

    body.setVelocity(this.velocity.x, this.velocity.y);
    return true;
  }
}
