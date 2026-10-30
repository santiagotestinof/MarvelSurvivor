import Phaser from 'phaser';

/**
 * Factor de escala de la interfaz según el tamaño de la pantalla.
 * Pantalla de 1920×1080 → 4. Celular en vertical → 1.5.
 */
export function uiScale(width: number, height: number): number {
  return Phaser.Math.Clamp(Math.min(width / 640, height / 360) * 2, 1.5, 4);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Tipografía de títulos: Impact si el dispositivo la tiene; si no, Anton (paquete `@fontsource/anton`), parecida. */
export const TITLE_FONT = 'Impact, Anton, "Arial Narrow", sans-serif';

export const UI_FONT = 'Montserrat, "Segoe UI", system-ui, sans-serif';

export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI_FONT,
    fontStyle: 'bold',
    fontSize: `${Math.round(size)}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.round(size / 8)),
  };
}

/** Panel de vidrio oscuro con borde celeste fino (fondo de tarjetas y recuadros de texto). */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  options: { fill?: number; alpha?: number; border?: number; borderAlpha?: number; radius?: number; lineWidth?: number } = {},
): void {
  const { fill = 0x0a1322, alpha = 0.88, border = 0x37d5ff, borderAlpha = 0.35, radius = 10, lineWidth = 2 } = options;
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 2, y + 5, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, radius);
  // Reflejo suave arriba, como un vidrio.
  g.fillStyle(0xffffff, 0.04).fillRoundedRect(x + 2, y + 2, w - 4, Math.max(4, h * 0.35), { tl: radius, tr: radius, bl: 0, br: 0 });
  g.lineStyle(lineWidth, border, borderAlpha).strokeRoundedRect(x, y, w, h, radius);
}
