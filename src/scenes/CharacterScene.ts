import { audio } from '../audio/AudioManager';
import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { RARITY_INFO, RARITY_ORDER } from '../characters/rarity';
import type { Rarity } from '../characters/CharacterDefinition';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { HERO_SHOP } from '../config/gameplayConfig';

import { SCENE_KEYS } from '../config/sceneKeys';
import { saveData } from '../meta/saveData';
import { drawHeroCard } from '../ui/heroCard';
import { UiButton } from '../ui/UiButton';
import { textStyle, uiScale } from '../ui/uiLayout';

const RANDOM_HERO_PRICE = 2000;
const RARITY_CHANCES: Record<Rarity, number> = { common: 80.5, rare: 15, epic: 4, legendary: 0.5 };

/** Elegir héroes, comprarlos individualmente o reclutar uno aleatorio según su rareza. */
export class CharacterScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private recruitButton!: UiButton;
  private goldLabel!: Phaser.GameObjects.Text;
  private revealObjects: Phaser.GameObjects.GameObject[] = [];
  private revealActive = false;
  /** Héroe al que se le tocó una vez "comprar" y espera la confirmación. */
  private pendingBuy: string | null = null;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.characters);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    audio.play('menu');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'PERSONAJES', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.hint = this.add.text(0, 0, 'Elegí héroes desbloqueados, comprá uno específico o reclutá al azar.', textStyle(11, '#9fb3bf')).setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => {
      if (!this.revealActive) this.scene.start(SCENE_KEYS.menu);
    }, ['ESC']);
    this.recruitButton = new UiButton(this, 'RECLUTAR ALEATORIO · 2000', 14, () => this.recruitRandomHero(), [], true);
    this.goldLabel = this.add.text(0, 0, '', textStyle(14, '#ffd24a')).setOrigin(1, 0);

    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      this.clearReveal();
    });
  }

  update(_time: number, delta: number): void {
    this.ground.tilePositionX += 4 * (delta / 1000);
    this.ground.tilePositionY += 2 * (delta / 1000);
  }

  private render(): void {
    const { width, height } = this.scale;
    const ui = uiScale(width, height);
    const portrait = width < height;

    const zoom = Math.max(2, computeZoom(width, height));
    this.ground.setSize(width, height).setTileScale(zoom);
    this.shade.clear().fillStyle(0x05080c, 0.72).fillRect(0, 0, width, height);
    this.title.setFontSize(Math.max(18, Math.round(portrait ? Math.min(width * 0.07, 34) : 8 * ui))).setPosition(width / 2, height * 0.07);
    this.hint.setFontSize(Math.max(10, Math.round(3.2 * ui))).setPosition(width / 2, height * (portrait ? 0.125 : 0.15));

    const size = Math.max(12, Math.round(3.6 * ui));
    this.backButton.setFontSize(size).setEnabled(!this.revealActive);
    this.goldLabel.setText(`ORO: ${saveData.gold}`).setFontSize(Math.max(12, Math.round(4 * ui))).setPosition(width - 3 * ui, 3 * ui);

    for (const object of this.cardObjects) object.destroy();
    this.cardObjects = [];

    const entries = Object.values(CHARACTER_REGISTRY);
    const columns = portrait ? 2 : entries.length;
    const rows = Math.ceil(entries.length / columns);
    const cardGap = Math.round(Math.max(6, 2.2 * ui));
    const areaX = width * 0.04;
    const areaW = width * 0.92;
    const areaY = height * (portrait ? 0.17 : 0.2);
    const areaH = height * 0.86 - areaY;
    const cardW = (areaW - cardGap * (columns - 1)) / columns;
    const cardH = Math.min((areaH - cardGap * (rows - 1)) / rows, portrait ? 999 : 340);

    entries.forEach(({ definition }, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = areaX + column * (cardW + cardGap);
      const y = areaY + row * (cardH + cardGap);
      const unlocked = saveData.isUnlocked(definition.id);
      const chosen = saveData.selectedCharacter === definition.id;
      const price = HERO_SHOP.prices[definition.rarity];
      const canAfford = saveData.gold >= price;
      const confirming = this.pendingBuy === definition.id;
      const footer = chosen
        ? { text: 'ELEGIDO', color: '#ffe272' }
        : unlocked
          ? { text: 'TOCÁ PARA ELEGIR', color: '#9fb3bf' }
          : confirming
            ? { text: `¿COMPRAR POR ${price}?\nTOCÁ OTRA VEZ`, color: '#7dffb0' }
            : canAfford
              ? { text: `COMPRAR · ${price} DE ORO`, color: '#ffd24a' }
              : { text: `${price} DE ORO (te faltan ${price - saveData.gold})`, color: '#ff8a8a' };
      const objects = drawHeroCard(this, definition, x, y, cardW, cardH, { locked: !unlocked, highlighted: chosen || confirming, footer });
      const zone = this.add.zone(x, y, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: !chosen && !this.revealActive });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!this.revealActive) this.onCardTap(definition.id, price);
      });
      this.cardObjects.push(...objects, zone);
    });

    const lockedCount = entries.filter(({ definition }) => !saveData.isUnlocked(definition.id)).length;
    const canRecruit = lockedCount > 0 && saveData.gold >= RANDOM_HERO_PRICE && !this.revealActive;
    this.recruitButton.setLabel(lockedCount === 0 ? 'TODOS DESBLOQUEADOS' : `RECLUTAR ALEATORIO · ${RANDOM_HERO_PRICE}`);
    this.recruitButton.setFontSize(Math.max(11, Math.round((portrait ? 3.1 : 3.5) * ui)));
    this.recruitButton.setEnabled(canRecruit).setAlpha(canRecruit || lockedCount === 0 ? 1 : 0.5);
    if (portrait) {
      this.recruitButton.setPosition(width / 2, height * 0.905);
      this.backButton.setPosition(width / 2, height * 0.965);
    } else {
      this.recruitButton.setPosition(width * 0.36, height * 0.94);
      this.backButton.setPosition(width * 0.78, height * 0.94);
    }
  }

  private recruitRandomHero(): void {
    if (this.revealActive || saveData.gold < RANDOM_HERO_PRICE) return;
    const locked = Object.values(CHARACTER_REGISTRY)
      .map(({ definition }) => definition)
      .filter((definition) => !saveData.isUnlocked(definition.id));
    if (locked.length === 0) return;

    // Se sortea primero la rareza y después un héroe de esa categoría.
    // Si una rareza se queda sin héroes disponibles, su peso se redistribuye entre las restantes.
    const availableRarities = RARITY_ORDER.filter((rarity) => locked.some((hero) => hero.rarity === rarity));
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
    this.render();
    this.showRecruitmentReveal(chosen.displayName, chosen.rarity);
  }

  private showRecruitmentReveal(heroName: string, rarity: Rarity): void {
    const { width, height } = this.scale;
    const info = RARITY_INFO[rarity];
    const overlay = this.add.graphics().setDepth(1000);
    overlay.fillStyle(0x02050a, 0.94).fillRect(0, 0, width, height);
    overlay.fillStyle(0x0d1b29, 1).fillRoundedRect(width * 0.12, height * 0.2, width * 0.76, height * 0.6, 14);
    overlay.lineStyle(4, info.color, 1).strokeRoundedRect(width * 0.12, height * 0.2, width * 0.76, height * 0.6, 14);
    const title = this.add.text(width / 2, height * 0.36, '¡HÉROE RECLUTADO!', {
      ...textStyle(Math.max(18, Math.round(7 * uiScale(width, height))), '#ffffff'),
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1001);
    const name = this.add.text(width / 2, height * 0.49, heroName.toUpperCase(), {
      ...textStyle(Math.max(22, Math.round(10 * uiScale(width, height))), '#ffffff'),
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1001);
    const tag = this.add.text(width / 2, height * 0.61, info.label, {
      ...textStyle(Math.max(18, Math.round(7 * uiScale(width, height))), info.css),
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1001);
    const hint = this.add.text(width / 2, height * 0.72, 'NUEVO HÉROE DESBLOQUEADO', {
      ...textStyle(Math.max(11, Math.round(3.5 * uiScale(width, height))), '#d7e6ef'),
      align: 'center',
    }).setOrigin(0.5).setDepth(1001);
    this.revealObjects.push(overlay, title, name, tag, hint);
    this.time.delayedCall(3000, () => {
      this.clearReveal();
      this.revealActive = false;
      this.render();
    });
  }

  private clearReveal(): void {
    for (const object of this.revealObjects) object.destroy();
    this.revealObjects = [];
  }

  private onCardTap(id: string, price: number): void {
    if (saveData.isUnlocked(id)) {
      this.pendingBuy = null;
      if (saveData.selectedCharacter !== id) saveData.select(id);
    } else if (saveData.gold < price) {
      this.pendingBuy = null;
    } else if (this.pendingBuy !== id) {
      this.pendingBuy = id;
    } else {
      this.pendingBuy = null;
      if (saveData.buyHero(id, price)) saveData.select(id);
    }
    this.render();
  }
}
