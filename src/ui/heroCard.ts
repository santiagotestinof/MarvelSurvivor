import Phaser from 'phaser';
import type { CharacterDefinition } from '../characters/CharacterDefinition';
import { RARITY_INFO } from '../characters/rarity';
import { Direction } from '../core/direction';
import { animationKey } from '../systems/AnimationSystem';
import { drawPanel, textStyle } from './uiLayout';

export interface HeroCardOptions {
  /** Héroe sin comprar: silueta negra, sin nombre ni datos (solo su rareza). */
  locked?: boolean;
  /** Tarjeta resaltada (héroe elegido). */
  highlighted?: boolean;
  /** Línea extra de abajo (por ejemplo "¡NUEVO!"). */
  footer?: { text: string; color: string };
  /** Muestra vida, velocidad y arma. */
  showStats?: boolean;
}

/**
 * Dibuja la tarjeta de un héroe (sprite, nombre, rareza y, opcional, stats y arma) dentro de (x, y, w, h).
 * Devuelve todos los objetos creados para que quien la pida pueda destruirlos o animarlos juntos.
 */
export function drawHeroCard(
  scene: Phaser.Scene,
  def: CharacterDefinition,
  x: number,
  y: number,
  w: number,
  h: number,
  options: HeroCardOptions = {},
): Phaser.GameObjects.GameObject[] {
  const { locked = false, highlighted = false, footer, showStats = true } = options;
  const rarity = RARITY_INFO[def.rarity];
  const objects: Phaser.GameObjects.GameObject[] = [];

  const pad = Math.max(6, Math.round(w * 0.06));
  const nameSize = Phaser.Math.Clamp(Math.round(Math.min(w * 0.115, h * 0.075)), 10, 22);
  const small = Math.max(9, Math.round(nameSize * 0.7));

  const panel = scene.add.graphics();
  drawPanel(panel, x, y, w, h, {
    radius: 8,
    border: highlighted ? 0xffffff : rarity.color,
    borderAlpha: highlighted ? 1 : locked ? 0.5 : 0.85,
    lineWidth: highlighted ? 4 : 2,
  });
  // Un velo del color de la rareza detrás del héroe.
  panel.fillStyle(rarity.color, locked ? 0.08 : 0.14).fillRoundedRect(x + 3, y + 3, w - 6, h * 0.46, 6);
  objects.push(panel);

  const imported = ['ironman', 'capitan', 'thor', 'strange', 'hulk'].includes(def.id);
  // Comparar el dibujo visible: las hojas importadas tienen mucho margen transparente.
  const textureKey = imported ? `${def.id}-menu` : def.sheets.idle.textureKey;
  const portrait = scene.textures.getFrame(textureKey, 0);
  const spriteScale = imported
    ? Math.min(h * 0.28 / portrait.height, (w - pad * 2) / portrait.width)
    : Math.max(2, Math.floor((h * 0.34) / def.frame.height));
  const imageAreaHeight = imported ? 48 * Math.max(2, Math.floor(h * 0.34 / 48)) : def.frame.height * spriteScale;
  const sprite = scene.add
    .sprite(x + w / 2, y + pad + imageAreaHeight / 2, textureKey, 0)
    .setScale(spriteScale);
  if (!imported) sprite.play(animationKey(def.id, 'idle', Direction.Down));
  if (locked) sprite.setTintFill(0x000000).setAlpha(0.92);
  objects.push(sprite);

  let cursor = y + pad * 1.3 + imageAreaHeight;
  const name = scene.add.text(x + w / 2, cursor, locked ? 'SIN DESBLOQUEAR' : def.displayName.toUpperCase(), textStyle(locked ? Math.round(nameSize * 0.8) : nameSize, locked ? '#8a97a3' : '#ffffff')).setOrigin(0.5, 0);
  name.setWordWrapWidth(w - pad * 2).setAlign('center');
  objects.push(name);
  cursor += name.height + 2;

  const tag = scene.add.text(x + w / 2, cursor, rarity.label, textStyle(small, rarity.css)).setOrigin(0.5, 0);
  objects.push(tag);
  cursor += tag.height + pad * 0.5;

  if (showStats && !locked) {
    const text = `VIDA ${def.stats.maxHealth}   VEL ${def.stats.moveSpeed}\n${def.weaponText}`;
    const info = scene.add
      .text(x + w / 2, cursor, text, { ...textStyle(small, locked ? '#a9b6c2' : '#d7e6ef'), align: 'center' })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(w - pad * 2);
    objects.push(info);
  }

  if (footer) {
    const line = scene.add.text(x + w / 2, y + h - pad * 0.8, footer.text, textStyle(small + 1, footer.color)).setOrigin(0.5, 1);
    line.setWordWrapWidth(w - pad);
    objects.push(line);
  }
  return objects;
}
