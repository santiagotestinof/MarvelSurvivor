import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { SCENE_KEYS } from '../config/sceneKeys';
import { EVOLUTION } from '../config/gameplayConfig';
import { MAIN_WEAPON_MAX_LEVEL, MAIN_WEAPONS } from '../progression/mainWeapon';
import { EVOLUTIONS, UPGRADES } from '../progression/upgrades';
import { HERO_WEAPONS, HERO_WEAPON_MAX_LEVEL } from '../systems/HeroWeapons';
import { drawMenuBackdrop } from '../ui/menuBackdrop';
import { PanelButton } from '../ui/PanelButton';
import { TITLE_FONT, UI_FONT } from '../ui/uiLayout';

/** Easter egg: el libro secreto. Muestra la combinación que pide la evolución de cada héroe. */
export class BookScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Graphics;
  private backButton!: PanelButton;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.book);
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

  private render(): void {
    for (const object of this.dynamicObjects) object.destroy();
    this.dynamicObjects = [];
    const { width, height } = this.scale;
    const portrait = width < height * 0.95;
    drawMenuBackdrop(this.backdrop, width, height, 0x7a5410, 0.5, 0.4);

    const designW = portrait ? 720 : 1280;
    const designH = portrait ? 1280 : 720;
    const s = Math.min(width / designW, height / designH);
    const ox = (width - designW * s) / 2;
    const oy = (height - designH * s) / 2;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;

    this.backButton.setBox(44 * s, 44 * s, 24 * s).setPosition(X(48 + 22), Y(32 + 22));
    this.text(X(48 + 62), Y(portrait ? 30 : 28), 'LIBRO DE EVOLUCIONES', (portrait ? 34 : 44) * s, '#ffffff', { title: true }).setLetterSpacing(3 * s);
    this.text(
      X(48 + 62),
      Y(portrait ? 76 : 80),
      `Cada evolución pide una pasiva tomada ${EVOLUTION.passivePicks} veces, el arma principal y la exclusiva al nivel máximo.`,
      13 * s,
      '#9db4d8',
      { bold: false, wrap: (designW - 48 - 62 - 48) * s },
    );

    const listX = 48;
    const listW = designW - 96;
    const top = portrait ? 140 : 124;
    const bottom = designH - 32;
    const gap = 10;
    const rowH = Math.min(portrait ? 150 : 90, (bottom - top - gap * (EVOLUTIONS.length - 1)) / EVOLUTIONS.length);

    EVOLUTIONS.forEach((evo, index) => {
      const x = X(listX);
      const y = Y(top + index * (rowH + gap));
      const w = listW * s;
      const h = rowH * s;
      const entry = CHARACTER_REGISTRY[evo.hero];
      const hero = entry?.definition.displayName ?? evo.hero;
      const main = entry ? MAIN_WEAPONS[entry.definition.stats.attack.kind].name : '?';
      const exclusive = HERO_WEAPONS[evo.hero]?.name ?? '?';
      const passive = UPGRADES.find((u) => u.id === evo.requires)?.name ?? evo.requires;

      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(x, y + 4 * s, w, h, 16 * s);
      g.fillStyle(0x0a1224, 0.9).fillRoundedRect(x, y, w, h, 16 * s);
      g.lineStyle(1.5, 0xffcf4a, 0.4).strokeRoundedRect(x, y, w, h, 16 * s);
      g.fillStyle(0xffcf4a, 0.9).fillRoundedRect(x, y + 10 * s, 5 * s, h - 20 * s, 2.5 * s);
      this.dynamicObjects.push(g);

      const tx = x + 24 * s;
      const wrap = w - 44 * s;
      const name = this.text(tx, y + h * 0.1, `${hero.toUpperCase()}  →  ${evo.name.toUpperCase()}`, 19 * s, '#ffcf4a', { title: true });
      name.setLetterSpacing(1 * s);
      const recipe = this.text(tx, y + h * 0.1 + name.height + 2 * s, `${passive} ×${EVOLUTION.passivePicks} + ${main} nv ${MAIN_WEAPON_MAX_LEVEL} + ${exclusive} nv ${HERO_WEAPON_MAX_LEVEL}`, 12 * s, '#5ee0a0', { wrap });
      this.text(tx, recipe.y + recipe.height + 2 * s, evo.text, 11 * s, '#9db4d8', { bold: false, wrap });
    });
  }
}
