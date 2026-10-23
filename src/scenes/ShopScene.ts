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
import { META_COLORS } from '../ui/metaIcons';
import { META_ITEM_SIZE, META_ITEM_TEXTURE, metaItemFrame } from '../ui/metaItemIcons';
import { UiButton } from '../ui/UiButton';
import { drawPanel, textStyle, uiScale } from '../ui/uiLayout';

const GOLD_COLOR = '#ffd24a';
const GOLD = 0xf5c518;

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Tienda de mejoras permanentes: una grilla con todas las mejoras (cada una con su ícono, su color y sus
 * rangos) y, abajo, el detalle de la elegida con el precio y el botón de comprar. Valen para todos los héroes.
 */
export class ShopScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private refundButton!: UiButton;
  /** Mejora elegida en la grilla (siempre hay una, así el detalle nunca queda vacío). */
  private selectedId = META_UPGRADES[0].id;
  private columns = 1;
  /** El reembolso pide confirmar con un segundo toque. */
  private refundArmed = false;
  /** Objetos de la grilla y del detalle: se destruyen y se arman de nuevo al comprar o cambiar el tamaño. */
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();

    this.title = this.add.text(0, 0, 'MEJORAS PERMANENTES', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.goldText = this.add.text(0, 0, '', textStyle(16, GOLD_COLOR)).setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => this.scene.start(SCENE_KEYS.menu), ['ESC']);
    this.refundButton = new UiButton(this, 'REEMBOLSAR', 16, () => this.refund(), []);
    this.selectedId = META_UPGRADES[0].id;
    this.refundArmed = false;

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const move = (dx: number, dy: number) => () => this.moveSelection(dx, dy);
      keyboard.addKey('LEFT').on('down', move(-1, 0));
      keyboard.addKey('RIGHT').on('down', move(1, 0));
      keyboard.addKey('UP').on('down', move(0, -1));
      keyboard.addKey('DOWN').on('down', move(0, 1));
      keyboard.addKey('ENTER').on('down', () => this.buySelected());
    }

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

    this.title.setFontSize(Math.max(18, Math.round(portrait ? Math.min(width * 0.07, 34) : 7 * ui))).setPosition(cx, height * 0.06);
    this.goldText.setText(`ORO: ${saveData.gold}`).setFontSize(Math.max(14, Math.round(4.2 * ui))).setPosition(cx, height * (portrait ? 0.105 : 0.125));

    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];

    const margin = width * 0.04;
    const areaW = width - margin * 2;
    const gap = Math.round(Math.max(5, 1.8 * ui));

    // Grilla: 8 columnas en pantalla ancha (3 filas) y 4 en vertical (6 filas).
    this.columns = portrait ? 4 : 8;
    const rows = Math.ceil(META_UPGRADES.length / this.columns);
    const gridTop = height * (portrait ? 0.14 : 0.17);
    const gridBottom = height * (portrait ? 0.66 : 0.7);
    const cellW = (areaW - gap * (this.columns - 1)) / this.columns;
    const cellH = (gridBottom - gridTop - gap * (rows - 1)) / rows;
    META_UPGRADES.forEach((def, index) => {
      const column = index % this.columns;
      const row = Math.floor(index / this.columns);
      this.drawCell(def, margin + column * (cellW + gap), gridTop + row * (cellH + gap), cellW, cellH);
    });

    const detailTop = gridBottom + gap * 1.5;
    const detailBottom = height * 0.875;
    this.drawDetail(margin, detailTop, areaW, detailBottom - detailTop, ui, portrait);
    this.layoutBottomBar(width, height, ui);
  }

  /** Un casillero de la grilla: nombre, ícono dentro de un marco del color de la mejora y sus rangos. */
  private drawCell(def: MetaUpgradeDefinition, x: number, y: number, w: number, h: number): void {
    const level = saveData.levelOf(def.id);
    const maxed = level >= def.maxLevel;
    const selected = this.selectedId === def.id;
    const color = META_COLORS[def.id] ?? 0x37d5ff;

    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, {
      radius: 6,
      fill: level > 0 ? 0x0f1d33 : 0x0a1322,
      border: selected ? 0xffffff : maxed ? GOLD : color,
      borderAlpha: selected ? 1 : maxed ? 0.95 : level > 0 ? 0.75 : 0.4,
      lineWidth: selected ? 3 : 2,
    });

    const nameSize = Phaser.Math.Clamp(Math.round(Math.min(w * 0.115, h * 0.13)), 8, 14);
    const name = this.add
      .text(x + w / 2, y + h * 0.05, def.name.toUpperCase(), { ...textStyle(nameSize, selected ? '#ffffff' : '#c9d6e2'), align: 'center', strokeThickness: 0 })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(w - 6);

    // Marco cuadrado del ícono; el ícono se escala de a números enteros para que los píxeles queden nítidos.
    const pipsH = Math.max(5, Math.round(h * 0.07));
    const boxTop = y + h * 0.05 + nameSize * 1.25 * (name.height > nameSize * 1.5 ? 2 : 1) + 2;
    const boxBottom = y + h - pipsH - h * 0.08;
    const box = Math.max(16, Math.min(boxBottom - boxTop, w * 0.62));
    const iconScale = Math.max(1, Math.floor((box * 0.97) / META_ITEM_SIZE));
    const boxX = x + w / 2 - box / 2;
    const boxY = boxTop + (boxBottom - boxTop - box) / 2;
    const frame = this.add.graphics();
    frame.fillStyle(0x050b14, 1).fillRoundedRect(boxX, boxY, box, box, 5);
    frame.fillStyle(color, level > 0 ? 0.28 : 0.1).fillRoundedRect(boxX, boxY, box, box, 5);
    frame.lineStyle(2, maxed ? GOLD : color, level > 0 ? 1 : 0.6).strokeRoundedRect(boxX, boxY, box, box, 5);
    const icon = this.add.image(x + w / 2, boxY + box / 2, META_ITEM_TEXTURE, metaItemFrame(def.id)).setScale(iconScale);
    if (level === 0) icon.setAlpha(0.8);

    // Rangos: un casillero por nivel, lleno si ya se compró.
    const pips = this.add.graphics();
    const pipGap = 2;
    const pipW = Math.min(pipsH * 1.4, (w * 0.8 - pipGap * (def.maxLevel - 1)) / def.maxLevel);
    const pipsW = def.maxLevel * pipW + (def.maxLevel - 1) * pipGap;
    const pipsY = y + h - pipsH - h * 0.05;
    for (let i = 0; i < def.maxLevel; i++) {
      const px = x + w / 2 - pipsW / 2 + i * (pipW + pipGap);
      pips.fillStyle(i < level ? (maxed ? GOLD : color) : 0x1b2433, 1).fillRect(px, pipsY, pipW, pipsH);
      pips.lineStyle(1, i < level ? 0xffffff : color, i < level ? 0.5 : 0.35).strokeRect(px, pipsY, pipW, pipsH);
    }

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, () => this.select(def.id));
    this.dynamicObjects.push(g, name, frame, icon, pips, zone);
  }

  /** Panel de abajo: ícono grande, qué hace la mejora elegida, su precio y el botón de comprar. */
  private drawDetail(x: number, y: number, w: number, h: number, ui: number, portrait: boolean): void {
    const def = META_UPGRADES.find((upgrade) => upgrade.id === this.selectedId) ?? META_UPGRADES[0];
    const level = saveData.levelOf(def.id);
    const maxed = level >= def.maxLevel;
    const cost = costOfNextLevel(def, level);
    const canBuy = !maxed && saveData.gold >= cost;
    const color = META_COLORS[def.id] ?? 0x37d5ff;
    const pad = Math.round(Math.max(8, 2.4 * ui));

    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, { radius: 8, border: color, borderAlpha: 0.8 });
    this.dynamicObjects.push(g);

    // Ícono grande en su marco.
    const box = Math.min(h - pad * 2, portrait ? h * 0.42 : h * 0.8);
    const boxX = x + pad;
    const boxY = portrait ? y + pad : y + h / 2 - box / 2;
    g.fillStyle(0x050b14, 1).fillRoundedRect(boxX, boxY, box, box, 6);
    g.fillStyle(color, 0.25).fillRoundedRect(boxX, boxY, box, box, 6);
    g.lineStyle(3, maxed ? GOLD : color, 1).strokeRoundedRect(boxX, boxY, box, box, 6);
    const iconScale = Math.max(2, Math.floor((box * 0.97) / META_ITEM_SIZE));
    this.dynamicObjects.push(this.add.image(boxX + box / 2, boxY + box / 2, META_ITEM_TEXTURE, metaItemFrame(def.id)).setScale(iconScale));

    const textX = boxX + box + pad;
    const nameSize = Math.max(13, Math.round(4.2 * ui));
    const bodySize = Math.max(10, Math.round(3.2 * ui));
    const now = level > 0 ? `Ahora: ${def.effect(level)}\n` : '';
    const next = maxed ? 'Rango máximo' : `Próximo rango: ${def.effect(level + 1)}`;
    const rightReserve = portrait ? 0 : Math.max(150, w * 0.26);
    const textW = x + w - pad - textX - rightReserve;
    const title = this.add.text(textX, boxY, `${def.name.toUpperCase()}   ${level}/${def.maxLevel}`, textStyle(nameSize, css(color))).setOrigin(0, 0);
    const body = this.add
      .text(textX, boxY + title.height + 3, `${now}${next}`, { ...textStyle(bodySize, '#d7e6ef'), strokeThickness: 0, lineSpacing: 3 })
      .setOrigin(0, 0)
      .setWordWrapWidth(Math.max(60, textW));
    this.dynamicObjects.push(title, body);

    // Precio y botón de comprar.
    const buttonSize = Math.max(12, Math.round(4 * ui));
    const button = new UiButton(this, maxed ? 'MÁXIMO' : 'COMPRAR', buttonSize, () => this.buySelected(), [], true);
    button.setEnabled(canBuy);
    button.setAlpha(canBuy || maxed ? 1 : 0.55);
    const priceSize = Math.max(13, Math.round(4.4 * ui));
    const priceY = portrait ? y + h - pad - button.height / 2 : y + h / 2 - button.height * 0.75;
    const buttonX = x + w - pad - button.width / 2;
    const buttonY = portrait ? priceY : y + h / 2 + button.height * 0.75;
    button.setPosition(buttonX, buttonY);
    this.dynamicObjects.push(button);
    if (!maxed) {
      const coin = this.add.graphics();
      const coinR = priceSize * 0.5;
      const price = this.add.text(0, 0, String(cost), textStyle(priceSize, canBuy ? GOLD_COLOR : '#ff8a8a')).setOrigin(1, 0.5);
      const priceX = portrait ? buttonX - button.width / 2 - pad - coinR * 2.6 : x + w - pad;
      price.setPosition(priceX, portrait ? priceY : priceY);
      coin.fillStyle(GOLD, 1).fillCircle(price.x - price.width - coinR * 1.4, price.y, coinR);
      coin.lineStyle(2, 0x8a6400, 1).strokeCircle(price.x - price.width - coinR * 1.4, price.y, coinR);
      this.dynamicObjects.push(coin, price);
    }
  }

  /** Fila de abajo: reembolso y volver. */
  private layoutBottomBar(width: number, height: number, ui: number): void {
    const size = Math.max(12, Math.round(3.6 * ui));
    const spent = totalSpentGold();
    this.refundButton.setLabel(this.refundArmed ? `¿SEGURO? +${spent}` : 'REEMBOLSAR');
    this.refundButton.setEnabled(spent > 0).setAlpha(spent > 0 ? 1 : 0.45);

    const buttons = [this.refundButton, this.backButton];
    for (const button of buttons) button.setFontSize(size);
    const gap = Math.round(size * 0.8);
    const total = buttons.reduce((sum, button) => sum + button.width, 0) + gap * (buttons.length - 1);
    let x = width / 2 - total / 2;
    for (const button of buttons) {
      button.setPosition(x + button.width / 2, height * 0.94);
      x += button.width + gap;
    }
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

  private select(id: string): void {
    this.selectedId = id;
    this.refundArmed = false;
    this.render();
  }

  /** Flechas del teclado: mueven la selección por la grilla. */
  private moveSelection(dx: number, dy: number): void {
    const index = META_UPGRADES.findIndex((upgrade) => upgrade.id === this.selectedId);
    const next = Phaser.Math.Clamp(index + dx + dy * this.columns, 0, META_UPGRADES.length - 1);
    if (next !== index) this.select(META_UPGRADES[next].id);
  }

  private buySelected(): void {
    const def = META_UPGRADES.find((upgrade) => upgrade.id === this.selectedId);
    if (!def) return;
    const level = saveData.levelOf(def.id);
    if (level >= def.maxLevel) return;
    if (saveData.purchase(def.id, costOfNextLevel(def, level))) {
      this.refundArmed = false;
      this.render();
    }
  }
}
