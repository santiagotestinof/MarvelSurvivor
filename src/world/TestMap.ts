import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { createRandom } from '../core/random';
import { BreakableProp, type BreakableKind } from '../entities/BreakableProp';
import { buildParkDetails, createParkTrees, PARK_TREE, PARK_PINE } from './ParkDetails';
import { nearParkPath, parkPaths } from './ParkPaths';
import { buildParkVegetation, createParkGround, PARK_GROUND } from './ParkVegetation';
import { drawCityPaving, drawCityCurbs } from './CityPaving';

const TILE = 16;
const WIDTH_TILES = 160;
const HEIGHT_TILES = 240;
const PARK = { left: 640, right: 1920, top: 640, bottom: 3200 };
const PATH_ROWS = [80, 120, 160];

// Índices del césped generado para este escenario.
const GRASS_TILES = Array.from({ length: 16 }, (_, index) => index);
const STONE_TILES = [16, 17];

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
    createParkTrees(this.scene);
    buildParkDetails(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.spawn.x,
      (x, y, w, h) => this.addObstacle(x, y, w, h));
    this.scatterProps();
    buildParkVegetation(this.scene, PARK, PATH_ROWS.map((row) => row * TILE), this.spawn.x,
      [...this.propBounds, ...this.obstacles.getChildren().map((object) =>
        (object as Phaser.GameObjects.Rectangle).getBounds())]);
  }

  private buildGround(): void {
    createParkGround(this.scene);
    const random = createRandom(2024);

    const data: number[][] = [];
    for (let row = 0; row < HEIGHT_TILES; row++) {
      const line: number[] = [];
      for (let col = 0; col < WIDTH_TILES; col++) {
        const x = col * TILE + TILE / 2;
        const y = row * TILE + TILE / 2;
        const onPath = x < PARK.left || x >= PARK.right || y < PARK.top || y >= PARK.bottom;
        const pool = onPath ? STONE_TILES : GRASS_TILES;
        line.push(pool[Math.floor(random() * pool.length)]);
      }
      data.push(line);
    }

    const map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(PARK_GROUND, PARK_GROUND, TILE, TILE, 0, 0);
    if (!tileset) throw new Error('No se pudo crear el tileset del suelo.');
    const layer = map.createLayer(0, tileset, 0, 0);
    layer?.setDepth(-1000);
  }

  private isPromenade(x: number, y: number, clearance = 0): boolean {
    return nearParkPath(this.paths, x, y, clearance);
  }

  /** Pavimento y señalización no bloquean el movimiento. */
  private buildCity(): void {
    const ground = this.scene.add.graphics().setDepth(-999);
    ground.fillStyle(0x929b9c);
    ground.fillRect(0, 0, PARK.left, this.heightPx);
    ground.fillRect(PARK.right, 0, this.widthPx - PARK.right, this.heightPx);
    ground.fillRect(PARK.left, 0, PARK.right - PARK.left, PARK.top);
    ground.fillRect(PARK.left, PARK.bottom, PARK.right - PARK.left, this.heightPx - PARK.bottom);

    // Una avenida continua rodea el parque; las esquinas quedan transitables.
    const roadXs = [PARK.left - 400, PARK.right + 112];
    const roadYs = [PARK.top - 400, PARK.bottom + 112];
    drawCityPaving(ground, PARK, this.widthPx, this.heightPx, roadXs, roadYs);
    for (const x of roadXs) {
      ground.fillStyle(0xd5d5c4).fillRect(x - 4, 0, 296, this.heightPx);
      ground.fillStyle(0x424b55).fillRect(x, 0, 288, this.heightPx);
    }
    for (const y of roadYs) {
      ground.fillStyle(0xd5d5c4).fillRect(0, y - 4, this.widthPx, 296);
      ground.fillStyle(0x424b55).fillRect(0, y, this.widthPx, 288);
    }
    drawCityCurbs(ground, this.widthPx, this.heightPx, roadXs, roadYs);
    for (const x of roadXs) {
      for (let y = 0; y < this.heightPx; y += 32) {
        if (roadYs.some((roadY) => y >= roadY - 24 && y <= roadY + 312) ||
          this.isPromenade(x, y, 24)) continue;
        ground.fillStyle(0xdac77a).fillRect(x + 140, y, 3, 16);
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
        ground.fillStyle(0xdac77a).fillRect(x, y + 140, 16, 3);
        ground.fillRect(x, y + 149, 16, 3);
      }
      for (let offset = 8; offset < 280; offset += 24) {
        ground.fillStyle(0xe2e2ce).fillRect(this.spawn.x - 36, y + offset, 72, 12);
      }
    }

    // Fachadas bajas en el borde urbano; vereda continua de más de 100 px delante.
    for (let y = 112; y < this.heightPx - 112; y += 320) {
      if (roadYs.some((roadY) => y + 68 > roadY - 80 && y - 12 < roadY + 368)) continue;
      this.placeFacade(8, y);
      this.placeFacade(this.widthPx - 112, y);
    }
    for (let x = PARK.left; x < PARK.right; x += 256) {
      if (Math.abs(x + 52 - this.spawn.x) < 144) continue;
      this.placeFacade(x, 32);
      this.placeFacade(x, this.heightPx - 80);
    }
  }

  private placeFacade(x: number, y: number): void {
      const facade = this.scene.add.graphics().setDepth(y + 64);
      facade.fillStyle(0x343942).fillRect(x - 4, y - 12, 112, 80);
      facade.fillStyle(0x875b4b).fillRect(x, y, 104, 64);
      facade.fillStyle(0xb38a68).fillRect(x, y - 12, 104, 12);
      for (let wx = x + 12; wx < x + 96; wx += 24) {
        facade.fillStyle(0x293e50).fillRect(wx, y + 10, 12, 20);
        facade.fillStyle(0x8bb0bb).fillRect(wx + 2, y + 12, 3, 16);
      }
      facade.fillStyle(0x303e43).fillRect(x + 44, y + 40, 16, 24);
      this.addObstacle(x + 52, y + 26, 112, 84);
  }

  private addObstacle(x: number, y: number, width: number, height: number): Phaser.GameObjects.Rectangle {
    const collider = this.scene.add.rectangle(x, y, width, height, 0x000000, 0);
    this.obstacles.add(collider);
    const body = collider.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    body.updateFromGameObject();
    return collider;
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
        if (this.obstacles.getChildren().some((object) => {
          const bounds = (object as Phaser.GameObjects.Rectangle).getBounds();
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
    this.propBounds.push(image.getBounds());

    const { width, height } = PROP_BODY[kind];
    const collider = this.addObstacle(x, y - height / 2, width, height);

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
