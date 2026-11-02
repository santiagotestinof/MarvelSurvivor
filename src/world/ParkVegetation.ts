import Phaser from 'phaser';
import { createRandom } from '../core/random';
import { nearParkPath, parkPaths, type ParkBounds } from './ParkPaths';
import { PARK_TREE, PARK_PINE } from './ParkTrees';

export const PARK_TALL_GRASS = 'park-tall-grass';
export const PARK_BUSH = 'park-bush';
export const PARK_FLOWERS = 'park-flowers';

/** Grupos pequeños de flores originales, espaciados y sin desplazar otras plantas. */
function buildFlowers(scene: Phaser.Scene, occupied: Phaser.Geom.Rectangle[],
  sites: Array<{ x: number; y: number }>): void {
  const plants = scene.children.getChildren().filter((object): object is Phaser.GameObjects.Image =>
    object instanceof Phaser.GameObjects.Image && [PARK_TALL_GRASS, PARK_BUSH].includes(object.texture.key));
  const placed: Array<{ x: number; y: number }> = [];
  for (const { x, y } of sites) {
    if (placed.length >= 64) break;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 84)) continue;
    const bounds = new Phaser.Geom.Rectangle(x - 10, y - 22, 20, 23);
    if (occupied.some((other) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, other))) continue;
    if (plants.some((plant) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, plant.getBounds()))) continue;
    scene.add.image(x, y, PARK_FLOWERS).setScale(0.375).setOrigin(46 / 96, 77 / 96).setDepth(-997);
    placed.push({ x, y });
  }
}

/** Reemplaza los arbustos anteriores en sitios despejados, sin mover las demás plantas. */
function buildBushes(scene: Phaser.Scene, paths: ReturnType<typeof parkPaths>,
  occupied: Phaser.Geom.Rectangle[], sites: Array<{ x: number; y: number }>): void {
  const images = scene.children.getChildren().filter((object): object is Phaser.GameObjects.Image =>
    object instanceof Phaser.GameObjects.Image);
  const trees = images.filter((image) => [PARK_TREE, PARK_PINE].includes(image.texture.key));
  const grass = images.filter((image) => image.texture.key === PARK_TALL_GRASS);
  const placed: Array<{ x: number; y: number }> = [];
  for (const { x, y } of sites) {
    if (placed.length >= 28) break;
    const nearTree = trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) < 140);
    if (!nearTree && !nearParkPath(paths, x, y, 120)) continue;
    if (nearParkPath(paths, x, y, 36)) continue;
    const bounds = new Phaser.Geom.Rectangle(x - 23, y - 35, 46, 36);
    if (occupied.some((other) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, other))) continue;
    if (grass.some((image) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, image.getBounds()))) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 110)) continue;
    scene.add.image(x, y, PARK_BUSH).setScale(0.625).setOrigin(0.5, 78 / 96).setDepth(-997);
    placed.push({ x, y });
  }
}

/** Matas originales de PixelLab a media escala, con separación y sin cuerpos físicos. */
function buildTallGrass(scene: Phaser.Scene, park: ParkBounds, paths: ReturnType<typeof parkPaths>,
  rows: number[], occupied: Phaser.Geom.Rectangle[], plants: Array<{ x: number; y: number }>): void {
  const random = createRandom(8451);
  const trees = scene.children.getChildren().filter((object): object is Phaser.GameObjects.Image =>
    object instanceof Phaser.GameObjects.Image && [PARK_TREE, PARK_PINE].includes(object.texture.key));
  const placed: Array<{ x: number; y: number }> = [];
  const cx = (park.left + park.right) / 2;
  const cy = (park.top + park.bottom) / 2;
  for (let attempt = 0; attempt < 1200 && placed.length < 72; attempt++) {
    let x: number;
    let y: number;
    if (trees.length > 0 && random() < 0.6) {
      const tree = trees[Math.floor(random() * trees.length)];
      const angle = random() * Math.PI;
      const radius = 44 + random() * 36;
      x = tree.x + Math.cos(angle) * radius;
      y = tree.y + 14 + Math.sin(angle) * radius * 0.65;
    } else {
      const path = paths[Math.floor(random() * paths.length)];
      const index = 1 + Math.floor(random() * (path.length - 2));
      const before = path[index - 1];
      const after = path[index + 1];
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.hypot(dx, dy);
      const side = random() < 0.5 ? -1 : 1;
      const offset = side * (74 + random() * 36);
      x = path[index].x - dy / length * offset;
      y = path[index].y + dx / length * offset;
    }
    x = Math.round(x / 2) * 2;
    y = Math.round(y / 2) * 2;
    if (x < park.left + 24 || x > park.right - 24 || y < park.top + 36 || y > park.bottom - 8) continue;
    if (nearParkPath(paths, x, y, 32)) continue;
    if (((x - cx) / 250) ** 2 + ((y - cy) / 210) ** 2 < 1) continue;
    // El rectángulo mide únicamente la parte visible del PNG a escala 0,5.
    const bounds = new Phaser.Geom.Rectangle(x - 17, y - 31, 34, 32);
    if (occupied.some((other) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, other))) continue;
    if (plants.some((p) => Math.hypot(p.x - x, p.y - y) < 38)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 64)) continue;
    // Evitar también el agua de los dos estanques y su borde de piedra.
    if ([[cx - 330, rows[0] - 270], [cx + 330, rows[2] + 270]].some(([px, py]) =>
      Math.abs(x - px) < 164 && Math.abs(y - py) < 132)) continue;
    scene.add.image(x, y, PARK_TALL_GRASS).setScale(0.5).setOrigin(0.5, 76 / 96).setDepth(-997);
    placed.push({ x, y });
  }
}

/** Plantas bajas transitables: no se añaden cuerpos físicos ni se tapan personajes. */
export function buildParkVegetation(scene: Phaser.Scene, park: ParkBounds, rows: number[], cx: number,
  occupied: Phaser.Geom.Rectangle[]): void {
  const random = createRandom(7134);
  const paths = parkPaths(park, rows, cx);
  const cy = (park.top + park.bottom) / 2;
  const placed: Array<{ x: number; y: number }> = [];
  const bushSites: Array<{ x: number; y: number }> = [];
  const flowerSites: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 650; i++) {
    const x = Math.floor((park.left + 32 + random() * (park.right - park.left - 64)) / 2) * 2;
    const y = Math.floor((park.top + 32 + random() * (park.bottom - park.top - 64)) / 2) * 2;
    if (nearParkPath(paths, x, y, 28)) continue;
    const footprint = new Phaser.Geom.Rectangle(x - 20, y - 26, 40, 36);
    if (occupied.some((bounds) => Phaser.Geom.Intersects.RectangleToRectangle(footprint, bounds))) continue;
    if (((x - cx) / 240) ** 2 + ((y - cy) / 200) ** 2 < 1) continue;
    if ([[cx - 330, rows[0] - 270], [cx + 330, rows[2] + 270]].some(([px, py]) =>
      Math.abs(x - px) < 164 && Math.abs(y - py) < 124)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 44)) continue;
    placed.push({ x, y });
    if (i % 4 === 1) {
      // Conservar la secuencia aleatoria mantiene intactas las flores y los arbustos.
      for (let blade = 0; blade < 6; blade++) random();
      continue;
    }
    const bush = i % 3 === 0;
    if (bush) {
      bushSites.push({ x, y });
      continue;
    }
    flowerSites.push({ x, y });
  }
  buildTallGrass(scene, park, paths, rows, occupied, placed);
  buildBushes(scene, paths, occupied, bushSites);
  buildFlowers(scene, occupied, flowerSites);
}
