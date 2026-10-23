// Íconos de las mejoras permanentes (tienda): un objeto de Marvel por mejora, dibujado a mano en 16×16.
// Arte original (formas simples con código), sin material de terceros.
// Orden de los íconos en la hoja = orden de META_ICON_IDS (debe coincidir con src/ui/metaItemIcons.ts).

import { CUSTOM_ICONS } from './meta-icons-custom.mjs';

export const ICON_SIZE = 16;
export const META_ICON_IDS = [
  'might', 'armor', 'max-health', 'recovery', 'cooldown', 'area', 'projectile-speed', 'duration',
  'amount', 'move-speed', 'magnet', 'luck', 'growth', 'greed', 'curse', 'revival',
  'omni', 'charm', 'defang', 'reroll', 'skip', 'banish', 'preserve',
];

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

const C = {
  K: hex('#12101c'), W: hex('#ffffff'), w: hex('#e5e9f0'), g: hex('#a7b1c2'), G: hex('#5d6a80'), D: hex('#2c3446'),
  PL: hex('#e9d5ff'), P: hex('#a855f7'), Pd: hex('#6d28d9'), Pk: hex('#4c1d95'), Pkk: hex('#2e1065'),
  BL: hex('#bfdbfe'), B: hex('#3b82f6'), Bd: hex('#1e40af'),
  CL: hex('#cffafe'), Cy: hex('#22d3ee'), Cd: hex('#0e7490'),
  RL: hex('#fecaca'), R: hex('#ef4444'), Rd: hex('#991b1b'),
  SL: hex('#fbcfe8'), S: hex('#f472b6'), Sd: hex('#be185d'),
  OL: hex('#fed7aa'), O: hex('#fb923c'), Od: hex('#c2410c'),
  YL: hex('#fef08a'), Y: hex('#facc15'), Yd: hex('#a16207'),
  EL: hex('#bbf7d0'), E: hex('#4ade80'), Ed: hex('#15803d'),
  FL: hex('#ecfccb'), F: hex('#a3e635'), Fd: hex('#365314'),
  N: hex('#92400e'), Nd: hex('#451a03'), T: hex('#e8c9a0'),
  M: hex('#c026d3'), Md: hex('#701a75'),
};

class Grid {
  constructor() {
    this.p = Array.from({ length: ICON_SIZE }, () => Array(ICON_SIZE).fill(null));
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE;
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.p[y][x] = c;
  }
  opaque(x, y) {
    return this.inside(x, y) && this.p[y][x] !== null;
  }
  // `color` puede ser un color o una función (x, y) => color.
  paint(x, y, color) {
    this.set(x, y, typeof color === 'function' ? color(x, y) : color);
  }
  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.paint(x + i, y + j, color);
  }
  circle(cx, cy, r, color) {
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.paint(x, y, color);
  }
  ring(cx, cy, r0, r1, color) {
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) {
        const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d >= r0 * r0 && d <= r1 * r1) this.paint(x, y, color);
      }
  }
  poly(points, color) {
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.paint(x, y, color);
      }
  }
  line(x0, y0, x1, y1, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      this.paint(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
    }
  }
  outline(color) {
    const marks = [];
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1)) marks.push([x, y]);
      }
    for (const [x, y] of marks) this.set(x, y, color);
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gema de seis lados con caras de luz, color y sombra (Gemas del Infinito). */
function gem(g, light, mid, dark) {
  const cx = 8;
  const cy = 8;
  g.poly(
    [[cx, 1.5], [13.5, 4.5], [13.5, 11.5], [cx, 14.5], [2.5, 11.5], [2.5, 4.5]],
    (x, y) => {
      const t = (x + 0.5 - cx) * 0.55 + (y + 0.5 - cy) * 0.85;
      if (t < -3) return light;
      if (t > 3.2) return dark;
      return mid;
    },
  );
  g.set(5, 4, C.W);
  g.set(6, 3, C.W);
  g.set(5, 5, light);
  g.line(8, 2, 8, 14, (x, y) => (y < 8 ? light : dark));
  g.set(8, 8, C.W);
}

/** Frasco de vidrio con líquido y corcho. */
function vial(g, liquidLight, liquid, liquidDark) {
  g.rect(6, 1, 4, 2, C.N);
  g.rect(6, 3, 4, 3, C.w);
  g.circle(8, 10, 4.7, (x, y) => {
    if (y < 9) return C.w;
    if (y >= 13) return liquidDark;
    return x < 7 ? liquidLight : liquid;
  });
  g.rect(6, 5, 4, 1, C.g);
  g.set(6, 8, C.W);
  g.set(6, 9, C.W);
}

