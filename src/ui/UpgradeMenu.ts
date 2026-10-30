import Phaser from 'phaser';
import type { UpgradeDefinition } from '../progression/upgrades';
import { PanelButton } from './PanelButton';
import { UpgradeCard } from './UpgradeCard';
import { TITLE_FONT, UI_FONT } from './uiLayout';

const DEPTH = 20;
/** Tiempo durante el cual se ignoran toques, para no elegir sin querer al aparecer el menú. */
const INPUT_DELAY_MS = 350;
const CARD_KEYS = ['ONE', 'TWO', 'THREE'];

/** Herramientas de la subida de nivel (mejoras permanentes): cambiar las opciones, saltear o desterrar una. */
export type LevelUpTool = 'reroll' | 'skip' | 'banish';

const TOOL_LABELS: Record<LevelUpTool, { label: string; key: string }> = {
  reroll: { label: 'REPETIR', key: 'R' },
  skip: { label: 'SALTEAR', key: 'S' },
  banish: { label: 'DESTERRAR', key: 'B' },
};

/** Todo lo que el menú necesita para una subida de nivel. */
export interface UpgradePrompt {
  level: number;
  choices: UpgradeDefinition[];
  /** Texto chico bajo las tarjetas (por ejemplo, cuántas pasivas lleva el jugador). */
  note: string;
  /** Usos de cada herramienta: `total` de la ronda (si es 0 el botón no se muestra) y los que `left` quedan. */
  tools: Record<LevelUpTool, { left: number; total: number }>;
  onPick: (choice: UpgradeDefinition) => void;
  onReroll: () => void;
  onSkip: () => void;
  onBanish: (choice: UpgradeDefinition) => void;
}

/** Menú de subida de nivel: título y tarjetas con las mejoras para elegir (click, toque o teclas 1/2/3). */
export class UpgradeMenu {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private cards: UpgradeCard[] = [];
  private choices: UpgradeDefinition[] = [];
  private prompt: UpgradePrompt | null = null;
  private banishMode = false;
  private readonly toolButtons: Record<LevelUpTool, PanelButton>;
  private readonly noteText: Phaser.GameObjects.Text;
  private openedAt = 0;
  private ui = 2;

