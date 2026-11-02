import type Phaser from 'phaser';
import type { ParkBounds } from './ParkPaths';

type Strip = readonly [number, number, number, number];
export const CITY_FURNITURE = {
  utility: { texture: 'city-utility-pole', path: 'assets/props/city-utility-pole.png', height: 96,
    origin: [44, 93], scale: 1, base: [[40, 85, 8, 8]] },
  hydrant: { texture: 'city-hydrant', path: 'assets/props/city-hydrant.png', height: 64,
    origin: [45, 53], scale: 0.5, base: [[32, 44, 27, 9]] },
  mailbox: { texture: 'city-mailbox', path: 'assets/props/city-mailbox.png', height: 96,
    origin: [46, 75], scale: 0.625, base: [[30, 62, 30, 13]] },
  signal: { texture: 'city-traffic-signal', path: 'assets/props/city-traffic-signal.png', height: 96,
    origin: [46, 93], scale: 1, base: [[39, 85, 16, 8]] },
  lamp: { texture: 'city-streetlamp', path: 'assets/props/city-streetlamp.png', height: 96,
    origin: [38, 91], scale: 1, base: [[32, 83, 12, 8]] },
  bin: { texture: 'city-bin', path: 'assets/props/city-bin.png', height: 96,
    origin: [48, 72], scale: 0.5, base: [[34, 61, 28, 11]] },
  barrier: { texture: 'city-barrier', path: 'assets/props/city-barrier.png', height: 64,
    origin: [47, 51], scale: 0.875, base: [[19, 42, 56, 9]] },
  bench: { texture: 'city-bench', path: 'assets/props/city-bench.png', height: 64,
    origin: [42, 54], scale: 0.75, base: [[16, 43, 54, 11]] },
  newsstand: { texture: 'city-newsstand', path: 'assets/props/city-newsstand.png', height: 64,
    origin: [48, 61], scale: 1, base: [[20, 48, 57, 13]] },
  dumpster: { texture: 'city-dumpster', path: 'assets/props/city-dumpster.png', height: 64,
    origin: [48, 57], scale: 0.875, base: [[20, 42, 58, 15]] },
} as const satisfies Record<string, { texture: string; path: string; height: number;
  origin: readonly [number, number]; scale: number; base: readonly Strip[] }>;

export type CityFurnitureKind = keyof typeof CITY_FURNITURE;
export interface CityFurnitureSite { kind: CityFurnitureKind; x: number; y: number }

/** Sólo Manhattan: veredas exteriores y frentes urbanos, sin ocupar accesos al parque. */
export function cityFurnitureLayout(park: ParkBounds, rows: readonly number[], width: number, height: number): CityFurnitureSite[] {
  const sites: CityFurnitureSite[] = [];
  const add = (kind: CityFurnitureKind, x: number, y: number): void => { sites.push({ kind, x, y }); };
  const roadXs = [park.left - 400, park.right + 112];
  const roadYs = [park.top - 400, park.bottom + 112];
  for (const rx of roadXs) {
    for (const ry of roadYs) {
      for (const dx of [-24, 312]) for (const dy of [-24, 312]) add('signal', rx + dx, ry + dy);
    }
    for (const row of rows) {
      add('signal', rx - 24, row + 70);
      add('signal', rx + 312, row - 70);
    }
  }
  const outerKinds: readonly CityFurnitureKind[] = ['hydrant', 'mailbox', 'lamp', 'bin', 'utility'];
  for (const [side, x] of [200, width - 204].entries()) {
    for (let y = park.top + 180, i = 0; y < park.bottom; y += 320, i++) {
      if (rows.some((row) => Math.abs(y - row) < 120)) continue;
      add(outerKinds[(i + side * 2) % outerKinds.length], x, y);
    }
  }
  for (const [side, x] of [park.left - 56, park.right + 56].entries()) {
    for (let y = park.top + 200, i = 0; y < park.bottom - 80; y += 480, i++) {
      if (rows.some((row) => Math.abs(y - row) < 120)) continue;
      add(i % 2 === 0 ? 'bench' : 'lamp', x, y);
      add('bin', x + (side === 0 ? 8 : -8), y + 56);
    }
  }
  // Puestos aislados y contenedores junto a las fachadas, nunca en el eje de los cruces.
  for (const [x, y] of [[180, 1060], [width - 184, 2780]]) add('newsstand', x, y);
  for (const x of [180, width - 184]) for (const y of [1480, 2320]) add('dumpster', x, y);
  add('barrier', 184, 960);
  add('barrier', width - 184, 2900);
  const front: Array<[CityFurnitureKind, number]> = [
    ['utility', park.left + 80], ['hydrant', park.left + 192], ['bench', park.left + 320],
    ['newsstand', park.left + 448], ['mailbox', park.right - 320], ['bin', park.right - 64],
  ];
  for (const [kind, x] of front) {
    if (Math.abs(x - width / 2) < 160) continue;
    add(kind, x, park.top - 420);
    add(kind, x, height - 144);
  }
  return sites;
}

export function cityFurnitureBodies(site: CityFurnitureSite) {
  const asset = CITY_FURNITURE[site.kind];
  return asset.base.map(([left, top, width, height]) => ({
    x: site.x + (left + width / 2 - asset.origin[0]) * asset.scale,
    y: site.y + (top + height / 2 - asset.origin[1]) * asset.scale,
    width: width * asset.scale, height: height * asset.scale,
  }));
}

export function buildCityFurniture(scene: Phaser.Scene, park: ParkBounds, rows: readonly number[], width: number, height: number,
  obstacles: Phaser.Physics.Arcade.StaticGroup,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  for (const site of cityFurnitureLayout(park, rows, width, height)) {
    const asset = CITY_FURNITURE[site.kind];
    const bodies = cityFurnitureBodies(site);
    // Comprobar bases existentes impide superponer mobiliario y entradas de los edificios.
    if (bodies.some((body) => obstacles.getChildren().some((object) => {
      const bounds = (object as Phaser.GameObjects.Rectangle).getBounds();
      return body.x + body.width / 2 + 6 > bounds.left && body.x - body.width / 2 - 6 < bounds.right &&
        body.y + body.height / 2 + 6 > bounds.top && body.y - body.height / 2 - 6 < bounds.bottom;
    }))) continue;
    scene.textures.get(asset.texture).setFilter(0); // NEAREST, PNG original sin repintar.
    scene.add.image(site.x, site.y, asset.texture).setOrigin(asset.origin[0] / 96, asset.origin[1] / asset.height)
      .setScale(asset.scale).setDepth(site.y).setName(`manhattan-${asset.texture}`);
    for (const body of bodies) obstacle(body.x, body.y, body.width, body.height);
  }
}
