import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { createRandom } from '../core/random';
import { BreakableProp, type BreakableKind } from '../entities/BreakableProp';
import { buildParkDetails } from './ParkDetails';
import { buildParkEntrance } from './ParkEntrance';
import { placeCommonBuilding } from './CommonBuildings';
import { commonBuildingLayout } from './CommonBuildingLayout';
import { lakePlacementBounds } from './ParkLake';
import { PARK_TREE, PARK_PINE, PARK_TREE_ORIGIN, PARK_PINE_ORIGIN } from './ParkTrees';
import { nearParkPath, parkPaths } from './ParkPaths';
import { buildParkVegetation } from './ParkVegetation';
import { buildParkTerrain } from './ParkTerrain';
import { drawCityPaving, drawCityCurbs, drawCityCrosswalks } from './CityPaving';
import { buildCityFurniture } from './CityFurniture';
import { buildParkedVehicles } from './CityVehicles';
import { drawLandmark } from './CityLandmarks';

const TILE = 16;
const WIDTH_TILES = 160;
const HEIGHT_TILES = 240;
const PARK = { left: 640, right: 1920, top: 640, bottom: 3200 };
const PATH_ROWS = [80, 120, 160];

type PropKind = 'tree' | 'rock' | 'crate';

/** Colisión de cada objeto: caja en la base (los pies del objeto). */
const PROP_BODY: Record<PropKind, { width: number; height: number }> = {
  tree: { width: 8, height: 6 },
  rock: { width: 12, height: 8 },
  crate: { width: 14, height: 10 },
};

/**
 * Primer escenario: parque abierto conectado a una avenida de Nueva York.
 * Los senderos y sus accesos se mantienen libres de obstáculos.
 */
export class TestMap {
  readonly widthPx = WIDTH_TILES * TILE;
  readonly heightPx = HEIGHT_TILES * TILE;
  readonly spawn = { x: this.widthPx / 2, y: this.heightPx / 2 + 150 };
  private readonly paths = parkPaths(PARK, PATH_ROWS.map((row) => row * TILE), this.widthPx / 2);
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private readonly propBounds: Phaser.Geom.Rectangle[] = [];
  /** Cajas y rocas que todavía no se rompieron. */
  readonly breakables = new Set<BreakableProp>();
  /** Se llama cuando se rompe un objeto (para soltar el oro). */
  onPropBroken: (prop: BreakableProp) => void = () => {};

  constructor(private readonly scene: Phaser.Scene) {
    this.obstacles = scene.physics.add.staticGroup();
  }

  build(): void {
    this.buildGround();
    this.buildCity();
    buildParkDetails(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.spawn.x,
      (x, y, w, h) => this.addObstacle(x, y, w, h));
    this.scatterProps();
    buildParkVegetation(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.spawn.x,
      [...this.propBounds, ...this.placementObstacleBounds()]);
    buildParkEntrance(this.scene, PARK, this.spawn.x,
      (x, y, w, h) => this.addObstacle(x, y, w, h));
  }

  private buildGround(): void {
    buildParkTerrain(this.scene, this.widthPx, this.heightPx, PARK, this.paths);
  }

  private isPromenade(x: number, y: number, clearance = 0): boolean {
    return nearParkPath(this.paths, x, y, clearance);
  }

  /** Pavimento y señalización no bloquean el movimiento. */
  private buildCity(): void {
    const ground = this.scene.add.graphics().setDepth(-999);
    // Una avenida continua rodea el parque; las esquinas quedan transitables.
    const roadXs = [PARK.left - 400, PARK.right + 112];
    const roadYs = [PARK.top - 400, PARK.bottom + 112];
    drawCityPaving(ground, PARK, this.widthPx, this.heightPx, roadXs, roadYs);
    drawCityCurbs(ground, this.widthPx, this.heightPx, roadXs, roadYs);
    for (const x of roadXs) {
      for (let y = 0; y < this.heightPx; y += 32) {
        if (roadYs.some((roadY) => y >= roadY - 24 && y <= roadY + 312) ||
          this.isPromenade(x, y, 24)) continue;
        ground.fillStyle(0x999b97).fillRect(x + 140, y, 3, 16);
        ground.fillRect(x + 149, y, 3, 16);
      }
      for (const row of PATH_ROWS) {
        for (let offset = 8; offset < 280; offset += 24) {
          ground.fillStyle(0xe2e2ce).fillRect(x + offset, row * TILE - 36, 12, 72);
        }
      }
    }
    for (const y of roadYs) {
      for (let x = 0; x < this.widthPx; x += 32) {
        if (roadXs.some((roadX) => x >= roadX - 24 && x <= roadX + 312) ||
          Math.abs(x - this.spawn.x) < 72) continue;
        ground.fillStyle(0x999b97).fillRect(x, y + 140, 16, 3);
        ground.fillRect(x, y + 149, 16, 3);
      }
      for (let offset = 8; offset < 280; offset += 24) {
        ground.fillStyle(0xe2e2ce).fillRect(this.spawn.x - 36, y + offset, 72, 12);
      }
    }

    drawCityCrosswalks(ground, roadXs, roadYs);

    for (const building of commonBuildingLayout(PARK, this.widthPx, this.heightPx,
      PATH_ROWS.map((row) => row * TILE))) {
      placeCommonBuilding(this.scene, building.x, building.baseY, building.kind,
        (x, y, w, h) => this.addObstacle(x, y, w, h));
    }
    const addCityObstacle = (x: number, y: number, w: number, h: number) => this.addObstacle(x, y, w, h);
    drawLandmark(this.scene, 32, 216, 'avengers', addCityObstacle);
    drawLandmark(this.scene, this.widthPx - 192, 216, 'bugle', addCityObstacle);
    drawLandmark(this.scene, 32, this.heightPx - 24, 'sanctum', addCityObstacle);
    drawLandmark(this.scene, this.widthPx - 192, this.heightPx - 24, 'baxter', addCityObstacle);
    buildCityFurniture(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.widthPx, this.heightPx,
      this.obstacles, addCityObstacle);
    buildParkedVehicles(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.widthPx, this.heightPx,
      this.obstacles, (x, y, w, h) => this.addObstacle(x, y, w, h));
  }

