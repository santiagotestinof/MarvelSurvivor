import Phaser from 'phaser';
import { UiButton } from './UiButton';
import { textStyle } from './uiLayout';

const DEPTH = 30;

/** Botón de pausa (esquina superior derecha, o tecla ESC) y pantalla de pausa con botón para seguir. */
export class PauseOverlay {
  private readonly pauseButton: UiButton;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly resumeButton: UiButton;
  private paused = false;

  constructor(scene: Phaser.Scene, onToggle: () => void) {
    this.pauseButton = new UiButton(scene, 'PAUSA [ESC]', 14, onToggle).setDepth(DEPTH + 5);
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x05080c, 0.7).setOrigin(0).setDepth(DEPTH).setVisible(false);
    this.title = scene.add.text(0, 0, 'PAUSA', textStyle(40)).setOrigin(0.5).setDepth(DEPTH + 1).setVisible(false);
    this.resumeButton = new UiButton(scene, 'SEGUIR [ESC]', 18, onToggle).setDepth(DEPTH + 1).setVisible(false).setEnabled(false);

    const keyboard = scene.input.keyboard;
    if (keyboard) keyboard.addKey('ESC').on('down', onToggle);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.dim.setVisible(paused);
    this.title.setVisible(paused);
    this.resumeButton.setVisible(paused).setEnabled(paused);
    this.pauseButton.setVisible(!paused);
  }

  /** El botón de pausa solo se ofrece mientras se juega (no en el menú de mejoras ni en el resultado). */
  setButtonAvailable(available: boolean): void {
    this.pauseButton.setVisible(available && !this.paused).setEnabled(available && !this.paused);
  }

  layout(ui: number, width: number, height: number, margin: number): void {
    this.dim.setSize(width, height);
    this.title.setFontSize(Math.max(28, Math.round(12 * ui))).setPosition(width / 2, height * 0.38);
    this.resumeButton.setFontSize(Math.max(16, Math.round(5 * ui))).setPosition(width / 2, height * 0.58);
    this.pauseButton.setFontSize(Math.max(11, Math.round(3.2 * ui)));
    // Debajo del contador de derrotados, en la esquina superior derecha.
    this.pauseButton.setPosition(width - margin - this.pauseButton.width / 2, margin + Math.max(12, Math.round(3.5 * ui)) + this.pauseButton.height / 2 + 10);
  }
}