  constructor(private readonly scene: Phaser.Scene) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x040812, 0.86).setOrigin(0).setDepth(DEPTH);
    this.title = scene.add.text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH + 1);
    this.title.setLetterSpacing(4);
    this.title.setShadow(0, 4, '#1593b8', 0, true, true);
    this.subtitle = scene.add.text(0, 0, 'ELEGÍ UNA MEJORA', { fontFamily: UI_FONT, fontStyle: 'bold', fontSize: '16px', color: '#9db4d8' }).setOrigin(0.5).setDepth(DEPTH + 1);
    this.subtitle.setLetterSpacing(4);
    const touch = scene.sys.game.device.input.touch;
    this.hint = scene.add
      .text(0, 0, touch ? 'Tocá una tarjeta' : 'Click o teclas 1 · 2 · 3', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#7f97c0' })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    this.noteText = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontStyle: 'bold', color: '#7f97c0' }).setOrigin(0.5).setDepth(DEPTH + 1);

    const makeTool = (tool: LevelUpTool): PanelButton =>
      new PanelButton(scene, TOOL_LABELS[tool].label, () => this.useTool(tool), { style: 'nav' }).setDepth(DEPTH + 1);
    this.toolButtons = { reroll: makeTool('reroll'), skip: makeTool('skip'), banish: makeTool('banish') };
    this.setVisible(false);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      CARD_KEYS.forEach((name, index) => keyboard.addKey(name).on('down', () => this.pick(index)));
      (Object.keys(TOOL_LABELS) as LevelUpTool[]).forEach((tool) =>
        keyboard.addKey(TOOL_LABELS[tool].key).on('down', () => this.useTool(tool)),
      );
    }
  }

  get isOpen(): boolean {
    return this.prompt !== null;
  }

  show(prompt: UpgradePrompt): void {
    const { level, choices } = prompt;
    this.prompt = prompt;
    this.banishMode = false;
    this.choices = choices;
    this.openedAt = this.scene.time.now;
    this.title.setText(`¡NIVEL ${level}!`);
    this.setVisible(true);
    this.refreshTools();

    this.destroyCards();
    this.cards = choices.map((choice, index) =>
      new UpgradeCard(this.scene, choice, index, () => this.pick(index)).setDepth(DEPTH + 1),
    );
    this.layout(this.ui);
    this.playEntrance();
  }

  layout(ui: number): void {
    this.ui = ui;
    const { width, height } = this.scene.scale;
    this.dim.setSize(width, height);

    const portrait = width < height;
    const count = this.cards.length;
    // En vertical la letra sale del ancho (uiScale queda chico en celulares).
    const font = portrait ? Math.max(14, Math.round(Math.min(width * 0.045, 22))) : Math.max(13, Math.round(4.4 * ui));
    this.title.setFontSize(Math.max(26, Math.round(11 * ui))).setPosition(width / 2, height * (portrait ? 0.12 : 0.15));
    this.subtitle.setFontSize(Math.max(14, Math.round(4.2 * ui))).setPosition(width / 2, this.title.y + this.title.height * 0.75);
    this.hint.setFontSize(Math.max(11, Math.round(3 * ui))).setPosition(width / 2, height * 0.92);
    this.noteText.setFontSize(Math.max(10, Math.round(2.8 * ui))).setPosition(width / 2, height * 0.955);
    this.layoutTools(width, height, ui);

    if (portrait) {
      const cardW = Math.min(width * 0.9, 520);
      const cardH = Math.round(font * 6);
      const gap = Math.round(font * 0.9);
      const total = count * cardH + (count - 1) * gap;
      const startY = Math.max(this.subtitle.y + font * 2, height * 0.53 - total / 2);
      this.cards.forEach((card, index) => {
        card.layout(cardW, cardH, font, true);
        card.setPosition(width / 2, startY + cardH / 2 + index * (cardH + gap));
      });
    } else {
      const gap = Math.round(font * 1.4);
      const cardW = Math.min((width * 0.9 - gap * (count - 1)) / Math.max(1, count), 72 * ui);
      // Todas las tarjetas con el alto de la que más texto tiene.
      const cardH = Math.max(...this.cards.map((card) => card.measureVerticalHeight(cardW, font)));
      const total = count * cardW + (count - 1) * gap;
      this.cards.forEach((card, index) => {
        card.layout(cardW, cardH, font, false);
        card.setPosition(width / 2 - total / 2 + cardW / 2 + index * (cardW + gap), height * 0.53);
      });
    }
  }

  private layoutTools(width: number, height: number, ui: number): void {
    const visible = (Object.keys(this.toolButtons) as LevelUpTool[]).filter((tool) => (this.prompt?.tools[tool].total ?? 0) > 0);
    const portrait = width < height * 0.95;
    const s = portrait ? Math.min(width / 720, height / 1280) : Math.min(width / 1280, height / 720);
    const bw = Math.min(236 * s, (width * 0.94) / Math.max(1, visible.length) - 8 * s);
    const bh = 50 * s;
    const gap = 14 * s;
    const font = Math.max(10, Math.min(15 * s, bw / 11));
    const total = bw * visible.length + gap * Math.max(0, visible.length - 1);
    let x = width / 2 - total / 2;
    for (const tool of visible) {
      this.toolButtons[tool].setBox(bw, bh, font).setPosition(x + bw / 2, height * 0.84);
      x += bw + gap;
    }
    void ui;
  }

  /** Muestra u oculta cada botón según los usos que quedan y actualiza sus textos. */
  private refreshTools(): void {
    const prompt = this.prompt;
    if (!prompt) return;
    for (const tool of Object.keys(TOOL_LABELS) as LevelUpTool[]) {
      const { left, total } = prompt.tools[tool];
      const button = this.toolButtons[tool];
      const active = tool === 'banish' && this.banishMode;
      button.setLabel(active ? 'ELEGÍ UNA TARJETA' : `${TOOL_LABELS[tool].label} ${left}/${total} [${TOOL_LABELS[tool].key}]`);
      button.setVisible(total > 0);
      button.setEnabled(total > 0 && (left > 0 || active));
      button.setAlpha(left > 0 || active ? 1 : 0.45);
      button.setStyle(active ? 'gold' : 'nav');
    }
    this.noteText.setText(prompt.note);
    this.layoutTools(this.scene.scale.width, this.scene.scale.height, this.ui);
  }

  private useTool(tool: LevelUpTool): void {
    const prompt = this.prompt;
    if (!prompt || this.scene.time.now - this.openedAt < INPUT_DELAY_MS) return;
    if (tool === 'banish') {
      if (prompt.tools.banish.left <= 0 && !this.banishMode) return;
      this.banishMode = !this.banishMode;
      this.refreshTools();
      return;
    }
    if (prompt.tools[tool].left <= 0) return;
    this.close();
    if (tool === 'reroll') prompt.onReroll();
    else prompt.onSkip();
  }

  /** Entrada: el título "salta" y las tarjetas aparecen una tras otra. */
  private playEntrance(): void {
    const { tweens } = this.scene;
    this.dim.setAlpha(0);
    tweens.add({ targets: this.dim, alpha: 1, duration: 150 });
    this.title.setScale(0.4);
    tweens.add({ targets: this.title, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.cards.forEach((card, index) => {
      card.setAlpha(0).setScale(0.85);
      tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 90 + index * 70, ease: 'Back.easeOut' });
    });
  }

  private pick(index: number): void {
    const choice = this.choices[index];
    const prompt = this.prompt;
    if (!choice || !prompt) return;
    if (this.scene.time.now - this.openedAt < INPUT_DELAY_MS) return;

    const banishing = this.banishMode;
    this.close();
    if (banishing) prompt.onBanish(choice);
    else prompt.onPick(choice);
  }

  private close(): void {
    this.prompt = null;
    this.banishMode = false;
    this.choices = [];
    this.destroyCards();
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    for (const item of [this.dim, this.title, this.subtitle, this.hint, this.noteText]) item.setVisible(visible);
    if (!visible) for (const button of Object.values(this.toolButtons)) button.setVisible(false);
  }

  private destroyCards(): void {
    for (const card of this.cards) card.destroy();
    this.cards = [];
  }
}
