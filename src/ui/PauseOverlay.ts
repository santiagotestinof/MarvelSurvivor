import Phaser from 'phaser';
import { PanelButton } from './PanelButton';
import { SoundPanel } from './SoundPanel';
import { TITLE_FONT } from './uiLayout';

const DEPTH = 30;

/** Botón de pausa (esquina superior derecha, o tecla ESC) y pantalla de pausa con botones para seguir, configurar o abandonar la ronda. */
export class PauseOverlay {
  private readonly pauseButton: PanelButton;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly card: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly resumeButton: PanelButton;
  private readonly menuButton: PanelButton;
  private readonly soundButton: PanelButton;
  private readonly soundPanel: SoundPanel;
  private paused = false;

  constructor(scene: Phaser.Scene, onToggle: () => void, onMenu: () => void) {
    this.pauseButton = new PanelButton(scene, 'PAUSA [ESC]', onToggle, { style: 'ghost' }).setDepth(DEPTH + 5);
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x040812, 0.78).setOrigin(0).setDepth(DEPTH).setVisible(false);
    this.card = scene.add.graphics().setDepth(DEPTH + 1).setVisible(false);
    this.title = scene.add.text(0, 0, 'PAUSA', { fontFamily: TITLE_FONT, color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH + 2).setVisible(false);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.hint = scene.add.text(0, 0, 'ESC para seguir jugando', { fontFamily: 'Montserrat, sans-serif', color: '#9db4d8' }).setOrigin(0.5).setDepth(DEPTH + 2).setVisible(false);
    this.resumeButton = new PanelButton(scene, 'SEGUIR', onToggle, { style: 'primary', display: true }).setDepth(DEPTH + 2).setVisible(false).setEnabled(false);
    this.soundButton = new PanelButton(scene, 'CONFIGURACIÓN', () => this.soundPanel.open()).setDepth(DEPTH + 2).setVisible(false).setEnabled(false);
    this.menuButton = new PanelButton(scene, 'ABANDONAR RONDA', onMenu, { style: 'ghost' }).setDepth(DEPTH + 2).setVisible(false).setEnabled(false);
    this.soundPanel = new SoundPanel(scene, DEPTH + 10, () => undefined, false);

    const keyboard = scene.input.keyboard;
    // Con el menú de sonido abierto, ESC lo cierra en vez de seguir la partida.
    if (keyboard) keyboard.addKey('ESC').on('down', () => (this.soundPanel.isOpen ? this.soundPanel.close() : onToggle()));
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.dim.setVisible(paused);
    this.card.setVisible(paused);
    this.title.setVisible(paused);
    this.hint.setVisible(paused);
    this.resumeButton.setVisible(paused).setEnabled(paused);
    this.menuButton.setVisible(paused).setEnabled(paused);
    this.soundButton.setVisible(paused).setEnabled(paused);
    if (!paused) this.soundPanel.close();
    this.pauseButton.setVisible(!paused);
  }

  /** El botón de pausa solo se ofrece mientras se juega (no en el menú de mejoras ni en el resultado). */
  setButtonAvailable(available: boolean): void {
    this.pauseButton.setVisible(available && !this.paused).setEnabled(available && !this.paused);
  }

  layout(ui: number, width: number, height: number, margin: number): void {
    // Todo se escala desde un diseño de 1280×720 (apaisado) o 720×1280 (vertical).
    const portrait = width < height * 0.95;
    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    this.dim.setSize(width, height);

    const cardW = (portrait ? 560 : 440) * s;
    const cardH = 470 * s;
    const cx = width / 2;
    const cy = height / 2;
    const left = cx - cardW / 2;
    const top = cy - cardH / 2;
    this.card.clear();
    this.card.fillStyle(0x000000, 0.4).fillRoundedRect(left, top + 8 * s, cardW, cardH, 24 * s);
    this.card.fillStyle(0x0a1224, 0.96).fillRoundedRect(left, top, cardW, cardH, 24 * s);
    this.card.fillStyle(0x2fb7ff, 0.1).fillRoundedRect(left, top, cardW, 120 * s, { tl: 24 * s, tr: 24 * s, bl: 0, br: 0 });
    this.card.lineStyle(2, 0x8cb4ff, 0.3).strokeRoundedRect(left, top, cardW, cardH, 24 * s);

    this.title.setFontSize(Math.max(28, Math.round(64 * s))).setLetterSpacing(4 * s).setPosition(cx, top + 66 * s);
    this.hint.setFontSize(Math.max(10, Math.round(13 * s))).setPosition(cx, top + 118 * s);
    const w = cardW - 72 * s;
    this.resumeButton.setBox(w, 76 * s, 36 * s).setPosition(cx, top + 196 * s);
    this.soundButton.setBox(w, 56 * s, 16 * s).setPosition(cx, top + 292 * s);
    this.menuButton.setBox(w, 52 * s, 14 * s).setPosition(cx, top + 372 * s);
    this.soundPanel.layout(ui, width, height);
    this.pauseButton.setBox(Math.max(110, 140 * s), Math.max(30, 40 * s), Math.max(11, 13 * s));
    // Debajo del contador de derrotados, en la esquina superior derecha.
    this.pauseButton.setPosition(width - margin - this.pauseButton.width / 2, margin + Math.max(12, Math.round(3.5 * ui)) + this.pauseButton.height / 2 + 10);
  }
}
