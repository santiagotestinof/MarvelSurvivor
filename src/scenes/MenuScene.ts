import Phaser from 'phaser';
import { ironManDefinition } from '../characters/ironman/ironManDefinition';
import { SCENE_KEYS } from '../config/sceneKeys';
import { ROUND } from '../config/gameplayConfig';
import { Direction } from '../core/direction';
import { animationKey } from '../systems/AnimationSystem';
import { createButton, formatTime, textStyle, uiScale } from '../ui/uiLayout';

/** Menú principal: título, instrucciones y botón para jugar. */
export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private hero!: Phaser.GameObjects.Sprite;
  private playButton!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0e1a12');

    this.title = this.add.text(0, 0, 'MARVEL SURVIVORS', textStyle(40, '#f5c518')).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, 'Fase 2 · prototipo', textStyle(14, '#cfe8d2')).setOrigin(0.5);

    this.hero = this.add
      .sprite(0, 0, ironManDefinition.sheets.idle.textureKey, 0)
      .setOrigin(0.5, ironManDefinition.origin.y)
      .play(animationKey(ironManDefinition.id, 'idle', Direction.Down));

    this.playButton = createButton(this, 'JUGAR', 20, () => this.startGame(), ['ENTER', 'SPACE']);

    const lines = [
      `Sobreviví ${formatTime(ROUND.durationMs)} y derrotá al jefe.`,
      'Mover: WASD o flechas · en celular, deslizá el dedo a la izquierda.',
      'Iron Man dispara solo al enemigo más cercano.',
    ];
    this.help = this.add.text(0, 0, lines.join('\n'), { ...textStyle(12, '#ffffff'), align: 'center' }).setOrigin(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private layout(): void {
    const { width, height } = this.scale;
    const ui = uiScale(width, height);
    const cx = width / 2;

    this.title.setFontSize(Math.round(10 * ui)).setPosition(cx, height * 0.14);
    this.subtitle.setFontSize(Math.round(3.5 * ui)).setPosition(cx, height * 0.14 + 7 * ui);

    // Escala entera para que el pixel art quede nítido.
    const heroScale = Math.max(2, Math.floor(height / 120));
    this.hero.setScale(heroScale).setPosition(cx, height * 0.52);

    this.playButton.setFontSize(Math.round(5 * ui)).setPosition(cx, height * 0.68);
    this.help.setFontSize(Math.round(3 * ui)).setPosition(cx, height * 0.84);
    this.help.setWordWrapWidth(width * 0.9);
  }

  private startGame(): void {
    this.scene.start(SCENE_KEYS.game);
  }
}
