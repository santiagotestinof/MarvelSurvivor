import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { PanelButton } from './PanelButton';
import { TITLE_FONT, UI_FONT } from './uiLayout';

interface Slider {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  gfx: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Zone;
  get: () => number;
  set: (v: number) => void;
  /** Posición y ancho de la barra (se recalculan en `layout`). */
  x: number;
  y: number;
  w: number;
}

/**
 * Menú de sonido: dos barras para subir y bajar el volumen general y el de la música.
 * Se arrastran con el mouse o el dedo (o se toca un punto de la barra). Cerrar: LISTO o ESC.
 */
export class SoundPanel {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sliders: Slider[];
  private readonly closeButton: PanelButton;
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private dragging: Slider | null = null;
  private opened = false;

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly onClose: () => void = () => undefined, closeOnEsc = true) {
    // El fondo oscuro tapa y bloquea todo lo que hay debajo.
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x05080c, 0.78).setOrigin(0).setDepth(depth).setInteractive();
    this.panel = scene.add.graphics().setDepth(depth + 1);
    this.title = scene.add.text(0, 0, 'CONFIGURACIÓN', { fontFamily: TITLE_FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5).setDepth(depth + 2);
    this.title.setLetterSpacing(3);
    this.sliders = [
      this.makeSlider('SONIDO: GENERAL', () => audio.masterVolume, (v) => audio.setMasterVolume(v)),
      this.makeSlider('SONIDO: MÚSICA', () => audio.musicVolume, (v) => audio.setMusicVolume(v)),
    ];
    this.closeButton = new PanelButton(scene, 'LISTO', () => this.close(), { style: 'primary' }).setDepth(depth + 2);
    this.all.push(this.dim, this.panel, this.title, this.closeButton);

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    if (closeOnEsc) {
      scene.input.keyboard?.addKey('ESC').on('down', () => {
        if (this.opened) this.close();
      });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    });
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
    this.setVisible(true);
    this.redraw();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.dragging = null;
    this.setVisible(false);
    this.onClose();
  }

  layout(_ui: number, width: number, height: number): void {
    const portrait = width < height * 0.95;
    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    this.s = s;
    this.dim.setSize(width, height);
    const cx = width / 2;
    const panelW = Math.min(width * 0.94, (portrait ? 640 : 560) * s);
    const rowH = 84 * s;
    const panelH = 118 * s + rowH * this.sliders.length + 92 * s;
    const top = height / 2 - panelH / 2;
    this.panelRect = { x: cx - panelW / 2, y: top, w: panelW, h: panelH };
    this.title.setFontSize(Math.max(18, Math.round(34 * s))).setPosition(cx, top + 48 * s);
    this.sliders.forEach((sl, i) => {
      const y = top + 108 * s + i * rowH;
      const size = Math.max(10, Math.round(14 * s));
      sl.label.setFontSize(size).setPosition(cx - panelW / 2 + 32 * s, y).setLetterSpacing(1.5 * s);
      sl.value.setFontSize(size).setPosition(cx + panelW / 2 - 32 * s, y).setOrigin(1, 0);
      sl.x = cx - panelW / 2 + 32 * s;
      sl.w = panelW - 64 * s;
      sl.y = y + 42 * s;
      // Zona táctil generosa alrededor de la barra.
      sl.hit.setPosition(sl.x + sl.w / 2, sl.y).setSize(sl.w + 24 * s, 44 * s);
    });
    this.closeButton.setBox(Math.min(240 * s, panelW - 64 * s), 54 * s, 20 * s).setPosition(cx, top + panelH - 54 * s);
    this.redraw();
  }

  private s = 1;
  private panelRect = { x: 0, y: 0, w: 0, h: 0 };

  private makeSlider(text: string, get: () => number, set: (v: number) => void): Slider {
    const scene = this.scene;
    const label = scene.add.text(0, 0, text, { fontFamily: UI_FONT, fontStyle: 'bold', color: '#9db4d8' }).setDepth(this.depth + 2);
    const value = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#3dd9ff' }).setDepth(this.depth + 2);
    const gfx = scene.add.graphics().setDepth(this.depth + 2);
    const hit = scene.add.zone(0, 0, 10, 10).setDepth(this.depth + 3).setInteractive({ useHandCursor: true });
    const slider: Slider = { label, value, gfx, hit, get, set, x: 0, y: 0, w: 1 };
    hit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.dragging = slider;
      this.setFromPointer(slider, pointer);
    });
    this.all.push(label, value, gfx, hit);
    return slider;
  }

  private setFromPointer(slider: Slider, pointer: Phaser.Input.Pointer): void {
    const v = Phaser.Math.Clamp((pointer.x - slider.x) / slider.w, 0, 1);
    slider.set(Math.round(v * 20) / 20);
    this.redraw();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging && pointer.isDown) this.setFromPointer(this.dragging, pointer);
  }

  private onUp(): void {
    this.dragging = null;
  }

  private redraw(): void {
    if (!this.opened) return;
    const s = this.s;
    const { x, y, w, h } = this.panelRect;
    const g = this.panel;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y + 6 * s, w, h, 22 * s);
    g.fillStyle(0x0a1224, 0.96).fillRoundedRect(x, y, w, h, 22 * s);
    g.lineStyle(2, 0x37d5ff, 0.4).strokeRoundedRect(x, y, w, h, 22 * s);
    g.fillStyle(0x8cb4ff, 0.15).fillRect(x + 32 * s, y + 84 * s, w - 64 * s, 1);
    for (const sl of this.sliders) {
      const v = sl.get();
      const th = Math.max(6, Math.round(10 * s));
      sl.value.setText(`${Math.round(v * 100)}%`);
      sl.gfx.clear();
      sl.gfx.fillStyle(0xffffff, 0.1).fillRoundedRect(sl.x, sl.y - th / 2, sl.w, th, th / 2);
      sl.gfx.fillStyle(0x37d5ff, 1).fillRoundedRect(sl.x, sl.y - th / 2, Math.max(th, sl.w * v), th, th / 2);
      sl.gfx.fillStyle(0x2fb7ff, 0.25).fillCircle(sl.x + sl.w * v, sl.y, th * 1.9);
      sl.gfx.fillStyle(0xe8f6ff, 1).fillCircle(sl.x + sl.w * v, sl.y, th * 1.2);
      sl.gfx.lineStyle(2, 0x37d5ff, 1).strokeCircle(sl.x + sl.w * v, sl.y, th * 1.2);
    }
  }

  private setVisible(visible: boolean): void {
    for (const object of this.all) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    this.closeButton.setEnabled(visible);
    for (const s of this.sliders) {
      if (visible) s.hit.setInteractive();
      else s.hit.disableInteractive();
    }
    if (visible) this.dim.setInteractive();
    else this.dim.disableInteractive();
  }
}
