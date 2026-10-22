import Phaser from 'phaser';

/**
 * Joystick virtual flotante: aparece donde se toca la mitad izquierda de la pantalla
 * y entrega un vector de longitud 0..1. Pensado para pantallas táctiles.
 * Con `?joystick` en la URL también responde al mouse (para probarlo en PC).
 */
export class VirtualJoystick {
  readonly vector = new Phaser.Math.Vector2();
  disabled = false;

  private pointerId: number | null = null;
  private readonly origin = new Phaser.Math.Vector2();
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly allowMouse = new URLSearchParams(window.location.search).has('joystick');

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly radius: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(50);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    });
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.disabled || this.pointerId !== null) return;
    if (!pointer.wasTouch && !this.allowMouse) return;
    if (pointer.x > this.scene.scale.width / 2) return;

    this.pointerId = pointer.id;
    this.origin.set(pointer.x, pointer.y);
    this.track(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.pointerId) this.track(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.release();
  }

  /** Suelta el joystick (también al terminar la ronda). */
  release(): void {
    this.pointerId = null;
    this.vector.set(0, 0);
    this.graphics.clear();
  }

  private track(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.origin.x;
    const dy = pointer.y - this.origin.y;
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(length, this.radius);
    const nx = length > 0 ? dx / length : 0;
    const ny = length > 0 ? dy / length : 0;

    const deadZone = 0.15;
    const strength = clamped / this.radius;
    if (strength < deadZone) this.vector.set(0, 0);
    else this.vector.set(nx * strength, ny * strength);

    this.graphics.clear();
    this.graphics.fillStyle(0xffffff, 0.12);
    this.graphics.fillCircle(this.origin.x, this.origin.y, this.radius);
    this.graphics.lineStyle(2, 0xffffff, 0.45);
    this.graphics.strokeCircle(this.origin.x, this.origin.y, this.radius);
    this.graphics.fillStyle(0xf5c518, 0.8);
    this.graphics.fillCircle(this.origin.x + nx * clamped, this.origin.y + ny * clamped, this.radius * 0.38);
  }
}