const DRAW = {
  // Gema del Poder
  might: (g) => gem(g, C.PL, C.P, C.Pd),

  // Máscara de Pantera Negra (traje de vibranio)
  armor: (g) => {
    g.poly([[3, 1.5], [6, 4], [10, 4], [13, 1.5], [14.5, 8], [11.5, 14.5], [4.5, 14.5], [1.5, 8]], (x, y) => (x + y < 11 ? C.g : x + y < 17 ? C.G : C.D));
    g.poly([[3.2, 8], [7.2, 9], [7.2, 10.4], [4.6, 10.8]], C.W);
    g.poly([[12.8, 8], [8.8, 9], [8.8, 10.4], [11.4, 10.8]], C.W);
    g.line(8, 5, 8, 8, C.g);
    g.line(6, 13, 10, 13, C.G);
    g.set(3, 3, C.P);
    g.set(12, 3, C.P);
  },

  // Suero del Supersoldado
  'max-health': (g) => vial(g, C.Cy, C.B, C.Bd),

  // Hierba corazón de Wakanda
  recovery: (g) => {
    const shade = (x, y) => (x + y < 11 ? C.SL : x + y > 17 ? C.Sd : C.S);
    g.circle(5.6, 6, 3.5, shade);
    g.circle(10.4, 6, 3.5, shade);
    g.poly([[2.2, 7.2], [13.8, 7.2], [8, 14]], shade);
    g.line(8, 13, 8, 15, C.Ed);
    g.set(7, 14, C.E);
    g.set(9, 14, C.E);
    g.set(4, 4, C.W);
  },

  // Reactor Arc
  cooldown: (g) => {
    g.circle(8, 8, 7, (x, y) => (x + y < 14 ? C.w : C.g));
    g.circle(8, 8, 5.2, C.D);
    g.circle(8, 8, 4.1, C.Cy);
    g.circle(8, 8, 2.4, C.CL);
    g.circle(8, 8, 1.2, C.W);
    for (const [x, y] of [[8, 4], [8, 11], [4, 8], [11, 8]]) g.set(x, y, C.Cd);
  },

  // Teseracto
  area: (g) => {
    g.poly([[8, 1.5], [14.5, 5], [8, 8.5], [1.5, 5]], C.CL);
    g.poly([[1.5, 5], [8, 8.5], [8, 14.5], [1.5, 11]], C.Cy);
    g.poly([[14.5, 5], [8, 8.5], [8, 14.5], [14.5, 11]], C.B);
    g.line(8, 9, 8, 14, C.Cd);
    g.rect(6, 4, 4, 2, C.W);
    g.set(8, 8, C.W);
  },

  // Flecha de Ojo de Halcón
  'projectile-speed': (g) => {
    g.line(3, 13, 11, 5, C.N);
    g.line(4, 13, 12, 5, C.Nd);
    g.poly([[14.5, 1.5], [14, 7], [9, 2]], (x, y) => (x + y > 16 ? C.g : C.w));
    g.poly([[1.5, 14.5], [1.5, 9.5], [5.5, 12.5]], C.P);
    g.poly([[1.5, 14.5], [6.5, 14.5], [3.5, 10.5]], C.Pd);
    g.line(1, 7, 3, 7, C.w);
    g.line(0, 9, 1, 9, C.g);
  },

  // Ojo de Agamotto
  duration: (g) => {
    g.circle(8, 8, 7, (x, y) => (x + y < 14 ? C.YL : C.Y));
    g.circle(8, 8, 5.2, C.Nd);
    g.ring(8, 8, 5.2, 6.2, C.Yd);
    g.circle(8, 8, 3.1, (x, y) => (x + y < 14 ? C.EL : C.E));
    g.circle(8, 8, 1.4, C.Ed);
    g.set(7, 7, C.W);
    g.rect(7, 0, 2, 2, C.Yd);
  },

  // Partículas Pym
  amount: (g) => {
    vial(g, C.RL, C.R, C.Rd);
    for (const [x, y] of [[2, 3], [13, 2], [14, 7], [1, 9]]) {
      g.set(x, y, C.R);
      g.set(x + 1, y, C.RL);
    }
  },

  // Capa de Levitación
  'move-speed': (g) => {
    g.poly([[4, 3], [12, 3], [15, 14.5], [11, 12], [8, 15], [5, 12], [1, 14.5]], (x) => (x < 8 ? C.R : C.Rd));
    g.line(6, 6, 4, 12, C.Rd);
    g.line(10, 6, 12, 12, C.R);
    g.line(8, 7, 8, 12, C.Rd);
    g.poly([[2.5, 1.5], [6, 4], [8, 2.5], [10, 4], [13.5, 1.5], [12, 5], [4, 5]], (x, y) => (y < 3 ? C.RL : C.R));
    g.circle(8, 5.5, 1.5, C.Y);
    g.set(8, 5, C.YL);
  },

  // Casco de Magneto
  magnet: (g) => {
    g.poly([[1.5, 2.5], [5, 5.5], [3.5, 10]], C.M);
    g.poly([[14.5, 2.5], [11, 5.5], [12.5, 10]], C.Md);
    g.circle(8, 7, 5.6, (x, y) => (x + y < 11 ? C.RL : x + y > 15 ? C.Rd : C.R));
    g.poly([[3.5, 8], [12.5, 8], [11.5, 14], [4.5, 14]], (x) => (x < 8 ? C.R : C.Rd));
    g.poly([[5.6, 8.4], [10.4, 8.4], [9.6, 13.2], [6.4, 13.2]], C.T);
    g.rect(6, 9, 1, 1, C.K);
    g.rect(9, 9, 1, 1, C.K);
    g.line(7, 12, 9, 12, C.N);
    g.line(8, 10, 8, 11, C.N);
  },

  // Cartas de Gambit
  luck: (g) => {
    g.poly([[1.5, 4], [8, 2], [10.5, 11.5], [4, 13.5]], C.g);
    g.poly([[2.2, 4.3], [7.7, 2.6], [9.8, 11], [4.3, 12.7]], C.w);
    g.poly([[6, 2.5], [13.5, 4.5], [11, 14.5], [3.5, 12.5]], C.G);
    g.poly([[6.6, 3.2], [12.9, 4.9], [10.6, 13.8], [4.2, 12]], C.W);
    g.poly([[9, 5.5], [11.4, 8.6], [8.8, 12], [6.6, 8.8]], C.R);
    g.set(8, 7, C.RL);
    g.set(4, 5, C.K);
  },

  // Isótopo gamma (Hulk)
  growth: (g) => {
    g.circle(8, 8, 7, C.Fd);
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) {
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 8;
        const r = Math.hypot(dx, dy);
        if (r < 2.4 || r > 6.1) continue;
        const angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
        for (const center of [90, 210, 330]) {
          let diff = Math.abs(((angle - center + 540) % 360) - 180);
          diff = 180 - diff;
          if (diff <= 32) g.set(x, y, dx + dy < 0 ? C.FL : C.F);
        }
      }
    g.circle(8, 8, 1.6, C.F);
  },

  // Lingote de vibranio
  greed: (g) => {
    g.poly([[4.5, 4], [12.5, 4], [15, 8], [2, 8]], C.w);
    g.rect(2, 8, 13, 5, (x, y) => (y === 12 ? C.G : x > 12 ? C.G : C.g));
    g.rect(2, 8, 13, 1, C.W);
    g.line(4, 10, 12, 10, C.P);
    g.line(5, 11, 11, 11, C.Pd);
    g.set(13, 2, C.W);
    g.set(12, 1, C.PL);
    g.set(14, 3, C.PL);
  },

  // Darkhold
  curse: (g) => {
    g.rect(3, 2, 10, 13, C.Pk);
    g.rect(3, 2, 2, 13, C.Pkk);
    g.rect(13, 3, 1, 11, C.T);
    g.rect(4, 14, 9, 1, C.T);
    for (const [x, y] of [[3, 2], [12, 2], [3, 13], [12, 13]]) g.set(x, y, C.g);
    g.ring(8.5, 8, 2.2, 3.4, C.R);
    g.circle(8.5, 8, 1.2, C.Rd);
    g.set(8, 8, C.W);
    g.line(8, 3, 8, 4, C.R);
    g.line(8, 12, 8, 13, C.R);
  },

  // Gema del Alma
  revival: (g) => gem(g, C.OL, C.O, C.Od),

  // Guantelete del Infinito
  omni: (g) => {
    g.rect(4, 12, 8, 3, (x, y) => (y === 14 ? C.Bd : C.B));
    g.rect(3, 6, 10, 6, (x, y) => (y > 10 ? C.Yd : C.Y));
    g.rect(1, 8, 2, 3, C.Yd);
    g.set(1, 8, C.YL);
    for (const x of [5, 7, 9, 11]) g.line(x, 8, x, 10, C.Yd);
    [C.P, C.B, C.R, C.E, C.O].forEach((color, i) => {
      g.rect(3 + i * 2, 4, 2, 2, color);
      g.set(3 + i * 2, 4, C.W);
    });
    g.set(2, 8, C.YL);
  },

  // Cetro de Loki
  charm: (g) => {
    g.line(2, 14, 9, 7, C.Y);
    g.line(3, 14, 10, 7, C.Yd);
    g.circle(11.5, 4.5, 2.4, (x, y) => (x + y < 16 ? C.CL : C.Cy));
    g.set(11, 4, C.W);
    for (const [x, y] of [[8, 6], [8, 4], [9, 2], [13, 1], [14, 3], [14, 6]]) g.set(x, y, C.Y);
    g.set(9, 7, C.Yd);
  },

  // Emblema de Viuda Negra
  defang: (g) => {
    g.rect(2, 1, 12, 2, C.g);
    g.rect(2, 13, 12, 2, C.G);
    g.poly([[3.5, 3], [12.5, 3], [8, 8]], (x) => (x < 8 ? C.R : C.Rd));
    g.poly([[3.5, 13], [12.5, 13], [8, 8]], (x) => (x < 8 ? C.R : C.Rd));
    g.set(5, 4, C.RL);
    g.set(5, 11, C.RL);
    g.set(8, 8, C.K);
  },

  // Mjolnir
  reroll: (g) => {
    g.rect(2, 2, 12, 5, (x, y) => (y === 2 ? C.W : y === 6 ? C.G : x > 11 ? C.G : C.g));
    g.rect(4, 2, 1, 5, C.D);
    g.rect(11, 2, 1, 5, C.D);
    g.rect(7, 7, 2, 7, (x) => (x === 8 ? C.Nd : C.N));
    g.rect(6, 13, 4, 2, C.T);
    g.set(8, 4, C.PL);
    g.set(7, 4, C.w);
  },

  // Anillo del Sanctum
  skip: (g) => {
    g.circle(8, 8, 4.2, C.Pkk);
    g.ring(8, 8, 3.2, 4.2, C.Od);
    g.ring(8, 8, 4.2, 6.8, (x, y) => (x + y < 13 ? C.YL : x + y < 16 ? C.Y : C.O));
    g.set(8, 8, C.B);
    g.set(7, 9, C.BL);
    g.set(9, 7, C.BL);
    const rand = mulberry32(7);
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const r = 6.9 + rand() * 1.2;
      const x = Math.round(7.5 + Math.cos(a) * r);
      const y = Math.round(7.5 + Math.sin(a) * r);
      if (!g.opaque(x, y)) g.set(x, y, i % 2 ? C.Y : C.O);
    }
  },

  // Gema de la Realidad
  banish: (g) => gem(g, C.RL, C.R, C.Rd),

  // Escudo del Capitán América
  preserve: (g) => {
    g.circle(8, 8, 7, C.R);
    g.ring(8, 8, 5.4, 7, C.Rd);
    g.circle(8, 8, 5.4, C.w);
    g.circle(8, 8, 4.1, C.R);
    g.circle(8, 8, 2.9, C.B);
    for (const [x, y] of [[8, 6], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [7, 9], [9, 9], [6, 10], [10, 10]]) g.set(x, y, C.W);
    g.set(6, 3, C.RL);
    g.set(5, 4, C.RL);
  },
};

