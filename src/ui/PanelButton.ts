import Phaser from 'phaser';
import { TITLE_FONT, UI_FONT } from './uiLayout';

export type PanelButtonStyle = 'primary' | 'nav' | 'ghost' | 'gold';

interface PanelButtonOptions {
  hotkeys?: string[];
  style?: PanelButtonStyle;
  /** Texto chico a la derecha del botón (por ejemplo, "6"). */
  detail?: string;
  /** Alinea el texto a la izquierda (botones de navegación). */
  alignLeft?: boolean;
  /** Usa la tipografía de títulos (Impact/Anton). */
  display?: boolean;
}

const COLORS: Record<PanelButtonStyle, { fill: number; fillHover: number; border: number; borderAlpha: number; text: string }> = {
  primary: { fill: 0x2fb7ff, fillHover: 0x6fd2ff, border: 0x8defff, borderAlpha: 0, text: '#04121f' },
  nav: { fill: 0x0a1224, fillHover: 0x123055, border: 0x37d5ff, borderAlpha: 0.4, text: '#eef4ff' },
  ghost: { fill: 0x0a1224, fillHover: 0x123055, border: 0x8cb4ff, borderAlpha: 0.2, text: '#9db4d8' },
  gold: { fill: 0x2a2208, fillHover: 0x45360d, border: 0xffcf4a, borderAlpha: 0.65, text: '#ffcf4a' },
};

/** Botón de tamaño fijo para los menús nuevos (JUGAR, PERSONAJES, ELEGIR...). Mouse, toque y teclas. */
export class PanelButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text | null;
  private hovered = false;
  private enabled = true;
  private boxW = 100;
  private boxH = 40;
  private fill: number | null = null;
  private styleName: PanelButtonStyle;

  constructor(scene: Phaser.Scene, text: string, onClick: () => void, private readonly options: PanelButtonOptions = {}) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.styleName = options.style ?? 'nav';
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, { fontFamily: options.display ? TITLE_FONT : UI_FONT, fontStyle: options.display ? 'normal' : 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.detail = options.detail !== undefined ? scene.add.text(0, 0, options.detail, { fontFamily: UI_FONT, fontStyle: 'bold', color: '#7f97c0' }).setOrigin(1, 0.5) : null;
    this.add([this.bg, this.label, ...(this.detail ? [this.detail] : [])]);

    this.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hovered = true;
      this.redraw();
    });
    this.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hovered = false;
      this.redraw();
    });
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.enabled) onClick();
    });
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      for (const name of options.hotkeys ?? []) {
        keyboard.addKey(name).on('down', () => {
          if (this.enabled && this.visible) onClick();
        });
      }
    }
    this.setEnabled(true);
  }

  /** Tamaño del botón y de su letra. */
  setBox(w: number, h: number, fontPx: number): this {
    this.boxW = Math.round(w);
    this.boxH = Math.round(h);
    this.label.setFontSize(Math.max(10, Math.round(fontPx)));
    this.detail?.setFontSize(Math.max(9, Math.round(fontPx * 0.72)));
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  /** Cambia el relleno (por ejemplo, dorado para "jugando con este"). Sin valor vuelve al estilo base. */
  setFill(color: number | null): this {
    this.fill = color;
    this.redraw();
    return this;
  }

  setStyle(style: PanelButtonStyle): this {
    this.styleName = style;
    this.redraw();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (!enabled) this.disableInteractive();
    else if (this.input) this.input.enabled = true;
    if (!enabled) this.hovered = false;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const c = COLORS[this.styleName];
    const r = Math.max(6, Math.round(this.boxH * 0.22));
    const left = -this.boxW / 2;
    const top = -this.boxH / 2;
    const g = this.bg;
    g.clear();
    if (this.styleName === 'primary' && this.enabled) {
      g.fillStyle(0x2fb7ff, this.hovered ? 0.35 : 0.2).fillRoundedRect(left - 4, top - 2, this.boxW + 8, this.boxH + 12, r + 4);
    }
    g.fillStyle(0x000000, 0.35).fillRoundedRect(left, top + 4, this.boxW, this.boxH, r);
    if (!this.enabled) {
      g.fillStyle(0x121a28, 1).fillRoundedRect(left, top, this.boxW, this.boxH, r);
      g.lineStyle(2, 0x4a5667, 0.6).strokeRoundedRect(left, top, this.boxW, this.boxH, r);
      this.label.setColor('#7d8a9a');
    } else {
      const face = this.fill ?? (this.hovered ? c.fillHover : c.fill);
      g.fillStyle(face, 1).fillRoundedRect(left, top, this.boxW, this.boxH, r);
      if (this.styleName === 'primary' || this.fill !== null) g.fillStyle(0xffffff, 0.18).fillRoundedRect(left + r * 0.4, top + 2, this.boxW - r * 0.8, this.boxH * 0.3, r * 0.6);
      if (c.borderAlpha > 0) g.lineStyle(2, c.border, this.hovered ? 1 : c.borderAlpha).strokeRoundedRect(left, top, this.boxW, this.boxH, r);
      this.label.setColor(this.fill !== null ? '#2a1d00' : c.text);
    }
    const padX = Math.round(this.boxH * 0.4);
    if (this.options.alignLeft) {
      this.label.setOrigin(0, 0.5).setPosition(left + padX, 0);
    } else {
      this.label.setOrigin(0.5).setPosition(0, 0);
    }
    this.detail?.setPosition(left + this.boxW - padX, 0);
    this.setSize(this.boxW, this.boxH);
    if (!this.enabled) return;
    if (this.input?.hitArea) (this.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, this.boxW, this.boxH);
    else this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.boxW, this.boxH), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
  }
}
