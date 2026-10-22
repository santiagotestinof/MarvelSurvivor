import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { VirtualJoystick } from '../input/VirtualJoystick';
import type { ProgressState } from '../progression/ProgressionSystem';
import type { UpgradeDefinition } from '../progression/upgrades';
import type { HudState } from '../systems/RoundController';
import { createButton, formatTime, textStyle, uiScale } from '../ui/uiLayout';
import { UpgradeCard } from '../ui/UpgradeCard';
import type { GameScene } from './GameScene';

/** Interfaz que se dibuja encima del juego: vida, tiempo, jefe, resultado y joystick táctil. */
export class HudScene extends Phaser.Scene {
  /** Vector del joystick táctil; GameScene lo lee como una fuente de movimiento más. */
  readonly touchVector = new Phaser.Math.Vector2();

  private gameScene!: GameScene;
  private joystick!: VirtualJoystick;
  private bars!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;

  private dim!: Phaser.GameObjects.Rectangle;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultStats!: Phaser.GameObjects.Text;
  private menuButton!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pausedByUser = false;

  private levelText!: Phaser.GameObjects.Text;
  private upgradeDim!: Phaser.GameObjects.Rectangle;
  private upgradeTitle!: Phaser.GameObjects.Text;
  private upgradeSubtitle!: Phaser.GameObjects.Text;
  private upgradeHint!: Phaser.GameObjects.Text;
  private upgradeCards: UpgradeCard[] = [];
  private upgradeChoices: UpgradeDefinition[] = [];
  private onUpgradePicked: ((choice: UpgradeDefinition) => void) | null = null;
  private upgradeOpenedAt = 0;

  private ui = 2;
  private resultScheduled = false;
  private resultShown = false;
  private latest: (HudState & ProgressState) | null = null;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.gameScene = this.scene.get(SCENE_KEYS.game) as GameScene;
    this.resultScheduled = false;
    this.resultShown = false;
    this.pausedByUser = false;
    this.latest = null;
    this.touchVector.set(0, 0);
    this.upgradeCards = [];
    this.upgradeChoices = [];
    this.onUpgradePicked = null;

