import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Conserva el arte importado incluso al regenerar los recursos del resto del juego. */
export function restoreImportedIronMan() {
  for (const name of ['ironman-idle.png', 'ironman-walk.png', 'ironman-menu.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/iron-man/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/ironman/${name}`, import.meta.url)),
    );
  }
}
