import Phaser from 'phaser';
import type { UpgradeDefinition } from '../progression/upgrades';
import { UpgradeCard } from './UpgradeCard';
import { textStyle } from './uiLayout';

const DEPTH = 20;
/** Tiempo durante el cual se ignoran toques, para no elegir sin querer al aparecer el menú. */
const INPUT_DELAY_MS = 350;
const CARD_KEYS = ['ONE', 'TWO', 'THREE'];

/** Menú de subida de nivel: título y tarjetas con las mejoras para elegir (click, toque o teclas 1/2/3). */
export class UpgradeMenu {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private cards: UpgradeCard[] = [];
  private choices: UpgradeDefinition[] = [];
  private onPick: ((choice: UpgradeDefinition) => void) | null = null;
  private openedAt = 0;
  private ui = 2;

  constructor(private readonly scene: Phaser.Scene) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x05080c, 0.78).setOrigin(0).setDepth(DEPTH);
    this.title = scene.add.text(0, 0, '', textStyle(32, '#f5c518')).setOrigin(0.5).setDepth(DEPTH + 1);
    this.title.setShadow(0, 4, '#7a1d12', 0, true, true);
    this.subtitle = scene.add.text(0, 0, 'Elegí una mejora', textStyle(16, '#d7e6ef')).setOrigin(0.5).setDepth(DEPTH + 1);
    const touch = scene.sys.game.device.input.touch;
    this.hint = scene.add
      .text(0, 0, touch ? 'Tocá una tarjeta' : 'Click o teclas 1 · 2 · 3', textStyle(12, '#9fb3bf'))
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    this.setVisible(false);

    const keyboard = scene.input.keyboard;
    if (keyboard) CARD_KEYS.forEach((name, index) => keyboard.addKey(name).on('down', () => this.pick(index)));
  }

  show(level: number, choices: UpgradeDefinition[], onPick: (choice: UpgradeDefinition) => void): void {
    this.choices = choices;
    this.onPick = onPick;
    this.openedAt = this.scene.time.now;
    this.title.setText(`¡NIVEL ${level}!`);
    this.setVisible(true);

    this.destroyCards();
    this.cards = choices.map((choice, index) =>
      new UpgradeCard(this.scene, choice, index, () => this.pick(index)).setDepth(DEPTH + 1),
    );
    this.layout(this.ui);
    this.playEntrance();
  }

  layout(ui: number): void {
    this.ui = ui;
    const { width, height } = this.scene.scale;
    this.dim.setSize(width, height);

    const portrait = width < height;
    const count = this.cards.length;
    // En vertical la letra sale del ancho (uiScale queda chico en celulares).
    const font = portrait ? Math.max(14, Math.round(Math.min(width * 0.045, 22))) : Math.max(13, Math.round(4.4 * ui));
    this.title.setFontSize(Math.max(26, Math.round(11 * ui))).setPosition(width / 2, height * (portrait ? 0.12 : 0.15));
    this.subtitle.setFontSize(Math.max(14, Math.round(4.2 * ui))).setPosition(width / 2, this.title.y + this.title.height * 0.75);
    this.hint.setFontSize(Math.max(11, Math.round(3 * ui))).setPosition(width / 2, height * 0.92);

    if (portrait) {
      const cardW = Math.min(width * 0.9, 520);
      const cardH = Math.round(font * 6);
      const gap = Math.round(font * 0.9);
      const total = count * cardH + (count - 1) * gap;
      const startY = Math.max(this.subtitle.y + font * 2, height * 0.53 - total / 2);
      this.cards.forEach((card, index) => {
        card.layout(cardW, cardH, font, true);
        card.setPosition(width / 2, startY + cardH / 2 + index * (cardH + gap));
      });
    } else {
      const gap = Math.round(font * 1.4);
      const cardW = Math.min((width * 0.9 - gap * (count - 1)) / Math.max(1, count), 72 * ui);
      // Todas las tarjetas con el alto de la que más texto tiene.
      const cardH = Math.max(...this.cards.map((card) => card.measureVerticalHeight(cardW, font)));
      const total = count * cardW + (count - 1) * gap;
      this.cards.forEach((card, index) => {
        card.layout(cardW, cardH, font, false);
        card.setPosition(width / 2 - total / 2 + cardW / 2 + index * (cardW + gap), height * 0.53);
      });
    }
  }

  /** Entrada: el título "salta" y las tarjetas aparecen una tras otra. */
  private playEntrance(): void {
    const { tweens } = this.scene;
    this.dim.setAlpha(0);
    tweens.add({ targets: this.dim, alpha: 1, duration: 150 });
    this.title.setScale(0.4);
    tweens.add({ targets: this.title, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.cards.forEach((card, index) => {
      card.setAlpha(0).setScale(0.85);
      tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 90 + index * 70, ease: 'Back.easeOut' });
    });
  }

  private pick(index: number): void {
    const choice = this.choices[index];
    const callback = this.onPick;
    if (!choice || !callback) return;
    if (this.scene.time.now - this.openedAt < INPUT_DELAY_MS) return;

    this.onPick = null;
    this.choices = [];
    this.destroyCards();
    this.setVisible(false);
    callback(choice);
  }

  private setVisible(visible: boolean): void {
    for (const item of [this.dim, this.title, this.subtitle, this.hint]) item.setVisible(visible);
  }

  private destroyCards(): void {
    for (const card of this.cards) card.destroy();
    this.cards = [];
  }
}
