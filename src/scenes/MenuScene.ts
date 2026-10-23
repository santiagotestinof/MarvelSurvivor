import Phaser from 'phaser';
import { ironManDefinition } from '../characters/ironman/ironManDefinition';
import { TEXTURES } from '../config/assetKeys';
import { computeZoom } from '../config/cameraConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { ROUND } from '../config/gameplayConfig';
import { Direction } from '../core/direction';
import { DRONE, enemyAnimationKey } from '../enemies/enemyKinds';
import { animationKey } from '../systems/AnimationSystem';
import { UiButton } from '../ui/UiButton';
import { saveData } from '../meta/saveData';
import { drawPanel, formatTime, textStyle, uiScale } from '../ui/uiLayout';

const DRONE_COUNT = 6;

interface BackgroundDrone {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
}

/** Menú principal: fondo animado, título, héroe con sus stats, botón para jugar e instrucciones. */
export class MenuScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Graphics;
  private drones: BackgroundDrone[] = [];
  private title!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private platform!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Sprite;
  private heroName!: Phaser.GameObjects.Text;
  private heroStats!: Phaser.GameObjects.Text;
  private playButton!: UiButton;
  private shopButton!: UiButton;
  private goldLabel!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Graphics;
  private help!: Phaser.GameObjects.Text;
  private version!: Phaser.GameObjects.Text;

  /** Posiciones base (el update les suma el flote). */
  private titleY = 0;
  private heroY = 0;
  private ui = 2;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');

    this.ground = this.add.tileSprite(0, 0, 10, 10, TEXTURES.ground).setOrigin(0);
    this.drones = [];
    for (let i = 0; i < DRONE_COUNT; i++) {
      const sprite = this.add.sprite(0, 0, DRONE.texture, 0).setAlpha(0.45).play(enemyAnimationKey(DRONE));
      sprite.anims.setProgress(Math.random());
      const angle = Math.random() * Math.PI * 2;
      this.drones.push({ sprite, vx: Math.cos(angle) * 14, vy: Math.sin(angle) * 14 });
    }
    this.shade = this.add.graphics();

    this.title = this.add.text(0, 0, 'MARVEL SURVIVORS', textStyle(40, '#f5c518')).setOrigin(0.5);
    this.title.setShadow(0, 6, '#7a1d12', 0, true, true);
    this.tagline = this.add.text(0, 0, 'Resistí la invasión de drones', textStyle(14, '#d7e6ef')).setOrigin(0.5);

    this.platform = this.add.graphics();
    this.hero = this.add
      .sprite(0, 0, ironManDefinition.sheets.idle.textureKey, 0)
      .setOrigin(0.5, ironManDefinition.origin.y)
      .play(animationKey(ironManDefinition.id, 'idle', Direction.Down));
    const { stats } = ironManDefinition;
    this.heroName = this.add.text(0, 0, ironManDefinition.displayName.toUpperCase(), textStyle(16, '#ffffff')).setOrigin(0.5);
    this.heroStats = this.add
      .text(0, 0, `VIDA ${stats.maxHealth}   VELOCIDAD ${stats.moveSpeed}   DAÑO ${stats.attack.damage}`, textStyle(11, '#ffd27a'))
      .setOrigin(0.5);

    this.playButton = new UiButton(this, 'JUGAR', 20, () => this.startGame(), ['ENTER', 'SPACE']);
    this.shopButton = new UiButton(this, 'MEJORAS', 20, () => this.scene.start(SCENE_KEYS.shop), ['M']);
    this.goldLabel = this.add.text(0, 0, '', textStyle(14, '#ffd24a')).setOrigin(1, 0);

    this.panel = this.add.graphics();
    const touch = this.sys.game.device.input.touch;
    const lines = [
      `Sobreviví ${formatTime(ROUND.durationMs)} y derrotá al jefe.`,
      touch ? 'Mover: deslizá el dedo en la mitad izquierda.' : 'Mover: WASD o flechas · Jugar: ENTER',
      `${ironManDefinition.displayName} dispara solo al enemigo más cercano.`,
    ];
    this.help = this.add.text(0, 0, lines.join('\n'), { ...textStyle(12, '#ffffff'), align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    this.version = this.add.text(0, 0, 'Fase 6 · prototipo', textStyle(10, '#7f9c88')).setOrigin(1, 1);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(time: number, delta: number): void {
    const { width, height } = this.scale;
    const dt = delta / 1000;
    this.ground.tilePositionX += 4 * dt;
    this.ground.tilePositionY += 2 * dt;

    // Drones de fondo: deambulan y reaparecen del otro lado al salir de la pantalla.
    const margin = 40;
    for (const drone of this.drones) {
      const s = drone.sprite;
      s.x += drone.vx * dt * s.scale;
      s.y += drone.vy * dt * s.scale;
      if (s.x < -margin) s.x = width + margin;
      else if (s.x > width + margin) s.x = -margin;
      if (s.y < -margin) s.y = height + margin;
      else if (s.y > height + margin) s.y = -margin;
    }

    const ui = this.ui;
    this.title.y = this.titleY + Math.sin(time / 700) * ui * 0.8;
    this.hero.y = this.heroY + Math.round(Math.sin(time / 450) * ui * 0.8);
    this.drawPlatform(0.55 + Math.sin(time / 450) * 0.15);
    this.playButton.setScale(1 + Math.sin(time / 380) * 0.03);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const ui = uiScale(width, height);
    this.ui = ui;
    const cx = width / 2;
    const portrait = width < height;

    // Fondo: el pasto del mapa con el mismo zoom que el juego, oscurecido y con viñeta.
    const zoom = Math.max(2, computeZoom(width, height));
    this.ground.setSize(width, height).setTileScale(zoom);
    for (const drone of this.drones) {
      drone.sprite.setScale(zoom);
      if (drone.sprite.x === 0 && drone.sprite.y === 0) drone.sprite.setPosition(Math.random() * width, Math.random() * height);
    }
    const shade = this.shade;
    shade.clear();
    shade.fillStyle(0x05080c, 0.55).fillRect(0, 0, width, height);
    const band = height * 0.3;
    shade.fillGradientStyle(0x05080c, 0x05080c, 0x05080c, 0x05080c, 0.85, 0.85, 0, 0).fillRect(0, 0, width, band);
    shade.fillGradientStyle(0x05080c, 0x05080c, 0x05080c, 0x05080c, 0, 0, 0.9, 0.9).fillRect(0, height - band, width, band);

    this.title.setText(portrait ? 'MARVEL\nSURVIVORS' : 'MARVEL SURVIVORS').setAlign('center');
    // En vertical manda el ancho: "SURVIVORS" ocupa casi toda la pantalla.
    this.title.setFontSize(Math.round(portrait ? Math.min(width * 0.11, 64) : 11 * ui));
    this.titleY = height * (portrait ? 0.14 : 0.13);
    this.title.setPosition(cx, this.titleY);
    this.tagline.setFontSize(Math.max(12, Math.round(3.6 * ui))).setPosition(cx, this.titleY + this.title.height / 2 + 3 * ui);

    // Escala entera para que el pixel art quede nítido.
    const heroScale = Math.max(2, Math.floor(height / (portrait ? 150 : 120)));
    this.heroY = height * (portrait ? 0.47 : 0.48);
    this.hero.setScale(heroScale).setPosition(cx, this.heroY);
    this.heroName.setFontSize(Math.max(13, Math.round(4.4 * ui))).setPosition(cx, this.heroY + 6 * heroScale + 4 * ui);
    this.heroStats.setFontSize(Math.max(10, Math.round(3 * ui))).setPosition(cx, this.heroName.y + this.heroName.height * 0.5 + 3 * ui);

    const buttonSize = Math.max(16, Math.round(5.5 * ui));
    this.playButton.setFontSize(buttonSize);
    this.shopButton.setFontSize(buttonSize);
    if (portrait) {
      this.playButton.setPosition(cx, height * 0.69);
      this.shopButton.setPosition(cx, height * 0.69 + this.playButton.height + 2.5 * ui);
    } else {
      const gap = 4 * ui;
      const total = this.playButton.width + gap + this.shopButton.width;
      this.playButton.setPosition(cx - total / 2 + this.playButton.width / 2, height * 0.71);
      this.shopButton.setPosition(cx + total / 2 - this.shopButton.width / 2, height * 0.71);
    }
    this.goldLabel.setText(`ORO: ${saveData.gold}`).setFontSize(Math.max(12, Math.round(4 * ui))).setPosition(width - 3 * ui, 3 * ui);

    this.help.setFontSize(Math.max(10, Math.round(3 * ui)));
    this.help.setWordWrapWidth(Math.min(width * 0.86, 200 * ui));
    const panelW = Math.min(width * 0.92, this.help.width + 12 * ui);
    const panelH = this.help.height + 6 * ui;
    const panelY = height * (portrait ? 0.86 : 0.87);
    this.help.setPosition(cx, panelY);
    this.panel.clear();
    drawPanel(this.panel, cx - panelW / 2, panelY - panelH / 2, panelW, panelH, { radius: Math.round(3 * ui) });

    this.version.setFontSize(Math.max(9, Math.round(2.6 * ui))).setPosition(width - 2 * ui, height - 1.5 * ui);
    this.drawPlatform(0.55);
  }

  /** Plataforma brillante bajo el héroe; `glow` (0..1) la hace latir. */
  private drawPlatform(glow: number): void {
    const s = this.hero.scaleX;
    const x = this.hero.x;
    const y = this.heroY;
    const w = 22 * s;
    const h = 7 * s;
    const g = this.platform;
    g.clear();
    g.fillStyle(0x37d5ff, 0.12 * glow).fillEllipse(x, y, w * 1.6, h * 1.6);
    g.fillStyle(0x0b1410, 0.85).fillEllipse(x, y, w, h);
    g.lineStyle(Math.max(2, s / 2), 0x37d5ff, 0.4 + 0.5 * glow).strokeEllipse(x, y, w, h);
    g.fillStyle(0x000000, 0.45).fillEllipse(x, y, w * 0.55, h * 0.45);
  }

  private startGame(): void {
    this.scene.start(SCENE_KEYS.game);
  }
}
