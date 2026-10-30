import { audio } from '../audio/AudioManager';
import Phaser from 'phaser';
import type { CharacterDefinition } from '../characters/CharacterDefinition';
import { HERO_INFO, heroStatLines } from '../characters/heroInfo';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { RARITY_INFO, RARITY_ORDER } from '../characters/rarity';
import type { Rarity } from '../characters/CharacterDefinition';
import { SCENE_KEYS } from '../config/sceneKeys';
import { META_UPGRADES } from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { HERO_WEAPONS } from '../systems/HeroWeapons';
import { portraitKey } from '../ui/heroPortrait';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { PanelButton } from '../ui/PanelButton';
import { TITLE_FONT, UI_FONT, textStyle, uiScale } from '../ui/uiLayout';

const RANDOM_HERO_PRICE = 2000;
const RARITY_CHANCES: Record<Rarity, number> = {
  common: 80.5,
  rare: 15,
  epic: 4,
  legendary: 0.5,
};
const FURY_FRAMES = ['nick-fury-frame-0', 'nick-fury-frame-1', 'nick-fury-frame-2', 'nick-fury-frame-3'];
const FURY_ANIMATION = 'nick-fury-speaking';
const SPIDER_TEXTURE = 'spiderman-recruitment-emblem';

const HERO_CODE_NAMES: Record<string, string> = {
  ironman: 'STARK',
  capitan: 'ROGERS',
  spiderman: 'PARKER',
  thor: 'ODINSON',
  strange: 'STRANGE',
  hulk: 'BANNER',
};

const GOLD = '#ffcf4a';
const RARITY_GLOW: Record<Rarity, number> = { common: 0x2a3f66, rare: 0x1b4f8f, epic: 0x4b2a86, legendary: 0x7a5410 };
const RARITY_TOP: Record<Rarity, number> = { common: 0x1c2740, rare: 0x143055, epic: 0x2b1b52, legendary: 0x3b2c10 };

