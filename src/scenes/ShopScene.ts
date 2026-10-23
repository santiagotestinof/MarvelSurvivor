import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import {
  META_UPGRADES,
  costOfNextLevel,
  refundAllUpgrades,
  totalSpentGold,
  type MetaUpgradeDefinition,
} from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { metaIconId } from '../ui/metaIcons';
import { UiButton } from '../ui/UiButton';
import { UPGRADE_ICON_SIZE, upgradeIconKey } from '../ui/upgradeIcons';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';

const GOLD_COLOR = '#ffd24a';
/** Mejoras por página (cuatro filas de dos en horizontal; ocho filas en vertical). */
const PER_PAGE = 8;
const PAGE_COUNT = Math.ceil(META_UPGRADES.length / PER_PAGE);

/** Tienda de mejoras permanentes: se pagan con oro y valen para todos los personajes. */
export class ShopScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private prevButton!: UiButton;
  private nextButton!: UiButton;
  private refundButton!: UiButton;
  private page = 0;
  /** Mejora tocada: su descripción se muestra arriba. */
  private selectedId: string | null = null;
  /** El reembolso pide confirmar con un segundo toque. */
  private refundArmed = false;
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
      .text(0, 0, '', {
        ...textStyle(11, '#9fb3bf'),
        align: 'center',
      })
      .setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => this.scene.start(SCENE_KEYS.menu), ['ESC']);
    this.prevButton = new UiButton(this, '<', 16, () => this.changePage(-1), ['LEFT']);
    this.nextButton = new UiButton(this, '>', 16, () => this.changePage(1), ['RIGHT']);
    this.refundButton = new UiButton(this, 'REEMBOLSAR', 16, () => this.refund(), []);
    this.page = 0;
    this.selectedId = null;
    this.refundArmed = false;

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
    this.goldText.setText(`ORO: ${saveData.gold}   ·   PÁGINA ${this.page + 1}/${PAGE_COUNT}`).setFontSize(Math.max(14, Math.round(4.6 * ui))).setPosition(cx, height * (portrait ? 0.125 : 0.15));
    this.updateHint(ui);
    this.hint.setFontSize(Math.max(10, Math.round(3.4 * ui))).setWordWrapWidth(width * 0.92).setPosition(cx, height * (portrait ? 0.165 : 0.2));
    this.layoutBottomBar(width, height, ui);

    for (const object of this.cardObjects) object.destroy();
    this.cardObjects = [];

    const columns = portrait ? 1 : 2;
    const pageItems = META_UPGRADES.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    const rows = Math.ceil(PER_PAGE / columns);
    const gap = Math.round(Math.max(6, 2.2 * ui));
    const areaX = width * 0.04;
    const areaW = width * 0.92;
    const areaY = height * (portrait ? 0.2 : 0.25);
    const areaH = height * 0.86 - areaY;
    const cardW = (areaW - gap * (columns - 1)) / columns;
    const cardH = (areaH - gap * (rows - 1)) / rows;

    pageItems.forEach((def, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawCard(def, areaX + column * (cardW + gap), areaY + row * (cardH + gap), cardW, cardH);
    });
  }

  /** Arriba: la descripción de la mejora tocada, o una ayuda si no hay ninguna. */
  private updateHint(_ui: number): void {
    const def = META_UPGRADES.find((upgrade) => upgrade.id === this.selectedId);
    if (!def) {
      this.hint.setColor('#9fb3bf').setText('Tocá una mejora para ver qué hace. Valen para todos los héroes.');
      return;
    }
    const level = saveData.levelOf(def.id);
    const next = level >= def.maxLevel ? `Máx: ${def.effect(level)}` : `Próx: ${def.effect(level + 1)}`;
    const now = level > 0 ? `Ahora: ${def.effect(level)}  ·  ` : '';
    this.hint.setColor('#ffffff').setText(`${def.name.toUpperCase()}\n${now}${next}`);
  }

  /** Fila de abajo: página anterior, reembolso, volver y página siguiente. */
  private layoutBottomBar(width: number, height: number, ui: number): void {
    const size = Math.max(12, Math.round(3.6 * ui));
    const spent = totalSpentGold();
    this.refundButton.setLabel(this.refundArmed ? `¿SEGURO? +${spent}` : 'REEMBOLSAR');
    this.refundButton.setEnabled(spent > 0).setAlpha(spent > 0 ? 1 : 0.45);
    this.prevButton.setEnabled(this.page > 0).setAlpha(this.page > 0 ? 1 : 0.45);
    this.nextButton.setEnabled(this.page < PAGE_COUNT - 1).setAlpha(this.page < PAGE_COUNT - 1 ? 1 : 0.45);

    const buttons = [this.prevButton, this.refundButton, this.backButton, this.nextButton];
    for (const button of buttons) button.setFontSize(size);
    const gap = Math.round(size * 0.8);
    const total = buttons.reduce((sum, button) => sum + button.width, 0) + gap * (buttons.length - 1);
    let x = width / 2 - total / 2;
    for (const button of buttons) {
      button.setPosition(x + button.width / 2, height * 0.94);
      x += button.width + gap;
    }
  }

  private changePage(step: number): void {
    const next = Phaser.Math.Clamp(this.page + step, 0, PAGE_COUNT - 1);
    if (next === this.page) return;
    this.page = next;
    this.refundArmed = false;
    this.render();
  }

  /** Primer toque: pide confirmar; segundo toque: devuelve todo el oro gastado. */
  private refund(): void {
    if (totalSpentGold() <= 0) return;
    if (!this.refundArmed) {
      this.refundArmed = true;
    } else {
      refundAllUpgrades();
      this.refundArmed = false;
    }
    this.render();
  }

  private drawCard(def: MetaUpgradeDefinition, x: number, y: number, w: number, h: number): void {
    const level = saveData.levelOf(def.id);
    const maxed = level >= def.maxLevel;
    const cost = costOfNextLevel(def, level);
    const canBuy = !maxed && saveData.gold >= cost;
    const selected = this.selectedId === def.id;

    const nameSize = Phaser.Math.Clamp(Math.round(h * 0.24), 11, 20);
    const pad = Math.round(nameSize * 0.6);

    const panel = this.add.graphics();
    drawPanel(panel, x, y, w, h, {
      radius: 8,
      border: selected ? 0xffffff : canBuy ? 0xf5c518 : 0xffffff,
      borderAlpha: selected ? 0.95 : canBuy ? 0.7 : 0.18,
    });
    // Tocar la tarjeta muestra la descripción (el botón de comprar queda por encima y no la dispara).
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, () => this.select(def.id));

    const buttonSize = Math.max(10, Math.round(nameSize * 0.72));
    const button = new UiButton(this, maxed ? 'MÁXIMO' : `COMPRAR ${cost}`, buttonSize, () => this.buy(def), []);
    button.setEnabled(canBuy);
    button.setAlpha(canBuy ? 1 : 0.5);
    button.setPosition(x + w - pad - button.width / 2, y + h / 2);

    // Ícono a la izquierda, escalado de a números enteros para que los píxeles queden nítidos.
    const iconScale = Math.max(2, Math.floor((h * 0.62) / UPGRADE_ICON_SIZE));
    const iconSize = UPGRADE_ICON_SIZE * iconScale;
    const iconX = x + pad + iconSize / 2;
    const badge = this.add.graphics();
    badge.fillStyle(0x0b1620, 0.9).fillCircle(iconX, y + h / 2, iconSize * 0.72);
    badge.lineStyle(2, maxed ? 0xf5c518 : 0xffffff, maxed ? 0.9 : 0.25).strokeCircle(iconX, y + h / 2, iconSize * 0.72);
    const icon = this.add.image(iconX, y + h / 2, upgradeIconKey(metaIconId(def.id))).setScale(iconScale);

    const textX = x + pad * 2 + iconSize * 1.45;
    const name = this.add.text(textX, y + h / 2 - pad * 0.2, def.name.toUpperCase(), textStyle(nameSize, '#ffffff')).setOrigin(0, 1);
    name.setWordWrapWidth(Math.max(40, button.x - button.width / 2 - pad - textX));

    // Círculos del nivel debajo del nombre.
    const pips = this.add.graphics();
    const pipR = Math.max(3, Math.round(nameSize * 0.28));
    const pipsY = y + h / 2 + pad * 0.2 + pipR + 2;
    for (let i = 0; i < def.maxLevel; i++) {
      const cx = textX + pipR + i * pipR * 2.6;
      pips.fillStyle(i < level ? 0xf5c518 : 0x1c2b24, 1).fillCircle(cx, pipsY, pipR);
      pips.lineStyle(1, 0xf5c518, 0.6).strokeCircle(cx, pipsY, pipR);
    }

    this.cardObjects.push(panel, zone, button, badge, icon, name, pips);
  }

  private select(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
    this.render();
  }

  private buy(def: MetaUpgradeDefinition): void {
    const level = saveData.levelOf(def.id);
    if (level >= def.maxLevel) return;
    if (saveData.purchase(def.id, costOfNextLevel(def, level))) {
      this.refundArmed = false;
      this.render();
    }
  }
}
