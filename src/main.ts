import Phaser from 'phaser';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-ext-400.css';
import '@fontsource/montserrat/latin-ext-700.css';
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
// Phaser dibuja el texto en un canvas: la tipografía tiene que estar cargada antes de crear las escenas.
const fontsReady = Promise.all([document.fonts.load('400 16px Montserrat'), document.fonts.load('700 16px Montserrat')]).catch(() => undefined);
startWhenSized(container, () => {
  void fontsReady.then(() => new Phaser.Game(createGameConfig()));
});
