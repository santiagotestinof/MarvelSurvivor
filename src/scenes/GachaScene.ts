import Phaser from 'phaser';
import { CHARACTER_REGISTRY, GACHA_POOL } from '../characters/registry';
import { RARITY_INFO, RARITY_ORDER } from '../characters/rarity';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { GACHA } from '../config/gameplayConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { Direction } from '../core/direction';
import { animationKey } from '../systems/AnimationSystem';
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
  /** Mientras la máquina saca cápsulas no se puede invocar de nuevo. */
  private busy = false;
  private machine: Phaser.GameObjects.Container | null = null;
  private machineGeo = { cx: 0, cy: 0, s: 1, groundY: 0 };
  /** Objetos temporales de la animación (cápsula, héroe cayendo, partículas). */
  private fxObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.gacha);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');
    this.results = [];
    this.resultObjects = [];
    this.fxObjects = [];
    this.machine = null;
    this.busy = false;
    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.shade = this.add.graphics();
    this.title = this.add.text(0, 0, 'INVOCAR HÉROES', textStyle(28, '#ffffff')).setOrigin(0.5);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.goldText = this.add.text(0, 0, '', textStyle(16, GOLD_COLOR)).setOrigin(0.5);
    this.info = this.add.text(0, 0, '', { ...textStyle(11, '#9fb3bf'), align: 'center' }).setOrigin(0.5);
    this.emptyText = this.add.text(0, 0, '', { ...textStyle(14, '#d7e6ef'), align: 'center' }).setOrigin(0.5);

    this.pullButton = new UiButton(this, 'INVOCAR', 16, () => this.doPull(1), ['ENTER', 'SPACE'], true);
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

  private async doPull(count: number): Promise<void> {
    if (this.busy) return;
    const results = pull(count);
    if (!results) return;
    // El oro y los héroes ya se guardaron: lo que sigue es solo la animación de la máquina.
    this.busy = true;
    this.results = [];
    this.render();
    for (let i = 0; i < results.length; i++) {
      await this.playPull(results[i], results.length > 1);
      if (!this.sys.isActive()) return;
    }
    this.results = results;
    this.animate = true;
    this.busy = false;
    this.render();
  }

  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** Una tirada: la máquina tiembla, cae la cápsula, se abre y el héroe cae al piso. */
  private async playPull(result: PullResult, fast: boolean): Promise<void> {
    const machine = this.machine;
    if (!machine) return;
    const { cx, cy, s, groundY } = this.machineGeo;
    const rarity = RARITY_INFO[result.rarity];
    const def = CHARACTER_REGISTRY[result.id].definition;
    const baseX = machine.x;

    await this.tweenAsync({ targets: machine, x: baseX + 5 * s, duration: fast ? 40 : 55, yoyo: true, repeat: fast ? 4 : 8 });
    machine.x = baseX;

    // Cápsula: la mitad de arriba tiene el color de la rareza.
    const r = 9 * s;
    const capsule = this.add.graphics().setDepth(20);
    capsule.fillStyle(rarity.color, 1).beginPath().arc(0, 0, r, Math.PI, 0, false).closePath().fillPath();
    capsule.fillStyle(0xf2f2f2, 1).beginPath().arc(0, 0, r, 0, Math.PI, false).closePath().fillPath();
    capsule.lineStyle(2, 0x15151a, 1).strokeCircle(0, 0, r);
    capsule.fillStyle(0xffffff, 0.5).fillRect(-r * 0.6, -r * 0.55, r * 0.5, r * 0.25);
    capsule.setPosition(cx, cy + 26 * s).setScale(0.3);
    this.fxObjects.push(capsule);
    await this.tweenAsync({ targets: capsule, scale: 1, duration: 120 });
    await this.tweenAsync({ targets: capsule, y: groundY, duration: fast ? 380 : 560, ease: 'Bounce.Out' });
    await this.wait(fast ? 80 : 320);

    // Se abre: destello y partículas del color de la rareza.
    this.tweens.add({ targets: capsule, scale: 2.2, alpha: 0, duration: 220, onComplete: () => capsule.destroy() });
    this.burst(cx, groundY, rarity.color, s, fast ? 8 : 16);
    if (!fast && (result.rarity === 'epic' || result.rarity === 'legendary')) {
      this.cameras.main.flash(350, (rarity.color >> 16) & 255, (rarity.color >> 8) & 255, rarity.color & 255);
    }

    // El héroe cae desde arriba y rebota al llegar al piso.
    const heroScale = Math.max(3, Math.round(s * 1.4));
    const hero = this.add
      .sprite(cx, -def.frame.height * heroScale, def.sheets.idle.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(heroScale)
      .setDepth(30)
      .play(animationKey(def.id, 'idle', Direction.Down));
    const label = this.add
      .text(cx, groundY + 8, `${def.displayName.toUpperCase()}\n${result.isNew ? '¡NUEVO!' : `Repetido +${result.refund} oro`}`, {
        ...textStyle(Math.max(11, Math.round(5 * s)), result.isNew ? '#ffe272' : GOLD_COLOR),
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(31)
      .setAlpha(0);
    this.fxObjects.push(hero, label);
    await this.tweenAsync({ targets: hero, y: groundY + 6, duration: fast ? 380 : 700, ease: 'Bounce.Out' });
    this.tweens.add({ targets: label, alpha: 1, duration: 150 });
    await this.wait(fast ? 330 : 1100);
    await this.tweenAsync({ targets: [hero, label], alpha: 0, duration: fast ? 120 : 250 });
    hero.destroy();
    label.destroy();
  }

  /** Partículas que salen disparadas desde (x, y). */
  private burst(x: number, y: number, color: number, s: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dot = this.add.circle(x, y, Math.max(3, 3 * s), i % 2 ? color : 0xffffff, 1).setDepth(25);
      this.fxObjects.push(dot);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 34 * s,
        y: y + Math.sin(angle) * 22 * s - 8 * s,
        alpha: 0,
        scale: 0.2,
        duration: 480,
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** La máquina de gacha: cúpula con cápsulas, cuerpo rojo con detalles dorados y una salida abajo. Origen = centro del cuerpo. */
  private buildMachine(cx: number, cy: number, s: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const colors = [0xc8202a, 0x37b6ff, 0xf5c518, 0x3ddc84, 0xb44cff, 0xff7ac8];
    g.fillStyle(0x15151a, 1).fillRoundedRect(-52 * s, 40 * s, 104 * s, 12 * s, 4 * s);
    g.fillStyle(0x15151a, 1).fillRoundedRect(-47 * s, -52 * s, 94 * s, 96 * s, 8 * s);
    g.fillStyle(0xc4161c, 1).fillRoundedRect(-44 * s, -49 * s, 88 * s, 90 * s, 7 * s);
    g.fillStyle(0xea3b30, 1).fillRoundedRect(-44 * s, -49 * s, 88 * s, 14 * s, 7 * s);
    g.lineStyle(Math.max(2, 2 * s), 0xf5c518, 1).strokeRoundedRect(-44 * s, -49 * s, 88 * s, 90 * s, 7 * s);
    g.fillStyle(0xcfe9ff, 0.28).fillCircle(0, -86 * s, 40 * s);
    const spots = [[-22, -76], [-6, -70], [14, -74], [26, -62], [-25, -68], [-14, -96], [6, -92], [24, -88], [-2, -112]];
    spots.forEach(([x, y], i) => {
      g.fillStyle(colors[i % colors.length], 1).fillCircle(x * s, y * s, 8 * s);
      g.fillStyle(0xffffff, 0.55).fillCircle((x - 2.5) * s, (y - 2.5) * s, 2.4 * s);
    });
    g.lineStyle(Math.max(2, 2 * s), 0xe9fcff, 0.8).strokeCircle(0, -86 * s, 40 * s);
    g.fillStyle(0xf5c518, 1).fillRoundedRect(-42 * s, -54 * s, 84 * s, 7 * s, 3 * s);
    g.fillStyle(0x15151a, 1).fillRoundedRect(-34 * s, -30 * s, 68 * s, 20 * s, 4 * s);
    g.fillStyle(0x15151a, 1).fillRoundedRect(-8 * s, 4 * s, 16 * s, 4 * s, 2 * s);
    g.fillStyle(0xf5c518, 1).fillCircle(-24 * s, 8 * s, 8 * s);
    g.fillStyle(0xb8870b, 1).fillRect(-26 * s, 2 * s, 4 * s, 12 * s);
    g.fillStyle(0x15151a, 1).fillRoundedRect(-24 * s, 16 * s, 48 * s, 26 * s, 5 * s);
    g.fillStyle(0x05080c, 1).fillRoundedRect(-20 * s, 20 * s, 40 * s, 22 * s, 4 * s);
    const sign = this.add.text(0, -20 * s, 'GACHA', textStyle(Math.max(10, 12 * s), '#f5c518')).setOrigin(0.5);
    return this.add.container(cx, cy, [g, sign]).setDepth(10);
  }

  private clearFx(): void {
    for (const object of this.fxObjects) if (object.active) object.destroy();
    this.fxObjects = [];
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
    this.renderMachine(width, height, ui, portrait);
  }

  private layoutButtons(width: number, height: number, ui: number, portrait: boolean): void {
    const size = Math.max(12, Math.round(3.8 * ui));
    this.pullButton.setLabel(`INVOCAR (${GACHA.pullCost})`);
    this.multiButton.setLabel(`x${GACHA.multiPulls} (${GACHA.pullCost * GACHA.multiPulls})`);
    const canOne = !this.busy && saveData.gold >= GACHA.pullCost;
    const canMulti = !this.busy && saveData.gold >= GACHA.pullCost * GACHA.multiPulls;
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

  /** La máquina se ve cuando todavía no hay resultados y mientras se hace la animación de la tirada. */
  private renderMachine(width: number, height: number, ui: number, portrait: boolean): void {
    this.machine?.destroy();
    this.machine = null;
    this.clearFx();
    const visible = this.busy || this.results.length === 0;
    this.emptyText.setVisible(false);
    if (!visible) return;

    const areaY = height * (portrait ? 0.24 : 0.29);
    const areaH = height * (portrait ? 0.84 : 0.85) - areaY;
    const hintSize = Math.max(11, Math.round(3.4 * ui));
    const s = Math.max(0.8, Math.min((areaH - hintSize * 3.2) / 196, (width * 0.7) / 104));
    const cx = width / 2;
    const cy = areaY + 132 * s;
    this.machineGeo = { cx, cy, s, groundY: cy + 56 * s };
    this.machine = this.buildMachine(cx, cy, s);

    this.emptyText
      .setVisible(!this.busy)
      .setText('Gastá oro para invocar héroes nuevos.\nRompé cajas y rocas y vencé enemigos para juntar más.')
      .setFontSize(hintSize)
      .setWordWrapWidth(width * 0.9)
      .setPosition(cx, cy + 56 * s + hintSize * 2.4);
  }
}