    this.bars = this.add.graphics().setDepth(1);
    this.healthText = this.add.text(0, 0, '', textStyle(12)).setOrigin(0.5).setDepth(2);
    this.timerText = this.add.text(0, 0, '', textStyle(24)).setOrigin(0.5, 0).setDepth(2);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0).setDepth(2);
    this.bossText = this.add.text(0, 0, 'JEFE', textStyle(12, '#ffd9d9')).setOrigin(0.5).setDepth(2).setVisible(false);

    this.levelText = this.add.text(0, 0, '', textStyle(12)).setOrigin(0.5).setDepth(2);

    this.upgradeDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7).setOrigin(0).setDepth(20).setVisible(false);
    this.upgradeTitle = this.add.text(0, 0, '', textStyle(32, '#f5c518')).setOrigin(0.5).setDepth(21).setVisible(false);
    this.upgradeSubtitle = this.add.text(0, 0, 'Elegí una mejora', textStyle(16, '#d7e6ef')).setOrigin(0.5).setDepth(21).setVisible(false);
    const touch = this.sys.game.device.input.touch;
    this.upgradeHint = this.add.text(0, 0, touch ? 'Tocá una tarjeta' : 'Click o teclas 1 · 2 · 3', textStyle(12, '#9fb3bf')).setOrigin(0.5).setDepth(21).setVisible(false);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      ['ONE', 'TWO', 'THREE'].forEach((name, index) => keyboard.addKey(name).on('down', () => this.pickUpgrade(index)));
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.togglePause());
    }

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setOrigin(0).setDepth(10).setVisible(false);
    this.resultTitle = this.add.text(0, 0, '', textStyle(40)).setOrigin(0.5).setDepth(11).setVisible(false);
    this.resultStats = this.add.text(0, 0, '', { ...textStyle(16), align: 'center' }).setOrigin(0.5).setDepth(11).setVisible(false);
    this.menuButton = createButton(this, 'VOLVER AL MENÚ', 18, () => this.backToMenu(), ['ENTER', 'SPACE'])
      .setDepth(11)
      .setVisible(false);
    this.menuButton.disableInteractive();

    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.68).setOrigin(0).setDepth(30).setVisible(false);
    this.pauseTitle = this.add.text(0, 0, 'PAUSA', textStyle(40, '#ffffff')).setOrigin(0.5).setDepth(31).setVisible(false);
    this.pauseButton = createButton(this, '⏸ PAUSAR [ESC]', 18, () => this.togglePause()).setDepth(51);

    const { width, height } = this.scale;
    this.joystick = new VirtualJoystick(this, Math.max(40, 16 * uiScale(width, height)));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(): void {
    this.touchVector.copy(this.joystick.vector);
    if (this.pausedByUser) return;

    const state = this.gameScene.getHudState();
    this.latest = state;
    this.drawState(state);

    this.pauseButton.setVisible(state.phase !== 'won' && state.phase !== 'lost' && this.upgradeChoices.length === 0);
    if ((state.phase === 'won' || state.phase === 'lost') && !this.resultScheduled) {
      this.resultScheduled = true;
      this.joystick.disabled = true;
      this.joystick.release();
      this.time.delayedCall(700, () => this.showResult(state));
    }
  }

  private togglePause(): void {
    if (this.latest?.phase === 'won' || this.latest?.phase === 'lost' || this.upgradeChoices.length > 0) return;
    this.pausedByUser = !this.pausedByUser;
    this.joystick.disabled = this.pausedByUser;
    if (this.pausedByUser) {
      this.joystick.release();
      this.touchVector.set(0, 0);
      this.scene.pause(SCENE_KEYS.game);
      this.pauseDim.setVisible(true);
      this.pauseTitle.setText('PAUSA\nESC para continuar').setVisible(true);
      this.pauseButton.setDepth(51).setText('▶ SEGUIR [ESC]');
    } else {
      this.scene.resume(SCENE_KEYS.game);
      this.pauseDim.setVisible(false);
      this.pauseTitle.setVisible(false);
      this.pauseButton.setDepth(51).setText('⏸ PAUSAR [ESC]');
    }
  }

  private get margin(): number {
    return Math.max(8, Math.round(3 * this.ui));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.ui = uiScale(width, height);
    const ui = this.ui;

    this.timerText.setFontSize(Math.max(18, Math.round(7 * ui))).setPosition(width / 2, this.margin);
    this.killsText.setFontSize(Math.max(12, Math.round(3.5 * ui))).setPosition(width - this.margin, this.margin);
    this.healthText.setFontSize(Math.max(10, Math.round(this.barHeight * 0.8)));
    this.bossText.setFontSize(Math.max(10, Math.round(this.barHeight * 0.8)));

    this.dim.setSize(width, height);
    this.layoutUpgrades();
    this.resultTitle.setFontSize(Math.max(28, Math.round(12 * ui))).setPosition(width / 2, height * 0.34);
    this.resultStats.setFontSize(Math.max(14, Math.round(4 * ui))).setPosition(width / 2, height * 0.5);
    this.menuButton.setFontSize(Math.max(16, Math.round(5 * ui))).setPosition(width / 2, height * 0.68);
    this.pauseButton.setFontSize(Math.max(12, Math.round(3.5 * ui)));
    this.pauseButton.setPosition(width - this.margin - this.pauseButton.width / 2, this.margin + this.pauseButton.height / 2 + 4);
    this.pauseDim.setSize(width, height);
    this.pauseTitle.setFontSize(Math.max(28, Math.round(12 * ui))).setPosition(width / 2, height * 0.42);

    if (this.latest) this.drawState(this.latest);
  }

  private get barHeight(): number {
    return Math.max(12, Math.round(5 * this.ui));
  }

  private drawState(state: HudState & ProgressState): void {
    const { width } = this.scale;
    const m = this.margin;
    const barH = this.barHeight;
    const barW = Math.max(120, Math.round(48 * this.ui));
    const g = this.bars;
    g.clear();

    // Vida del jugador
    const ratio = Phaser.Math.Clamp(state.health / state.maxHealth, 0, 1);
    g.fillStyle(0x000000, 0.6).fillRect(m - 2, m - 2, barW + 4, barH + 4);
    g.fillStyle(ratio > 0.35 ? 0x3ddc84 : 0xff4d4d, 1).fillRect(m, m, barW * ratio, barH);
    this.healthText.setText(`${Math.ceil(state.health)} / ${state.maxHealth}`).setPosition(m + barW / 2, m + barH / 2);

    // Tiempo
    this.timerText.setText(state.phase === 'waves' ? formatTime(state.remainingMs) : '¡JEFE!');
    this.timerText.setColor(state.phase === 'waves' ? '#ffffff' : '#ff8a8a');
    this.killsText.setText(`Derrotados: ${state.kills}`);

    // Experiencia (barra fina abajo de todo)
    const xpH = Math.max(8, Math.round(2.5 * this.ui));
    const { height } = this.scale;
    g.fillStyle(0x000000, 0.6).fillRect(0, height - xpH, width, xpH);
    g.fillStyle(0x37d5ff, 1).fillRect(0, height - xpH, width * Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1), xpH);
    this.levelText
      .setFontSize(Math.max(10, Math.round(xpH * 0.9)))
      .setText(`NV ${state.level}`)
      .setPosition(width / 2, height - xpH / 2);

    // Vida del jefe
    const showBoss = state.phase === 'boss' && state.bossMaxHealth > 0;
    this.bossText.setVisible(showBoss);
    if (showBoss) {
      const bossW = Math.min(width * 0.6, Math.round(100 * this.ui));
      const bossX = (width - bossW) / 2;
      const bossY = this.margin + this.timerText.height + 6;
      const bossRatio = Phaser.Math.Clamp(state.bossHealth / state.bossMaxHealth, 0, 1);
      g.fillStyle(0x000000, 0.6).fillRect(bossX - 2, bossY - 2, bossW + 4, barH + 4);
      g.fillStyle(0xb44cff, 1).fillRect(bossX, bossY, bossW * bossRatio, barH);
      this.bossText.setPosition(width / 2, bossY + barH / 2);
    }
  }

  /** Muestra las opciones de mejora; `onPick` se llama con la elegida. */
  showUpgrades(level: number, choices: UpgradeDefinition[], onPick: (choice: UpgradeDefinition) => void): void {
    this.joystick.disabled = true;
    this.joystick.release();
    this.upgradeChoices = choices;
    this.pauseButton.setVisible(false);
    this.onUpgradePicked = onPick;
    this.upgradeOpenedAt = this.time.now;
    this.upgradeTitle.setText(`¡NIVEL ${level}!`).setVisible(true);
    this.upgradeSubtitle.setVisible(true);
    this.upgradeHint.setVisible(true);
    this.upgradeDim.setVisible(true);

    for (const card of this.upgradeCards) card.destroy();
    this.upgradeCards = choices.map((choice, index) =>
      new UpgradeCard(this, choice, index, () => this.pickUpgrade(index)).setDepth(21),
    );
    this.layoutUpgrades();
  }

  private layoutUpgrades(): void {
    const { width, height } = this.scale;
    const ui = this.ui;
    this.upgradeDim.setSize(width, height);
    const portrait = width < height;
    const count = this.upgradeCards.length;
    const font = portrait ? Math.max(14, Math.round(Math.min(width * 0.045, 22))) : Math.max(13, Math.round(4.4 * ui));
    this.upgradeTitle.setFontSize(Math.max(26, Math.round(11 * ui))).setPosition(width / 2, height * (portrait ? 0.12 : 0.15));
    this.upgradeSubtitle.setFontSize(Math.max(14, Math.round(4.2 * ui))).setPosition(width / 2, this.upgradeTitle.y + this.upgradeTitle.height * 0.75);
    this.upgradeHint.setFontSize(Math.max(11, Math.round(3 * ui))).setPosition(width / 2, height * 0.92);
    if (portrait) {
      const cardW = Math.min(width * 0.9, 520);
      const cardH = Math.round(font * 6);
      const gap = Math.round(font * 0.9);
      const total = count * cardH + (count - 1) * gap;
      const startY = Math.max(this.upgradeSubtitle.y + font * 2, height * 0.53 - total / 2);
      this.upgradeCards.forEach((card, index) => {
        card.layout(cardW, cardH, font, true);
        card.setPosition(width / 2, startY + cardH / 2 + index * (cardH + gap));
      });
    } else if (count > 0) {
      const gap = Math.round(font * 1.4);
      const cardW = Math.min((width * 0.9 - gap * (count - 1)) / count, 72 * ui);
      const cardH = Math.max(...this.upgradeCards.map((card) => card.measureVerticalHeight(cardW, font)));
      const total = count * cardW + (count - 1) * gap;
      this.upgradeCards.forEach((card, index) => {
        card.layout(cardW, cardH, font, false);
        card.setPosition(width / 2 - total / 2 + cardW / 2 + index * (cardW + gap), height * 0.53);
      });
    }
  }

  private pickUpgrade(index: number): void {
    const choice = this.upgradeChoices[index];
    if (!choice || !this.onUpgradePicked) return;
    if (this.time.now - this.upgradeOpenedAt < 350) return; // evita toques accidentales
    const callback = this.onUpgradePicked;
    this.onUpgradePicked = null;
    this.upgradeChoices = [];
    for (const card of this.upgradeCards) card.destroy();
    this.upgradeCards = [];
    this.upgradeTitle.setVisible(false);
    this.upgradeSubtitle.setVisible(false);
    this.upgradeHint.setVisible(false);
    this.upgradeDim.setVisible(false);
    this.joystick.disabled = false;
    this.pauseButton.setVisible(true);
    callback(choice);
  }

  private showResult(state: HudState): void {
    const won = state.phase === 'won';
    this.resultShown = true;
    this.resultTitle.setText(won ? '¡VICTORIA!' : 'DERROTA').setColor(won ? '#f5c518' : '#ff6b6b').setVisible(true);
    this.resultStats
      .setText(`Tiempo: ${formatTime(state.elapsedMs)}\nEnemigos derrotados: ${state.kills}`)
      .setVisible(true);
    this.dim.setVisible(true);
    this.pauseButton.setVisible(false);
    this.menuButton.setVisible(true).setInteractive({ useHandCursor: true });
  }

  private backToMenu(): void {
    if (!this.resultShown) return;
    this.scene.stop(SCENE_KEYS.game);
    this.scene.start(SCENE_KEYS.menu);
  }
}
