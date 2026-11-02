import Phaser from 'phaser';

export const PARK_LAMP = 'park-lamp';
export const PARK_BIN = 'park-bin';
export const PARK_BENCH = 'park-bench';

const FURNITURE = {
  lamp: { texture: PARK_LAMP, scale: 1, originX: 47 / 96, originY: 92 / 96, width: 10, height: 6 },
  bin: { texture: PARK_BIN, scale: 0.5, originX: 48 / 96, originY: 74 / 96, width: 15, height: 10 },
  bench: { texture: PARK_BENCH, scale: 0.75, originX: 48 / 96, originY: 71 / 96, width: 50, height: 10 },
} as const;

/** La posición representa el apoyo en el suelo, no el centro del lienzo transparente. */
export function placeParkFurniture(scene: Phaser.Scene, kind: keyof typeof FURNITURE,
  x: number, y: number, obstacle: (x: number, y: number, w: number, h: number) => unknown): void {
  const prop = FURNITURE[kind];
  scene.add.image(x, y, prop.texture).setOrigin(prop.originX, prop.originY)
    .setScale(prop.scale).setDepth(y).setName(`central-park-${kind}`);
  const collider = obstacle(x, y - prop.height / 2, prop.width, prop.height);
  if (kind !== 'bin' && collider instanceof Phaser.GameObjects.Rectangle) collider.setData('webAnchor', true);
}
