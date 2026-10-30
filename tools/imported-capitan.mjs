import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Evita que npm run sprites reemplace el arte importado por el provisional. */
export function restoreImportedCapitan() {
  for (const name of ['capitan-idle.png', 'capitan-walk.png', 'capitan-menu.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/capitan/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/capitan/${name}`, import.meta.url)),
    );
  }
}
