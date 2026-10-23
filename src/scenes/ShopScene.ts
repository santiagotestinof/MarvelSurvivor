import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { META } from '../config/gameplayConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { META_UPGRADES, costOfNextLevel, type MetaUpgradeDefinition } from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { UiButton } from '../ui/UiButton';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';

const GOLD_COLOR = '#ffd24a';

/** Tienda de mejoras permanentes: se pagan con oro y valen para todos los personajes. */
export class ShopScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  /** Tarjetas de las mejoras: se destruyen y se arman de nuevo al comprar o cambiar el tamaño. */
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();

    this.title = this.add.text(0, 0, 'MEJORAS PERMANENTES', textStyle(28, '#f5c518')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#7a1d12', 0, true, true);
    this.goldText = this.add.text(0, 0, '', textStyle(16, GOLD_COLOR)).setOrigin(0.5);
    this.hint = this.add
      .text(0, 0, 'Rompé cajas y rocas y vencé enemigos para juntar oro. Valen para todos los héroes.', {
        ...textStyle(11, '#9fb3bf'),
        align: 'center',
      })
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
    const cx = width / 2;

    const zoom = Math.max(2, computeZoom(width, height));
    this.ground.setSize(width, height).setTileScale(zoom);
    this.shade.clear().fillStyle(0x05080c, 0.72).fillRect(0, 0, width, height);

    this.title.setFontSize(Math.max(18, Math.round(portrait ? Math.min(width * 0.07, 34) : 8 * ui))).setPosition(cx, height * 0.07);
    this.goldText.setText(`ORO: ${saveData.gold}`).setFontSize(Math.max(14, Math.round(4.6 * ui))).setPosition(cx, height * (portrait ? 0.125 : 0.15));
    this.hint.setFontSize(Math.max(9, Math.round(2.8 * ui))).setWordWrapWidth(width * 0.92).setPosition(cx, height * (portrait ? 0.165 : 0.2));
    this.backButton.setFontSize(Math.max(13, Math.round(4 * ui))).setPosition(cx, height * 0.94);

    for (const object of this.cardObjects) object.destroy();
    this.cardObjects = [];

    const columns = portrait ? 1 : 2;
    const rows = Math.ceil(META_UPGRADES.length / columns);
    const gap = Math.round(Math.max(6, 2.2 * ui));
    const areaX = width * 0.04;
    const areaW = width * 0.92;
    const areaY = height * (portrait ? 0.2 : 0.25);
    const areaH = height * 0.86 - areaY;
    const cardW = (areaW - gap * (columns - 1)) / columns;
    const cardH = (areaH - gap * (rows - 1)) / rows;

    META_UPGRADES.forEach((def, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawCard(def, areaX + column * (cardW + gap), areaY + row * (cardH + gap), cardW, cardH);
    });
  }

  private drawCard(def: MetaUpgradeDefinition, x: number, y: number, w: number, h: number): void {
    const level = saveData.levelOf(def.id);
    const maxed = level >= META.maxLevel;
    const cost = costOfNextLevel(def, level);
    const canBuy = !maxed && saveData.gold >= cost;

    const nameSize = Phaser.Math.Clamp(Math.round(h * 0.24), 11, 20);
    const smallSize = Math.max(9, Math.round(nameSize * 0.72));
    const pad = Math.round(nameSize * 0.6);

    const panel = this.add.graphics();
    drawPanel(panel, x, y, w, h, { radius: 8, border: canBuy ? 0xf5c518 : 0xffffff, borderAlpha: canBuy ? 0.7 : 0.18 });

    const buttonSize = Math.max(11, Math.round(nameSize * 0.85));
    const button = new UiButton(this, maxed ? 'MÁXIMO' : `COMPRAR ${cost}`, buttonSize, () => this.buy(def), []);
    button.setEnabled(canBuy);
    button.setAlpha(canBuy ? 1 : 0.5);
    button.setPosition(x + w - pad - button.width / 2, y + h / 2);

    const textW = w - button.width - pad * 3;
    const name = this.add.text(x + pad, y + pad * 0.7, def.name.toUpperCase(), textStyle(nameSize, '#ffffff')).setOrigin(0, 0);

    // Los círculos del nivel van a la derecha del nombre; el resto de la tarjeta queda para el efecto.
    const pips = this.add.graphics();
    const pipR = Math.max(3, Math.round(nameSize * 0.28));
    const pipsX = x + pad + name.width + pad;
    const pipsY = name.y + name.height / 2;
    for (let i = 0; i < META.maxLevel; i++) {
      const cx = pipsX + pipR + i * pipR * 2.6;
      pips.fillStyle(i < level ? 0xf5c518 : 0x1c2b24, 1).fillCircle(cx, pipsY, pipR);
      pips.lineStyle(1, 0xf5c518, 0.6).strokeCircle(cx, pipsY, pipR);
    }

    const effectText = maxed ? `Máx: ${def.effect(level)}` : `Próx: ${def.effect(level + 1)}`;
    const effect = this.add
      .text(x + pad, name.y + name.height + 2, effectText, textStyle(smallSize, maxed ? GOLD_COLOR : '#d7e6ef'))
      .setOrigin(0, 0)
      .setWordWrapWidth(textW);

    this.cardObjects.push(panel, button, name, pips, effect);
  }

  private buy(def: MetaUpgradeDefinition): void {
    const level = saveData.levelOf(def.id);
    if (level >= META.maxLevel) return;
    if (saveData.purchase(def.id, costOfNextLevel(def, level))) this.render();
  }
}