  private addObstacle(x: number, y: number, width: number, height: number): Phaser.GameObjects.Rectangle {
    const collider = this.scene.add.rectangle(x, y, width, height, 0x000000, 0);
    this.obstacles.add(collider);
    const body = collider.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    body.updateFromGameObject();
    return collider;
  }

  private placementObstacleBounds(): Phaser.Geom.Rectangle[] {
    return [
      ...this.obstacles.getChildren()
        .filter((object) => !(object as Phaser.GameObjects.Rectangle).getData('parkLakeWater'))
        .map((object) => (object as Phaser.GameObjects.Rectangle).getBounds()),
      ...lakePlacementBounds(this.spawn.x, PATH_ROWS.map((row) => row * TILE)),
    ];
  }

  private scatterProps(): void {
    const random = createRandom(77);
    const placed: Array<{ x: number; y: number }> = [];
    const margin = 24;
    const clearRadius = 200;

    const plan: Array<[PropKind, number]> = [
      ['tree', 300],
      ['rock', 18],
      ['crate', 16],
    ];

    for (const [kind, count] of plan) {
      let attempts = 0;
      let created = 0;
      while (created < count && attempts < count * 20) {
        attempts++;
        const x = PARK.left + margin + random() * (PARK.right - PARK.left - margin * 2);
        const y = PARK.top + margin + 20 + random() * (PARK.bottom - PARK.top - margin * 2 - 20);

        if (Phaser.Math.Distance.Between(x, y, this.spawn.x, this.spawn.y) < clearRadius) continue;
        if (this.isPromenade(x, y, 40) || this.isPromenade(x, y - 40, 20)) continue;
        if (Math.abs(x - this.widthPx / 2) < 250 && Math.abs(y - this.heightPx / 2) < 220) continue;
        // Arboledas repartidas entre claros amplios, además del arbolado perimetral.
        const nearEdge = x < PARK.left + 180 || x > PARK.right - 180 ||
          y < PARK.top + 160 || y > PARK.bottom - 160;
        const inGrove = [920, 1640].some((gx) => [860, 1530, 2280, 2970].some((gy) =>
          Phaser.Math.Distance.Between(x, y, gx, gy) < 190));
        if (!nearEdge && !inGrove) continue;
        if (this.placementObstacleBounds().some((bounds) => {
          return x > bounds.left - 40 && x < bounds.right + 40 &&
            y > bounds.top - 30 && y < bounds.bottom + 64;
        })) continue;
        if (placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < 50)) continue;
        const footprint = kind === 'tree' ? new Phaser.Geom.Rectangle(x - 36, y - 84, 72, 88) :
          new Phaser.Geom.Rectangle(x - 20, y - 28, 40, 32);
        if (this.propBounds.some((bounds) => Phaser.Geom.Intersects.RectangleToRectangle(footprint, bounds))) continue;

        placed.push({ x, y });
        this.placeProp(kind, Math.round(x), Math.round(y));
        created++;
      }
    }
  }

  /** (x, y) es el punto del suelo donde se apoya el objeto. */
  private placeProp(kind: PropKind, x: number, y: number): void {
    const texture = kind === 'tree' ? (Math.round(x) % 3 === 0 ? PARK_PINE : PARK_TREE) : TEXTURES[kind];
    const image = this.scene.add.image(x, y, texture).setOrigin(0.5, 1).setDepth(y);
    if (texture === PARK_TREE) image.setOrigin(PARK_TREE_ORIGIN.x, PARK_TREE_ORIGIN.y);
    if (texture === PARK_PINE) image.setOrigin(PARK_PINE_ORIGIN.x, PARK_PINE_ORIGIN.y);
    this.propBounds.push(image.getBounds());

    const { width, height } = PROP_BODY[kind];
    const collider = this.addObstacle(x, y - height / 2, width, height);
    if (kind === 'tree') collider.setData('webAnchor', true);

    if (kind === 'crate' || kind === 'rock') this.makeBreakable(kind, image, collider);
  }

  /** Daña las cajas y rocas dentro del radio (explosiones). */
  damagePropsInRadius(x: number, y: number, radius: number, damage: number): void {
    const radiusSq = radius * radius;
    for (const prop of [...this.breakables]) {
      if ((prop.x - x) ** 2 + (prop.y - y) ** 2 <= radiusSq) prop.takeDamage(damage);
    }
  }

  private makeBreakable(kind: BreakableKind, image: Phaser.GameObjects.Image, collider: Phaser.GameObjects.Rectangle): void {
    const prop = new BreakableProp(kind, image, collider, (broken) => {
      this.breakables.delete(broken);
      this.onPropBroken(broken);
    });
    this.breakables.add(prop);
  }
}
