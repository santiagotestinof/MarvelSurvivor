import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { createRandom } from '../core/random';

const TILE = 16;
const WIDTH_TILES = 120;
const HEIGHT_TILES = 80;

// Índices dentro de public/assets/tiles/ground.png
const GRASS_TILES = [0, 1, 2, 3];
const STONE_TILES = [4, 5];

type PropKind = 'tree' | 'rock' | 'crate';

/** Colisión de cada objeto: caja en la base (los pies del objeto). */
const PROP_BODY: Record<PropKind, { width: number; height: number }> = {
  tree: { width: 8, height: 6 },
  rock: { width: 12, height: 8 },
  crate: { width: 14, height: 10 },
};

/**
 * Mapa provisional para probar movimiento, cámara, animaciones y colisiones.
 * Suelo de pasto con un camino de piedra en cruz, y árboles, rocas y cajas repartidos.
 */
export class TestMap {
  readonly widthPx = WIDTH_TILES * TILE;
  readonly heightPx = HEIGHT_TILES * TILE;
  readonly spawn = { x: this.widthPx / 2, y: this.heightPx / 2 };
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;

  constructor(private readonly scene: Phaser.Scene) {
    this.obstacles = scene.physics.add.staticGroup();
  }

  build(): void {
    this.buildGround();
    this.placeLandmarksNearSpawn();
    this.scatterProps();
  }

  private buildGround(): void {
    const random = createRandom(2024);
    const pathRowStart = HEIGHT_TILES / 2 - 2;
    const pathColStart = WIDTH_TILES / 2 - 2;

    const data: number[][] = [];
    for (let row = 0; row < HEIGHT_TILES; row++) {
      const line: number[] = [];
      for (let col = 0; col < WIDTH_TILES; col++) {
        const onPath =
          (row >= pathRowStart && row < pathRowStart + 4) || (col >= pathColStart && col < pathColStart + 4);
        const pool = onPath ? STONE_TILES : GRASS_TILES;
        line.push(pool[Math.floor(random() * pool.length)]);
      }
      data.push(line);
    }

    const map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(TEXTURES.ground, TEXTURES.ground, TILE, TILE, 0, 0);
    if (!tileset) throw new Error('No se pudo crear el tileset del suelo.');
    const layer = map.createLayer(0, tileset, 0, 0);
    layer?.setDepth(-1000);
  }

  /** Objetos fijos cerca del punto de inicio, para probar colisiones apenas arranca el juego. */
  private placeLandmarksNearSpawn(): void {
    const { x, y } = this.spawn;
    this.placeProp('crate', x + 56, y - 8);
    this.placeProp('crate', x + 72, y - 8);
    this.placeProp('crate', x + 64, y + 8);
    this.placeProp('tree', x - 64, y - 24);
    this.placeProp('rock', x - 48, y + 28);
    this.placeProp('tree', x + 8, y + 64);
  }

  private scatterProps(): void {
    const random = createRandom(77);
    const placed: Array<{ x: number; y: number }> = [];
    const margin = 24;
    const clearRadius = 90; // zona libre alrededor del inicio

    const plan: Array<[PropKind, number]> = [
      ['tree', 110],
      ['rock', 60],
      ['crate', 35],
    ];

    for (const [kind, count] of plan) {
      let attempts = 0;
      let created = 0;
      while (created < count && attempts < count * 20) {
        attempts++;
        const x = margin + random() * (this.widthPx - margin * 2);
        const y = margin + 20 + random() * (this.heightPx - margin * 2 - 20);

        if (Phaser.Math.Distance.Between(x, y, this.spawn.x, this.spawn.y) < clearRadius) continue;
        if (placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < 30)) continue;

        placed.push({ x, y });
        this.placeProp(kind, Math.round(x), Math.round(y));
        created++;
      }
    }
  }

  /** (x, y) es el punto del suelo donde se apoya el objeto. */
  private placeProp(kind: PropKind, x: number, y: number): void {
    this.scene.add.image(x, y, TEXTURES[kind]).setOrigin(0.5, 1).setDepth(y);

    const { width, height } = PROP_BODY[kind];
    const collider = this.scene.add.rectangle(x, y - height / 2, width, height, 0x000000, 0);
    this.obstacles.add(collider);
    const body = collider.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    body.updateFromGameObject();
  }
}
