import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';

/**
 * Si la página carga con el contenedor en 0×0 (pestaña o panel oculto), WebGL no puede crear
 * su framebuffer y Phaser se cae con "Framebuffer status: Incomplete Attachment" (pantalla negra).
 * Por eso el juego se crea recién cuando el contenedor tiene tamaño.
 */
function startWhenSized(container: HTMLElement, start: () => void): void {
  const hasSize = () => container.clientWidth > 0 && container.clientHeight > 0;
  if (hasSize()) {
    start();
    return;
  }
  const observer = new ResizeObserver(() => {
    if (!hasSize()) return;
    observer.disconnect();
    start();
  });
  observer.observe(container);
}

const container = document.getElementById('game');
if (!container) throw new Error('Falta el contenedor #game en index.html.');
startWhenSized(container, () => new Phaser.Game(createGameConfig()));
