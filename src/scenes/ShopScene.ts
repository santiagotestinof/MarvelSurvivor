import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { SCENE_KEYS } from '../config/sceneKeys';
import { META_UPGRADES, costOfNextLevel, refundAllUpgrades, totalSpentGold, type MetaUpgradeDefinition } from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { META_COLORS } from '../ui/metaIcons';
import { META_ITEM_SIZE, META_ITEM_TEXTURE, metaItemFrame } from '../ui/metaItemIcons';
import { PanelButton } from '../ui/PanelButton';
import { TITLE_FONT, UI_FONT } from '../ui/uiLayout';

const GOLD_COLOR = '#ffcf4a';
const GOLD = 0xffcf4a;

/**
 * Tienda de mejoras permanentes: grilla con todas las mejoras (ícono, color y rangos) y, al costado, el detalle de la elegida
 * con precio y botón de comprar. Cada héroe tiene sus propios niveles: se compra y se reembolsa para el héroe elegido.
 */
export class ShopScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private backButton!: PanelButton;
  private refundButton!: PanelButton;
  private heroButton!: PanelButton;
  private buyButton!: PanelButton;
  /** Mejora elegida en la grilla (siempre hay una, así el detalle nunca queda vacío). */
  private selectedId = META_UPGRADES[0].id;
  private columns = 6;
  /** El reembolso pide confirmar con un segundo toque. */
  private refundArmed = false;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070c1a');
    audio.play('menu');
    this.backdrop = this.add.graphics().setDepth(-20);
    this.backButton = new PanelButton(this, '‹', () => this.scene.start(SCENE_KEYS.menu), { hotkeys: ['ESC'] });
    this.heroButton = new PanelButton(this, 'HÉROE', () => this.nextHero(), { hotkeys: ['H'], style: 'gold' });
    this.buyButton = new PanelButton(this, 'COMPRAR', () => this.buySelected(), { style: 'primary', display: true });
    this.refundButton = new PanelButton(this, 'REEMBOLSAR', () => this.refund(), { style: 'ghost' });
    // Los botones se crean una sola vez y los paneles se rehacen en cada dibujo: van siempre por encima.
    for (const button of [this.backButton, this.heroButton, this.buyButton, this.refundButton]) button.setDepth(10);
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

  private heroName(): string {
    return (CHARACTER_REGISTRY[saveData.selectedCharacter]?.definition.displayName ?? saveData.selectedCharacter).toUpperCase();
  }

  private render(): void {
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const { width, height } = this.scale;
    const portrait = width < height * 0.95;
    drawMenuBackdrop(this.backdrop, width, height, 0x2a3f66, 0.35, 0.45);

    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    // Cabecera: volver, título, héroe y oro.
    this.backButton.setBox(44 * s, 44 * s, 24 * s).setPosition(X(48 + 22), Y(32 + 22));
    this.text(X(48 + 62), Y(portrait ? 30 : 28), 'MEJORAS', (portrait ? 38 : 44) * s, '#ffffff', { title: true }).setLetterSpacing(3 * s);
    this.text(X(48 + 62), Y(portrait ? 76 : 80), 'Permanentes · cada héroe tiene sus propios niveles', 13 * s, '#9db4d8', { bold: false });
    const goldText = this.text(0, 0, saveData.gold.toLocaleString('es-AR'), 26 * s, GOLD_COLOR, { title: true, origin: [1, 0.5] });
    const chipH = 44 * s;
    const chipW = goldText.width + 62 * s;
    const chipX = X(designW - 48) - chipW;
    const chipY = Y(32);
    const chip = this.add.graphics();
    chip.fillStyle(0x0a1224, 0.8).fillRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.lineStyle(2, GOLD, 0.45).strokeRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.fillStyle(GOLD, 1).fillCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    chip.lineStyle(2, 0xb78700, 1).strokeCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    this.dynamicObjects.push(chip);
    goldText.setPosition(chipX + chipW - 18 * s, chipY + chipH / 2).setDepth(1);
    this.heroButton.setLabel(portrait ? this.heroName() : `HÉROE: ${this.heroName()} [H]`);
    const heroW = portrait ? 230 : 280;
    this.heroButton.setBox(heroW * s, 44 * s, 13 * s).setPosition(chipX - 16 * s - (heroW * s) / 2, chipY + chipH / 2);

    // Grilla.
    this.columns = portrait ? 4 : 6;
    const rows = Math.ceil(META_UPGRADES.length / this.columns);
    const gridX = 48;
    const gridY = portrait ? 116 : 112;
    const gridW = portrait ? 624 : 720;
    const gridH = portrait ? 640 : 520;
    const gap = 12;
    const cellW = (gridW - gap * (this.columns - 1)) / this.columns;
    const cellH = (gridH - gap * (rows - 1)) / rows;
    META_UPGRADES.forEach((def, index) => {
      const col = index % this.columns;
      const row = Math.floor(index / this.columns);
      this.drawCell(def, X(gridX + col * (cellW + gap)), Y(gridY + row * (cellH + gap)), cellW * s, cellH * s, s);
    });

    // Detalle.
    const dx = portrait ? 48 : 792;
    const dy = portrait ? gridY + gridH + 18 : 112;
    const dw = portrait ? 624 : 440;
    const dh = portrait ? 1232 - dy : 520;
    this.drawDetail(X(dx), Y(dy), dw * s, dh * s, s, portrait);
  }

  /** Un casillero de la grilla: nombre, ícono en su marco del color de la mejora y sus rangos. */
  private drawCell(def: MetaUpgradeDefinition, x: number, y: number, w: number, h: number, s: number): void {
    const level = saveData.levelOf(def.id);
    const maxed = level >= def.maxLevel;
    const selected = this.selectedId === def.id;
    const color = META_COLORS[def.id] ?? 0x37d5ff;

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x, y + 4 * s, w, h, 14 * s);
    g.fillStyle(level > 0 ? 0x0f1d36 : 0x0a1224, 0.95).fillRoundedRect(x, y, w, h, 14 * s);
    g.fillStyle(color, level > 0 ? 0.12 : 0.05).fillRoundedRect(x, y, w, h * 0.55, { tl: 14 * s, tr: 14 * s, bl: 0, br: 0 });
    g.lineStyle(selected ? 3 : 1.5, selected ? 0xffffff : maxed ? GOLD : color, selected ? 1 : level > 0 ? 0.7 : 0.35).strokeRoundedRect(x, y, w, h, 14 * s);
    this.dynamicObjects.push(g);

    const name = this.text(x + w / 2, y + 8 * s, def.name.toUpperCase(), Math.min(11 * s, w * 0.095), selected ? '#ffffff' : '#c9d6e2', { origin: [0.5, 0], align: 'center', wrap: w - 8 * s });

    const pipsH = Math.max(4, 7 * s);
    const topArea = y + 8 * s + name.height + 4 * s;
    const bottomArea = y + h - pipsH - 12 * s;
    const box = Math.max(16, Math.min(bottomArea - topArea, w * 0.62));
    const iconScale = Math.max(0.5, Math.floor((box / META_ITEM_SIZE) * 2) / 2);
    const boxX = x + w / 2 - box / 2;
    const boxY = topArea + (bottomArea - topArea - box) / 2;
    const frame = this.add.graphics();
    frame.fillStyle(0x050b14, 1).fillRoundedRect(boxX, boxY, box, box, 8 * s);
    frame.fillStyle(color, level > 0 ? 0.28 : 0.1).fillRoundedRect(boxX, boxY, box, box, 8 * s);
    frame.lineStyle(2, maxed ? GOLD : color, level > 0 ? 1 : 0.6).strokeRoundedRect(boxX, boxY, box, box, 8 * s);
    this.dynamicObjects.push(frame);
    const icon = this.add.image(x + w / 2, boxY + box / 2, META_ITEM_TEXTURE, metaItemFrame(def.id)).setScale(iconScale);
    if (level === 0) icon.setAlpha(0.8);
    this.dynamicObjects.push(icon);

    // Rangos: un casillero por nivel, lleno si ya se compró.
    const pips = this.add.graphics();
    const pipGap = 2;
    const pipW = Math.min(pipsH * 1.6, (w * 0.8 - pipGap * (def.maxLevel - 1)) / def.maxLevel);
    const pipsW = def.maxLevel * pipW + (def.maxLevel - 1) * pipGap;
    const pipsY = y + h - pipsH - 8 * s;
    for (let i = 0; i < def.maxLevel; i++) {
      const px = x + w / 2 - pipsW / 2 + i * (pipW + pipGap);
      pips.fillStyle(i < level ? (maxed ? GOLD : color) : 0x1b2433, 1).fillRoundedRect(px, pipsY, pipW, pipsH, 2);
    }
    this.dynamicObjects.push(pips);

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, () => this.select(def.id));
    this.dynamicObjects.push(zone);
  }

  /** Panel del detalle: ícono grande, qué hace la mejora elegida, su precio y los botones de comprar y reembolsar. */
  private drawDetail(x: number, y: number, w: number, h: number, s: number, portrait: boolean): void {
    const def = META_UPGRADES.find((upgrade) => upgrade.id === this.selectedId) ?? META_UPGRADES[0];
    const level = saveData.levelOf(def.id);
    const maxed = level >= def.maxLevel;
    const cost = costOfNextLevel(def, level);
    const canBuy = !maxed && saveData.gold >= cost;
    const color = META_COLORS[def.id] ?? 0x37d5ff;
    const pad = 24 * s;

    const g = this.add.graphics();
    g.fillStyle(0x0a1224, 0.8).fillRoundedRect(x, y, w, h, 22 * s);
    g.fillStyle(color, 0.12).fillRoundedRect(x, y, w, 130 * s, { tl: 22 * s, tr: 22 * s, bl: 0, br: 0 });
    g.lineStyle(2, color, 0.5).strokeRoundedRect(x, y, w, h, 22 * s);
    this.dynamicObjects.push(g);

    // Ícono grande en su marco.
    const box = (portrait ? 96 : 110) * s;
    const boxX = x + pad;
    const boxY = y + pad;
    g.fillStyle(0x050b14, 1).fillRoundedRect(boxX, boxY, box, box, 14 * s);
    g.fillStyle(color, 0.25).fillRoundedRect(boxX, boxY, box, box, 14 * s);
    g.lineStyle(3, maxed ? GOLD : color, 1).strokeRoundedRect(boxX, boxY, box, box, 14 * s);
    const iconScale = Math.max(1, Math.floor((box * 0.9) / META_ITEM_SIZE));
    this.dynamicObjects.push(this.add.image(boxX + box / 2, boxY + box / 2, META_ITEM_TEXTURE, metaItemFrame(def.id)).setScale(iconScale));

    const textX = boxX + box + 18 * s;
    const textW = x + w - pad - textX;
    this.text(textX, boxY - 2 * s, `NIVEL ${level} DE ${def.maxLevel}`, 11 * s, maxed ? GOLD_COLOR : '#7f97c0', { bold: true }).setLetterSpacing(2 * s);
    this.text(textX, boxY + 16 * s, def.name.toUpperCase(), 34 * s, '#ffffff', { title: true, wrap: textW }).setLetterSpacing(1 * s);

    // Rangos con el color de la mejora.
    const pips = this.add.graphics();
    const pipW = Math.min(24 * s, (textW - 4 * s * (def.maxLevel - 1)) / def.maxLevel);
    for (let i = 0; i < def.maxLevel; i++) {
      pips.fillStyle(i < level ? (maxed ? GOLD : color) : 0x1b2433, 1).fillRoundedRect(textX + i * (pipW + 4 * s), boxY + box - 8 * s, pipW, 8 * s, 3 * s);
    }
    this.dynamicObjects.push(pips);

    let ty = boxY + box + 22 * s;
    if (level > 0) {
      this.text(x + pad, ty, 'AHORA', 10 * s, '#7f97c0').setLetterSpacing(2 * s);
      const now = this.text(x + pad, ty + 16 * s, def.effect(level), 15 * s, '#eef4ff', { wrap: w - pad * 2 });
      ty += 16 * s + now.height + 16 * s;
    }
    this.text(x + pad, ty, maxed ? 'RANGO MÁXIMO' : 'PRÓXIMO RANGO', 10 * s, maxed ? GOLD_COLOR : '#7f97c0').setLetterSpacing(2 * s);
    if (!maxed) this.text(x + pad, ty + 16 * s, def.effect(level + 1), 15 * s, '#9ce8ff', { wrap: w - pad * 2 });

    // Precio y botones (abajo).
    const innerW = w - pad * 2;
    const spent = totalSpentGold();
    this.refundButton.setLabel(this.refundArmed ? `¿SEGURO? +${spent}` : 'REEMBOLSAR').setBox(innerW * 0.46, 46 * s, 13 * s).setPosition(x + pad + (innerW * 0.46) / 2, y + h - pad - 23 * s);
    this.refundButton.setEnabled(spent > 0).setAlpha(spent > 0 ? 1 : 0.45);
    const buyW = innerW * 0.5;
    this.buyButton.setLabel(maxed ? 'MÁXIMO' : 'COMPRAR').setBox(buyW, 56 * s, 26 * s).setPosition(x + w - pad - buyW / 2, y + h - pad - 28 * s);
    this.buyButton.setEnabled(canBuy).setAlpha(canBuy || maxed ? 1 : 0.55);
    if (!maxed) {
      const price = this.text(x + w - pad, y + h - pad - 56 * s - 14 * s, String(cost), 26 * s, canBuy ? GOLD_COLOR : '#ff8a8a', { title: true, origin: [1, 0.5] });
      const coin = this.add.graphics();
      const r = 9 * s;
      coin.fillStyle(GOLD, 1).fillCircle(price.x - price.width - r * 1.8, price.y, r);
      coin.lineStyle(2, 0xb78700, 1).strokeCircle(price.x - price.width - r * 1.8, price.y, r);
      this.dynamicObjects.push(coin);
    }
  }

  /** Primer toque: pide confirmar; segundo toque: devuelve todo el oro gastado en este héroe. */
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

  /** Pasa al siguiente héroe reclutado (queda como el elegido para jugar). */
  private nextHero(): void {
    const owned = Object.keys(CHARACTER_REGISTRY).filter((id) => saveData.isUnlocked(id));
    if (owned.length < 2) return;
    saveData.select(owned[(owned.indexOf(saveData.selectedCharacter) + 1) % owned.length]);
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
