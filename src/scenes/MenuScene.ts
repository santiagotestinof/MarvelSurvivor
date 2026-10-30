import { audio } from '../audio/AudioManager';
import Phaser from 'phaser';
import type { CharacterDefinition } from '../characters/CharacterDefinition';
import { HERO_INFO, heroStatLines } from '../characters/heroInfo';
import { RARITY_INFO } from '../characters/rarity';
import { CHARACTER_REGISTRY, STARTER_ID } from '../characters/registry';
import { SCENE_KEYS } from '../config/sceneKeys';
import { META_UPGRADES } from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { HERO_WEAPONS } from '../systems/HeroWeapons';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { PanelButton } from '../ui/PanelButton';
import { portraitKey } from '../ui/heroPortrait';
import { SoundPanel } from '../ui/SoundPanel';
import { TITLE_FONT, UI_FONT } from '../ui/uiLayout';

const RED = '#ff3b4a';
const GOLD = '#ffcf4a';

/** Menú principal: título, navegación a la izquierda, el héroe elegido al centro y su ficha a la derecha. */
export class MenuScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private marvel!: Phaser.GameObjects.Text;
  private survivors!: Phaser.GameObjects.Text;
  private hero!: Phaser.GameObjects.Image;
  private playButton!: PanelButton;
  private charactersButton!: PanelButton;
  private shopButton!: PanelButton;
  private mapsButton!: PanelButton;
  private achievementsButton!: PanelButton;
  private bookButton: PanelButton | null = null;
  private soundButton!: PanelButton;
  private prevButton!: PanelButton;
  private nextButton!: PanelButton;
  private soundPanel!: SoundPanel;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private heroY = 0;
  private scaleFactor = 1;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070c1a');
    audio.play('menu');

    this.backdrop = this.add.graphics().setDepth(-20);
    this.glow = this.add.graphics().setDepth(-10);
    this.marvel = this.add.text(0, 0, 'MARVEL', { fontFamily: TITLE_FONT, color: RED }).setOrigin(0, 1);
    this.survivors = this.add.text(0, 0, 'SURVIVORS', { fontFamily: TITLE_FONT, color: '#ffffff' }).setOrigin(0, 0);
    this.survivors.setShadow(0, 4, '#1593b8', 0, true, true);

    const def = this.currentHero();
    this.hero = this.add.image(0, 0, portraitKey(this, def)).setOrigin(0.5, 1);

    this.playButton = new PanelButton(this, 'JUGAR', () => this.startGame(), { hotkeys: ['ENTER', 'SPACE'], style: 'primary', display: true });
    this.charactersButton = new PanelButton(this, 'PERSONAJES', () => this.scene.start(SCENE_KEYS.characters), {
      hotkeys: ['P'],
      alignLeft: true,
      detail: `${Object.keys(CHARACTER_REGISTRY).filter((id) => saveData.isUnlocked(id)).length}/${Object.keys(CHARACTER_REGISTRY).length}`,
    });
    this.shopButton = new PanelButton(this, 'MEJORAS', () => this.scene.start(SCENE_KEYS.shop), { hotkeys: ['M'], alignLeft: true, detail: 'por héroe' });
    this.mapsButton = new PanelButton(this, 'MAPAS', () => this.scene.start(SCENE_KEYS.maps), { hotkeys: ['A'] });
    this.achievementsButton = new PanelButton(this, 'LOGROS', () => this.scene.start(SCENE_KEYS.achievements), { hotkeys: ['L'] });
    // Easter egg: el libro de evoluciones aparece en el menú recién cuando se lo encontró en el mapa.
    this.bookButton = saveData.hasBook ? new PanelButton(this, 'LIBRO', () => this.scene.start(SCENE_KEYS.book), { hotkeys: ['B'] }) : null;
    this.soundButton = new PanelButton(this, 'CONFIGURACIÓN', () => this.soundPanel.open(), { hotkeys: ['C'], style: 'ghost' });
    this.prevButton = new PanelButton(this, '‹', () => this.cycleHero(-1), { hotkeys: ['LEFT'] });
    this.nextButton = new PanelButton(this, '›', () => this.cycleHero(1), { hotkeys: ['RIGHT'] });
    this.soundPanel = new SoundPanel(this, 100);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(time: number): void {
    this.hero.y = this.heroY + Math.round(Math.sin(time / 450) * this.scaleFactor * 4);
  }

  private currentHero(): CharacterDefinition {
    return (CHARACTER_REGISTRY[saveData.selectedCharacter] ?? CHARACTER_REGISTRY[STARTER_ID]).definition;
  }

  /** Pasa al héroe desbloqueado anterior o siguiente (queda elegido para jugar). */
  private cycleHero(step: number): void {
    const owned = Object.keys(CHARACTER_REGISTRY).filter((id) => saveData.isUnlocked(id));
    if (owned.length < 2) return;
    const index = owned.indexOf(saveData.selectedCharacter);
    saveData.select(owned[(index + step + owned.length) % owned.length]);
    this.hero.setTexture(portraitKey(this, this.currentHero()));
    this.layout();
  }

  private text(x: number, y: number, value: string, size: number, color: string, options: { title?: boolean; origin?: [number, number]; wrap?: number; bold?: boolean } = {}): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, value, {
        fontFamily: options.title ? TITLE_FONT : UI_FONT,
        fontStyle: options.title || options.bold === false ? 'normal' : 'bold',
        fontSize: `${Math.max(7, Math.round(size))}px`,
        color,
        wordWrap: options.wrap ? { width: options.wrap } : undefined,
      })
      .setOrigin(...(options.origin ?? [0, 0]));
    this.dynamicObjects.push(t);
    return t;
  }

  private layout(): void {
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const { width, height } = this.scale;
    const portrait = width < height * 0.95;
    const def = this.currentHero();
    const rarity = RARITY_INFO[def.rarity];

    drawMenuBackdrop(this.backdrop, width, height, rarity.color === 0xb8c4cc ? 0x1a3a66 : rarity.color, portrait ? 0.5 : 0.5, 0.5);

    // Todo se arma en una grilla de diseño de 1280×720 (apaisado) o 720×1280 (vertical) y se escala.
    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    this.scaleFactor = s;
    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    // Oro (arriba a la derecha).
    const goldText = this.text(0, 0, saveData.gold.toLocaleString('es-AR'), 26 * s, GOLD, { title: true, origin: [1, 0.5] });
    const chipH = 44 * s;
    const chipW = goldText.width + 62 * s;
    const chipX = X(designW - 36) - chipW;
    const chipY = Y(26);
    const chip = this.add.graphics();
    chip.fillStyle(0x0a1224, 0.8).fillRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.lineStyle(2, 0xffcf4a, 0.45).strokeRoundedRect(chipX, chipY, chipW, chipH, chipH / 2);
    chip.fillStyle(0xffcf4a, 1).fillCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    chip.lineStyle(2, 0xb78700, 1).strokeCircle(chipX + 26 * s, chipY + chipH / 2, 10 * s);
    this.dynamicObjects.push(chip);
    goldText.setPosition(chipX + chipW - 18 * s, chipY + chipH / 2).setDepth(1);

    // Título.
    const titleX = portrait ? X(designW / 2) : X(56);
    this.marvel.setFontSize(Math.round((portrait ? 38 : 44) * s)).setOrigin(portrait ? 0.5 : 0, 0).setPosition(titleX, Y(portrait ? 40 : 38)).setLetterSpacing(5 * s);
    this.survivors.setFontSize(Math.round((portrait ? 84 : 84) * s)).setOrigin(portrait ? 0.5 : 0, 0).setPosition(titleX, Y(portrait ? 84 : 78)).setLetterSpacing(2 * s);

    // Héroe.
    const heroCx = portrait ? X(designW / 2) : X(640);
    const heroBottom = portrait ? Y(660) : Y(470);
    const heroH = (portrait ? 400 : 340) * s;
    const frame = this.hero.frame;
    this.hero.setScale(heroH / frame.realHeight).setPosition(heroCx, heroBottom);
    this.heroY = heroBottom;
    const glowR = (portrait ? 260 : 190) * s;
    this.glow.clear();
    this.glow.fillStyle(rarity.color === 0xb8c4cc ? 0x3dd9ff : rarity.color, 0.07);
    for (let i = 0; i < 6; i++) this.glow.fillCircle(heroCx, heroBottom - heroH * 0.5, glowR * (1 - i * 0.14));
    this.glow.fillStyle(0x3dd9ff, 0.3).fillEllipse(heroCx, heroBottom + 2 * s, 260 * s, 30 * s);
    this.glow.lineStyle(2, 0x3dd9ff, 0.5).strokeEllipse(heroCx, heroBottom + 2 * s, 260 * s, 30 * s);

    const nameY = heroBottom + 40 * s;
    this.text(heroCx, nameY, def.displayName.toUpperCase(), 38 * s, '#ffffff', { title: true, origin: [0.5, 0] }).setLetterSpacing(2 * s);
    this.text(heroCx, nameY + 46 * s, rarity.label, 12 * s, rarity.css, { origin: [0.5, 0] }).setLetterSpacing(3 * s);
    const arrowGap = (portrait ? 250 : 190) * s;
    this.prevButton.setBox(44 * s, 44 * s, 24 * s).setPosition(heroCx - arrowGap, nameY + 16 * s);
    this.nextButton.setBox(44 * s, 44 * s, 24 * s).setPosition(heroCx + arrowGap, nameY + 16 * s);

    // Navegación.
    const navX = portrait ? X(designW / 2) : X(56 + 170);
    const navW = portrait ? 600 * s : 340 * s;
    let navY = portrait ? Y(1000) : Y(250 + 38);
    this.playButton.setBox(navW, 76 * s, 38 * s).setPosition(navX, navY);
    navY += (76 / 2 + 12 + 26) * s;
    this.charactersButton.setBox(navW, 52 * s, 16 * s).setPosition(navX, navY);
    navY += 64 * s;
    this.shopButton.setBox(navW, 52 * s, 16 * s).setPosition(navX, navY);
    navY += (52 / 2 + 10 + 24) * s;
    const small = [this.mapsButton, this.achievementsButton, ...(this.bookButton ? [this.bookButton] : [])];
    const gap = 10 * s;
    const smallW = (navW - gap * (small.length - 1)) / small.length;
    small.forEach((button, i) => button.setBox(smallW, 48 * s, 13 * s).setPosition(navX - navW / 2 + smallW / 2 + i * (smallW + gap), navY));
    navY += (48 / 2 + 12 + 22) * s;
    this.soundButton.setBox(navW, 44 * s, 13 * s).setPosition(navX, navY);

    this.soundPanel.layout(Math.max(1.5, s * 2.4), width, height);

    // Ficha del héroe (solo en pantalla apaisada).
    if (!portrait) this.drawCard(def, X(designW - 56 - 310), Y(120), 310 * s, s);
  }

  private drawCard(def: CharacterDefinition, x: number, y: number, w: number, s: number): void {
    const info = HERO_INFO[def.id];
    const stats = heroStatLines(def);
    const exclusive = HERO_WEAPONS[def.id];
    const pad = 22 * s;
    const inner = w - pad * 2;
    const panel = this.add.graphics();
    this.dynamicObjects.push(panel);

    let cy = y + pad;
    this.text(x + pad, cy, 'ESTADÍSTICAS', 12 * s, '#7f97c0').setLetterSpacing(2.5 * s);
    cy += 28 * s;
    const bar = (label: string, value: number, max: number, color: number, css: string) => {
      this.text(x + pad, cy, label, 13 * s, '#eef4ff');
      this.text(x + w - pad, cy, String(value), 13 * s, css, { origin: [1, 0] });
      cy += 20 * s;
      panel.fillStyle(0xffffff, 0.1).fillRoundedRect(x + pad, cy, inner, 8 * s, 4 * s);
      panel.fillStyle(color, 1).fillRoundedRect(x + pad, cy, Math.max(8 * s, inner * Math.min(1, value / max)), 8 * s, 4 * s);
      cy += 24 * s;
    };
    bar('Vida', stats.health, 160, 0xff5a6e, '#ff7a8a');
    bar('Velocidad', stats.speed, 100, 0x3ed68c, '#5ee0a0');
    if (stats.bonus) {
      const bonus = this.text(x + pad, cy - 6 * s, stats.bonus, 12 * s, GOLD, { wrap: inner });
      cy += bonus.height + 4 * s;
    }
    panel.fillStyle(0x8cb4ff, 0.2).fillRect(x + pad, cy + 2 * s, inner, 1);
    cy += 16 * s;

    const row = (label: string, name: string, text: string, color: number) => {
      panel.fillStyle(color, 0.16).fillRoundedRect(x + pad, cy, 36 * s, 36 * s, 10 * s);
      panel.lineStyle(2, color, 0.7).strokeRoundedRect(x + pad, cy, 36 * s, 36 * s, 10 * s);
      panel.fillStyle(color, 1).fillCircle(x + pad + 18 * s, cy + 18 * s, 6 * s);
      const tx = x + pad + 48 * s;
      this.text(tx, cy - 2 * s, label, 10 * s, '#7f97c0').setLetterSpacing(2 * s);
      this.text(tx, cy + 12 * s, name, 14 * s, '#ffffff');
      const body = this.text(tx, cy + 32 * s, text, 11 * s, '#9db4d8', { wrap: inner - 48 * s, bold: false });
      cy += 32 * s + body.height + 14 * s;
    };
    row('ARMA', info.main.name, info.main.text, 0x3dd9ff);
    if (exclusive) row('EXCLUSIVA', exclusive.name, exclusive.text, 0xb06bff);
    row(`ULTI · ${info.ultimate.cooldown}`, info.ultimate.name, info.ultimate.text, 0xffcf4a);

    const levels = META_UPGRADES.reduce((sum, upgrade) => sum + saveData.levelOf(upgrade.id, def.id), 0);
    this.text(x + pad, cy + 2 * s, `Mejoras permanentes: ${levels} ${levels === 1 ? 'nivel' : 'niveles'}`, 12 * s, '#9db4d8', { bold: false });
    cy += 30 * s;

    // El panel se dibuja al final, detrás de todo, con el alto real del contenido.
    const h = cy - y;
    const back = this.add.graphics().setDepth(-1);
    back.fillStyle(0x0a1224, 0.78).fillRoundedRect(x, y, w, h, 18 * s);
    back.lineStyle(2, 0x8cb4ff, 0.25).strokeRoundedRect(x, y, w, h, 18 * s);
    this.dynamicObjects.push(back);
    panel.setDepth(0);
  }

  private startGame(): void {
    this.scene.start(SCENE_KEYS.game);
  }
}
