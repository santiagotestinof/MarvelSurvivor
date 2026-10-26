import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { EVOLUTION } from '../config/gameplayConfig';
import { MAIN_WEAPON_MAX_LEVEL, MAIN_WEAPONS } from '../progression/mainWeapon';
import { EVOLUTIONS, UPGRADES } from '../progression/upgrades';
import { HERO_WEAPONS, HERO_WEAPON_MAX_LEVEL } from '../systems/HeroWeapons';
import { UiButton } from '../ui/UiButton';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';

/** Easter egg: el libro secreto. Muestra la combinación que pide la evolución de cada héroe. */
export class BookScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.book);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    audio.play('menu');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'LIBRO DE EVOLUCIONES', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.hint = this.add
      .text(0, 0, `Cada evolución pide una pasiva tomada ${EVOLUTION.passivePicks} veces, el arma principal y la exclusiva al nivel máximo.`, textStyle(11, '#9fb3bf'))
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
    this.title.setFontSize(Math.max(16, Math.round(portrait ? Math.min(width * 0.06, 30) : 7 * ui))).setPosition(width / 2, height * 0.07);
    this.hint.setFontSize(Math.max(9, Math.round(2.8 * ui))).setWordWrapWidth(width * 0.9).setAlign('center').setPosition(width / 2, height * (portrait ? 0.125 : 0.14));
    this.backButton.setFontSize(Math.max(12, Math.round(3.6 * ui)));
    this.backButton.setPosition(width / 2, height * 0.95);

    for (const object of this.rowObjects) object.destroy();
    this.rowObjects = [];

    const areaTop = height * (portrait ? 0.17 : 0.2);
    const areaBottom = height * 0.9;
    const gap = Math.max(4, Math.round(1.4 * ui));
    const rowH = Math.min(Math.max(40, 17 * ui), (areaBottom - areaTop - gap * (EVOLUTIONS.length - 1)) / EVOLUTIONS.length);
    const rowW = Math.min(width * 0.94, 280 * ui);
    const x = (width - rowW) / 2;
    const pad = Math.round(2.4 * ui);

    EVOLUTIONS.forEach((evo, index) => {
      const y = areaTop + index * (rowH + gap);
      const entry = CHARACTER_REGISTRY[evo.hero];
      const hero = entry?.definition.displayName ?? evo.hero;
      const main = entry ? MAIN_WEAPONS[entry.definition.stats.attack.kind].name : '?';
      const exclusive = HERO_WEAPONS[evo.hero]?.name ?? '?';
      const passive = UPGRADES.find((u) => u.id === evo.requires)?.name ?? evo.requires;
      const g = this.add.graphics();
      drawPanel(g, x, y, rowW, rowH, { radius: Math.round(2.4 * ui), border: 0xffe272, borderAlpha: 0.6, alpha: 0.88 });
      const name = this.add.text(x + pad, y + rowH * 0.1, `${hero.toUpperCase()} → ${evo.name}`, textStyle(Math.max(11, 3.5 * ui), '#ffe272'));
      const recipe = this.add.text(
        x + pad,
        name.y + name.height + 1,
        `${passive} ×${EVOLUTION.passivePicks} + ${main} nv ${MAIN_WEAPON_MAX_LEVEL} + ${exclusive} nv ${HERO_WEAPON_MAX_LEVEL}`,
        textStyle(Math.max(9, 2.9 * ui), '#7dffb0'),
      );
      const effect = this.add.text(x + pad, recipe.y + recipe.height + 1, evo.text, textStyle(Math.max(8, 2.5 * ui), '#c9d6df'));
      effect.setWordWrapWidth(rowW - pad * 2);
      this.rowObjects.push(g, name, recipe, effect);
    });
  }
}
