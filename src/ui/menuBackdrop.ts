import type Phaser from 'phaser';

/** Fondo de los menús: degradé azul oscuro con un brillo de color detrás del héroe y una cuadrícula tenue. */
export function drawMenuBackdrop(g: Phaser.GameObjects.Graphics, width: number, height: number, glowColor = 0x1a3a66, glowX = 0.5, glowY = 0.5): void {
  g.clear();
  g.fillStyle(0x070c1a, 1).fillRect(0, 0, width, height);
  const cx = width * glowX;
  const cy = height * glowY;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const rx = width * (0.62 - t * 0.5);
    const ry = height * (0.78 - t * 0.62);
    g.fillStyle(i === 0 ? 0x0e1c38 : glowColor, i === 0 ? 1 : 0.07).fillEllipse(cx, cy, rx * 2, ry * 2);
  }
  const step = Math.max(32, Math.round(Math.min(width, height) / 15));
  g.lineStyle(1, 0x78aaff, 0.05);
  for (let x = 0; x <= width; x += step) g.lineBetween(x, 0, x, height);
  for (let y = 0; y <= height; y += step) g.lineBetween(0, y, width, y);
  const bandTop = height * 0.6;
  for (let i = 0; i < 12; i++) g.fillStyle(0x040812, 0.05).fillRect(0, bandTop + ((height - bandTop) * i) / 12, width, (height - bandTop) * (1 - i / 12));
}
