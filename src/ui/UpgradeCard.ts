import Phaser from 'phaser';
import { UPGRADE_CATEGORIES, type UpgradeDefinition } from '../progression/upgrades';
import { UPGRADE_ICON_SIZE, upgradeIconKey } from './upgradeIcons';
import { UI_FONT, drawPanel, textStyle } from './uiLayout';

const CARD_FILL = 0x0a1322;

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Tarjeta de una mejora en la pantalla de subir de nivel: categoría (con su color), ícono,
 * nombre, descripción y la tecla que la elige. Dos formatos: vertical (pantalla apaisada)
 * y `compact` horizontal (celular en vertical).
 */
export class UpgradeCard extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly category: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly keyLabel: Phaser.GameObjects.Text;
  private readonly color: number;

  private cardW = 100;
  private cardH = 130;
  private font = 14;
  private compact = false;
  private hovered = false;

  constructor(scene: Phaser.Scene, upgrade: UpgradeDefinition, index: number, onPick: () => void) {
    super(scene, 0, 0);
    scene.add.existing(this);
    const category = UPGRADE_CATEGORIES[upgrade.category];
    this.color = category.color;

    this.bg = scene.add.graphics();
    const iconKey = upgradeIconKey(upgrade.id);
    this.icon = scene.add.image(0, 0, scene.textures.exists(iconKey) ? iconKey : '__WHITE');
    this.category = scene.add.text(0, 0, category.label, { fontFamily: UI_FONT, fontStyle: 'bold', color: '#101010' });
    this.title = scene.add.text(0, 0, upgrade.name, textStyle(16));
    this.desc = scene.add.text(0, 0, upgrade.description, { fontFamily: UI_FONT, color: '#d7e6ef', lineSpacing: 2 });
    this.keyLabel = scene.add.text(0, 0, String(index + 1), { fontFamily: UI_FONT, fontStyle: 'bold', color: '#101010' }).setOrigin(0.5);
    this.add([this.bg, this.icon, this.category, this.title, this.desc, this.keyLabel]);

    this.setSize(this.cardW, this.cardH).setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.on(Phaser.Input.Events.POINTER_UP, onPick);
  }

  layout(width: number, height: number, font: number, compact: boolean): void {
    this.cardW = Math.round(width);
    this.cardH = Math.round(height);
    this.font = Math.round(font);
    this.compact = compact;
    this.setSize(this.cardW, this.cardH);
    if (this.input) (this.input.hitArea as Phaser.Geom.Rectangle).setSize(this.cardW, this.cardH);
    this.redraw();
  }

  private setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.setScale(hovered ? 1.04 : 1);
    this.redraw();
  }

  private redraw(): void {
    const { cardW: w, cardH: h, font } = this;
    const left = -w / 2;
    const top = -h / 2;
    const r = Math.max(6, Math.round(font * 0.6));
    const g = this.bg;
    g.clear();
    drawPanel(g, left, top, w, h, {
      fill: this.hovered ? 0x14284a : CARD_FILL,
      alpha: 0.96,
      border: this.color,
      borderAlpha: this.hovered ? 1 : 0.55,
      lineWidth: this.hovered ? 4 : 2,
      radius: r,
    });

    this.applyFonts(font);
    if (this.compact) this.layoutHorizontal(left, top, w, h, r);
    else this.layoutVertical(left, top, w, h, r);
  }

  /** Alto que necesita la tarjeta vertical con este ancho y tamaño de letra (para que no sobre ni falte lugar). */
  measureVerticalHeight(width: number, font: number): number {
    this.applyFonts(font);
    this.title.setWordWrapWidth(width - font);
    this.desc.setWordWrapWidth(width - font * 1.4);
    const m = this.verticalMetrics(width, font);
    return Math.ceil(m.iconY + m.iconRadius + font * 0.5 + this.title.height + font * 0.35 + this.desc.height + font * 2.4);
  }

  private applyFonts(font: number): void {
    this.title.setFontSize(Math.round(font * 1.2));
    this.desc.setFontSize(Math.round(font * 0.9));
    this.category.setFontSize(Math.max(9, Math.round(font * 0.7)));
    this.keyLabel.setFontSize(Math.round(font * 0.85));
  }

  /** Medidas de la parte de arriba de la tarjeta vertical, desde su borde superior. */
  private verticalMetrics(width: number, font: number): { bandH: number; iconScale: number; iconY: number; iconRadius: number } {
    const bandH = Math.round(font * 1.6);
    const iconScale = Math.max(2, Math.floor((width * 0.26) / UPGRADE_ICON_SIZE));
    const iconRadius = UPGRADE_ICON_SIZE * iconScale * 0.78;
    return { bandH, iconScale, iconY: bandH + font * 0.6 + iconRadius, iconRadius };
  }

  /** Tarjeta alta: franja de categoría arriba, ícono, nombre, descripción y tecla abajo. */
  private layoutVertical(left: number, top: number, w: number, h: number, r: number): void {
    const { font } = this;
    const g = this.bg;
    const { bandH, iconScale, iconY: iconOffset, iconRadius } = this.verticalMetrics(w, font);
    g.fillStyle(this.color, 0.95).fillRoundedRect(left, top, w, bandH, { tl: r, tr: r, bl: 0, br: 0 });
    this.category.setColor('#101010').setOrigin(0.5).setPosition(0, top + bandH / 2);

    const iconY = top + iconOffset;
    g.fillStyle(this.color, 0.16).fillCircle(0, iconY, iconRadius);
    this.icon.setScale(iconScale).setPosition(0, iconY);

    this.title.setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(w - font).setPosition(0, iconY + iconRadius + font * 0.5);
    this.desc
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(w - font * 1.4)
      .setPosition(0, this.title.y + this.title.height + font * 0.35);

    this.drawKeyBadge(0, top + h - font * 1.1);
  }

  /** Tarjeta ancha (celular en vertical): ícono a la izquierda y textos a la derecha. */
  private layoutHorizontal(left: number, top: number, w: number, h: number, r: number): void {
    const { font } = this;
    const g = this.bg;
    const stripW = Math.max(6, Math.round(font * 0.45));
    g.fillStyle(this.color, 0.95).fillRoundedRect(left, top, stripW, h, { tl: r, tr: 0, bl: r, br: 0 });

    const iconScale = Math.max(2, Math.floor(Math.min(h * 0.45, w * 0.14) / UPGRADE_ICON_SIZE));
    const iconSize = UPGRADE_ICON_SIZE * iconScale;
    const iconX = left + stripW + font * 0.6 + iconSize * 0.7;
    g.fillStyle(this.color, 0.16).fillCircle(iconX, 0, iconSize * 0.75);
    this.icon.setScale(iconScale).setPosition(iconX, 0);

    const textX = iconX + iconSize * 0.75 + font * 0.7;
    const textW = left + w - textX - font * 2.2;
    this.category.setColor(hex(this.color)).setOrigin(0, 0).setPosition(textX, top + font * 0.5);
    this.title.setOrigin(0, 0).setAlign('left').setWordWrapWidth(textW).setPosition(textX, this.category.y + this.category.height);
    this.desc.setOrigin(0, 0).setAlign('left').setWordWrapWidth(textW).setPosition(textX, this.title.y + this.title.height + 2);

    this.drawKeyBadge(left + w - font * 1.3, top + font * 1.2);
  }

  private drawKeyBadge(x: number, y: number): void {
    const size = Math.round(this.font * 1.4);
    this.bg.fillStyle(0xffffff, this.hovered ? 1 : 0.85).fillRoundedRect(x - size / 2, y - size / 2, size, size, Math.round(size * 0.25));
    this.keyLabel.setPosition(x, y);
  }
}
