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

const FONT = 'monospace';

export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontStyle: 'bold',
    fontSize: `${Math.round(size)}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.round(size / 6)),
  };
}

/** Botón de texto que responde a mouse, toque y teclado (si se pasa `hotkeys`). */
export function createButton(
  scene: Phaser.Scene,
  label: string,
  size: number,
  onClick: () => void,
  hotkeys: string[] = [],
): Phaser.GameObjects.Text {
  const padX = Math.round(size * 1.2);
  const padY = Math.round(size * 0.6);
  const button = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: `${Math.round(size)}px`,
      color: '#101010',
      backgroundColor: '#f5c518',
      padding: { left: padX, right: padX, top: padY, bottom: padY },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  button.on(Phaser.Input.Events.POINTER_OVER, () => button.setBackgroundColor('#ffe272'));
  button.on(Phaser.Input.Events.POINTER_OUT, () => button.setBackgroundColor('#f5c518'));
  button.on(Phaser.Input.Events.POINTER_UP, onClick);

  const keyboard = scene.input.keyboard;
  if (keyboard) {
    for (const name of hotkeys) keyboard.addKey(name).on('down', onClick);
  }
  return button;
}
