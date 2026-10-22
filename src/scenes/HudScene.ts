import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { VirtualJoystick } from '../input/VirtualJoystick';
import type { HudState } from '../systems/RoundController';
import { createButton, formatTime, textStyle, uiScale } from '../ui/uiLayout';
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

  private ui = 2;
  private resultScheduled = false;
  private resultShown = false;
  private latest: HudState | null = null;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.gameScene = this.scene.get(SCENE_KEYS.game) as GameScene;
    this.resultScheduled = false;
    this.resultShown = false;
    this.latest = null;
    this.touchVector.set(0, 0);

    this.bars = this.add.graphics().setDepth(1);
    this.healthText = this.add.text(0, 0, '', textStyle(12)).setOrigin(0.5).setDepth(2);
    this.timerText = this.add.text(0, 0, '', textStyle(24)).setOrigin(0.5, 0).setDepth(2);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0).setDepth(2);
    this.bossText = this.add.text(0, 0, 'JEFE', textStyle(12, '#ffd9d9')).setOrigin(0.5).setDepth(2).setVisible(false);

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setOrigin(0).setDepth(10).setVisible(false);
    this.resultTitle = this.add.text(0, 0, '', textStyle(40)).setOrigin(0.5).setDepth(11).setVisible(false);
    this.resultStats = this.add.text(0, 0, '', { ...textStyle(16), align: 'center' }).setOrigin(0.5).setDepth(11).setVisible(false);
    this.menuButton = createButton(this, 'VOLVER AL MENÚ', 18, () => this.backToMenu(), ['ENTER', 'SPACE'])
      .setDepth(11)
      .setVisible(false);
    this.menuButton.disableInteractive();

    const { width, height } = this.scale;
    this.joystick = new VirtualJoystick(this, Math.max(40, 16 * uiScale(width, height)));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(): void {
    this.touchVector.copy(this.joystick.vector);

    const state = this.gameScene.getHudState();
    this.latest = state;
    this.drawState(state);

    if ((state.phase === 'won' || state.phase === 'lost') && !this.resultScheduled) {
      this.resultScheduled = true;
      this.joystick.disabled = true;
      this.joystick.release();
      this.time.delayedCall(700, () => this.showResult(state));
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
    this.resultTitle.setFontSize(Math.max(28, Math.round(12 * ui))).setPosition(width / 2, height * 0.34);
    this.resultStats.setFontSize(Math.max(14, Math.round(4 * ui))).setPosition(width / 2, height * 0.5);
    this.menuButton.setFontSize(Math.max(16, Math.round(5 * ui))).setPosition(width / 2, height * 0.68);

    if (this.latest) this.drawState(this.latest);
  }

  private get barHeight(): number {
    return Math.max(12, Math.round(5 * this.ui));
  }

  private drawState(state: HudState): void {
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

  private showResult(state: HudState): void {
    const won = state.phase === 'won';
    this.resultShown = true;
    this.resultTitle.setText(won ? '¡VICTORIA!' : 'DERROTA').setColor(won ? '#f5c518' : '#ff6b6b').setVisible(true);
    this.resultStats
      .setText(`Tiempo: ${formatTime(state.elapsedMs)}\nEnemigos derrotados: ${state.kills}`)
      .setVisible(true);
    this.dim.setVisible(true);
    this.menuButton.setVisible(true).setInteractive({ useHandCursor: true });
  }

  private backToMenu(): void {
    if (!this.resultShown) return;
    this.scene.stop(SCENE_KEYS.game);
    this.scene.start(SCENE_KEYS.menu);
  }
}
