import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { TEXTURES } from '../config/assetKeys';
import { SCENE_KEYS } from '../config/sceneKeys';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { PanelButton } from '../ui/PanelButton';
import { TITLE_FONT, UI_FONT } from '../ui/uiLayout';
import { MAPS } from '../world/maps';

/** Lista de mapas disponibles. Hoy hay uno solo (queda elegido); más adelante se podrá elegir entre varios. */
export class MapScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private backButton!: PanelButton;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.maps);
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

  private text(x: number, y: number, value: string, size: number, color: string, options: { title?: boolean; origin?: [number, number]; wrap?: number; bold?: boolean; align?: string } = {}): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, value, {
        fontFamily: options.title ? TITLE_FONT : UI_FONT,
        fontStyle: options.title || options.bold === false ? 'normal' : 'bold',
        fontSize: `${Math.max(7, Math.round(size))}px`,
        color,
        align: options.align ?? 'left',
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
    drawMenuBackdrop(this.backdrop, width, height, 0x1d6a3a, 0.5, 0.5);

    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const s = Math.min(width / designW, height / designH);
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    this.backButton.setBox(44 * s, 44 * s, 24 * s).setPosition(X(48 + 22), Y(32 + 22));
    this.text(X(48 + 62), Y(portrait ? 30 : 28), 'MAPAS', (portrait ? 38 : 44) * s, '#ffffff', { title: true }).setLetterSpacing(3 * s);
    this.text(X(48 + 62), Y(portrait ? 76 : 80), 'Estos son los mapas disponibles. Pronto habrá más.', 13 * s, '#9db4d8', { bold: false });

    const columns = portrait ? 1 : Math.min(3, Math.max(1, MAPS.length));
    const gap = 24;
    const cardW = portrait ? designW - 96 : Math.min(380, (designW - 96 - gap * (columns - 1)) / columns);
    const cardH = portrait ? 420 : 440;
    const totalW = cardW * columns + gap * (columns - 1);
    const startX = (designW - totalW) / 2;
    const startY = portrait ? 140 : 140;

    MAPS.forEach((map, index) => {
      const x = X(startX + (index % columns) * (cardW + gap));
      const y = Y(startY + Math.floor(index / columns) * (cardH + gap));
      const w = cardW * s;
      const h = cardH * s;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(x, y + 4 * s, w, h, 18 * s);
      g.fillStyle(0x0a1224, 0.9).fillRoundedRect(x, y, w, h, 18 * s);
      g.lineStyle(2, 0xffcf4a, 0.7).strokeRoundedRect(x, y, w, h, 18 * s);
      this.dynamicObjects.push(g);

      // Vista previa: el pasto del mapa en un recuadro con esquinas redondeadas.
      const pad = 16 * s;
      const pw = w - pad * 2;
      const ph = h * 0.55;
      const preview = this.add.tileSprite(x + pad, y + pad, pw, ph, TEXTURES.ground).setOrigin(0).setTileScale(Math.max(1, 3 * s));
      const mask = this.make.graphics({ x: 0, y: 0 });
      mask.fillStyle(0xffffff, 1).fillRoundedRect(x + pad, y + pad, pw, ph, 12 * s);
      preview.setMask(mask.createGeometryMask());
      const frame = this.add.graphics().lineStyle(2, 0x37d5ff, 0.5).strokeRoundedRect(x + pad, y + pad, pw, ph, 12 * s);
      this.dynamicObjects.push(preview, mask, frame);

      // Cartel ELEGIDO.
      const chipW = 100 * s;
      const chipH = 28 * s;
      const chip = this.add.graphics();
      chip.fillStyle(0x2a2208, 0.95).fillRoundedRect(x + pw + pad - chipW - 10 * s, y + pad + 10 * s, chipW, chipH, chipH / 2);
      chip.lineStyle(1.5, 0xffcf4a, 0.8).strokeRoundedRect(x + pw + pad - chipW - 10 * s, y + pad + 10 * s, chipW, chipH, chipH / 2);
      this.dynamicObjects.push(chip);
      this.text(x + pw + pad - chipW / 2 - 10 * s, y + pad + 10 * s + chipH / 2, 'ELEGIDO', 12 * s, '#ffcf4a', { origin: [0.5, 0.5] }).setLetterSpacing(1.5 * s);

      const textY = y + pad * 2 + ph;
      this.text(x + pad, textY, map.name.toUpperCase(), 28 * s, '#ffffff', { title: true }).setLetterSpacing(1.5 * s);
      this.text(x + pad, textY + 40 * s, map.description, 13 * s, '#9db4d8', { bold: false, wrap: pw });
    });
  }
}