/** Elegir héroes reclutados, ver la ficha de cada uno (con scroll) y reclutar uno aleatorio de los que faltan. */
export class CharacterScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private backButton!: PanelButton;
  private recruitButton!: PanelButton;
  private chooseButton!: PanelButton;
  private upgradesButton!: PanelButton;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private revealObjects: Phaser.GameObjects.GameObject[] = [];
  private revealActive = false;
  /** Héroe cuya ficha se está viendo (puede ser uno todavía no reclutado). */
  private viewId = saveData.selectedCharacter;
  private scrollY = 0;
  private scrollMax = 0;
  private scrollBox = new Phaser.Geom.Rectangle();
  private scrollContent: Phaser.GameObjects.Container | null = null;
  private scrollBar: Phaser.GameObjects.Graphics | null = null;
  private scrollViewH = 0;
  private scrollContentH = 0;
  private dragging = false;

  constructor() {
    super(SCENE_KEYS.characters);
  }

  preload(): void {
    FURY_FRAMES.forEach((key, index) => {
      this.load.image(key, `/assets/recruitment/nick${index}.png`);
    });
    this.load.image(SPIDER_TEXTURE, '/assets/recruitment/spiderman-emblem.png');
    this.load.image('ironman-recruitment-emblem', '/assets/recruitment/ironman.png');
    this.load.image('capitan-recruitment-emblem', '/assets/recruitment/capitan.png');
    this.load.image('thor-recruitment-emblem', '/assets/recruitment/thor.png');
    this.load.image('strange-recruitment-emblem', '/assets/recruitment/strange.png');
    this.load.image('hulk-recruitment-emblem', '/assets/recruitment/hulk.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070c1a');
    audio.play('menu');
    this.viewId = saveData.selectedCharacter;
    this.scrollY = 0;
    this.backdrop = this.add.graphics().setDepth(-20);
    this.backButton = new PanelButton(this, '‹', () => {
      if (!this.revealActive) this.scene.start(SCENE_KEYS.menu);
    }, { hotkeys: ['ESC'] });
    this.recruitButton = new PanelButton(this, 'RECLUTAR HÉROE AL AZAR · 2000', () => this.recruitRandomHero(), { style: 'gold', display: true });
    this.chooseButton = new PanelButton(this, 'ELEGIR', () => this.chooseViewed(), { style: 'primary', display: true });
    this.upgradesButton = new PanelButton(this, 'MEJORAS', () => this.openUpgrades(), { style: 'gold' });

    if (!this.anims.exists(FURY_ANIMATION)) {
      this.anims.create({
        key: FURY_ANIMATION,
        frames: FURY_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      });
    }

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (this.revealActive || !this.scrollBox.contains(pointer.x, pointer.y)) return;
      this.scrollBy(dy * 0.6);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.dragging = !this.revealActive && this.scrollBox.contains(pointer.x, pointer.y);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.dragging = false));
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.dragging && pointer.isDown) this.scrollBy(pointer.prevPosition.y - pointer.y);
    });

    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      this.input.off('wheel');
      this.clearReveal();
    });
  }

  private scrollBy(delta: number): void {
    if (!this.scrollContent || this.scrollMax <= 0) return;
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.scrollMax);
    this.scrollContent.y = this.scrollBox.y - this.scrollY;
    this.drawScrollBar();
  }

  private drawScrollBar(): void {
    const bar = this.scrollBar;
    if (!bar) return;
    bar.clear();
    if (this.scrollMax <= 0) return;
    const trackH = this.scrollViewH;
    const thumbH = Math.max(24, trackH * (this.scrollViewH / this.scrollContentH));
    const thumbY = this.scrollBox.y + (trackH - thumbH) * (this.scrollY / this.scrollMax);
    bar.fillStyle(0xffffff, 0.08).fillRoundedRect(this.scrollBox.right + 4, this.scrollBox.y, 4, trackH, 2);
    bar.fillStyle(0x8cb4ff, 0.6).fillRoundedRect(this.scrollBox.right + 4, thumbY, 4, thumbH, 2);
  }

  private chooseViewed(): void {
    if (this.revealActive || !saveData.isUnlocked(this.viewId)) return;
    saveData.select(this.viewId);
    this.render();
  }

  /** La tienda de mejoras trabaja con el héroe elegido: se lo elige antes de abrirla. */
  private openUpgrades(): void {
    if (this.revealActive || !saveData.isUnlocked(this.viewId)) return;
    saveData.select(this.viewId);
    this.scene.start(SCENE_KEYS.shop);
  }

  private text(x: number, y: number, value: string, size: number, color: string, options: { title?: boolean; origin?: [number, number]; wrap?: number; bold?: boolean; into?: Phaser.GameObjects.Container } = {}): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, value, {
        fontFamily: options.title ? TITLE_FONT : UI_FONT,
        fontStyle: options.title || options.bold === false ? 'normal' : 'bold',
        fontSize: `${Math.max(7, Math.round(size))}px`,
        color,
        wordWrap: options.wrap ? { width: options.wrap } : undefined,
      })
      .setOrigin(...(options.origin ?? [0, 0]));
    if (options.into) options.into.add(t);
    else this.dynamicObjects.push(t);
    return t;
  }

  private render(): void {
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    this.scrollContent = null;
    this.scrollBar = null;
    const { width, height } = this.scale;
    const portrait = width < height * 0.95;
    const entries = Object.values(CHARACTER_REGISTRY).map((entry) => entry.definition);
    if (!CHARACTER_REGISTRY[this.viewId]) this.viewId = saveData.selectedCharacter;
    const view = CHARACTER_REGISTRY[this.viewId].definition;
    const owned = saveData.isUnlocked(view.id);
    const chosen = saveData.selectedCharacter === view.id;

    drawMenuBackdrop(this.backdrop, width, height, RARITY_GLOW[view.rarity], portrait ? 0.5 : 0.72, portrait ? 0.7 : 0.45);

    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    // Cabecera.
    this.backButton.setBox(44 * s, 44 * s, 24 * s).setPosition(X(48 + 22), Y(32 + 22)).setEnabled(!this.revealActive);
    const title = this.text(X(48 + 62), Y(portrait ? 30 : 28), 'PERSONAJES', (portrait ? 38 : 44) * s, '#ffffff', { title: true });
    title.setLetterSpacing(3 * s);
    const count = entries.filter((d) => saveData.isUnlocked(d.id)).length;
    this.text(X(48 + 62), Y(portrait ? 76 : 80), `${count} de ${entries.length} reclutados`, 13 * s, '#9db4d8', { bold: false });
    const goldText = this.text(0, 0, saveData.gold.toLocaleString('es-AR'), 26 * s, GOLD, { title: true, origin: [1, 0.5] });
    const chipH = 44 * s;
    const chipW = goldText.width + 62 * s;
    const chipX = X(designW - 48) - chipW;
    const chipY = Y(32);
    const chip = this.add.graphics();
    chip.fillStyle(0x0a1224, 0.8).fillRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.lineStyle(2, 0xffcf4a, 0.45).strokeRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.fillStyle(0xffcf4a, 1).fillCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    chip.lineStyle(2, 0xb78700, 1).strokeCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    this.dynamicObjects.push(chip);
    goldText.setPosition(chipX + chipW - 18 * s, chipY + chipH / 2).setDepth(1);

    // Grilla de héroes.
    const gridX = 48;
    const gridY = portrait ? 120 : 112;
    const gridW = portrait ? 624 : 520;
    const gap = 16;
    const tileW = (gridW - gap * 2) / 3;
    const tileH = portrait ? 170 : 200;
    entries.forEach((def, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      this.drawTile(def, X(gridX + col * (tileW + gap)), Y(gridY + row * (tileH + gap)), tileW * s, tileH * s, s, def.id === view.id);
    });
    const gridBottom = gridY + 2 * tileH + gap;
    this.recruitButton.setBox(gridW * s, 54 * s, 22 * s).setPosition(X(gridX + gridW / 2), Y(portrait ? gridBottom + 16 + 27 : 632 + 27));
    const lockedCount = entries.length - count;
    const canRecruit = lockedCount > 0 && saveData.gold >= RANDOM_HERO_PRICE && !this.revealActive;
    this.recruitButton.setLabel(lockedCount === 0 ? 'TODOS RECLUTADOS' : `RECLUTAR HÉROE AL AZAR · ${RANDOM_HERO_PRICE}`).setEnabled(canRecruit);

    // Panel de detalle.
    const px = portrait ? 48 : 620;
    const py = portrait ? gridBottom + 16 + 54 + 16 : 112;
    const pw = portrait ? 624 : 612;
    const ph = portrait ? 1232 - py : 574;
    const panel = this.add.graphics().setDepth(-5);
    panel.fillStyle(0x0a1224, 0.78).fillRoundedRect(X(px), Y(py), pw * s, ph * s, 22 * s);
    panel.fillStyle(RARITY_GLOW[view.rarity], 0.3).fillRoundedRect(X(px), Y(py), (portrait ? pw : 250) * s, (portrait ? 262 : ph) * s, { tl: 22 * s, tr: portrait ? 22 * s : 0, bl: portrait ? 0 : 22 * s, br: 0 });
    panel.lineStyle(2, 0x8cb4ff, 0.25).strokeRoundedRect(X(px), Y(py), pw * s, ph * s, 22 * s);
    this.dynamicObjects.push(panel);

    // Retrato grande.
    const key = portraitKey(this, view);
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1);
    const portraitH = (portrait ? 210 : 300) * s;
    img.setScale(portraitH / img.frame.realHeight);
    const imgCx = portrait ? X(px + pw / 2) : X(px + 125);
    const imgBottom = portrait ? Y(py + 240) : Y(py + 400);
    img.setPosition(imgCx, imgBottom);
    if (!owned) img.setTintFill(0x000000).setAlpha(0.6);
    this.dynamicObjects.push(img);
    const shadow = this.add.graphics();
    shadow.fillStyle(0xffffff, 0.2).fillEllipse(imgCx, imgBottom + 6 * s, 180 * s, 20 * s);
    this.dynamicObjects.push(shadow);

    // Zona con scroll: datos del héroe.
    const sx = portrait ? X(px + 28) : X(px + 274);
    const sy = portrait ? Y(py + 262) : Y(py + 26);
    const sw = portrait ? (pw - 56 - 16) * s : (pw - 274 - 28 - 16) * s;
    const sBottom = Y(py + ph - 92);
    const sh = sBottom - sy;
    this.scrollBox.setTo(sx, sy, sw, sh);
    this.scrollViewH = sh;
    const content = this.add.container(sx, sy);
    this.scrollContent = content;
    this.dynamicObjects.push(content);
    const contentH = this.buildDetail(content, view, sw, s);
    this.scrollContentH = contentH;
    this.scrollMax = Math.max(0, contentH - sh);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.scrollMax);
    content.y = sy - this.scrollY;
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff, 1).fillRect(sx - 4, sy - 8 * s, sw + 8, sh + 8 * s);
    content.setMask(maskShape.createGeometryMask());
    this.dynamicObjects.push(maskShape);
    this.scrollBar = this.add.graphics();
    this.dynamicObjects.push(this.scrollBar);
    this.drawScrollBar();

    // Barra de acciones fija.
    const barY = Y(py + ph - 92);
    const bar = this.add.graphics().setDepth(-4);
    bar.fillStyle(0x0a1224, 0.95).fillRoundedRect(X(px) + 1, barY, pw * s - 2, 91 * s, { tl: 0, tr: 0, bl: 22 * s, br: 22 * s });
    bar.lineStyle(1, 0x8cb4ff, 0.15).lineBetween(X(px) + 1, barY, X(px + pw) - 1, barY);
    this.dynamicObjects.push(bar);
    const actionCy = barY + 46 * s;
    const actionLeft = portrait ? px + 28 : px + 250 + 24;
    const actionRight = px + pw - 28;
    const upW = 150;
    if (owned) {
      const chooseW = actionRight - actionLeft - upW - 12;
      this.chooseButton.setVisible(true).setBox(chooseW * s, 52 * s, 18 * s).setPosition(X(actionLeft + chooseW / 2), actionCy);
      this.chooseButton.setLabel(chosen ? 'JUGANDO CON ESTE' : 'ELEGIR').setFill(chosen ? 0xffcf4a : null).setEnabled(!this.revealActive);
      this.upgradesButton.setVisible(true).setBox(upW * s, 52 * s, 12 * s).setPosition(X(actionRight - upW / 2), actionCy).setEnabled(!this.revealActive);
      const levels = META_UPGRADES.reduce((sum, upgrade) => sum + saveData.levelOf(upgrade.id, view.id), 0);
      this.upgradesButton.setLabel(`MEJORAS · ${levels} NIV.`);
    } else {
      this.chooseButton.setVisible(false);
      this.upgradesButton.setVisible(false);
      const note = this.text(X((actionLeft + actionRight) / 2), actionCy, 'Se consigue reclutando al azar', 13 * s, '#9db4d8', { origin: [0.5, 0.5] });
      note.setLetterSpacing(1 * s);
    }
  }

  /** Una tarjeta de la grilla: retrato, nombre y rareza; silueta con candado si todavía no se reclutó. */
  private drawTile(def: CharacterDefinition, x: number, y: number, w: number, h: number, s: number, selected: boolean): void {
    const rarity = RARITY_INFO[def.rarity];
    const owned = saveData.isUnlocked(def.id);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y + 5 * s, w, h, 16 * s);
    g.fillStyle(0x0a1326, 1).fillRoundedRect(x, y, w, h, 16 * s);
    g.fillStyle(RARITY_TOP[def.rarity], 1).fillRoundedRect(x, y, w, h * 0.7, { tl: 16 * s, tr: 16 * s, bl: 0, br: 0 });
    g.fillStyle(rarity.color, 1).fillRoundedRect(x, y, w, 5 * s, { tl: 16 * s, tr: 16 * s, bl: 0, br: 0 });
    g.fillStyle(0x050914, 0.6).fillRect(x, y + h * 0.78, w, h * 0.22 - 16 * s);
    g.fillStyle(0x050914, 0.6).fillRoundedRect(x, y + h - 36 * s, w, 36 * s, { tl: 0, tr: 0, bl: 16 * s, br: 16 * s });
    g.lineStyle(selected ? 3 : 1.5, selected ? 0xffffff : rarity.color, selected ? 1 : 0.55).strokeRoundedRect(x, y, w, h, 16 * s);
    this.dynamicObjects.push(g);

    const key = portraitKey(this, def);
    const img = this.add.image(x + w / 2, y + h * 0.66, key).setOrigin(0.5, 1);
    img.setScale(Math.min((h * 0.55) / img.frame.realHeight, (w * 0.7) / img.frame.realWidth));
    if (!owned) img.setTintFill(0x000000).setAlpha(0.55);
    this.dynamicObjects.push(img);

    this.text(x + w / 2, y + h - 48 * s, owned ? def.displayName.toUpperCase().replace('CAPITÁN AMÉRICA', 'CAPITÁN').replace('DOCTOR STRANGE', 'DR. STRANGE') : '???', 18 * s, '#ffffff', { title: true, origin: [0.5, 0] }).setLetterSpacing(1 * s);
    this.text(x + w / 2, y + h - 12 * s, rarity.label, 9 * s, rarity.css, { origin: [0.5, 1] }).setLetterSpacing(2 * s);

    if (!owned) {
      const lock = this.add.graphics();
      lock.fillStyle(0x050914, 0.85).fillCircle(x + w - 26 * s, y + 28 * s, 14 * s);
      lock.fillStyle(0x9db4d8, 1).fillRoundedRect(x + w - 32 * s, y + 27 * s, 12 * s, 9 * s, 2 * s);
      lock.lineStyle(2 * s, 0x9db4d8, 1).strokeCircle(x + w - 26 * s, y + 25 * s, 3.5 * s);
      this.dynamicObjects.push(lock);
    } else if (saveData.selectedCharacter === def.id) {
      const label = this.text(0, 0, 'JUGANDO', 10 * s, '#2a1d00', { origin: [0.5, 0.5] });
      label.setLetterSpacing(1.5 * s);
      const badgeW = label.width + 16 * s;
      const badge = this.add.graphics();
      badge.fillStyle(0xffcf4a, 1).fillRoundedRect(x + 10 * s, y + 14 * s, badgeW, label.height + 6 * s, (label.height + 6 * s) / 2);
      this.dynamicObjects.push(badge);
      label.setPosition(x + 10 * s + badgeW / 2, y + 14 * s + (label.height + 6 * s) / 2).setDepth(1);
    }

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.revealActive || this.viewId === def.id) return;
      this.viewId = def.id;
      this.scrollY = 0;
      this.render();
    });
    this.dynamicObjects.push(zone);
  }

  /** Arma la ficha (rareza, nombre, stats, arma, exclusiva, ulti) dentro del contenedor con scroll. Devuelve su alto. */
  private buildDetail(into: Phaser.GameObjects.Container, def: CharacterDefinition, w: number, s: number): number {
    const rarity = RARITY_INFO[def.rarity];
    const info = HERO_INFO[def.id];
    const stats = heroStatLines(def);
    const exclusive = HERO_WEAPONS[def.id];
    const g = this.add.graphics();
    into.add(g);
    let y = 0;
    this.text(0, y, rarity.label, 11 * s, rarity.css, { into }).setLetterSpacing(3 * s);
    y += 18 * s;
    const name = this.text(0, y, saveData.isUnlocked(def.id) ? def.displayName.toUpperCase() : '???', 48 * s, '#ffffff', { title: true, into, wrap: w });
    name.setLetterSpacing(1.5 * s);
    y += name.height + 14 * s;

    const bar = (label: string, value: number, max: number, color: number, css: string) => {
      this.text(0, y, label, 13 * s, '#eef4ff', { into });
      this.text(w, y, String(value), 13 * s, css, { into, origin: [1, 0] });
      y += 20 * s;
      g.fillStyle(0xffffff, 0.1).fillRoundedRect(0, y, w, 8 * s, 4 * s);
      g.fillStyle(color, 1).fillRoundedRect(0, y, Math.max(8 * s, w * Math.min(1, value / max)), 8 * s, 4 * s);
      y += 22 * s;
    };
    bar('Vida', stats.health, 160, 0xff5a6e, '#ff7a8a');
    bar('Velocidad', stats.speed, 100, 0x3ed68c, '#5ee0a0');
    if (stats.bonus) {
      const bonus = this.text(0, y - 6 * s, stats.bonus, 12 * s, GOLD, { into, wrap: w });
      y += bonus.height + 8 * s;
    }
    y += 10 * s;

    const card = (label: string, title: string, text: string, color: number) => {
      const body = this.text(60 * s, y + 38 * s, text, 12 * s, '#9db4d8', { into, wrap: w - 72 * s, bold: false });
      const cardH = Math.max(64 * s, 46 * s + body.height + 12 * s);
      g.fillStyle(0xffffff, 0.04).fillRoundedRect(0, y, w, cardH, 12 * s);
      g.lineStyle(1, 0x8cb4ff, 0.15).strokeRoundedRect(0, y, w, cardH, 12 * s);
      g.fillStyle(color, 0.16).fillRoundedRect(12 * s, y + 12 * s, 38 * s, 38 * s, 10 * s);
      g.lineStyle(2, color, 0.7).strokeRoundedRect(12 * s, y + 12 * s, 38 * s, 38 * s, 10 * s);
      g.fillStyle(color, 1).fillCircle(31 * s, y + 31 * s, 7 * s);
      this.text(60 * s, y + 10 * s, label, 10 * s, '#7f97c0', { into }).setLetterSpacing(2 * s);
      this.text(60 * s, y + 22 * s, title, 15 * s, '#ffffff', { into });
      into.bringToTop(body);
      y += cardH + 10 * s;
    };
    card('ARMA PRINCIPAL', info.main.name, info.main.text, 0x3dd9ff);
    if (exclusive) card('ARMA EXCLUSIVA · NIVEL 1 A 7', exclusive.name, exclusive.text, 0xb06bff);
    card(`ULTI · ENFRIAMIENTO ${info.ultimate.cooldown}`, info.ultimate.name, info.ultimate.text, 0xffcf4a);
    return y;
  }

  private recruitRandomHero(): void {
    if (this.revealActive || saveData.gold < RANDOM_HERO_PRICE) return;
    const locked = Object.values(CHARACTER_REGISTRY)
      .map(({ definition }) => definition)
      .filter((definition) => !saveData.isUnlocked(definition.id));
    if (locked.length === 0) return;

    // Primero se sortea la rareza con sus probabilidades; después, un héroe al azar de esa rareza.
    // Si una rareza ya no tiene héroes disponibles, su peso se redistribuye proporcionalmente entre las restantes.
    const availableRarities = RARITY_ORDER.filter((rarity) =>
      locked.some((hero) => hero.rarity === rarity),
    );
    const totalChance = availableRarities.reduce((total, rarity) => total + RARITY_CHANCES[rarity], 0);
    let rarityRoll = Math.random() * totalChance;
    let chosenRarity = availableRarities[0];

    for (const rarity of availableRarities) {
      rarityRoll -= RARITY_CHANCES[rarity];
      if (rarityRoll < 0) {
        chosenRarity = rarity;
        break;
      }
    }

    const rarityPool = locked.filter((hero) => hero.rarity === chosenRarity);
    const chosen = rarityPool[Math.floor(Math.random() * rarityPool.length)];
    if (!chosen || !saveData.buyHero(chosen.id, RANDOM_HERO_PRICE)) return;
    this.revealActive = true;
    this.viewId = chosen.id;
    this.scrollY = 0;
    this.render();
    this.playNickFuryReveal(chosen.id, chosen.displayName, chosen.rarity);
  }

  private playNickFuryReveal(heroId: string, heroName: string, heroRarity: Rarity): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const scale = Math.max(2, Math.floor(Math.min(width / 110, height / 95)));
    const fx = width * 0.31;
    const fy = height * 0.47;
    const overlay = this.add.graphics().setDepth(1000);
    overlay.fillStyle(0x02050a, 0.92).fillRect(0, 0, width, height);
    overlay.fillStyle(0x0d1b29, 1).fillRect(width * 0.06, height * 0.1, width * 0.88, height * 0.8);
    overlay.lineStyle(Math.max(2, scale), 0x37d5ff, 0.85).strokeRect(width * 0.06, height * 0.1, width * 0.88, height * 0.8);
    this.revealObjects.push(overlay);

    const furyWidth = Math.min(width * 0.32, height * 0.52 * 201 / 250);
    const fury = this.add.sprite(fx, fy, FURY_FRAMES[0])
      .setDisplaySize(furyWidth, furyWidth * 250 / 201)
      .setDepth(1001);
    fury.play(FURY_ANIMATION);
    this.revealObjects.push(fury);

    const commX = width * 0.69;
    const commY = height * 0.43;
    const commW = Math.min(width * 0.6, Math.min(width * 0.25, 190) * 4);
    const commH = Math.min(height * 0.8, Math.min(height * 0.28, 150) * 4);

    const caption = this.add.text(cx, height * 0.76, 'TRANSMISIÓN ENTRANTE...', {
      ...textStyle(Math.max(13, Math.round(4.2 * uiScale(width, height))), '#d7e6ef'),
      align: 'center',
    }).setOrigin(0.5).setDepth(1003);
    const dialogue = this.add.text(cx, height * 0.22, 'HEY, MR...', {
      ...textStyle(Math.max(18, Math.round(6 * uiScale(width, height))), '#ffffff'),
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1003);
    this.revealObjects.push(caption, dialogue);

    // Pixel noise inicial que se desvanece para simular la señal de una transmisión antigua.
    const noise = this.add.graphics().setDepth(1004);
    for (let i = 0; i < 160; i++) {
      noise.fillStyle(Math.random() > 0.5 ? 0x37d5ff : 0xffffff, Math.random() * 0.35);
      noise.fillRect(Math.random() * width, Math.random() * height, scale, scale);
    }
    this.revealObjects.push(noise);
    this.tweens.add({ targets: noise, alpha: 0, duration: 650, onComplete: () => noise.destroy() });

    this.time.delayedCall(1000, () => {
      if (this.revealActive) dialogue.setText('HEY, MR.');
    });
    this.time.delayedCall(2000, () => {
      if (this.revealActive) dialogue.setText('HEY, MR..');
    });
    this.time.delayedCall(3000, () => {
      if (!this.revealActive) return;
      dialogue.setText('HEY, MR...');
      fury.setTexture(FURY_FRAMES[2]);
      fury.anims.pause();
    });
    this.time.delayedCall(4000, () => {
      if (!this.revealActive) return;
      fury.play(FURY_ANIMATION);
      this.drawHeroEmblem(heroId, commX, commY, Math.min(commW, commH) * 0.425);
      dialogue.setText(`HEY, MR. ${HERO_CODE_NAMES[heroId] ?? heroName.toUpperCase()}!`);
      const rarityInfo = RARITY_INFO[heroRarity];
      caption.setText(`${heroName.toUpperCase()} · ${rarityInfo.label}`);
      caption.setColor(rarityInfo.css);
      this.cameras.main.shake(140, 0.003);
    });
    this.time.delayedCall(6000, () => {
      if (!this.revealActive) return;
      this.clearReveal();
      this.revealActive = false;
      this.render();
    });
  }

  private drawHeroEmblem(heroId: string, x: number, y: number, size: number): void {
    const emblemTextures: Record<string, string> = {
      ironman: 'ironman-recruitment-emblem',
      capitan: 'capitan-recruitment-emblem',
      thor: 'thor-recruitment-emblem',
      strange: 'strange-recruitment-emblem',
      hulk: 'hulk-recruitment-emblem',
    };
    const texture = heroId === 'spiderman' ? SPIDER_TEXTURE : emblemTextures[heroId];
    if (texture) {
      const emblem = this.add.image(x, y, texture)
        .setDisplaySize(size * 0.95, size * 0.95)
        .setDepth(1005);
      this.revealObjects.push(emblem);
      return;
    }

    const g = this.add.graphics().setDepth(1005);
    const s = size / 12;
    const rect = (px: number, py: number, w: number, h: number, color: number) => {
      g.fillStyle(color, 1).fillRect(x + px * s, y + py * s, w * s, h * s);
    };
    const colors: Record<string, number> = {
      ironman: 0xd92828, capitan: 0x2876d2, spiderman: 0xd92828,
      thor: 0x7c65e8, strange: 0xd64cda, hulk: 0x4cb34c,
    };
    const color = colors[heroId] ?? 0x37d5ff;
    g.fillStyle(0x07111b, 1).fillCircle(x, y, size * 0.52);
    g.fillStyle(color, 1).fillCircle(x, y, size * 0.42);
    if (heroId === 'capitan') {
      g.lineStyle(Math.max(2, s), 0xffffff, 1).strokeCircle(x, y, size * 0.27);
      g.fillStyle(0xffffff, 1).fillPoints([{ x, y: y - size * 0.22 }, { x: x + size * 0.2, y: y + size * 0.18 }, { x: x - size * 0.2, y: y + size * 0.18 }], true);
    } else if (heroId === 'thor') {
      rect(-1, -4, 2, 8, 0xffffff);
      rect(-4, -2, 8, 4, 0xffffff);
    } else if (heroId === 'hulk') {
      rect(-3, -2, 6, 4, 0x183d1b);
      rect(-2, -4, 4, 2, 0x183d1b);
    } else if (heroId === 'strange') {
      g.lineStyle(Math.max(2, s), 0xffd76b, 1).strokeCircle(x, y, size * 0.25);
      rect(-1, -3, 2, 6, 0xffd76b);
    } else {
      rect(-2, -4, 4, 8, 0xf5c518);
      rect(-4, -2, 8, 4, 0xf5c518);
    }
    this.revealObjects.push(g);
  }

  private clearReveal(): void {
    for (const object of this.revealObjects) object.destroy();
    this.revealObjects = [];
  }
}
