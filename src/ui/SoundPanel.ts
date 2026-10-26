import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { UiButton } from './UiButton';
import { drawPanel, textStyle } from './uiLayout';

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
  private readonly closeButton: UiButton;
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private dragging: Slider | null = null;
  private ui = 2;
  private opened = false;

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly onClose: () => void = () => undefined, closeOnEsc = true) {
    // El fondo oscuro tapa y bloquea todo lo que hay debajo.
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x05080c, 0.78).setOrigin(0).setDepth(depth).setInteractive();
    this.panel = scene.add.graphics().setDepth(depth + 1);
    this.title = scene.add.text(0, 0, 'CONFIGURACIÓN', textStyle(24)).setOrigin(0.5).setDepth(depth + 2);
    this.sliders = [
      this.makeSlider('SONIDO: GENERAL', () => audio.masterVolume, (v) => audio.setMasterVolume(v)),
      this.makeSlider('SONIDO: MÚSICA', () => audio.musicVolume, (v) => audio.setMusicVolume(v)),
    ];
    this.closeButton = new UiButton(scene, 'LISTO', 18, () => this.close(), [], true).setDepth(depth + 2);
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

  layout(ui: number, width: number, height: number): void {
    this.ui = ui;
    this.dim.setSize(width, height);
    const cx = width / 2;
    const panelW = Math.min(width * 0.9, 150 * ui);
    const rowH = 14 * ui;
    const panelH = 12 * ui + rowH * this.sliders.length + this.closeButton.height + 8 * ui;
    const top = height / 2 - panelH / 2;
    this.panelRect = { x: cx - panelW / 2, y: top, w: panelW, h: panelH };
    this.title.setFontSize(Math.max(18, Math.round(6 * ui))).setPosition(cx, top + 6 * ui);
    this.sliders.forEach((s, i) => {
      const y = top + 14 * ui + i * rowH;
      s.label.setFontSize(Math.max(10, Math.round(3.2 * ui))).setPosition(cx - panelW / 2 + 6 * ui, y);
      s.value.setFontSize(Math.max(10, Math.round(3.2 * ui))).setPosition(cx + panelW / 2 - 6 * ui, y).setOrigin(1, 0);
      s.x = cx - panelW / 2 + 6 * ui;
      s.w = panelW - 12 * ui;
      s.y = y + 7 * ui;
      // Zona táctil generosa alrededor de la barra.
      s.hit.setPosition(s.x + s.w / 2, s.y).setSize(s.w + 4 * ui, 7 * ui);
    });
    this.closeButton.setFontSize(Math.max(14, Math.round(4.6 * ui))).setPosition(cx, top + panelH - this.closeButton.height / 2 - 4 * ui);
    this.redraw();
  }

  private panelRect = { x: 0, y: 0, w: 0, h: 0 };

  private makeSlider(text: string, get: () => number, set: (v: number) => void): Slider {
    const scene = this.scene;
    const label = scene.add.text(0, 0, text, textStyle(11)).setDepth(this.depth + 2);
    const value = scene.add.text(0, 0, '', textStyle(11, '#8defff')).setDepth(this.depth + 2);
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
    const ui = this.ui;
    this.panel.clear();
    drawPanel(this.panel, this.panelRect.x, this.panelRect.y, this.panelRect.w, this.panelRect.h, { radius: Math.round(3 * ui) });
    for (const s of this.sliders) {
      const v = s.get();
      const h = Math.max(4, Math.round(1.6 * ui));
      s.value.setText(`${Math.round(v * 100)}%`);
      s.gfx.clear();
      s.gfx.fillStyle(0x1b2a3d, 1).fillRoundedRect(s.x, s.y - h / 2, s.w, h, h / 2);
      s.gfx.fillStyle(0x37d5ff, 1).fillRoundedRect(s.x, s.y - h / 2, Math.max(h, s.w * v), h, h / 2);
      s.gfx.fillStyle(0xe8f6ff, 1).fillCircle(s.x + s.w * v, s.y, h * 1.2);
      s.gfx.lineStyle(2, 0x37d5ff, 1).strokeCircle(s.x + s.w * v, s.y, h * 1.2);
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
