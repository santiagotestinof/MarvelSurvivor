import Phaser from 'phaser';
import { PARK_PATH_WIDTH, type ParkPoint } from './ParkPaths';
import { PLAZA_WIDTH as WIDTH, PLAZA_HEIGHT as HEIGHT, PLAZA_BORDER as BORDER,
  PLAZA_ENTRY_CLEARANCE } from './ParkPlazaLayout';

export const PARK_PLAZA = 'bethesda-plaza';

/** Una sola composición de piedra; el borde se abre donde llegan los senderos. */
export function placeParkPlaza(scene: Phaser.Scene, x: number, y: number,
  paths: ParkPoint[][]): void {
  scene.textures.get(PARK_PLAZA).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const pavingClip = scene.make.graphics({ x, y }, false).fillStyle(0xffffff);
  const borderClip = scene.make.graphics({ x, y }, false).fillStyle(0xffffff);
  const edging = scene.add.graphics().setPosition(x, y).setDepth(-997.25);

  // Filas de un píxel: conserva el pixel art y elimina los escalones de 4×4.
  for (let dy = -HEIGHT / 2 - BORDER; dy < HEIGHT / 2 + BORDER; dy++) {
    const py = dy + 0.5;
    const innerHalf = Math.abs(py) < HEIGHT / 2
      ? WIDTH / 2 * Math.sqrt(1 - (py / (HEIGHT / 2)) ** 2) : 0;
    if (innerHalf > 0) {
      const left = Math.ceil(-innerHalf - 0.5);
      const right = Math.floor(innerHalf - 0.5);
      pavingClip.fillRect(left, dy, right - left + 1, 1);
    }
    let runStart: number | undefined;
    for (let dx = -WIDTH / 2 - BORDER; dx <= WIDTH / 2 + BORDER; dx++) {
      const px = dx + 0.5;
      const inside = (px / (WIDTH / 2)) ** 2 + (py / (HEIGHT / 2)) ** 2 <= 1;
      const inOuter = (px / (WIDTH / 2 + BORDER)) ** 2 +
        (py / (HEIGHT / 2 + BORDER)) ** 2 <= 1;
      let stone = false;
      let outer = 0;
      let rx = WIDTH / 2;
      let ry = HEIGHT / 2;
      if (!inside && inOuter) {
        let distanceSq = Infinity;
        for (const path of paths) for (const point of path) {
          distanceSq = Math.min(distanceSq, (x + px - point.x) ** 2 + (y + py - point.y) ** 2);
        }
        // Incluye los márgenes del Wang y ensancha gradualmente la boca del acceso.
        // La abertura incluye el ensanche y medio tile del cordón Wang.
        const opening = PARK_PATH_WIDTH / 2 + PLAZA_ENTRY_CLEARANCE + 16;
        const taper = Phaser.Math.Clamp((Math.sqrt(distanceSq) - opening) / 12, 0, 1);
        rx += BORDER * taper;
        ry += BORDER * taper;
        outer = (px / rx) ** 2 + (py / ry) ** 2;
        stone = taper > 0 && outer <= 1;
      }
      if (stone && runStart === undefined) runStart = dx;
      if (!stone && runStart !== undefined) {
        borderClip.fillRect(runStart, dy, dx - runStart, 1);
        runStart = undefined;
      }
      if (stone) {
        // Bisel fino sobre la piedra original, sin bandas oscuras anchas.
        const edgeDistance = (1 - Math.sqrt(outer)) * Math.min(rx, ry);
        if (edgeDistance < 1) {
          edging.fillStyle(py < 0 ? 0xc8bfa9 : 0x777163).fillRect(dx, dy, 1, 1);
        }
      }
    }
  }

  const addMaskedStone = (clip: Phaser.GameObjects.Graphics, width: number, height: number,
    depth: number, name: string): void => {
    const mask = clip.createGeometryMask();
    scene.add.image(x, y, PARK_PLAZA)
      .setDisplaySize(width, height)
      .setDepth(depth)
      .setMask(mask)
      .setName(name)
      .once(Phaser.GameObjects.Events.DESTROY, () => {
        mask.destroy();
        clip.destroy();
      });
  };
  // Se conserva el tamaño y el centrado del pavimento que ya estaba integrado.
  addMaskedStone(pavingClip, WIDTH, HEIGHT, -997.5, 'bethesda-plaza-paving');
  addMaskedStone(borderClip, WIDTH + BORDER * 2, HEIGHT + BORDER * 2,
    -997.4, 'bethesda-plaza-stone-border');
}
