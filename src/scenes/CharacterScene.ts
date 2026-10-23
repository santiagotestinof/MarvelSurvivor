import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { saveData } from '../meta/saveData';
import { drawHeroCard } from '../ui/heroCard';
import { UiButton } from '../ui/UiButton';
import { textStyle, uiScale } from '../ui/uiLayout';

/** Elegir con qué héroe jugar. Los que todavía no se consiguieron aparecen como silueta. */
export class CharacterScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private gachaButton!: UiButton;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.characters);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'PERSONAJES', textStyle(28, '#f5c518')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#7a1d12', 0, true, true);
    this.hint = this.add.text(0, 0, 'Tocá un héroe para elegirlo.', textStyle(11, '#9fb3bf')).setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => this.scene.start(SCENE_KEYS.menu), ['ESC']);
    this.gachaButton = new UiButton(this, 'INVOCAR [G]', 16, () => this.scene.start(SCENE_KEYS.gacha), ['G']);

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

    const size = Math.max(12, Math.round(3.6 * ui));
    this.backButton.setFontSize(size);
    this.gachaButton.setFontSize(size);
    const gap = Math.round(size * 0.8);
    const total = this.backButton.width + gap + this.gachaButton.width;
    this.gachaButton.setPosition(width / 2 - total / 2 + this.gachaButton.width / 2, height * 0.94);
    this.backButton.setPosition(width / 2 + total / 2 - this.backButton.width / 2, height * 0.94);

    for (const object of this.cardObjects) object.destroy();
    this.cardObjects = [];

    const entries = Object.values(CHARACTER_REGISTRY);
    const columns = portrait ? 2 : entries.length;
    const rows = Math.ceil(entries.length / columns);
    const cardGap = Math.round(Math.max(6, 2.2 * ui));
    const areaX = width * 0.04;
    const areaW = width * 0.92;
    const areaY = height * (portrait ? 0.17 : 0.2);
    const areaH = height * 0.86 - areaY;
    const cardW = (areaW - cardGap * (columns - 1)) / columns;
    const cardH = Math.min((areaH - cardGap * (rows - 1)) / rows, portrait ? 999 : 340);

    entries.forEach(({ definition }, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = areaX + column * (cardW + cardGap);
      const y = areaY + row * (cardH + cardGap);
      const unlocked = saveData.isUnlocked(definition.id);
      const chosen = saveData.selectedCharacter === definition.id;
      const objects = drawHeroCard(this, definition, x, y, cardW, cardH, {
        locked: !unlocked,
        highlighted: chosen,
        footer: chosen ? { text: 'ELEGIDO', color: '#ffe272' } : unlocked ? { text: 'TOCÁ PARA ELEGIR', color: '#9fb3bf' } : undefined,
      });
      const zone = this.add.zone(x, y, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: unlocked });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!unlocked || chosen) return;
        saveData.select(definition.id);
        this.render();
      });
      this.cardObjects.push(...objects, zone);
    });
  }
}
