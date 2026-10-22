import Phaser from 'phaser';
import { UI_FONT } from './uiLayout';

const FACE = 0xf5c518;
const FACE_HOVER = 0xffe272;
const EDGE = 0x8a6400;
const OUTLINE = 0x1a1205;

/**
 * Botón con relieve: cara dorada, borde oscuro y "profundidad" que se hunde al apretarlo.
 * Responde a mouse, toque y teclado (si se pasan `hotkeys`). Se dispara al soltar sobre el botón.
 */
export class UiButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private hovered = false;
  private pressed = false;
  private enabled = true;
  private fontPx = 20;

  constructor(scene: Phaser.Scene, text: string, size: number, onClick: () => void, hotkeys: string[] = []) {
    super(scene, 0, 0);
    scene.add.existing(this);

    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, { fontFamily: UI_FONT, fontStyle: 'bold', color: '#1a1205' }).setOrigin(0.5);
    this.add([this.bg, this.label]);

    this.on(Phaser.Input.Events.POINTER_OVER, () => this.setHover(true));
    this.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.pressed = false;
      this.setHover(false);
    });
    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressed = true;
      this.redraw();
    });
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      const wasPressed = this.pressed;
      this.pressed = false;
      this.redraw();
      if (wasPressed && this.enabled) onClick();
    });

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      for (const name of hotkeys) {
        keyboard.addKey(name).on('down', () => {
          if (this.enabled && this.visible) onClick();
        });
      }
    }

    this.setFontSize(size);
    this.setEnabled(true);
  }

  setFontSize(size: number): this {
    this.fontPx = Math.round(size);
    this.label.setFontSize(this.fontPx);
    this.redraw();
    return this;
  }

  /** Activa o desactiva el botón (mouse, toque y teclas). */
  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (enabled) this.setInteractive({ useHandCursor: true });
    else this.disableInteractive();
    if (!enabled) this.pressed = this.hovered = false;
    this.redraw();
    return this;
  }

  private setHover(hovered: boolean): void {
    this.hovered = hovered;
    this.redraw();
  }

  private redraw(): void {
    const padX = Math.round(this.fontPx * 1.3);
    const padY = Math.round(this.fontPx * 0.55);
    const w = Math.round(this.label.width + padX * 2);
    const h = Math.round(this.label.height + padY * 2);
    const depth = Math.max(3, Math.round(this.fontPx * 0.22));
    const r = Math.max(4, Math.round(this.fontPx * 0.35));
    const sink = this.pressed ? depth : 0;
    const left = -w / 2;
    const top = -h / 2 - depth / 2;

    const g = this.bg;
    g.clear();
    // Sombra y canto inferior (lo que da el relieve).
    g.fillStyle(0x000000, 0.35).fillRoundedRect(left + 2, top + depth + 4, w, h, r);
    g.fillStyle(OUTLINE, 1).fillRoundedRect(left - 2, top + sink - 2, w + 4, h + depth - sink + 4, r + 2);
    g.fillStyle(EDGE, 1).fillRoundedRect(left, top + sink, w, h + depth - sink, r);
    // Cara del botón con un brillo arriba.
    g.fillStyle(this.hovered ? FACE_HOVER : FACE, 1).fillRoundedRect(left, top + sink, w, h, r);
    g.fillStyle(0xffffff, this.hovered ? 0.35 : 0.25).fillRoundedRect(left + r * 0.6, top + sink + 3, w - r * 1.2, h * 0.28, r * 0.6);

    this.label.setPosition(0, top + sink + h / 2);
    this.setSize(w + 4, h + depth + 4);
    if (this.input) (this.input.hitArea as Phaser.Geom.Rectangle).setSize(w + 4, h + depth + 4);
  }
}
