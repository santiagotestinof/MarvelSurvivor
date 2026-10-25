import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { UiButton } from '../ui/UiButton';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';
import { MAPS } from '../world/maps';

/** Lista de mapas disponibles. Hoy hay uno solo (queda elegido); más adelante se podrá elegir entre varios. */
export class MapScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.maps);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    audio.play('menu');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'MAPAS', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.hint = this.add.text(0, 0, 'Estos son los mapas disponibles. Pronto habrá más.', textStyle(11, '#9fb3bf')).setOrigin(0.5);
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
    const zoom = Math.max(2, computeZoom(width, height));
    this.ground.setSize(width, height).setTileScale(zoom);
    this.shade.clear().fillStyle(0x05080c, 0.72).fillRect(0, 0, width, height);
    this.title.setFontSize(Math.max(18, Math.round(portrait ? Math.min(width * 0.07, 34) : 8 * ui))).setPosition(width / 2, height * 0.07);
    this.hint.setFontSize(Math.max(10, Math.round(3.2 * ui))).setPosition(width / 2, height * (portrait ? 0.125 : 0.15));
    this.backButton.setFontSize(Math.max(12, Math.round(3.6 * ui)));
    this.backButton.setPosition(width / 2, height * 0.94);

    for (const object of this.cardObjects) object.destroy();
    this.cardObjects = [];

    const columns = portrait ? 1 : Math.min(3, MAPS.length);
    const gap = Math.round(Math.max(6, 2.2 * ui));
    const cardW = Math.min(width * 0.9, 120 * ui);
    const cardH = Math.min(height * 0.5, 90 * ui);
    const totalW = cardW * columns + gap * (columns - 1);
    const startX = (width - totalW) / 2;
    const startY = height * (portrait ? 0.2 : 0.24);

    MAPS.forEach((map, index) => {
      const x = startX + (index % columns) * (cardW + gap);
      const y = startY + Math.floor(index / columns) * (cardH + gap);
      const g = this.add.graphics();
      drawPanel(g, x, y, cardW, cardH, { radius: Math.round(3 * ui), border: 0xffe272, borderAlpha: 0.9 });
      // Vista previa: el pasto del mapa en un recuadro.
      const pad = Math.round(2.5 * ui);
      const previewH = cardH * 0.5;
      const preview = this.add.tileSprite(x + pad, y + pad, cardW - pad * 2, previewH, TEXTURES.ground).setOrigin(0).setTileScale(zoom);
      const frame = this.add.graphics().lineStyle(2, 0x37d5ff, 0.6).strokeRect(x + pad, y + pad, cardW - pad * 2, previewH);
      const name = this.add.text(x + cardW / 2, y + pad * 2 + previewH, map.name, textStyle(Math.max(13, 4.4 * ui), '#ffffff')).setOrigin(0.5, 0);
      const description = this.add
        .text(x + cardW / 2, name.y + name.height + pad * 0.6, map.description, {
          ...textStyle(Math.max(10, 2.8 * ui), '#c9d6df'),
          align: 'center',
          wordWrap: { width: cardW - pad * 3 },
        })
        .setOrigin(0.5, 0);
      const chosen = this.add
        .text(x + cardW - pad, y + pad * 1.4, 'ELEGIDO', textStyle(Math.max(10, 3 * ui), '#ffe272'))
        .setOrigin(1, 0)
        .setBackgroundColor('#0a1322');
      this.cardObjects.push(g, preview, frame, name, description, chosen);
    });
  }
}
