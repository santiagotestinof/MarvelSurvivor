import Phaser from 'phaser';

/** Rectángulo del mundo jugable (esquina y tamaño). Se comparte y se cambia al pasar a la arena del jefe. */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ARENA_SIZE = { width: 640, height: 448 };

/**
 * Arena de la pelea final: un recinto cerrado, lejos del mapa de la ronda, donde solo están el jugador y el jefe
 * (más los Drones que invoca). Está dibujada con formas (nada de arte de terceros).
 */
export class BossArena {
  readonly rect: WorldRect;
  readonly playerSpawn: { x: number; y: number };
  readonly bossSpawn: { x: number; y: number };

  constructor(private readonly scene: Phaser.Scene, mapWidth: number) {
    this.rect = { x: mapWidth + 1200, y: 400, width: ARENA_SIZE.width, height: ARENA_SIZE.height };
    this.playerSpawn = { x: this.rect.x + this.rect.width / 2, y: this.rect.y + this.rect.height * 0.78 };
    this.bossSpawn = { x: this.rect.x + this.rect.width / 2, y: this.rect.y + this.rect.height * 0.3 };
  }

  build(): void {
    const { x, y, width, height } = this.rect;
    const g = this.scene.add.graphics().setDepth(-1000);
    // Fuera de la arena: vacío oscuro (por si la cámara muestra más que el recinto).
    g.fillStyle(0x05060b).fillRect(x - 600, y - 600, width + 1200, height + 1200);
    // Suelo: baldosas de piedra oscura en damero.
    const tile = 32;
    for (let ty = 0; ty < height / tile; ty++) {
      for (let tx = 0; tx < width / tile; tx++) {
        g.fillStyle((tx + ty) % 2 === 0 ? 0x1b2130 : 0x202738).fillRect(x + tx * tile, y + ty * tile, tile, tile);
      }
    }
    // Círculo central y anillos de runas.
    const cx = x + width / 2;
    const cy = y + height / 2;
    g.lineStyle(3, 0x7a1f2b, 0.9).strokeCircle(cx, cy, 150);
    g.lineStyle(2, 0xc23a4a, 0.6).strokeCircle(cx, cy, 110);
    g.lineStyle(2, 0x37d5ff, 0.35).strokeCircle(cx, cy, 70);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle(0xc23a4a, 0.7).fillRect(cx + Math.cos(a) * 130 - 3, cy + Math.sin(a) * 130 - 3, 6, 6);
    }
    // Muros: borde grueso con luz en el filo interno.
    const wall = 22;
    g.fillStyle(0x0b0d16).fillRect(x - wall, y - wall, width + wall * 2, wall);
    g.fillRect(x - wall, y + height, width + wall * 2, wall);
    g.fillRect(x - wall, y, wall, height);
    g.fillRect(x + width, y, wall, height);
    g.lineStyle(3, 0x7a1f2b, 1).strokeRect(x, y, width, height);
    // Antorchas en las esquinas.
    for (const [tx, ty] of [[x + 14, y + 14], [x + width - 14, y + 14], [x + 14, y + height - 14], [x + width - 14, y + height - 14]]) {
      g.fillStyle(0x3a2a1c).fillRect(tx - 5, ty - 5, 10, 10);
      g.fillStyle(0xff8a2a).fillCircle(tx, ty - 2, 4);
      g.fillStyle(0xffd24a).fillCircle(tx, ty - 3, 2);
    }
  }
}
