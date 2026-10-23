import Phaser from 'phaser';
import { UI_FONT } from './uiLayout';

const ACCENT = 0x37d5ff;
const ACCENT_HOVER = 0x8defff;
const BASE = 0x0d1a2b;
const BASE_HOVER = 0x173250;
const DISABLED_FACE = 0x151d29;

/**
 * Botón plano de vidrio oscuro con borde celeste; el principal (`primary`) va relleno de celeste.
 * Se ilumina al pasar el mouse y se hunde un poco al apretarlo. Responde a mouse, toque y teclado (si se pasan `hotkeys`). Se dispara al soltar sobre el botón.
 */
export class UiButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private hovered = false;
  private pressed = false;
  private enabled = true;
  private fontPx = 20;

  constructor(scene: Phaser.Scene, text: string, size: number, onClick: () => void, hotkeys: string[] = [], private readonly primary = false) {
    super(scene, 0, 0);
    scene.add.existing(this);

    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, { fontFamily: UI_FONT, fontStyle: 'bold', color: '#e8f6ff' }).setOrigin(0.5);
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

  /** Cambia el texto del botón. */
  setLabel(text: string): this {
    this.label.setText(text);
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
    const padX = Math.round(this.fontPx * 1.4);
    const padY = Math.round(this.fontPx * 0.6);
    const w = Math.round(this.label.width + padX * 2);
    const h = Math.round(this.label.height + padY * 2);
    const r = Math.max(5, Math.round(h * 0.3));
    const sink = this.pressed ? Math.max(1, Math.round(this.fontPx * 0.08)) : 0;
    const left = -w / 2;
    const top = -h / 2 + sink;
    const line = Math.max(2, Math.round(this.fontPx * 0.1));
    const lit = this.hovered && this.enabled;

    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(left + 1, top + line + 2, w, h, r);
    if (lit) g.fillStyle(ACCENT, 0.18).fillRoundedRect(left - line * 1.5, top - line * 1.5, w + line * 3, h + line * 3, r + line);
    if (!this.enabled) {
      g.fillStyle(DISABLED_FACE, 1).fillRoundedRect(left, top, w, h, r);
      g.lineStyle(line, 0x4a5667, 0.7).strokeRoundedRect(left, top, w, h, r);
      this.label.setColor('#7d8a9a');
    } else if (this.primary) {
      g.fillStyle(lit ? ACCENT_HOVER : ACCENT, 1).fillRoundedRect(left, top, w, h, r);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(left + r * 0.5, top + line, w - r, h * 0.3, r * 0.6);
      this.label.setColor('#06202b');
    } else {
      g.fillStyle(lit ? BASE_HOVER : BASE, 0.96).fillRoundedRect(left, top, w, h, r);
      g.lineStyle(line, lit ? ACCENT_HOVER : ACCENT, lit ? 1 : 0.65).strokeRoundedRect(left, top, w, h, r);
      this.label.setColor('#e8f6ff');
    }

    this.label.setPosition(0, top + h / 2);
    this.setSize(w + 4, h + 6);
    if (this.input) (this.input.hitArea as Phaser.Geom.Rectangle).setSize(w + 4, h + 6);
  }
}