/** Devuelve la hoja de íconos: una fila de `META_ICON_IDS.length` cuadros de 16×16, como píxeles RGBA. */
export function buildMetaIconSheet() {
  const width = ICON_SIZE * META_ICON_IDS.length;
  const px = new Uint8Array(width * ICON_SIZE * 4);
  META_ICON_IDS.forEach((id, index) => {
    const g = new Grid();
    const custom = CUSTOM_ICONS[id];
    if (custom) {
      // Ícono hecho a mano: se copia sin contorno extra y se centra en el cuadro.
      const cells = [];
      custom.forEach((row, y) =>
        row.split(' ').forEach((cell, x) => {
          if (cell !== '-') cells.push([x, y, cell]);
        }),
      );
      const minX = Math.min(...cells.map(([x]) => x));
      const maxX = Math.max(...cells.map(([x]) => x));
      const minY = Math.min(...cells.map(([, y]) => y));
      const maxY = Math.max(...cells.map(([, y]) => y));
      // Centrado por la caja que ocupa el dibujo (márgenes iguales a cada lado; si sobra un píxel, queda abajo/derecha).
      const shiftX = Math.floor((ICON_SIZE - (maxX - minX + 1)) / 2) - minX;
      const shiftY = Math.floor((ICON_SIZE - (maxY - minY + 1)) / 2) - minY;
      for (const [x, y, cell] of cells) g.set(x + shiftX, y + shiftY, hex(`#${cell}`));
      console.log(`  ícono propio ${id}: corrido ${shiftX},${shiftY}`);
    } else {
      DRAW[id](g);
      g.outline(C.K);
    }
    for (let y = 0; y < ICON_SIZE; y++)
      for (let x = 0; x < ICON_SIZE; x++) {
        const color = g.p[y][x];
        if (color) px.set(color, (y * width + index * ICON_SIZE + x) * 4);
      }
  });
  return { width, height: ICON_SIZE, px };
}
