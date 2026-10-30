import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Evita que npm run sprites reemplace el arte importado por el provisional. */
export function restoreImportedStrange() {
  for (const name of ['strange-idle.png', 'strange-walk.png', 'strange-menu.png', 'strange-ultimate.png']) {
    copyFileSync(
      fileURLToPath(new URL(`../character-studio/strange/imported/${name}`, import.meta.url)),
      fileURLToPath(new URL(`../public/assets/characters/strange/${name}`, import.meta.url)),
    );
  }
}
