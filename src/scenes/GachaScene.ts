import Phaser from 'phaser';
import { CHARACTER_REGISTRY, GACHA_POOL } from '../characters/registry';
import { RARITY_INFO, RARITY_ORDER } from '../characters/rarity';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { GACHA } from '../config/gameplayConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { hasEverything, pull, pullsUntilGuarantee, type PullResult } from '../meta/gacha';
import { saveData } from '../meta/saveData';
import { drawHeroCard } from '../ui/heroCard';
import { UiButton } from '../ui/UiButton';
import { textStyle, uiScale } from '../ui/uiLayout';

const GOLD_COLOR = '#ffd24a';

/** Gacha: se gasta oro para invocar héroes; cada uno tiene una rareza y los repetidos devuelven oro. */
export class GachaScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private emptyText!: Phaser.GameObjects.Text;
  private pullButton!: UiButton;
  private multiButton!: UiButton;
  private backButton!: UiButton;
  private charactersButton!: UiButton;
  /** Resultado de la última invocación (se redibuja al cambiar el tamaño de pantalla). */
  private results: PullResult[] = [];
  private resultObjects: Phaser.GameObjects.GameObject[] = [];
  /** Si es true, las tarjetas aparecen con animación (solo justo después de invocar). */
  private animate = false;

  constructor() {
    super(SCENE_KEYS.gacha);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    this.results = [];
    this.resultObjects = [];
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'INVOCAR HÉROES', textStyle(28, '#f5c518')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#7a1d12', 0, true, true);
    this.goldText = this.add.text(0, 0, '', textStyle(16, GOLD_COLOR)).setOrigin(0.5);
    this.info = this.add.text(0, 0, '', { ...textStyle(11, '#9fb3bf'), align: 'center' }).setOrigin(0.5);
    this.emptyText = this.add.text(0, 0, '', { ...textStyle(14, '#d7e6ef'), align: 'center' }).setOrigin(0.5);

    this.pullButton = new UiButton(this, 'INVOCAR', 16, () => this.doPull(1), ['ENTER', 'SPACE']);
    this.multiButton = new UiButton(this, 'x10', 16, () => this.doPull(GACHA.multiPulls), ['X']);
    this.charactersButton = new UiButton(this, 'PERSONAJES [P]', 16, () => this.scene.start(SCENE_KEYS.characters), ['P']);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => this.scene.start(SCENE_KEYS.menu), ['ESC']);

    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this));
  }

  update(_time: number, delta: number): void {
    this.ground.tilePositionX += 4 * (delta / 1000);
    this.ground.tilePositionY += 2 * (delta / 1000);
  }

  private doPull(count: number): void {
    const results = pull(count);
    if (!results) return;
    this.results = results;
    this.animate = true;
    this.render();
  }

  /** "Común 55%  ·  Raro 30% ..." (solo rarezas que tienen héroes en el gacha). */
  private oddsText(): string {
    const present = RARITY_ORDER.filter((rarity) => GACHA_POOL.some((id) => CHARACTER_REGISTRY[id].definition.rarity === rarity));
    const total = present.reduce((sum, rarity) => sum + GACHA.weights[rarity], 0);
    return present.map((rarity) => `${RARITY_INFO[rarity].label} ${Math.round((GACHA.weights[rarity] / total) * 100)}%`).join('  ·  ');
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

    const left = pullsUntilGuarantee();
    const guarantee = hasEverything()
      ? '¡Ya tenés todos los héroes! Los repetidos devuelven oro.'
      : `Garantía: héroe épico o mejor en ${left} ${left === 1 ? 'tirada' : 'tiradas'} · Repetidos devuelven oro`;
    this.info
      .setText(`${this.oddsText()}\n${guarantee}`)
      .setFontSize(Math.max(10, Math.round(3 * ui)))
      .setWordWrapWidth(width * 0.94)
      .setPosition(cx, height * (portrait ? 0.185 : 0.225));

    this.layoutButtons(width, height, ui, portrait);
    this.renderResults(width, height, ui, portrait);
  }

  private layoutButtons(width: number, height: number, ui: number, portrait: boolean): void {
    const size = Math.max(12, Math.round(3.8 * ui));
    this.pullButton.setLabel(`INVOCAR (${GACHA.pullCost})`);
    this.multiButton.setLabel(`x${GACHA.multiPulls} (${GACHA.pullCost * GACHA.multiPulls})`);
    const canOne = saveData.gold >= GACHA.pullCost;
    const canMulti = saveData.gold >= GACHA.pullCost * GACHA.multiPulls;
    this.pullButton.setEnabled(canOne).setAlpha(canOne ? 1 : 0.45);
    this.multiButton.setEnabled(canMulti).setAlpha(canMulti ? 1 : 0.45);

    const rows = portrait ? [[this.pullButton, this.multiButton], [this.charactersButton, this.backButton]] : [[this.pullButton, this.multiButton, this.charactersButton, this.backButton]];
    const gap = Math.round(size * 0.8);
    rows.forEach((row, rowIndex) => {
      for (const button of row) button.setFontSize(size);
      const total = row.reduce((sum, button) => sum + button.width, 0) + gap * (row.length - 1);
      let x = width / 2 - total / 2;
      const y = portrait ? height * (0.87 + rowIndex * 0.075) : height * 0.93;
      for (const button of row) {
        button.setPosition(x + button.width / 2, y);
        x += button.width + gap;
      }
    });
  }

  private renderResults(width: number, height: number, ui: number, portrait: boolean): void {
    this.tweens.killTweensOf(this.resultObjects);
    for (const object of this.resultObjects) object.destroy();
    this.resultObjects = [];

    const areaW = width * 0.92;
    const areaY = height * (portrait ? 0.24 : 0.29);
    const areaH = height * (portrait ? 0.84 : 0.85) - areaY;
    const n = this.results.length;

    this.emptyText
      .setVisible(n === 0)
      .setText('Gastá oro para invocar héroes nuevos.\nRompé cajas y rocas y vencé enemigos para juntar más.')
      .setFontSize(Math.max(11, Math.round(3.6 * ui)))
      .setWordWrapWidth(areaW)
      .setPosition(width / 2, areaY + areaH / 2);
    if (n === 0) return;

    const columns = n === 1 ? 1 : portrait ? 2 : 5;
    const rows = Math.ceil(n / columns);
    const gap = Math.round(Math.max(6, 2 * ui));
    let cardW = (areaW - gap * (columns - 1)) / columns;
    let cardH = (areaH - gap * (rows - 1)) / rows;
    if (n === 1) {
      cardW = Math.min(cardW, areaH * 0.7, 300);
      cardH = Math.min(cardH, 360);
    }
    const totalW = cardW * columns + gap * (columns - 1);
    const totalH = cardH * rows + gap * (rows - 1);
    const startX = width / 2 - totalW / 2;
    const startY = areaY + (areaH - totalH) / 2;

    this.results.forEach((result, index) => {
      const x = startX + (index % columns) * (cardW + gap);
      const y = startY + Math.floor(index / columns) * (cardH + gap);
      const def = CHARACTER_REGISTRY[result.id].definition;
      const objects = drawHeroCard(this, def, x, y, cardW, cardH, {
        showStats: n === 1,
        footer: result.isNew
          ? { text: '¡NUEVO!', color: '#ffe272' }
          : { text: `Repetido +${result.refund} oro`, color: GOLD_COLOR },
      });
      this.resultObjects.push(...objects);

      if (!this.animate) return;
      // Cada tarjeta "salta" en su turno; las épicas y legendarias con un destello.
      const cx = x + cardW / 2;
      const cy = y + cardH / 2;
      for (const object of objects) {
        const target = object as Phaser.GameObjects.GameObject & { setAlpha: (a: number) => unknown; alpha: number };
        const finalAlpha = target.alpha;
        target.setAlpha(0);
        this.tweens.add({ targets: target, alpha: finalAlpha, duration: 220, delay: index * 140 });
      }
      if (result.rarity === 'epic' || result.rarity === 'legendary') {
        const flash = this.add.circle(cx, cy, Math.min(cardW, cardH) * 0.55, RARITY_INFO[result.rarity].color, 0.5).setDepth(5).setAlpha(0);
        this.resultObjects.push(flash);
        this.tweens.add({ targets: flash, alpha: { from: 0.7, to: 0 }, scale: { from: 0.6, to: 1.4 }, duration: 500, delay: index * 140 });
      }
    });
    this.animate = false;
  }
}
