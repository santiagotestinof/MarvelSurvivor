import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { ACHIEVEMENTS } from '../meta/achievements';
import { saveData } from '../meta/saveData';
import { UPGRADES } from '../progression/upgrades';
import { UiButton } from '../ui/UiButton';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';

/** Lista de logros con su progreso y la mejora pasiva que desbloquea cada uno. */
export class AchievementScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.achievements);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    audio.play('menu');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'LOGROS', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    const done = ACHIEVEMENTS.filter((a) => saveData.isAchievementDone(a.id)).length;
    this.hint = this.add
      .text(0, 0, `${done} de ${ACHIEVEMENTS.length} cumplidos. Cada logro desbloquea una mejora pasiva para las rondas.`, textStyle(11, '#9fb3bf'))
      .setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => this.scene.start(SCENE_KEYS.menu), ['ESC']);
    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this));
  }

  update(_time: number, delta: number): void {
    this.ground.tilePositionX += 4 * (delta / 1000);
    this.ground.tilePositionY += 2 * (delta / 1000);
  }

  private render(): void {
    const { width, height } = this.scale;
    const ui = uiScale(width, height);
    const portrait = width < height;
    this.ground.setSize(width, height).setTileScale(Math.max(2, computeZoom(width, height)));
    this.shade.clear().fillStyle(0x05080c, 0.72).fillRect(0, 0, width, height);
    this.title.setFontSize(Math.max(18, Math.round(portrait ? Math.min(width * 0.07, 34) : 8 * ui))).setPosition(width / 2, height * 0.07);
    this.hint.setFontSize(Math.max(9, Math.round(2.8 * ui))).setWordWrapWidth(width * 0.9).setAlign('center').setPosition(width / 2, height * (portrait ? 0.125 : 0.14));
    this.backButton.setFontSize(Math.max(12, Math.round(3.6 * ui)));
    this.backButton.setPosition(width / 2, height * 0.95);

    for (const object of this.rowObjects) object.destroy();
    this.rowObjects = [];

    const areaTop = height * (portrait ? 0.17 : 0.2);
    const areaBottom = height * 0.9;
    const gap = Math.max(4, Math.round(1.4 * ui));
    const rowH = Math.min(Math.max(26, 11 * ui), (areaBottom - areaTop - gap * (ACHIEVEMENTS.length - 1)) / ACHIEVEMENTS.length);
    const rowW = Math.min(width * 0.94, 260 * ui);
    const x = (width - rowW) / 2;
    const pad = Math.round(2.4 * ui);

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = areaTop + index * (rowH + gap);
      const done = saveData.isAchievementDone(achievement.id);
      const value = Math.min(achievement.target, achievement.value(saveData.lifetime));
      const passive = UPGRADES.find((u) => u.id === achievement.passiveId)?.name ?? achievement.passiveId;
      const g = this.add.graphics();
      drawPanel(g, x, y, rowW, rowH, {
        radius: Math.round(2.4 * ui),
        border: done ? 0xffe272 : 0x37d5ff,
        borderAlpha: done ? 0.9 : 0.3,
        alpha: done ? 0.92 : 0.8,
      });
      const mark = this.add
        .text(x + pad, y + rowH / 2, done ? '✔' : '○', textStyle(Math.max(12, 4.4 * ui), done ? '#7dffb0' : '#8a97a3'))
        .setOrigin(0, 0.5);
      const textX = x + pad * 2 + mark.width;
      const name = this.add.text(textX, y + rowH * 0.12, achievement.name, textStyle(Math.max(11, 3.6 * ui), done ? '#ffe272' : '#ffffff'));
      const description = this.add.text(textX, name.y + name.height + 1, achievement.description, textStyle(Math.max(9, 2.7 * ui), '#c9d6df'));
      const unit = achievement.unit ? ` ${achievement.unit}` : '';
      const progress = this.add
        .text(x + rowW - pad, y + rowH * 0.12, done ? 'CUMPLIDO' : `${value}${unit} / ${achievement.target}${unit}`, textStyle(Math.max(10, 3 * ui), done ? '#7dffb0' : '#9fb3bf'))
        .setOrigin(1, 0);
      const reward = this.add
        .text(x + rowW - pad, progress.y + progress.height + 1, `Desbloquea: ${passive}`, textStyle(Math.max(9, 2.7 * ui), done ? '#37d5ff' : '#6f8aa0'))
        .setOrigin(1, 0);
      this.rowObjects.push(g, mark, name, description, progress, reward);
    });
  }
}
