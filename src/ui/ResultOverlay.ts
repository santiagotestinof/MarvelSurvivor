import Phaser from 'phaser';
import type { HudSnapshot } from '../scenes/GameScene';
import { ACHIEVEMENTS } from '../meta/achievements';
import { UPGRADES } from '../progression/upgrades';
import { PanelButton } from './PanelButton';
import { TITLE_FONT, UI_FONT, formatTime } from './uiLayout';

const DEPTH = 10;

/** Pantalla final de la ronda (victoria o derrota) con el botón para volver al menú. */
export class ResultOverlay {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly card: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text;
  private readonly values: Phaser.GameObjects.Text;
  private readonly extra: Phaser.GameObjects.Text;
  private readonly button: PanelButton;
  private shown = false;
  private won = false;
  private achievementLines: string[] = [];

  constructor(scene: Phaser.Scene, onBackToMenu: () => void) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x040812, 0.82).setOrigin(0).setDepth(DEPTH).setVisible(false);
    this.card = scene.add.graphics().setDepth(DEPTH + 1).setVisible(false);
    this.title = scene.add.text(0, 0, '', { fontFamily: TITLE_FONT, color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH + 2).setVisible(false);
    this.title.setLetterSpacing(5);
    this.labels = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#7f97c0', lineSpacing: 12 }).setDepth(DEPTH + 2).setVisible(false);
    this.values = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#ffffff', lineSpacing: 12, align: 'right' }).setOrigin(1, 0).setDepth(DEPTH + 2).setVisible(false);
    this.extra = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#5ee0a0', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0).setDepth(DEPTH + 2).setVisible(false);
    this.button = new PanelButton(scene, 'VOLVER AL MENÚ', () => this.shown && onBackToMenu(), { hotkeys: ['ENTER', 'SPACE'], style: 'primary' })
      .setDepth(DEPTH + 2)
      .setVisible(false)
      .setEnabled(false);
  }

  show(state: HudSnapshot): void {
    const won = state.phase === 'won';
    this.shown = true;
    this.won = won;
    this.title.setText(won ? '¡VICTORIA!' : 'DERROTA').setColor(won ? '#ffcf4a' : '#ff5a6e').setVisible(true);
    const payout = state.goldPayout ?? 0;
    this.achievementLines = state.newAchievements.flatMap((id) => {
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      if (!achievement) return [];
      const passive = UPGRADES.find((u) => u.id === achievement.passiveId)?.name ?? achievement.passiveId;
      return [`¡LOGRO! ${achievement.name}: desbloqueaste ${passive}`];
    });
    this.labels.setText(['TIEMPO', 'ENEMIGOS DERROTADOS', won ? 'ORO GANADO' : 'ORO GUARDADO'].join('\n')).setVisible(true);
    this.values.setText([formatTime(state.elapsedMs), String(state.kills), `+${payout}`].join('\n')).setVisible(true);
    this.extra.setText(this.achievementLines.join('\n')).setVisible(this.achievementLines.length > 0);
    this.dim.setVisible(true);
    this.card.setVisible(true);
    this.button.setVisible(true).setEnabled(true);
  }

  layout(_ui: number, width: number, height: number): void {
    const portrait = width < height * 0.95;
    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    this.dim.setSize(width, height);
    const cw = Math.min(width * 0.94, (portrait ? 620 : 560) * s);
    const extraH = this.achievementLines.length * 30 * s + (this.achievementLines.length ? 24 * s : 0);
    const ch = 380 * s + extraH;
    const x = width / 2 - cw / 2;
    const y = height / 2 - ch / 2;
    const accent = this.won ? 0xffcf4a : 0xff5a6e;
    const g = this.card;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(x, y + 8 * s, cw, ch, 24 * s);
    g.fillStyle(0x0a1224, 0.97).fillRoundedRect(x, y, cw, ch, 24 * s);
    g.lineStyle(2, accent, 0.65).strokeRoundedRect(x, y, cw, ch, 24 * s);
    g.fillStyle(accent, 0.9).fillRoundedRect(x + cw / 2 - 40 * s, y, 80 * s, 5 * s, 2.5 * s);
    g.fillStyle(0x8cb4ff, 0.18).fillRect(x + 36 * s, y + 118 * s, cw - 72 * s, 1);

    this.title.setFontSize(Math.max(28, Math.round(72 * s))).setPosition(width / 2, y + 70 * s);
    const size = Math.max(11, Math.round(17 * s));
    this.labels.setFontSize(size).setLineSpacing(14 * s).setPosition(x + 40 * s, y + 144 * s).setLetterSpacing(1.5 * s);
    this.values.setFontSize(size).setLineSpacing(14 * s).setPosition(x + cw - 40 * s, y + 144 * s);
    this.extra.setFontSize(Math.max(10, Math.round(14 * s))).setWordWrapWidth(cw - 60 * s).setPosition(width / 2, y + 262 * s);
    this.button.setBox(Math.min(300 * s, cw - 60 * s), 58 * s, 20 * s).setPosition(width / 2, y + ch - 58 * s);
  }
}
