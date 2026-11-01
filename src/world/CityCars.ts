import type Phaser from 'phaser';

type CarKind = 'blue' | 'red' | 'taxi';
type Strip = readonly [number, number, number, number];
const HORIZONTAL_BASE: readonly Strip[] = [[16, 21, 64, 10], [14, 31, 68, 4], [20, 35, 56, 3]];
export const CITY_CARS = {
  blue: {
    horizontal: { texture: 'car-blue-horizontal', path: 'assets/props/car-blue-horizontal.png', base: HORIZONTAL_BASE },
    vertical: { texture: 'car-blue-vertical', path: 'assets/props/car-blue-vertical.png',
      base: [[36, 17, 23, 4], [32, 21, 32, 51], [35, 72, 25, 7]] as readonly Strip[] },
  },
  red: {
    horizontal: { texture: 'car-red-horizontal', path: 'assets/props/car-red-horizontal.png', base: HORIZONTAL_BASE },
    vertical: { texture: 'car-red-vertical', path: 'assets/props/car-red-vertical.png',
      base: [[38, 18, 20, 4], [34, 22, 28, 51], [37, 73, 23, 7]] as readonly Strip[] },
  },
  taxi: {
    horizontal: { texture: 'car-taxi-horizontal', path: 'assets/props/car-taxi-horizontal.png', base: HORIZONTAL_BASE },
    vertical: { texture: 'car-taxi-vertical', path: 'assets/props/car-taxi-vertical.png',
      base: [[34, 16, 25, 5], [29, 21, 34, 52], [33, 73, 26, 7]] as readonly Strip[] },
  },
} as const;

const ORDER: readonly CarKind[] = ['blue', 'red', 'taxi', 'blue', 'red', 'taxi', 'blue', 'red'];

/** ~81 px de largo frente a los ~40 px visibles del personaje; proporciones uniformes. */
export function cityCarGeometry(x: number, y: number, vertical: boolean, reverse: boolean, variant: number) {
  const kind = ORDER[variant % ORDER.length];
  const asset = CITY_CARS[kind][vertical ? 'vertical' : 'horizontal'];
  const scale = vertical ? 1.25 : 1.125;
  const height = vertical ? 96 : 48;
  const flipX = !vertical && reverse;
  const flipY = vertical && reverse;
  const bodies = asset.base.map(([left, top, width, h]) => ({
    x: x + (left + width / 2 - 48) * scale * (flipX ? -1 : 1),
    y: y + (top + h / 2 - height / 2) * scale * (flipY ? -1 : 1),
    width: width * scale, height: h * scale,
  }));
  return { asset, scale, flipX, flipY, bodies,
    // Reserva centrada que también contempla el pequeño desplazamiento del taxi en su lienzo.
    width: (vertical ? 40 : 72) * scale, height: (vertical ? 68 : 38) * scale };
}

export function placeCityCar(scene: Phaser.Scene, x: number, y: number,
  geometry: ReturnType<typeof cityCarGeometry>,
  obstacle: (x: number, y: number, width: number, height: number) => unknown): void {
  const { asset, scale, flipX, flipY, bodies } = geometry;
  scene.textures.get(asset.texture).setFilter(0); // NEAREST
  scene.add.image(x, y, asset.texture).setOrigin(0.5).setScale(scale)
    .setFlipX(flipX).setFlipY(flipY).setDepth(Math.max(...bodies.map((b) => b.y + b.height / 2)))
    .setName(`manhattan-${asset.texture}`);
  for (const body of bodies) obstacle(body.x, body.y, body.width, body.height);
}
