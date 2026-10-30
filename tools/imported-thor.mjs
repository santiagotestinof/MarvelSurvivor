import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Evita que npm run sprites reemplace el arte importado por el provisional. */
export function restoreImportedThor() {
  for (const name of ['thor-idle.png', 'thor-walk.png', 'thor-menu.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/thor/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/thor/${name}`, import.meta.url)),
    );
  }
}
