import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { PauseOverlay } from '../ui/PauseOverlay';
import { ResultOverlay } from '../ui/ResultOverlay';
import { UpgradeMenu, type UpgradePrompt } from '../ui/UpgradeMenu';
import { formatTime, textStyle, uiScale } from '../ui/uiLayout';
import type { GameScene, HudSnapshot } from './GameScene';

/** Demora entre el final de la ronda y la pantalla de resultado. */
const RESULT_DELAY_MS = 700;

/** Interfaz encima del juego: vida, tiempo, XP, jefe, menú de mejoras, resultado y joystick táctil. */
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

  private levelText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private upgradeMenu!: UpgradeMenu;
  private result!: ResultOverlay;
  private pause!: PauseOverlay;

  private ui = 2;
  private resultScheduled = false;
  private latest: HudSnapshot | null = null;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.gameScene = this.scene.get(SCENE_KEYS.game) as GameScene;
    this.resultScheduled = false;
    this.latest = null;
    this.touchVector.set(0, 0);

    this.bars = this.add.graphics().setDepth(1);
    this.healthText = this.add.text(0, 0, '', textStyle(12)).setOrigin(0.5).setDepth(2);
    this.timerText = this.add.text(0, 0, '', textStyle(24)).setOrigin(0.5, 0).setDepth(2);
    this.killsText = this.add.text(0, 0, '', textStyle(14)).setOrigin(1, 0).setDepth(2);
    this.bossText = this.add.text(0, 0, 'JEFE', textStyle(12, '#ffd9d9')).setOrigin(0.5).setDepth(2).setVisible(false);

    this.levelText = this.add.text(0, 0, '', textStyle(12)).setOrigin(0.5).setDepth(2);
    this.goldText = this.add.text(0, 0, '', textStyle(12, '#ffd24a')).setOrigin(0, 0).setDepth(2);

    this.upgradeMenu = new UpgradeMenu(this);
    this.result = new ResultOverlay(this, () => this.backToMenu());
    this.pause = new PauseOverlay(this, () => this.togglePause());

    const { width, height } = this.scale;
    this.joystick = new VirtualJoystick(this, Math.max(40, 16 * uiScale(width, height)));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(): void {
    if (this.pause.isPaused) return;
    this.touchVector.copy(this.joystick.vector);

    const state = this.gameScene.getHudState();
    this.latest = state;
    this.drawState(state);

    const playing = state.phase === 'waves' || state.phase === 'boss';
    this.pause.setButtonAvailable(playing && !this.upgradeMenu.isOpen);

    if ((state.phase === 'won' || state.phase === 'lost') && !this.resultScheduled) {
      this.resultScheduled = true;
      this.setJoystickEnabled(false);
      // Se usa el estado más reciente: el oro guardado se calcula un cuadro después de terminar la ronda.
      this.time.delayedCall(RESULT_DELAY_MS, () => this.result.show(this.latest ?? state));
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

    this.goldText.setFontSize(Math.max(11, Math.round(3.4 * ui)));
    this.goldText.setPosition(this.margin, this.margin + this.barHeight + 8);
    this.upgradeMenu.layout(ui);
    this.result.layout(ui, width, height);
    this.pause.layout(ui, width, height, this.margin);

    if (this.latest) this.drawState(this.latest);
  }

  private get barHeight(): number {
    return Math.max(12, Math.round(5 * this.ui));
  }

  private drawState(state: HudSnapshot): void {
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

    // Tiempo (o aviso de jefe, solo si el jefe llegó a aparecer: perder en las oleadas deja el reloj)
    const bossAppeared = state.bossMaxHealth > 0;
    this.timerText.setText(bossAppeared ? '¡JEFE!' : formatTime(state.remainingMs));
    this.timerText.setColor(bossAppeared ? '#ff8a8a' : '#ffffff');
    this.killsText.setText(`Derrotados: ${state.kills}`);
    this.goldText.setText(`ORO ${state.gold}`);

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

  /** Pausa el joystick y muestra las mejoras; al elegir (o usar una herramienta) se vuelve a activar. */
  showUpgrades(prompt: UpgradePrompt): void {
    this.setJoystickEnabled(false);
    const done = <A extends unknown[]>(callback: (...args: A) => void) => (...args: A): void => {
      this.setJoystickEnabled(true);
      callback(...args);
    };
    this.upgradeMenu.show({
      ...prompt,
      onPick: done(prompt.onPick),
      onReroll: done(prompt.onReroll),
      onSkip: done(prompt.onSkip),
      onBanish: done(prompt.onBanish),
    });
  }

  /** Pausa o reanuda la ronda (no aplica en el menú de mejoras ni en el resultado). */
  private togglePause(): void {
    const playing = this.latest?.phase === 'waves' || this.latest?.phase === 'boss';
    if (!playing || this.upgradeMenu.isOpen) return;

    const pausing = !this.pause.isPaused;
    this.pause.setPaused(pausing);
    this.setJoystickEnabled(!pausing);
    if (pausing) {
      this.touchVector.set(0, 0);
      this.scene.pause(SCENE_KEYS.game);
    } else {
      this.scene.resume(SCENE_KEYS.game);
    }
  }

  private setJoystickEnabled(enabled: boolean): void {
    this.joystick.disabled = !enabled;
    if (!enabled) this.joystick.release();
  }

  private backToMenu(): void {
    this.scene.stop(SCENE_KEYS.game);
    this.scene.start(SCENE_KEYS.menu);
  }
}
