import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Evita que npm run sprites reemplace el arte importado por el provisional. */
export function restoreImportedHulk() {
  for (const name of ['hulk-idle.png', 'hulk-walk.png', 'hulk-menu.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/hulk/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/hulk/${name}`, import.meta.url)),
    );
  }
}
