import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Evita que npm run sprites reemplace el arte importado por el provisional. */
export function restoreImportedSpiderman() {
  for (const name of ['spiderman-idle.png', 'spiderman-walk.png', 'spiderman-menu.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/spiderman/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/spiderman/${name}`, import.meta.url)),
    );
  }
}
