import Phaser from 'phaser';
import type { HudState } from '../systems/RoundController';
import { UiButton } from './UiButton';
import { formatTime, textStyle } from './uiLayout';

const DEPTH = 10;

/** Pantalla final de la ronda (victoria o derrota) con el botón para volver al menú. */
export class ResultOverlay {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly button: UiButton;
  private shown = false;

  constructor(scene: Phaser.Scene, onBackToMenu: () => void) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setOrigin(0).setDepth(DEPTH).setVisible(false);
    this.title = scene.add.text(0, 0, '', textStyle(40)).setOrigin(0.5).setDepth(DEPTH + 1).setVisible(false);
    this.stats = scene.add
      .text(0, 0, '', { ...textStyle(16), align: 'center' })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setVisible(false);
    this.button = new UiButton(scene, 'VOLVER AL MENÚ', 18, () => this.shown && onBackToMenu(), ['ENTER', 'SPACE'])
      .setDepth(DEPTH + 1)
      .setVisible(false)
      .setEnabled(false);
  }

  show(state: HudState): void {
    const won = state.phase === 'won';
    this.shown = true;
    this.title.setText(won ? '¡VICTORIA!' : 'DERROTA').setColor(won ? '#f5c518' : '#ff6b6b').setVisible(true);
    this.stats.setText(`Tiempo: ${formatTime(state.elapsedMs)}\nEnemigos derrotados: ${state.kills}`).setVisible(true);
    this.dim.setVisible(true);
    this.button.setVisible(true).setEnabled(true);
  }

  layout(ui: number, width: number, height: number): void {
    this.dim.setSize(width, height);
    this.title.setFontSize(Math.max(28, Math.round(12 * ui))).setPosition(width / 2, height * 0.34);
    this.stats.setFontSize(Math.max(14, Math.round(4 * ui))).setPosition(width / 2, height * 0.5);
    this.button.setFontSize(Math.max(16, Math.round(5 * ui))).setPosition(width / 2, height * 0.68);
  }
}
