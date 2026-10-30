import { audio } from '../audio/AudioManager';
import Phaser from 'phaser';
import { CHARACTER_REGISTRY } from '../characters/registry';
import { RARITY_INFO, RARITY_ORDER } from '../characters/rarity';
import type { Rarity } from '../characters/CharacterDefinition';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { saveData } from '../meta/saveData';
import { drawHeroCard } from '../ui/heroCard';
import { UiButton } from '../ui/UiButton';
import { textStyle, uiScale } from '../ui/uiLayout';

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

/** Elegir héroes desbloqueados y reclutar uno aleatorio de los que faltan. */
export class CharacterScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private recruitButton!: UiButton;
  private goldLabel!: Phaser.GameObjects.Text;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private revealObjects: Phaser.GameObjects.GameObject[] = [];
  private revealActive = false;

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
    this.cameras.main.setBackgroundColor('#0e1a12');
    audio.play('menu');
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'PERSONAJES', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.hint = this.add.text(0, 0, 'Elegí entre los héroes que ya desbloqueaste. Los demás se reclutan al azar.', textStyle(11, '#9fb3bf')).setOrigin(0.5);
    this.backButton = new UiButton(this, 'VOLVER [ESC]', 16, () => {
      if (!this.revealActive) this.scene.start(SCENE_KEYS.menu);
    }, ['ESC']);
    this.recruitButton = new UiButton(this, 'RECLUTAR ALEATORIO · 2000', 14, () => this.recruitRandomHero(), [], true);
    this.goldLabel = this.add.text(0, 0, '', textStyle(14, '#ffd24a')).setOrigin(1, 0);

    if (!this.anims.exists(FURY_ANIMATION)) {
      this.anims.create({
        key: FURY_ANIMATION,
        frames: FURY_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      });
    }

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
      const footer = chosen
        ? { text: 'ELEGIDO', color: '#ffe272' }
        : unlocked
          ? { text: 'TOCÁ PARA ELEGIR', color: '#9fb3bf' }
          : { text: 'RECLUTAMIENTO ALEATORIO', color: '#ffd24a' };
      const objects = drawHeroCard(this, definition, x, y, cardW, cardH, {
        locked: !unlocked,
        highlighted: chosen,
        footer,
      });
      const zone = this.add.zone(x, y, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: unlocked && !this.revealActive });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.revealActive) return;
        if (saveData.isUnlocked(definition.id)) {
          if (saveData.selectedCharacter !== definition.id) saveData.select(definition.id);
          this.render();
        }
      });
      this.cardObjects.push(...objects, zone);
    });

    const lockedCount = entries.filter(({ definition }) => !saveData.isUnlocked(definition.id)).length;
    const canRecruit = lockedCount > 0 && saveData.gold >= RANDOM_HERO_PRICE && !this.revealActive;
    this.recruitButton.setLabel(lockedCount === 0 ? 'TODOS DESBLOQUEADOS' : 'RECLUTAR ALEATORIO · 2000');
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
