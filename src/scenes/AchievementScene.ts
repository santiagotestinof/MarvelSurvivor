import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { SCENE_KEYS } from '../config/sceneKeys';
import { ACHIEVEMENTS } from '../meta/achievements';
import { saveData } from '../meta/saveData';
import { UPGRADES } from '../progression/upgrades';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { PanelButton } from '../ui/PanelButton';
import { TITLE_FONT, UI_FONT } from '../ui/uiLayout';

/** Lista de logros con su progreso y la mejora pasiva que desbloquea cada uno. */
export class AchievementScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private backButton!: PanelButton;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.achievements);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070c1a');
    audio.play('menu');
    this.backdrop = this.add.graphics().setDepth(-20);
    this.backButton = new PanelButton(this, '‹', () => this.scene.start(SCENE_KEYS.menu), { hotkeys: ['ESC'] });
    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this));
  }

  private text(x: number, y: number, value: string, size: number, color: string, options: { title?: boolean; origin?: [number, number]; wrap?: number; bold?: boolean } = {}): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, value, {
        fontFamily: options.title ? TITLE_FONT : UI_FONT,
        fontStyle: options.title || options.bold === false ? 'normal' : 'bold',
        fontSize: `${Math.max(7, Math.round(size))}px`,
        color,
        wordWrap: options.wrap ? { width: options.wrap } : undefined,
      })
      .setOrigin(...(options.origin ?? [0, 0]));
    this.dynamicObjects.push(t);
    return t;
  }

  private render(): void {
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const { width, height } = this.scale;
    const portrait = width < height * 0.95;
    drawMenuBackdrop(this.backdrop, width, height, 0x7a5410, 0.5, 0.4);

    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    const done = ACHIEVEMENTS.filter((a) => saveData.isAchievementDone(a.id)).length;
    this.backButton.setBox(44 * s, 44 * s, 24 * s).setPosition(X(48 + 22), Y(32 + 22));
    this.text(X(48 + 62), Y(portrait ? 30 : 28), 'LOGROS', (portrait ? 38 : 44) * s, '#ffffff', { title: true }).setLetterSpacing(3 * s);
    this.text(X(48 + 62), Y(portrait ? 76 : 80), `${done} de ${ACHIEVEMENTS.length} cumplidos · cada logro desbloquea una mejora pasiva para las rondas`, 13 * s, '#9db4d8', { bold: false });

    const listX = 48;
    const listW = designW - 96;
    const top = portrait ? 120 : 116;
    const bottom = designH - 40;
    const gap = 10;
    const rowH = Math.min(portrait ? 120 : 74, (bottom - top - gap * (ACHIEVEMENTS.length - 1)) / ACHIEVEMENTS.length);

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = Y(top + index * (rowH + gap));
      const x = X(listX);
      const w = listW * s;
      const h = rowH * s;
      const complete = saveData.isAchievementDone(achievement.id);
      const value = Math.min(achievement.target, achievement.value(saveData.lifetime));
      const passive = UPGRADES.find((u) => u.id === achievement.passiveId)?.name ?? achievement.passiveId;
      const accent = complete ? 0xffcf4a : 0x3dd9ff;

      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(x, y + 4 * s, w, h, 16 * s);
      g.fillStyle(complete ? 0x1d1a0c : 0x0a1224, 0.9).fillRoundedRect(x, y, w, h, 16 * s);
      g.lineStyle(complete ? 2 : 1.5, accent, complete ? 0.7 : 0.25).strokeRoundedRect(x, y, w, h, 16 * s);
      // Casillero con el estado.
      const badge = Math.min(h * 0.62, 46 * s);
      g.fillStyle(accent, complete ? 0.95 : 0.1).fillRoundedRect(x + 16 * s, y + (h - badge) / 2, badge, badge, 12 * s);
      g.lineStyle(2, accent, complete ? 1 : 0.5).strokeRoundedRect(x + 16 * s, y + (h - badge) / 2, badge, badge, 12 * s);
      this.dynamicObjects.push(g);
      this.text(x + 16 * s + badge / 2, y + h / 2, complete ? '✔' : String(index + 1), badge * 0.5, complete ? '#2a1d00' : '#7f97c0', { origin: [0.5, 0.5] });

      const textX = x + 16 * s + badge + 18 * s;
      const rightW = Math.min(w * 0.34, 330 * s);
      this.text(textX, y + h * 0.16, achievement.name, 18 * s, complete ? '#ffcf4a' : '#ffffff', { title: true }).setLetterSpacing(1 * s);
      this.text(textX, y + h * 0.56, achievement.description, 12 * s, '#9db4d8', { bold: false, wrap: w - badge - rightW - 70 * s });

      // Progreso y recompensa, a la derecha.
      const rx = x + w - 20 * s;
      const unit = achievement.unit ? ` ${achievement.unit}` : '';
      this.text(rx, y + h * 0.16, complete ? 'CUMPLIDO' : `${value}${unit} / ${achievement.target}${unit}`, 12 * s, complete ? '#5ee0a0' : '#9db4d8', { origin: [1, 0] });
      const barW = rightW;
      const barY = y + h * 0.5;
      const bar = this.add.graphics();
      bar.fillStyle(0xffffff, 0.1).fillRoundedRect(rx - barW, barY, barW, 7 * s, 3.5 * s);
      bar.fillStyle(complete ? 0x3ed68c : 0x3dd9ff, 1).fillRoundedRect(rx - barW, barY, Math.max(7 * s, barW * (value / achievement.target)), 7 * s, 3.5 * s);
      this.dynamicObjects.push(bar);
      this.text(rx, y + h * 0.68, `Desbloquea: ${passive}`, 11 * s, complete ? '#3dd9ff' : '#6f8aa0', { origin: [1, 0] });
    });
  }
}
