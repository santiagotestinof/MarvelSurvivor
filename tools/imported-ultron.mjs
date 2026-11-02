import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Conserva las vistas importadas de los Ultron bots al regenerar el arte provisional. */
export function restoreImportedUltron() {
  copyFileSync(
    fileURLToPath(new URL('../character-studio/ultron-bots/imported/drone.png', import.meta.url)),
    fileURLToPath(new URL('../public/assets/enemies/drone.png', import.meta.url)),
  );
}
