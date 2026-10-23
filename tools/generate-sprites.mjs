// Genera los recursos gráficos PROVISIONALES del prototipo (arte original, sin material de terceros).
//
//   npm run sprites                       -> escribe en public/assets
//   node tools/generate-sprites.mjs --preview <carpeta>   -> además guarda vistas ampliadas
//
// Hoja de sprites de personajes: una fila por dirección, una columna por cuadro.
// Orden de filas (debe coincidir con src/core/direction.ts):
//   0 abajo, 1 abajo-izq, 2 izquierda, 3 arriba-izq, 4 arriba, 5 arriba-der, 6 derecha, 7 abajo-der

import { STRANGE_REF, STRANGE_ARMS_REF } from './hero-trace-strange.mjs';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IRON_MAN_REF } from './ironman-reference.mjs';
import { CAPITAN_REF } from './hero-trace-capitan.mjs';
import { THOR_REF } from './hero-trace-thor.mjs';
import { HULK_REF } from './hero-trace-hulk.mjs';
import { SPIDERMAN_REF } from './hero-trace-spiderman.mjs';
import { buildMetaIconSheet } from './meta-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const FRAME = 32;

// ---------------------------------------------------------------- utilidades PNG

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(cv) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 6; // RGBA
  const stride = cv.w * 4;
  const raw = Buffer.alloc((stride + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(cv.px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function save(cv, relPath) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, encodePng(cv));
  console.log('  escrito', join('public/assets', relPath), `(${cv.w}x${cv.h})`);
}

// ---------------------------------------------------------------- lienzo de píxeles

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 4);
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    this.px.set(c, (y * this.w + x) * 4);
  }
  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]];
  }
  opaque(x, y) {
    return this.get(x, y)[3] > 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  // Rectángulo con luz arriba y sombra abajo/derecha.
  shaded(x, y, w, h, base, light, dark) {
    this.rect(x, y, w, h, base);
    if (h >= 3) {
      this.rect(x, y, w, 1, light);
      this.rect(x, y + h - 1, w, 1, dark);
    }
    if (w >= 3) this.rect(x + w - 1, y + 1, 1, Math.max(0, h - 2), dark);
  }
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3] > 0) this.set(ox + x, oy + y, c);
      }
  }
}

// Contorno de 1 px alrededor de la silueta.
function addOutline(cv, color) {
  const marks = [];
  for (let y = 0; y < cv.h; y++)
    for (let x = 0; x < cv.w; x++) {
      if (cv.opaque(x, y)) continue;
      if (cv.opaque(x - 1, y) || cv.opaque(x + 1, y) || cv.opaque(x, y - 1) || cv.opaque(x, y + 1))
        marks.push([x, y]);
    }
  for (const [x, y] of marks) cv.set(x, y, color);
  return cv;
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

// ---------------------------------------------------------------- Iron Man (provisional)

const C = {
  outline: hex('#150909'),
  red: hex('#c4161c'),
  redLight: hex('#ea3b30'),
  redDark: hex('#8c0f18'),
  redDeep: hex('#5a0911'),
  gold: hex('#f5c518'),
  goldLight: hex('#ffe272'),
  goldDark: hex('#b8870b'),
  arc: hex('#e9fcff'),
  arcWhite: hex('#ffffff'),
  arcGlow: hex('#6fd8ff'),
  arcDim: hex('#3a9fd0'),
  eye: hex('#dff6ff'),
};

/** Completa los colores de un héroe: lo que no se define se toma del traje base (rojo y dorado, Iron Man). */
function heroPalette(pal = {}) {
  const base = { ...C, ...pal };
  return {
    leg: base.red, legLight: base.redLight, legDark: base.redDark, legDeep: base.redDeep, boot: base.redDeep,
    belt: base.gold, beltLight: base.goldLight, beltDark: base.goldDark,
    head: base.red, headLight: base.redLight, headDark: base.redDark,
    face: base.gold, faceLight: base.goldLight, faceDark: base.goldDark,
    ...base,
  };
}

// fx, fy: hacia dónde mira (-1, 0, 1). stride: -2..2 (zancada). bob: 0/-1 (cuerpo arriba).
// head: 0/1 (respiración). pulse: 0..2 (brillo del reactor ARC).
function drawHero(style, { fx, fy, stride = 0, bob = 0, head = 0, pulse = 0 }) {
  const P = heroPalette(style.pal);
  const cv = new Canvas(FRAME, FRAME);
  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const back = fy < 0;

  const torsoW = (straight ? 10 : sideOnly ? 8 : 9) + (style.wide ? 2 : 0);
  const tx = cx - Math.floor(torsoW / 2) + (diag ? fx : 0);
  const ty = 12 + bob;
  const tb = 20 + bob;
  const torsoH = tb - ty + 1;

  // Piernas
  const legTop = 20 + bob;
  for (const si of [-1, 1]) {
    const sep = straight ? 1 : diag ? 0.5 : 0;
    let x0 = Math.round(cx - 2 + si * 3 * sep);
    if (!straight) x0 += fx * si * stride;
    const dy = fy !== 0 ? Math.round((fy * si * stride) / 2) : 0;
    const bottom = Math.min(30, 29 + dy);
    const far = si < 0 && !straight;
    cv.shaded(
      x0,
      legTop,
      4,
      bottom - legTop + 1,
      far ? P.legDark : P.leg,
      far ? P.leg : P.legLight,
      far ? P.legDeep : P.legDark,
    );
    if (!sideOnly && !style.plainLegs) cv.rect(x0 + 1, legTop + 3, 2, 2, far ? P.goldDark : P.gold); // rodillera
    if (!style.plainLegs) cv.rect(x0, bottom - 3, 4, 1, far ? P.goldDark : P.gold); // tobillo
    cv.rect(x0, bottom - 1, 4, 2, P.boot); // bota
  }

  const drawArm = (x, top, dark) => {
    cv.shaded(x, top, 3, 8, dark ? P.redDark : P.red, dark ? P.red : P.redLight, dark ? P.redDeep : P.redDark);
    if (style.bareArms) {
      cv.rect(x, top + 5, 3, 3, dark ? P.faceDark : P.face); // brazo descubierto
    }
    cv.rect(x, top, 3, 2, dark ? P.goldDark : P.gold); // hombrera
    cv.rect(x, top + 6, 3, 2, dark ? P.goldDark : P.gold); // guantelete
  };
  const armSwing = (side) => (sideOnly ? -fx * side * stride : Math.round((-fy * side * stride) / 2));

  // Brazo lejano (solo en vistas de perfil, queda detrás del torso)
  if (sideOnly) drawArm(cx - 1 + armSwing(-1), ty + 1, true);

  // Capa: asoma por detrás en las vistas de frente y de perfil
  if (P.cape && !back) cv.shaded(tx - 1, ty + 1, torsoW + 2, 12, P.cape, P.capeLight, P.capeDark);

  // Torso
  cv.shaded(tx, ty, torsoW, torsoH, P.red, P.redLight, P.redDark);
  cv.shaded(tx + 1, tb - 3, torsoW - 2, 4, P.belt, P.beltLight, P.beltDark); // cinturón / abdomen

  if (!back) {
    // Reactor ARC
    const off = sideOnly ? fx * 2 : diag ? fx : 0;
    const ax = cx - 1 + off;
    const ay = ty + 2;
    if (!sideOnly) {
      const ring = pulse === 1 ? P.arcDim : P.arcGlow;
      const pts = [
        [ax - 1, ay], [ax - 1, ay + 1], [ax + 2, ay], [ax + 2, ay + 1],
        [ax, ay - 1], [ax + 1, ay - 1], [ax, ay + 2], [ax + 1, ay + 2],
      ];
      for (const [x, y] of pts) if (x >= tx && x <= tx + torsoW - 1) cv.set(x, y, ring);
    }
    cv.rect(ax, ay, 2, 2, pulse === 2 ? P.arcWhite : P.arc);
  } else {
    // Mochila / propulsores en la espalda
    if (P.cape) {
      cv.shaded(tx - 1, ty, torsoW + 2, 13, P.cape, P.capeLight, P.capeDark);
    } else if (!style.noPack) {
      const bx = cx - 2 + (diag ? fx : 0);
      cv.rect(bx, ty + 1, 4, 4, P.goldDark);
      cv.rect(bx, ty + 1, 4, 1, P.gold);
      cv.rect(bx + 1, ty + 4, 2, 1, P.arcDim);
    }
  }

  // Brazos
  if (sideOnly) {
    drawArm(cx - 1 + armSwing(1), ty + 1, false);
  } else {
    drawArm(tx - 3, ty + armSwing(-1), false);
    drawArm(tx + torsoW, ty + armSwing(1), false);
  }

  // Cabeza (casco)
  const hy = 3 + bob + head;
  const headW = sideOnly ? 9 : 10;
  const hx = cx - Math.floor(headW / 2) + (diag ? fx : 0);
  cv.shaded(hx, hy, headW, 9, P.head, P.headLight, P.headDark);

  if (fy >= 0) {
    let fxs;
    let fw;
    let eyes;
    if (straight) {
      fw = 6;
      fxs = cx - 3;
      eyes = [[fxs, 2], [fxs + 4, 2]];
    } else if (sideOnly) {
      fw = 4;
      fxs = fx > 0 ? hx + headW - fw : hx;
      eyes = [[fx > 0 ? fxs + 2 : fxs, 2]];
    } else {
      fw = 5;
      fxs = cx - 2 + fx * 3;
      eyes = fx > 0 ? [[fxs, 1], [fxs + 3, 2]] : [[fxs + 4, 1], [fxs, 2]];
    }
    cv.shaded(fxs, hy + 2, fw, 7, P.face, P.faceLight, P.faceDark);
    for (const [ex, ew] of eyes) cv.rect(ex, hy + 4, ew, 1, P.eye);
    if (!sideOnly) cv.rect(fxs + Math.floor(fw / 2) - 1, hy + 7, 2, 1, P.faceDark); // boca
  } else if (straight) {
    cv.rect(cx, hy + 1, 1, 7, P.headDark); // costura trasera del casco
  } else {
    cv.rect(fx > 0 ? hx + headW - 1 : hx, hy + 3, 1, 4, P.faceDark); // borde del visor asomando
    cv.rect(cx + fx, hy + 1, 1, 7, P.headDark);
  }

  return addOutline(cv, P.outline);
}

// Orden de filas: abajo, abajo-izq, izq, arriba-izq, arriba, arriba-der, der, abajo-der
const DIRECTIONS = [
  [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1],
];

function buildSheet(style, frames) {
  const sheet = new Canvas(frames.length * FRAME, DIRECTIONS.length * FRAME);
  DIRECTIONS.forEach(([fx, fy], row) => {
    frames.forEach((f, col) => {
      sheet.blit(drawHero(style, { fx, fy, ...f }), col * FRAME, row * FRAME);
    });
  });
  return sheet;
}


// ---------------------------------------------------------------- Iron Man (a partir de la imagen de referencia)

const REF_PALETTE = {
  K: hex('#150909'),
  R: hex('#c80000'),
  r: hex('#880000'),
  d: hex('#560000'),
  Y: hex('#f4d434'),
  O: hex('#c4a400'),
  o: hex('#947200'),
  B: hex('#84b4f4'),
  W: hex('#d4e4f4'),
};

/** Tamaño del cuadro de Iron Man (más alto que el resto por los propulsores) y escala de la referencia. */
const IM_FRAME = { w: 48, h: 48 };
const IM_SCALE = 0.8;
/** Fila (de la referencia) donde terminan las piernas; abajo de eso solo hay llama de los propulsores. */
const IM_FEET_ROW = 43;
/** Fila del cuadro donde están los pies: 6 filas más arriba que el suelo (41), así flota en el aire. */
const IM_FEET_Y = 35;

const refGrid = () => IRON_MAN_REF.map((row) => [...row]);

/** Achica la grilla de letras a `scale`: cada píxel nuevo toma la letra que más ocupa su zona (el contorno pesa un poco más). */
function shrinkGrid(grid, scale) {
  const h = grid.length;
  const w = grid[0].length;
  const ow = Math.ceil(w * scale);
  const oh = Math.ceil(h * scale);
  const out = [];
  for (let oy = 0; oy < oh; oy++) {
    const row = [];
    for (let ox = 0; ox < ow; ox++) {
      const x0 = ox / scale;
      const x1 = (ox + 1) / scale;
      const y0 = oy / scale;
      const y1 = (oy + 1) / scale;
      const weights = {};
      let total = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++)
        for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
          const cover = (Math.min(x + 1, x1) - Math.max(x, x0)) * (Math.min(y + 1, y1) - Math.max(y, y0));
          if (cover <= 0) continue;
          weights[grid[y][x]] = (weights[grid[y][x]] ?? 0) + cover;
          total += cover;
        }
      const empty = weights['.'] ?? 0;
      if (empty > total * 0.55) {
        row.push('.');
        continue;
      }
      let best = '.';
      let bestW = -1;
      for (const [letter, weight] of Object.entries(weights)) {
        if (letter === '.') continue;
        const value = weight * (letter === 'K' ? 1.0 : 1);
        if (value > bestW) {
          bestW = value;
          best = letter;
        }
      }
      row.push(best);
    }
    out.push(row);
  }
  return out;
}

/** Aprieta la grilla en horizontal (para las vistas de perfil y diagonales). */
function squeezeGrid(grid, factor) {
  const w = grid[0].length;
  const nw = Math.max(4, Math.round(w * factor));
  return grid.map((row) => {
    const out = [];
    for (let x = 0; x < nw; x++) {
      const a = Math.floor((x * w) / nw);
      const b = Math.max(a + 1, Math.floor(((x + 1) * w) / nw));
      const counts = {};
      for (let i = a; i < b && i < w; i++) counts[row[i]] = (counts[row[i]] ?? 0) + 1;
      const letters = Object.keys(counts).filter((l) => l !== '.');
      if (letters.length === 0) out.push('.');
      else out.push(letters.sort((l, m) => counts[m] * (m === 'K' ? 1 : 1) - counts[l] * (l === 'K' ? 1 : 1))[0]);
    }
    return out;
  });
}

// fx, fy: hacia dónde mira. stride: -2..2 (piernas abiertas/cerradas). bob: 0/-1 (cuerpo arriba). pulse: 0..2 (largo de las llamas).
function drawIronManRef({ fx, fy, stride = 0, bob = 0, pulse = 0 }) {
  let g = refGrid();
  const h = g.length;
  const w = g[0].length;

  // De espaldas: el casco y el pecho quedan lisos (sin careta ni reactor).
  if (fy < 0) {
    const toRed = { Y: 'R', O: 'r', o: 'd', B: 'R', W: 'R' };
    for (let y = 0; y < 14; y++) for (let x = 0; x < w; x++) g[y][x] = toRed[g[y][x]] ?? g[y][x];
    for (let y = 14; y < 24; y++) for (let x = 12; x < 24; x++) if (g[y][x] === 'B' || g[y][x] === 'W') g[y][x] = 'R';
  }

  // Largo de las llamas de los propulsores (pies abajo, manos a los costados).
  const flame = [10, 7, 9][pulse] ?? 10;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== 'B' && g[y][x] !== 'W') continue;
      const foot = y > IM_FEET_ROW && y - IM_FEET_ROW > flame;
      const hand = y >= 31 && (x <= 8 || x >= 25) && y - 31 > flame + 2;
      if (foot || hand) g[y][x] = '.';
    }

  // Las piernas se abren y se cierran al caminar.
  const sway = Math.round(stride / 2);
  if (sway !== 0) {
    const legs = g.map((row) => [...row]);
    for (let y = 29; y < h; y++)
      for (let x = 9; x < 26; x++) {
        const c = g[y][x];
        if (c === '.') continue;
        legs[y][x] = legs[y][x] === c ? '.' : legs[y][x];
      }
    for (let y = 29; y < h; y++)
      for (let x = 9; x < 26; x++) {
        const c = g[y][x];
        if (c === '.') continue;
        const nx = x + (x < 17 ? -sway : sway);
        if (nx >= 0 && nx < w) legs[y][nx] = c;
      }
    g = legs;
  }

  // Costados y diagonales: el mismo dibujo de frente (o de espaldas), espejado si mira a la izquierda.
  if (fx < 0) g = g.map((row) => row.reverse());

  const small = shrinkGrid(g, IM_SCALE);
  const cv = new Canvas(IM_FRAME.w, IM_FRAME.h);
  const ox = Math.round((IM_FRAME.w - small[0].length) / 2);
  const oy = IM_FEET_Y - Math.round(IM_FEET_ROW * IM_SCALE) + bob;
  small.forEach((row, y) =>
    row.forEach((letter, x) => {
      const color = REF_PALETTE[letter];
      if (color) cv.set(ox + x, oy + y, color);
    }),
  );
  return cv;
}

function buildIronManSheet(frames) {
  const sheet = new Canvas(frames.length * IM_FRAME.w, DIRECTIONS.length * IM_FRAME.h);
  DIRECTIONS.forEach(([fx, fy], row) => {
    frames.forEach((f, col) => {
      sheet.blit(drawIronManRef({ fx, fy, ...f }), col * IM_FRAME.w, row * IM_FRAME.h);
    });
  });
  return sheet;
}

const IDLE_FRAMES = [
  { head: 0, pulse: 0 },
  { head: 0, pulse: 1 },
  { head: 1, pulse: 2 },
  { head: 1, pulse: 1 },
];

const WALK_STRIDE = [0, 2, 2, 0, -2, -2];
const WALK_BOB = [-1, 0, 0, -1, 0, 0];
const WALK_FRAMES = WALK_STRIDE.map((stride, i) => ({ stride, bob: WALK_BOB[i], pulse: i % 2 ? 1 : 0 }));

// Iron Man flota: el cuerpo no se mueve, solo cambia el largo de las llamas de los propulsores.
const IM_IDLE_FRAMES = [0, 1, 2, 1].map((pulse) => ({ pulse }));
const IM_WALK_FRAMES = [0, 1, 2, 1, 2, 1].map((pulse) => ({ pulse }));


// ---------------------------------------------------------------- héroes: un estilo por personaje
// `pal` pisa colores del traje base. red* = traje, gold* = detalles, arc* = emblema del pecho.
const HEROES = {
  ironman: { pal: {} },
  capitan: {
    pal: {
      red: hex('#2a50b8'), redLight: hex('#4a74e0'), redDark: hex('#1b3487'), redDeep: hex('#12235c'),
      gold: hex('#f2f2f2'), goldLight: hex('#ffffff'), goldDark: hex('#b9c0cc'),
      belt: hex('#c8202a'), beltLight: hex('#ea3b44'), beltDark: hex('#8c1119'),
      leg: hex('#2a50b8'), legLight: hex('#4a74e0'), legDark: hex('#1b3487'), legDeep: hex('#12235c'), boot: hex('#8c1119'),
      head: hex('#2a50b8'), headLight: hex('#4a74e0'), headDark: hex('#1b3487'),
      face: hex('#f0c9a0'), faceLight: hex('#ffe3c4'), faceDark: hex('#c4966c'), eye: hex('#1b3487'),
      arc: hex('#ffffff'), arcWhite: hex('#ffffff'), arcGlow: hex('#c8202a'), arcDim: hex('#8c1119'),
    },
    plainLegs: true,
  },
  spiderman: {
    pal: {
      red: hex('#d1202a'), redLight: hex('#f1473f'), redDark: hex('#8c1119'), redDeep: hex('#5a0911'),
      gold: hex('#2a50b8'), goldLight: hex('#4a74e0'), goldDark: hex('#1b3487'),
      belt: hex('#2a50b8'), beltLight: hex('#4a74e0'), beltDark: hex('#1b3487'),
      leg: hex('#2a50b8'), legLight: hex('#4a74e0'), legDark: hex('#1b3487'), legDeep: hex('#12235c'), boot: hex('#d1202a'),
      head: hex('#d1202a'), headLight: hex('#f1473f'), headDark: hex('#8c1119'),
      face: hex('#d1202a'), faceLight: hex('#f1473f'), faceDark: hex('#8c1119'), eye: hex('#ffffff'),
      arc: hex('#15151a'), arcWhite: hex('#15151a'), arcGlow: hex('#15151a'), arcDim: hex('#3a3a46'),
    },
    plainLegs: true,
    noPack: true,
  },
  thor: {
    pal: {
      red: hex('#4a5568'), redLight: hex('#6b7a92'), redDark: hex('#2f3846'), redDeep: hex('#1d232d'),
      gold: hex('#cfd6e0'), goldLight: hex('#ffffff'), goldDark: hex('#8a94a4'),
      belt: hex('#8a5a2b'), beltLight: hex('#b8803f'), beltDark: hex('#5a3a1a'),
      leg: hex('#2f3846'), legLight: hex('#4a5568'), legDark: hex('#1d232d'), legDeep: hex('#12161d'), boot: hex('#5a3a1a'),
      head: hex('#f0d060'), headLight: hex('#fff0a0'), headDark: hex('#b8962b'),
      face: hex('#f0c9a0'), faceLight: hex('#ffe3c4'), faceDark: hex('#c4966c'), eye: hex('#2a50b8'),
      arc: hex('#cfd6e0'), arcWhite: hex('#ffffff'), arcGlow: hex('#8a94a4'), arcDim: hex('#6b7a92'),
      cape: hex('#c4161c'), capeLight: hex('#ea3b30'), capeDark: hex('#8c0f18'),
    },
    plainLegs: true,
  },
  hulk: {
    pal: {
      red: hex('#3fae3a'), redLight: hex('#6fd35f'), redDark: hex('#25782a'), redDeep: hex('#164d1b'),
      gold: hex('#3fae3a'), goldLight: hex('#6fd35f'), goldDark: hex('#25782a'),
      belt: hex('#6a3fa8'), beltLight: hex('#8a5fd0'), beltDark: hex('#452a73'),
      leg: hex('#6a3fa8'), legLight: hex('#8a5fd0'), legDark: hex('#452a73'), legDeep: hex('#2c1b4d'), boot: hex('#2c1b4d'),
      head: hex('#25782a'), headLight: hex('#3fae3a'), headDark: hex('#164d1b'),
      face: hex('#3fae3a'), faceLight: hex('#6fd35f'), faceDark: hex('#164d1b'), eye: hex('#ffffff'),
      arc: hex('#3fae3a'), arcWhite: hex('#3fae3a'), arcGlow: hex('#3fae3a'), arcDim: hex('#3fae3a'),
    },
    plainLegs: true,
    noPack: true,
    wide: true,
  },
};

function saveHero(id) {
  const style = HEROES[id];
  const idle = buildSheet(style, IDLE_FRAMES);
  const walk = buildSheet(style, WALK_FRAMES);
  save(idle, `characters/${id}/${id}-idle.png`);
  save(walk, `characters/${id}/${id}-walk.png`);
  return { idle, walk };
}


// ---------------------------------------------------------------- Capitán y Thor (calcados de las referencias, como Iron Man)
const DRAWN_REFS = { capitan: CAPITAN_REF, thor: THOR_REF, hulk: HULK_REF, spiderman: SPIDERMAN_REF };
const DRAWN_HEROES = Object.keys(DRAWN_REFS);
const DRAWN_FRAME = 48;
/** Las referencias de estos héroes miran a la izquierda (Capitán, Thor e Iron Man miran a la derecha). */
const DRAWN_FACES_LEFT = ['hulk', 'spiderman'];
/** Pies en la fila 40 del cuadro (el suelo está en (24, 41)). Un solo dibujo para todas las direcciones: se espeja según hacia dónde mira el original (`DRAWN_FACES_LEFT`). */
function drawnFrame(id, { fx, stride = 0, bob = 0 }) {
  const rows = DRAWN_REFS[id].map((row) => row.split(' '));
  const h = rows.length;
  const w = rows[0].length;
  let g = rows.map((row) => row.map((c) => (c === '-' ? null : c)));
  // Piernas: se abren y se cierran al caminar (las últimas filas del dibujo, separadas por la mitad de los pies).
  const sway = Math.round(stride / 2);
  if (sway !== 0) {
    const legRow = Math.round(h * 0.68);
    const xs = [];
    for (let y = h - 6; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x]) xs.push(x);
    const mid = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const out = g.map((row, y) => (y < legRow ? [...row] : Array(w).fill(null)));
    for (let y = legRow; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = g[y][x];
        if (!c) continue;
        const nx = x + (x < mid ? -sway : sway);
        if (nx >= 0 && nx < w) out[y][nx] = c;
      }
    g = out;
  }
  // Hacia dónde mira el dibujo original: al ir al lado contrario (o quieto / de frente) se espeja, así sin movimiento lateral todos miran a la derecha.
  const mirror = DRAWN_FACES_LEFT.includes(id) ? fx >= 0 : fx < 0;
  if (mirror) g = g.map((row) => [...row].reverse());
  const cv = new Canvas(DRAWN_FRAME, DRAWN_FRAME);
  const ox = Math.round((DRAWN_FRAME - w) / 2);
  const oy = 41 - h + bob;
  g.forEach((row, y) => row.forEach((c, x) => c && cv.set(ox + x, oy + y, hex(`#${c}`))));
  return cv;
}
function buildDrawnSheet(id, frames) {
  const sheet = new Canvas(frames.length * DRAWN_FRAME, DIRECTIONS.length * DRAWN_FRAME);
  DIRECTIONS.forEach(([fx, fy], row) => {
    frames.forEach((f, col) => sheet.blit(drawnFrame(id, { fx, fy, ...f }), col * DRAWN_FRAME, row * DRAWN_FRAME));
  });
  return sheet;
}
const DRAWN_IDLE = [0, -1, -1, 0].map((bob) => ({ bob }));
const DRAWN_WALK = [0, 2, 2, 0, -2, -2].map((stride, i) => ({ stride, bob: i % 3 === 0 ? -1 : 0 }));


// ---------------------------------------------------------------- Doctor Strange (flota, siempre de frente) y su aura
/** Cuadro de 48×48: flota con los pies en la fila 37 (el suelo está en 41). Sin dibujo de espalda: las 8 filas son iguales. */
function strangeFrame(ref, { bob = 0, sway = 0 }) {
  const rows = ref.map((row) => row.split(' '));
  const w = rows[0].length;
  const cv = new Canvas(DRAWN_FRAME, DRAWN_FRAME);
  const ox = Math.round((DRAWN_FRAME - w) / 2) + sway;
  const oy = 38 - rows.length + bob;
  rows.forEach((row, y) => row.forEach((c, x) => c !== '-' && cv.set(ox + x, oy + y, hex(`#${c}`))));
  return cv;
}
function buildStrangeSheet(frames) {
  const sheet = new Canvas(frames.length * DRAWN_FRAME, DIRECTIONS.length * DRAWN_FRAME);
  DIRECTIONS.forEach((_, row) =>
    frames.forEach((f, col) => sheet.blit(strangeFrame(STRANGE_REF, f), col * DRAWN_FRAME, row * DRAWN_FRAME)),
  );
  return sheet;
}
const STRANGE_IDLE = [0, 1, 1, 0].map((bob) => ({ bob }));
const STRANGE_WALK = [0, 1, 1, 0, 1, 1].map((bob, i) => ({ bob, sway: [0, 1, 1, 0, -1, -1][i] }));


function drawLine(cv, x0, y0, x1, y1, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let t = 0; t <= steps; t++) cv.set(x0 + ((x1 - x0) * t) / steps, y0 + ((y1 - y0) * t) / steps, c);
}
function drawRing(cv, cx, cy, r, c, dash = 0) {
  const n = Math.ceil(r * 8);
  for (let i = 0; i < n; i++) {
    if (dash && Math.floor((i / n) * dash * 2) % 2) continue;
    const a = (i / n) * Math.PI * 2;
    cv.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
  }
}
const AURA_GOLD = hex('#ffc24a');
const AURA_LIGHT = hex('#fff0b8');
const AURA_DIM = hex('#d9741a');
/** Anillo exterior: dos círculos con runas pseudo-mágicas entre medio (como el hechizo de la película). */
function makeAuraOuter() {
  const S = 128;
  const cv = new Canvas(S, S);
  const c = S / 2 - 0.5;
  drawRing(cv, c, c, 62, AURA_GOLD);
  drawRing(cv, c, c, 61, AURA_DIM);
  drawRing(cv, c, c, 49, AURA_GOLD);
  drawRing(cv, c, c, 48, AURA_DIM);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const runes = 16;
  for (let k = 0; k < runes; k++) {
    const a = (k / runes) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const tx = -uy;
    const ty = ux;
    const rc = 55.5;
    const pts = [];
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) pts.push([(rnd() - 0.5) * 7, (rnd() - 0.5) * 8]);
    const at = ([lx, ly]) => [c + ux * (rc + ly) + tx * lx, c + uy * (rc + ly) + ty * lx];
    drawLine(cv, ...at([0, -4]), ...at([0, 4]), AURA_GOLD);
    for (let i = 0; i < pts.length - 1; i++) drawLine(cv, ...at(pts[i]), ...at(pts[i + 1]), AURA_LIGHT);
    const b = (k + 0.5) / runes * Math.PI * 2;
    cv.rect(Math.round(c + Math.cos(b) * 55.5), Math.round(c + Math.sin(b) * 55.5), 1, 1, AURA_LIGHT);
  }
  return cv;
}
/** Mandala interior: estrella de seis puntas dentro de un círculo con rayos finos. */
function makeAuraInner() {
  const S = 128;
  const cv = new Canvas(S, S);
  const c = S / 2 - 0.5;
  drawRing(cv, c, c, 40, AURA_GOLD);
  drawRing(cv, c, c, 28, AURA_DIM, 24);
  for (const rot of [-Math.PI / 2, -Math.PI / 2 + Math.PI / 3]) {
    const p = [0, 1, 2].map((i) => [c + Math.cos(rot + (i * Math.PI * 2) / 3) * 40, c + Math.sin(rot + (i * Math.PI * 2) / 3) * 40]);
    for (let i = 0; i < 3; i++) drawLine(cv, ...p[i], ...p[(i + 1) % 3], AURA_GOLD);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    drawLine(cv, c + Math.cos(a) * 14, c + Math.sin(a) * 14, c + Math.cos(a) * 24, c + Math.sin(a) * 24, AURA_DIM);
  }
  drawRing(cv, c, c, 12, AURA_LIGHT);
  return cv;
}

// ---------------------------------------------------------------- terreno y objetos

function makeGrass(seed) {
  const cv = new Canvas(16, 16);
  const rnd = mulberry32(seed);
  const base = hex('#4a8c3f');
  const lightC = hex('#58a14a');
  const darkC = hex('#3e7a35');
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = rnd();
      cv.set(x, y, v < 0.12 ? darkC : v < 0.3 ? lightC : base);
    }
  if (seed % 2 === 0) {
    const fx = 3 + Math.floor(rnd() * 10);
    const fy = 3 + Math.floor(rnd() * 10);
    cv.set(fx, fy, hex('#f4e04d'));
  }
  return cv;
}

function makeStone(seed) {
  const cv = new Canvas(16, 16);
  const rnd = mulberry32(seed);
  const base = hex('#8f9298');
  const mortar = hex('#6c6f76');
  const light = hex('#a2a5ab');
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) cv.set(x, y, rnd() < 0.2 ? light : base);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    for (let x = 0; x < 16; x++) cv.set(x, y0 + 3, mortar);
    const shift = (row % 2) * 4;
    for (let k = 0; k < 2; k++) for (let y = 0; y < 3; y++) cv.set((shift + k * 8) % 16, y0 + y, mortar);
  }
  return cv;
}

function makeGround() {
  const sheet = new Canvas(16 * 6, 16);
  [makeGrass(1), makeGrass(2), makeGrass(3), makeGrass(4), makeStone(11), makeStone(12)].forEach((t, i) =>
    sheet.blit(t, i * 16, 0),
  );
  return sheet;
}

function makeTree() {
  const cv = new Canvas(32, 40);
  const rnd = mulberry32(7);
  // El tronco arranca dentro de la copa (que se dibuja encima) para que no queden separados.
  cv.shaded(14, 22, 4, 16, hex('#7a4f2a'), hex('#946236'), hex('#4f3118'));
  const blobs = [[16, 13, 11], [9, 18, 8], [23, 18, 8]];
  const dark = hex('#2c6a2e');
  const mid = hex('#3f8a3a');
  const light = hex('#5cae4c');
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 32; x++) {
      let inside = false;
      for (const [bx, by, r] of blobs) if (Math.hypot(x - bx, (y - by) * 1.05) <= r) inside = true;
      if (!inside) continue;
      const t = (y - 13) / 14 + (x - 16) / 40 + (rnd() - 0.5) * 0.25;
      cv.set(x, y, t > 0.55 ? dark : t > -0.1 ? mid : light);
    }
  return addOutline(cv, hex('#10260f'));
}

// Piedra rompible: hoja de 4 cuadros de 16x12 (intacta -> grietas leves -> grietas medias -> muy agrietada).
function makeRock() {
  const sheet = new Canvas(16 * 4, 12);
  const crackDark = hex('#1d1f24');
  const crackMid = hex('#434750');
  const clear = [0, 0, 0, 0];

  const stage1Cracks = [
    [7, 2], [7, 3], [8, 4], [7, 5], [6, 5],
  ];
  const stage2Cracks = [
    ...stage1Cracks,
    [8, 5], [9, 6], [10, 7], [6, 6], [5, 7], [4, 8], [11, 4], [12, 5],
  ];
  const stage3Cracks = [
    ...stage2Cracks,
    [7, 6], [7, 7], [8, 8], [8, 9], [3, 6], [4, 5], [11, 8], [12, 9], [5, 9], [10, 4],
  ];

  for (let stage = 0; stage < 4; stage++) {
    const cv = new Canvas(16, 12);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x - 7.5) / 7.2, (y - 6.5) / 4.6);
        if (d > 1) continue;
        const t = y / 12 + (x - 8) / 40;
        cv.set(x, y, t > 0.62 ? hex('#6b6f78') : t > 0.35 ? hex('#8b909a') : hex('#aeb3bc'));
      }

    // En etapas avanzadas se desprenden pedacitos del borde superior/lateral.
    if (stage >= 2) {
      cv.set(6, 2, clear);
      cv.set(12, 3, clear);
    }
    if (stage >= 3) {
      cv.set(5, 2, clear);
      cv.set(7, 2, clear);
      cv.set(13, 4, clear);
      cv.set(2, 5, clear);
    }

    addOutline(cv, hex('#25272c'));

    const cracks = stage === 1 ? stage1Cracks : stage === 2 ? stage2Cracks : stage === 3 ? stage3Cracks : [];
    for (const [cx, cy] of cracks) {
      if (cv.opaque(cx, cy)) cv.set(cx, cy, crackDark);
      if (stage >= 2 && cv.opaque(cx + 1, cy) && (cx + cy) % 2 === 0) cv.set(cx + 1, cy, crackMid);
    }

    sheet.blit(cv, stage * 16, 0);
  }
  return sheet;
}

// Caja rompible: hoja de 4 cuadros de 16x16 (intacta -> astillada -> agrietada -> a punto de romperse).
function makeCrate() {
  const sheet = new Canvas(16 * 4, 16);
  const outline = hex('#2a1a09');
  const wood = hex('#b07a35');
  const woodLight = hex('#c8924a');
  const woodDark = hex('#6b4519');
  const crack = hex('#1f1105');
  const splinter = hex('#4a2d0f');
  const clear = [0, 0, 0, 0];

  const stage1 = [
    [7, 5], [8, 6], [8, 7], [7, 8], [9, 8],
  ];
  const stage2 = [
    ...stage1,
    [6, 4], [7, 9], [6, 10], [5, 11], [10, 9], [11, 10], [4, 7], [5, 7], [10, 5],
  ];
  const stage3 = [
    ...stage2,
    [8, 9], [8, 10], [9, 11], [9, 12], [4, 12], [3, 12], [12, 6], [11, 6], [6, 12], [7, 13],
    [5, 4], [10, 12], [12, 10], [3, 5], [4, 5],
  ];

  for (let stage = 0; stage < 4; stage++) {
    const cv = new Canvas(16, 16);
    // Cuerpo de la caja en (1..14, 1..14) para dejar 1 px de contorno oscuro alrededor.
    cv.rect(1, 1, 14, 14, wood);
    for (let i = 2; i < 14; i++) {
      cv.set(i, i, woodDark);
      cv.set(15 - i, i, woodDark);
    }
    // Marco de madera
    cv.rect(1, 1, 14, 2, woodDark);
    cv.rect(1, 13, 14, 2, woodDark);
    cv.rect(1, 1, 2, 14, woodDark);
    cv.rect(13, 1, 2, 14, woodDark);
    cv.rect(2, 2, 12, 1, woodLight);
    cv.rect(3, 3, 10, 1, woodLight);

    // En etapas avanzadas se desprenden astillas de las esquinas antes de trazar el contorno.
    if (stage >= 2) {
      cv.set(1, 1, clear);
      cv.set(14, 14, clear);
    }
    if (stage >= 3) {
      cv.set(2, 1, clear);
      cv.set(1, 2, clear);
      cv.set(14, 1, clear);
      cv.set(1, 14, clear);
      // Hueco central de tablas partidas
      cv.rect(7, 7, 2, 2, crack);
    }

    addOutline(cv, outline);

    const cracks = stage === 1 ? stage1 : stage === 2 ? stage2 : stage === 3 ? stage3 : [];
    for (const [cx, cy] of cracks) {
      if (cv.opaque(cx, cy)) cv.set(cx, cy, crack);
      if (stage >= 2 && cv.opaque(cx - 1, cy) && (cx + cy) % 2 === 1) cv.set(cx - 1, cy, splinter);
    }

    sheet.blit(cv, stage * 16, 0);
  }
  return sheet;
}

// ---------------------------------------------------------------- enemigos y proyectil (provisional)

function fillEllipse(cv, cx, cy, rx, ry, colorAt) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      cv.set(x, y, colorAt(dx, dy));
    }
}

// Centinela tipo Ultron (enemigo principal): 8 direcciones (orden DIRECTIONS) x 4 cuadros de 32x32.
// Incluye vistas diagonales (3/4) para que el giro entre frente, costado y espalda sea suave y natural.
function drawUltronBot(fx, fy, frameIdx) {
  const cv = new Canvas(32, 32);
  const outline = hex('#0e0f14');
  const mLight = hex('#b8bcc6');
  const mBase = hex('#888c96');
  const mDark = hex('#5c606a');
  const mDeep = hex('#2d3038');
  const socket = hex('#17181d');
  const scarRed = hex('#941919');
  const redGlow = hex('#e8352b');
  const redBright = hex('#ff6e62');

  const strides = [-2, -1, 2, 1];
  const bobs = [0, -1, 0, -1];
  const stride = strides[frameIdx] ?? 0;
  const bob = bobs[frameIdx] ?? 0;

  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const isFront = fy > 0;
  const isBack = fy < 0;

  // ---------------- 1) PIERNAS (y = 20..30)
  const hipY = 20 + bob;
  if (!sideOnly) {
    // En frente/espalda y diagonal 3/4 las piernas van más juntas (±2 px) para una silueta más estilizada.
    for (const side of [-1, 1]) {
      const step = side * stride;
      const lift = step > 0 ? -1 : 0;
      const sep = 2;
      const diagShift = diag ? Math.round((fx * side * stride) / 3) : 0;
      const lx = cx + side * sep - 1 + diagShift;
      const farLeg = diag && side !== fx;
      const legBase = farLeg ? mDark : mBase;
      const legLight = farLeg ? mBase : mLight;
      // Muslo segmentado con brillo diagonal (2 px de ancho en frente/espalda, 3 px en diagonal)
      const legW = straight ? 2 : 3;
      const legX = straight ? (side < 0 ? cx - 3 : cx + 1) : lx;
      cv.rect(legX, hipY, legW, 4, legBase);
      cv.rect(legX + (side < 0 ? 0 : legW - 1), hipY, 1, 4, legLight);
      // Rodilla oscura
      const kneeY = hipY + 4 + lift;
      cv.rect(legX, kneeY, legW, 2, mDeep);
      // Pantorrilla
      const shinX = straight ? legX : lx + fx;
      cv.rect(shinX, kneeY + 2, legW, 3, legBase);
      cv.rect(shinX + (legW > 2 ? 1 : 0), kneeY + 2, 1, 3, legLight);
      // Bota
      const footY = Math.min(30, kneeY + 5);
      cv.rect(shinX - (side < 0 && straight ? 1 : 0), footY, 3, 2, mDark);
      cv.rect(shinX, footY, 2, 1, legLight);
    }
  } else {
    // Vista de perfil puro: dos piernas en tijera
    for (const layer of [-1, 1]) {
      const step = layer * stride;
      const dark = layer < 0;
      const baseC = dark ? mDark : mBase;
      const lightC = dark ? mBase : mLight;
      const thighX = cx - 1 + Math.round(step * 0.6);
      const kneeX = cx - 1 + step;
      const lift = step * fx > 0 ? -1 : 0;
      cv.rect(thighX, hipY, 3, 4, baseC);
      cv.rect(thighX + (fx > 0 ? 2 : 0), hipY, 1, 4, lightC);
      cv.rect(kneeX, hipY + 4 + lift, 3, 2, mDeep);
      cv.rect(kneeX, hipY + 6 + lift, 3, 3, baseC);
      cv.rect(kneeX + (fx > 0 ? 2 : 0), hipY + 6 + lift, 1, 3, lightC);
      const footX = fx > 0 ? kneeX : kneeX - 1;
      cv.rect(footX, Math.min(30, hipY + 9 + lift), 4, 2, mDark);
      cv.set(footX + (fx > 0 ? 2 : 1), Math.min(30, hipY + 9 + lift), lightC);
    }
  }

  // ---------------- 2) BRAZO LEJANO (en perfil y en diagonal 3/4 queda parcialmente detrás del torso)
  const ty = 12 + bob;
  const drawProfileArm = (swing, isFar) => {
    const baseC = isFar ? mDark : mBase;
    const lightC = isFar ? mBase : mLight;
    const shX = cx - 1 + Math.round(swing * 0.4);
    const shY = ty;
    cv.rect(shX, shY, 3, 3, baseC);
    cv.set(shX + 1, shY, lightC);
    const elbX = shX + Math.round(swing * 0.8);
    const elbY = shY + 3;
    cv.rect(elbX, elbY, 3, 3, baseC);
    cv.set(elbX + 1, elbY + 1, redGlow);
    const foreX = elbX + fx * 2;
    const foreY = elbY + 1;
    cv.rect(foreX, foreY, 3, 3, baseC);
    cv.set(foreX + 1, foreY + 1, redGlow);
    const handX = foreX + fx * 2;
    const handY = foreY - 1;
    cv.rect(handX, handY, 2, 3, baseC);
    cv.set(handX, handY - 1, mDeep);
    cv.set(handX + 1, handY - 1, mDeep);
  };

  if (sideOnly) {
    drawProfileArm(-stride, true);
  }

  // ---------------- 3) TORSO (y = 12..19)
  if (!sideOnly) {
    // En frente/espalda mide 8 px (más estilizado); en diagonal 3/4 mide 7 px.
    const chestW = straight ? 8 : 7;
    const waistW = straight ? 6 : 5;
    const hipW = 5;
    const tx = cx - Math.floor(chestW / 2);
    const centerShift = diag ? fx : 0;
    const midX = cx + centerShift;

    cv.shaded(tx, ty, chestW, 5, mBase, mLight, mDark);
    cv.shaded(cx - Math.floor(waistW / 2), ty + 5, waistW, 2, mBase, mLight, mDark);
    cv.shaded(cx - Math.floor(hipW / 2), ty + 7, hipW, 2, mDark, mBase, mDeep);

    if (isFront) {
      // Brillo del esternón y ranuras pectorales desplazados hacia donde gira el torso
      cv.rect(midX - 1, ty + 1, 2, 3, mLight);
      cv.set(midX - 2, ty + 2, mDeep);
      if (midX + 1 < tx + chestW) cv.set(midX + 1, ty + 2, mDeep);
      // Nodos rojos en V del pecho
      if (midX - 2 >= tx) cv.set(midX - 2, ty + 4, redGlow);
      if (midX + 1 < tx + chestW) cv.set(midX + 1, ty + 4, redGlow);
      cv.set(midX - 1, ty + 5, redBright);
      cv.set(midX, ty + 5, redBright);
      cv.rect(cx - Math.floor(hipW / 2), ty + 6, hipW, 1, mDeep);
    } else if (isBack) {
      // Columna vertebral cibernética (en diagonal 3/4 se desplaza levemente hacia -fx)
      const spineX = cx - (diag ? fx : 0);
      cv.rect(spineX - 1, ty, 2, 8, mDeep);
      for (let y = ty + 1; y <= ty + 6; y += 2) cv.rect(spineX - 1, y, 2, 1, mLight);
      if (spineX - 2 >= tx) cv.set(spineX - 2, ty + 2, scarRed);
      if (spineX + 1 < tx + chestW) cv.set(spineX + 1, ty + 2, scarRed);
      cv.set(spineX - 2, ty + 4, redGlow);
      if (spineX + 1 < tx + chestW) cv.set(spineX + 1, ty + 4, redGlow);
    }
  } else {
    // Torso de perfil puro (6 px)
    const tx = cx - 3;
    cv.shaded(tx, ty, 6, 5, mBase, mLight, mDark);
    cv.shaded(tx + 1, ty + 5, 5, 3, mDark, mBase, mDeep);
    const frontX = fx > 0 ? tx + 5 : tx;
    cv.rect(frontX, ty + 1, 1, 4, mLight);
    cv.set(frontX - fx, ty + 3, redGlow);
    cv.set(frontX - fx * 2, ty + 4, redBright);
    const backX = fx > 0 ? tx : tx + 5;
    cv.rect(backX, ty + 1, 1, 5, mDeep);
  }

  // ---------------- 4) BRAZOS
  if (sideOnly) {
    drawProfileArm(stride, false);
  } else {
    for (const side of [-1, 1]) {
      const swing = Math.round((side * stride) / 2);
      // Hombros más pegados al torso (2 px por brazo) para que de frente y espaldas se vea más fino y proporcionado
      const shX = straight
        ? (side < 0 ? cx - 6 : cx + 4)
        : (side < 0 ? cx - 5 : cx + 3);
      const shY = ty + (swing > 0 ? 1 : 0);
      const farArm = diag && side !== fx;
      const armBase = farArm ? mDark : mBase;
      const armLight = farArm ? mBase : mLight;
      const armDark = farArm ? mDeep : mDark;

      cv.shaded(shX, shY, 2, 3, armBase, armLight, armDark);
      const raised = (isFront && (diag ? side === fx : side > 0)) || (isBack && (diag ? side === fx : side < 0));
      if (raised) {
        const armX = shX + (diag ? fx : 0);
        cv.rect(armX, shY + 3, 2, 3, armBase);
        cv.set(armX + (side > 0 ? 1 : 0), shY + 4, redGlow);
        const clawX = armX + (diag ? fx : side);
        const clawY = shY;
        cv.shaded(clawX, clawY + 1, 2, 3, armBase, armLight, armDark);
        cv.set(clawX, clawY - 1, mDeep);
        cv.set(clawX + 1, clawY - 1, mDeep);
      } else {
        const armX = shX;
        cv.shaded(armX, shY + 3, 2, 3, armBase, armLight, armDark);
        cv.set(armX + (side < 0 ? 0 : 1), shY + 4, redGlow);
        cv.shaded(armX, shY + 6, 2, 3, armBase, armLight, armDark);
        cv.set(armX + (side < 0 ? 0 : 1), shY + 7, redGlow);
        cv.rect(armX, shY + 9, 2, 2, armDark);
      }
    }
  }

  // ---------------- 5) CABEZA (y = 2..11)
  const hy = 2 + bob;
  if (straight) {
    cv.shaded(cx - 3, hy, 6, 2, mBase, mLight, mDark);
    cv.shaded(cx - 4, hy + 2, 8, 5, mBase, mLight, mDark);
    cv.shaded(cx - 3, hy + 7, 6, 3, mDark, mBase, mDeep);
    cv.rect(cx - 5, hy + 4, 1, 2, mBase);
    cv.rect(cx + 4, hy + 4, 1, 2, mBase);

    if (isFront) {
      cv.rect(cx - 2, hy + 1, 2, 2, mLight);
      cv.rect(cx - 2, hy + 2, 1, 3, scarRed);
      cv.rect(cx + 1, hy + 2, 1, 3, scarRed);
      cv.set(cx - 2, hy + 1, scarRed);
      cv.rect(cx - 3, hy + 5, 2, 2, socket);
      cv.rect(cx + 1, hy + 5, 2, 2, socket);
      cv.rect(cx - 3, hy + 5, 2, 1, redBright);
      cv.rect(cx + 1, hy + 5, 2, 1, redBright);
      cv.set(cx - 2, hy + 6, redGlow);
      cv.set(cx + 1, hy + 6, redGlow);
      cv.rect(cx - 3, hy + 7, 6, 2, socket);
      cv.set(cx - 2, hy + 8, mBase);
      cv.set(cx, hy + 8, mBase);
      cv.set(cx + 1, hy + 8, mBase);
    } else {
      cv.rect(cx - 2, hy + 1, 2, 2, mLight);
      cv.rect(cx, hy + 1, 1, 7, mDeep);
      cv.rect(cx - 2, hy + 6, 4, 1, mDeep);
      cv.rect(cx - 1, hy + 4, 2, 2, scarRed);
      cv.set(cx, hy + 4, redGlow);
    }
  } else if (diag) {
    // Cabeza en diagonal 3/4: punto intermedio entre frente/espalda y perfil
    const hx = cx - 4;
    cv.shaded(hx + 1, hy, 6, 2, mBase, mLight, mDark);
    cv.shaded(hx, hy + 2, 8, 5, mBase, mLight, mDark);
    cv.shaded(hx + 1, hy + 7, 6, 3, mDark, mBase, mDeep);
    // Oreja visible del lado cercano (-fx)
    const earX = fx > 0 ? hx - 1 : hx + 8;
    cv.rect(earX, hy + 4, 1, 2, mDark);

    if (isFront) {
      // En 3/4 de frente se ven los dos ojos y las dos marcas rojas pero desplazados hacia fx
      const s1 = fx > 0 ? cx - 1 : cx - 3;
      const s2 = fx > 0 ? cx + 2 : cx;
      cv.rect(s1, hy + 2, 1, 3, scarRed);
      cv.rect(s2, hy + 2, 1, 3, scarRed);
      // Ojo cercano al centro (2 px) y ojo del borde (2 px)
      const eNear = fx > 0 ? cx - 1 : cx - 1;
      const eFar = fx > 0 ? cx + 2 : cx - 4;
      cv.rect(eNear, hy + 5, 2, 2, socket);
      cv.rect(eFar, hy + 5, 2, 2, socket);
      cv.rect(eNear, hy + 5, 2, 1, redBright);
      cv.rect(eFar, hy + 5, 2, 1, redBright);
      cv.set(eNear + 1, hy + 6, redGlow);
      cv.set(eFar + (fx > 0 ? 1 : 0), hy + 6, redGlow);
      // Rejilla bucal desplazada hacia fx
      const jawX = fx > 0 ? cx - 1 : cx - 3;
      cv.rect(jawX, hy + 7, 5, 2, socket);
      cv.set(jawX + 1, hy + 8, mBase);
      cv.set(jawX + 3, hy + 8, mBase);
    } else {
      // En 3/4 de espaldas se ve la nuca desplazada hacia -fx y un destello del ojo/mandíbula en el borde fx
      const seamX = cx - fx;
      cv.rect(seamX, hy + 1, 1, 7, mDeep);
      cv.rect(seamX - 1, hy + 4, 2, 2, scarRed);
      cv.set(seamX, hy + 4, redGlow);
      const edgeX = fx > 0 ? hx + 7 : hx;
      cv.set(edgeX, hy + 5, redGlow);
      cv.rect(edgeX, hy + 6, 1, 2, socket);
    }
  } else {
    // Cabeza de perfil puro
    const hx = cx - 4;
    cv.shaded(hx + 1, hy, 7, 2, mBase, mLight, mDark);
    cv.shaded(hx, hy + 2, 9, 5, mBase, mLight, mDark);
    cv.shaded(hx + 1, hy + 7, 7, 3, mDark, mBase, mDeep);
    cv.rect(cx - 1, hy + 4, 2, 3, mDeep);
    cv.set(cx - 1, hy + 5, mBase);

    const faceX = fx > 0 ? hx + 6 : hx;
    const scarX = fx > 0 ? hx + 6 : hx + 2;
    cv.rect(scarX, hy + 2, 1, 3, scarRed);
    cv.rect(faceX, hy + 5, 3, 2, socket);
    cv.rect(fx > 0 ? faceX + 1 : faceX, hy + 5, 2, 1, redBright);
    cv.set(faceX + 1, hy + 6, redGlow);
    cv.rect(faceX, hy + 7, 3, 2, socket);
    cv.set(faceX + 1, hy + 8, mBase);
  }

  return addOutline(cv, outline);
}

function makeDrone() {
  const framesPerDir = 4;
  const sheet = new Canvas(32 * framesPerDir, 32 * DIRECTIONS.length);
  DIRECTIONS.forEach(([fx, fy], row) => {
    for (let col = 0; col < framesPerDir; col++) {
      sheet.blit(drawUltronBot(fx, fy, col), col * 32, row * 32);
    }
  });
  return sheet;
}

// Cráneo Rojo / Red Skull (primer jefe grande, OVERLORD): 8 direcciones (orden DIRECTIONS) x 4 cuadros de 48x48.
// Fiel a la imagen de referencia: cráneo carmesí con pómulos marcados, cuencas oscuras y pupilas claras,
// gabardina militar oscura de HYDRA con solapas, botones dorados, hebilla plateada, brazalete/emblema rojo de HYDRA,
// faldón largo acampanado con forro interior bordó y botas negras altas.
function drawRedSkull(fx, fy, frameIdx) {
  const cv = new Canvas(48, 48);
  const outline = hex('#09080a');
  // Cráneo carmesí
  const skullLight = hex('#b83838');
  const skullBase = hex('#8e2222');
  const skullDark = hex('#5c1313');
  const skullDeep = hex('#170808');
  const eyeDot = hex('#f2e6d0');
  // Gabardina militar oscura de HYDRA
  const coatLight = hex('#343b32');
  const coatBase = hex('#222720');
  const coatDark = hex('#151814');
  const coatLining = hex('#3d1717');
  // Detalles del uniforme: rojo HYDRA, botones dorados, hebilla/insignias plateadas y cuero negro
  const hydraRed = hex('#a82424');
  const hydraBright = hex('#d63838');
  const brass = hex('#d4b24c');
  const silver = hex('#b8c0c8');
  const silverDark = hex('#6e7680');
  const leather = hex('#16181c');
  const leatherLight = hex('#363b44');

  const strides = [-2, -1, 2, 1];
  const bobs = [0, -1, 0, -1];
  const stride = strides[frameIdx] ?? 0;
  const bob = bobs[frameIdx] ?? 0;

  const cx = 24;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const isFront = fy > 0;
  const isBack = fy < 0;
  const ty = 17 + bob;

  // ---------------- 1) BOTAS MILITARES ALTAS Y FALDÓN DE LA GABARDINA (y = 26..44)
  const coatTop = 26 + bob;
  if (!sideOnly) {
    // Forro interior bordó oscuro entre las piernas (debajo del faldón abierto)
    if (isFront) {
      cv.rect(cx - 3, coatTop + 2, 6, 9, coatLining);
    }
    for (const side of [-1, 1]) {
      const step = side * stride;
      const lift = step > 0 ? -1 : 0;
      const sep = straight ? 5 : 4;
      const lx = cx + side * sep - 2;

      // Faldón acampanado de la gabardina a cada lado (y = 26..36)
      const tailW = straight ? 7 : 6;
      const tailX = side < 0 ? cx - (straight ? 9 : 7) : cx + 2;
      cv.shaded(tailX, coatTop, tailW, 10, coatBase, coatLight, coatDark);
      // Borde inferior acampanado hacia afuera como en la imagen
      cv.rect(tailX + (side < 0 ? -1 : 1), coatTop + 6, tailW, 5, coatBase);
      cv.rect(tailX + (side < 0 ? -1 : 1), coatTop + 10, tailW, 1, coatDark);

      // Bota negra militar alta (caña + pie)
      const bootY = 36 + bob + lift;
      cv.shaded(lx, bootY, 4, 6, leather, leatherLight, outline);
      cv.rect(lx + 1, bootY + 1, 1, 4, leatherLight); // brillo de la caña
      const footX = side < 0 ? lx - 2 : lx;
      cv.rect(footX, bootY + 6, 6, 3, leather);
      cv.rect(footX + (side < 0 ? 1 : 2), bootY + 6, 3, 1, leatherLight);
    }
  } else {
    // Perfil: faldón de la gabardina y botas en paso de marcha
    for (const layer of [-1, 1]) {
      const step = layer * stride * 2;
      const lift = step * fx > 0 ? -1 : 0;
      const bx = cx - 2 + step;
      const bootY = 36 + bob + lift;
      cv.shaded(bx, bootY, 4, 6, leather, leatherLight, outline);
      const footX = fx > 0 ? bx : bx - 2;
      cv.rect(footX, bootY + 6, 6, 3, leather);
      cv.rect(footX + (fx > 0 ? 3 : 1), bootY + 6, 2, 1, leatherLight);
    }
    cv.shaded(cx - 5, coatTop, 10, 11, coatBase, coatLight, coatDark);
    cv.rect(cx - 6, coatTop + 6, 12, 5, coatBase);
    cv.rect(cx, coatTop + 2, 1, 9, coatDark);
  }

  // ---------------- 2) TORSO: CHAQUETA DE OFICIAL DE HYDRA, SOLAPAS, BOTONES DORADOS Y CINTURÓN (y = 17..26)
  if (!sideOnly) {
    const chestW = straight ? 14 : 12;
    const tx = cx - Math.floor(chestW / 2);
    const midX = cx + (diag ? fx * 2 : 0);

    cv.shaded(tx, ty, chestW, 9, coatBase, coatLight, coatDark);
    // Hombreras / charreteras militares con borde dorado y rojo
    cv.rect(tx - 1, ty, 4, 2, coatLight);
    cv.rect(tx + chestW - 3, ty, 4, 2, coatLight);
    cv.rect(tx, ty, 2, 1, brass);
    cv.rect(tx + chestW - 2, ty, 2, 1, brass);
    cv.set(tx - 1, ty + 1, hydraRed);
    cv.set(tx + chestW, ty + 1, hydraRed);

    // Cinturón de cuero negro con hebilla cuadrada plateada en el centro
    cv.rect(tx, ty + 8, chestW, 2, leather);

    if (isFront) {
      cv.rect(midX - 2, ty + 7, 4, 4, silver);
      cv.rect(midX - 1, ty + 8, 2, 2, silverDark);
      // Cuello militar, corbata/cuello interior rojo oscuro e insignias plateadas en las solapas
      cv.rect(midX - 2, ty, 4, 2, skullDark);
      cv.set(midX - 4, ty + 1, silver);
      cv.set(midX + 3, ty + 1, silver);
      // Solapas cruzadas con vivos rojos sutiles
      cv.rect(midX - 4, ty + 2, 8, 2, coatLight);
      cv.set(midX - 4, ty + 3, hydraRed);
      cv.set(midX + 3, ty + 3, hydraRed);
      // Correa diagonal de cuero y doble hilera de botones dorados (idénticos a la imagen)
      cv.set(midX - 4, ty + 2, leatherLight);
      cv.set(midX - 3, ty + 4, leatherLight);
      cv.set(midX - 2, ty + 6, leatherLight);
      cv.set(midX - 2, ty + 5, brass);
      cv.set(midX + 1, ty + 5, brass);
      cv.set(midX - 2, ty + 7, brass);
      cv.set(midX + 1, ty + 7, brass);
      // Cartuchera/funda en la cadera izquierda del sprite
      cv.rect(tx, ty + 9, 3, 4, leather);
    } else if (isBack) {
      const spineX = cx - (diag ? fx : 0);
      cv.rect(spineX, ty + 1, 1, 7, coatDark);
    }
  } else {
    const tx = cx - 5;
    cv.shaded(tx, ty, 10, 9, coatBase, coatLight, coatDark);
    cv.rect(tx + 3, ty, 4, 1, brass);
    // Cinturón en perfil
    cv.rect(tx, ty + 8, 10, 2, leather);
    cv.rect(fx > 0 ? tx + 8 : tx, ty + 7, 2, 4, silver);
  }

  // ---------------- 3) BRAZOS CON PARCHE Y BRAZALETE ROJO DE HYDRA Y GUANTES NEGROS
  if (sideOnly) {
    const armX = cx - 2;
    cv.shaded(armX, ty + 1, 4, 7, coatBase, coatLight, coatDark);
    // Brazalete/emblema rojo de HYDRA en la manga
    cv.rect(armX, ty + 3, 4, 2, hydraRed);
    cv.set(armX + 1, ty + 3, hydraBright);
    // Antebrazo levantado hacia fx con puño enguantado (como en la pose de la foto)
    const foreX = armX + fx * 3;
    cv.shaded(foreX, ty + 3, 4, 4, coatBase, coatLight, coatDark);
    cv.rect(foreX, ty + 6, 4, 1, hydraRed);
    const gloveX = foreX + fx * 2;
    cv.shaded(gloveX, ty + 1, 4, 4, leather, leatherLight, outline);
  } else {
    for (const side of [-1, 1]) {
      const swing = Math.round((side * stride) / 2);
      const shX = straight
        ? (side < 0 ? cx - 11 : cx + 7)
        : (side < 0 ? cx - 9 : cx + 5);
      const shY = ty + 1 + (swing > 0 ? 1 : 0);

      // El brazo derecho de la imagen (side > 0 en frente) tiene el puño enguantado levantado y brazalete rojo;
      // el otro brazo (side < 0 en frente) apoya en la cintura con el parche redondo de HYDRA en el hombro.
      const raised = (isFront && side > 0) || (isBack && side < 0);
      if (raised) {
        cv.shaded(shX, shY, 4, 6, coatBase, coatLight, coatDark);
        cv.rect(shX, shY + 3, 4, 2, hydraRed); // brazalete rojo de HYDRA
        cv.set(shX + 1, shY + 5, hydraRed); // vivo rojo del puño
        const fistX = shX + side * 3;
        const fistY = shY - 1;
        cv.shaded(fistX, fistY + 2, 4, 4, coatBase, coatLight, coatDark);
        // Guante de cuero negro cerrado en puño amenazante (idéntico a la referencia)
        cv.shaded(fistX, fistY - 1, 4, 4, leather, leatherLight, outline);
      } else {
        cv.shaded(shX, shY, 4, 7, coatBase, coatLight, coatDark);
        // Parche redondo rojo de HYDRA en la manga superior
        cv.rect(shX + 1, shY + 1, 2, 3, hydraRed);
        cv.set(shX + 1, shY + 2, hydraBright);
        // Vivo rojo en la bocamanga y guante negro en la cintura
        cv.rect(shX, shY + 6, 4, 1, hydraRed);
        cv.shaded(shX + (side < 0 ? 2 : -2), shY + 6, 4, 3, leather, leatherLight, outline);
      }
    }
  }

  // ---------------- 4) CABEZA: EL CRÁNEO ROJO (y = 3..16)
  const hy = 3 + bob;
  if (straight) {
    // Bóveda craneal carmesí amplia y redondeada (12x8 arriba, pómulos salientes en y+6..8, mandíbula cuadrada 8x4 abajo)
    cv.shaded(cx - 5, hy, 10, 2, skullBase, skullLight, skullDark);
    cv.shaded(cx - 6, hy + 2, 12, 7, skullBase, skullLight, skullDark);
    cv.shaded(cx - 4, hy + 9, 8, 5, skullBase, skullLight, skullDark);

    if (isFront) {
      // Brillo frontal del cráneo y arcos superciliares fruncidos
      cv.rect(cx - 4, hy + 1, 5, 2, skullLight);
      cv.rect(cx - 4, hy + 4, 3, 1, skullLight);
      cv.rect(cx + 1, hy + 4, 3, 1, skullLight);
      cv.set(cx - 1, hy + 4, skullDark);
      cv.set(cx, hy + 4, skullDark);

      // Cuencas oculares negras profundas con pupilas claras penetrantes (como en la imagen)
      cv.rect(cx - 5, hy + 5, 4, 2, skullDeep);
      cv.rect(cx + 1, hy + 5, 4, 2, skullDeep);
      cv.set(cx - 3, hy + 6, eyeDot);
      cv.set(cx + 2, hy + 6, eyeDot);

      // Pómulos salientes a los lados y fosa nasal triangular negra
      cv.rect(cx - 6, hy + 7, 2, 2, skullLight);
      cv.rect(cx + 4, hy + 7, 2, 2, skullLight);
      cv.rect(cx - 1, hy + 7, 2, 2, skullDeep);

      // Surcos de las mejillas y boca esquelética severa
      cv.set(cx - 4, hy + 9, skullDeep);
      cv.set(cx + 3, hy + 9, skullDeep);
      cv.rect(cx - 3, hy + 10, 6, 1, skullDeep);
      cv.rect(cx - 2, hy + 11, 4, 2, skullLight); // mentón
    } else {
      // Cráneo visto de atrás con suturas óseas oscuras
      cv.rect(cx - 3, hy + 1, 4, 3, skullLight);
      cv.rect(cx, hy + 2, 1, 8, skullDark);
      cv.rect(cx - 4, hy + 8, 8, 1, skullDark);
    }
  } else if (diag) {
    // Cráneo en 3/4 (45°)
    const hx = cx - 5;
    cv.shaded(hx + 1, hy, 9, 2, skullBase, skullLight, skullDark);
    cv.shaded(hx, hy + 2, 11, 7, skullBase, skullLight, skullDark);
    cv.shaded(hx + 2, hy + 9, 7, 5, skullBase, skullLight, skullDark);

    if (isFront) {
      const faceX = fx > 0 ? cx - 2 : cx - 5;
      cv.rect(faceX, hy + 5, 3, 2, skullDeep);
      cv.rect(faceX + 4, hy + 5, 3, 2, skullDeep);
      cv.set(faceX + 1, hy + 6, eyeDot);
      cv.set(faceX + 5, hy + 6, eyeDot);
      cv.rect(faceX + 3, hy + 7, 2, 2, skullDeep); // fosa nasal
      cv.rect(faceX + 1, hy + 10, 5, 1, skullDeep); // boca
    } else {
      cv.rect(cx - fx, hy + 2, 1, 8, skullDark);
    }
  } else {
    // Cráneo en perfil puro
    const hx = cx - 5;
    cv.shaded(hx + 1, hy, 8, 2, skullBase, skullLight, skullDark);
    cv.shaded(hx, hy + 2, 10, 7, skullBase, skullLight, skullDark);
    cv.shaded(hx + 2, hy + 9, 7, 5, skullBase, skullLight, skullDark);
    const eyeX = fx > 0 ? hx + 7 : hx + 1;
    cv.rect(eyeX, hy + 5, 3, 2, skullDeep);
    cv.set(eyeX + 1, hy + 6, eyeDot);
    const noseX = fx > 0 ? hx + 9 : hx;
    cv.set(noseX, hy + 7, skullDeep);
    cv.rect(fx > 0 ? hx + 6 : hx + 1, hy + 10, 4, 1, skullDeep);
  }

  return addOutline(cv, outline);
}

function makeOverlord() {
  const framesPerDir = 4;
  const sheet = new Canvas(48 * framesPerDir, 48 * DIRECTIONS.length);
  DIRECTIONS.forEach(([fx, fy], row) => {
    for (let col = 0; col < framesPerDir; col++) {
      sheet.blit(drawRedSkull(fx, fy, col), col * 48, row * 48);
    }
  });
  return sheet;
}

// Outrider (súbdito de Thanos en Endgame, reemplaza a las abejas en SCOUT):
// 8 direcciones (orden DIRECTIONS) x 4 cuadros de 32x32.
// Piel azul-gris oscura, cresta espinosa, colmillos amarillentos, marcas doradas en V en el pecho,
// 4 brazos con garras y 2 tentáculos dorsales curvos en los hombros.
function drawOutrider(fx, fy, frameIdx) {
  const cv = new Canvas(32, 32);
  const outline = hex('#090a0f');
  const sLight = hex('#4c5668');
  const sBase = hex('#313947');
  const sDark = hex('#1e232d');
  const sDeep = hex('#13161d');
  const gum = hex('#7d4940');
  const tooth = hex('#e6d88a');
  const gold = hex('#c9b062');
  const goldDark = hex('#8f7838');

  const strides = [-2, -1, 2, 1];
  const bobs = [0, -1, 0, -1];
  const stride = strides[frameIdx] ?? 0;
  const bob = bobs[frameIdx] ?? 0;

  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const isFront = fy > 0;
  const isBack = fy < 0;
  const ty = 12 + bob;

  // ---------------- 1) TENTÁCULOS DORSALES CURVOS (salen detrás de los hombros y se arquean arriba afuera)
  if (!sideOnly) {
    for (const side of [-1, 1]) {
      const tx0 = cx + side * 4;
      const sway = frameIdx % 2 === 0 ? 0 : 1;
      // Tallo curvo bien separado de la cabeza con pinza dorada en la punta (como en la foto)
      cv.rect(tx0, ty - 1, 2, 1, sDark);
      cv.rect(tx0 + side, ty - 2, 2, 1, sDark);
      cv.rect(tx0 + side * 2, ty - 4 + sway, 2, 2, sBase);
      cv.set(tx0 + side * 3, ty - 5 + sway, sLight);
      cv.set(tx0 + side * 2, ty - 6 + sway, goldDark);
      cv.set(tx0 + side, ty - 6 + sway, tooth);
    }
  } else {
    // En perfil los tentáculos dorsales se arquean claramente detrás de la espalda (-fx)
    const backDir = -fx;
    const sway = frameIdx % 2 === 0 ? 0 : 1;
    cv.rect(cx + backDir * 3, ty - 1, 2, 1, sDark);
    cv.rect(cx + backDir * 5, ty - 3 + sway, 2, 2, sBase);
    cv.set(cx + backDir * 6, ty - 4 + sway, sLight);
    cv.set(cx + backDir * 5, ty - 5 + sway, goldDark);
    cv.set(cx + backDir * 4, ty - 5 + sway, tooth);
  }

  // ---------------- 2) PIERNAS CON GARRAS (y = 20..30)
  const hipY = 20 + bob;
  if (!sideOnly) {
    for (const side of [-1, 1]) {
      const step = side * stride;
      const lift = step > 0 ? -1 : 0;
      const sep = 2;
      const diagShift = diag ? Math.round((fx * side * stride) / 3) : 0;
      const lx = cx + side * sep - 1 + diagShift;
      const farLeg = diag && side !== fx;
      const legBase = farLeg ? sDark : sBase;
      const legLight = farLeg ? sBase : sLight;

      const legW = straight ? 2 : 3;
      const legX = straight ? (side < 0 ? cx - 3 : cx + 1) : lx;
      // Muslo musculoso
      cv.rect(legX, hipY, legW, 4, legBase);
      cv.rect(legX + (side < 0 ? 0 : legW - 1), hipY, 1, 3, legLight);
      // Rodilla y pantorrilla
      const kneeY = hipY + 4 + lift;
      cv.rect(legX, kneeY, legW, 2, sDark);
      const shinX = straight ? legX : lx + fx;
      cv.rect(shinX, kneeY + 2, legW, 3, legBase);
      cv.set(shinX + (legW > 2 ? 1 : 0), kneeY + 2, legLight);
      // Pie con garras amarillas como en la foto
      const footY = Math.min(30, kneeY + 5);
      const footX = shinX - (side < 0 && straight ? 1 : 0);
      cv.rect(footX, footY, 3, 2, sDark);
      cv.set(footX, footY + 1, tooth);
      cv.set(footX + 1, footY + 1, tooth);
      cv.set(footX + 2, footY + 1, gold);
    }
  } else {
    for (const layer of [-1, 1]) {
      const step = layer * stride;
      const dark = layer < 0;
      const baseC = dark ? sDark : sBase;
      const lightC = dark ? sBase : sLight;
      const thighX = cx - 1 + Math.round(step * 0.6);
      const kneeX = cx - 1 + step;
      const lift = step * fx > 0 ? -1 : 0;
      cv.rect(thighX, hipY, 3, 4, baseC);
      cv.rect(thighX + (fx > 0 ? 2 : 0), hipY, 1, 3, lightC);
      cv.rect(kneeX, hipY + 4 + lift, 3, 2, sDark);
      cv.rect(kneeX, hipY + 6 + lift, 3, 3, baseC);
      const footY = Math.min(30, hipY + 9 + lift);
      const footX = fx > 0 ? kneeX : kneeX - 1;
      cv.rect(footX, footY, 4, 2, sDark);
      cv.set(footX + (fx > 0 ? 3 : 0), footY + 1, tooth);
      cv.set(footX + (fx > 0 ? 1 : 2), footY + 1, gold);
    }
  }

  // ---------------- 3) BRAZOS DE PERFIL LEJANOS
  const drawProfileArms = (swing, isFar) => {
    const baseC = isFar ? sDark : sBase;
    const lightC = isFar ? sBase : sLight;
    const shX = cx - 1 + Math.round(swing * 0.4);
    // Brazo superior con franja dorada en el hombro y garras adelante
    cv.rect(shX, ty, 3, 3, baseC);
    cv.rect(shX, ty + 1, 3, 1, goldDark);
    const foreX = shX + fx * 2;
    cv.rect(foreX, ty + 2, 3, 3, baseC);
    cv.set(foreX + 1, ty + 2, lightC);
    const handX = foreX + fx * 2;
    cv.rect(handX, ty, 2, 3, baseC);
    cv.set(handX, ty - 1, tooth);
    cv.set(handX + 1, ty - 1, gold);
    // Brazo inferior secundario (4 brazos del Outrider)
    const lowX = shX + fx;
    cv.rect(lowX, ty + 5, 2, 4, sDark);
    cv.set(lowX + fx, ty + 8, gold);
  };

  if (sideOnly) {
    drawProfileArms(-stride, true);
  }

  // ---------------- 4) TORSO CON MARCAS DORADAS EN V (y = 12..19)
  if (!sideOnly) {
    const chestW = straight ? 8 : 7;
    const waistW = straight ? 6 : 5;
    const hipW = 5;
    const tx = cx - Math.floor(chestW / 2);
    const midX = cx + (diag ? fx : 0);

    cv.shaded(tx, ty, chestW, 5, sBase, sLight, sDark);
    cv.shaded(cx - Math.floor(waistW / 2), ty + 5, waistW, 2, sBase, sLight, sDark);
    cv.shaded(cx - Math.floor(hipW / 2), ty + 7, hipW, 2, sDark, sBase, sDeep);

    if (isFront) {
      // Arnés/marcas doradas en V que bajan desde los hombros al centro del pecho (idénticas a la foto)
      cv.set(tx + 1, ty, gold);
      cv.set(tx + chestW - 2, ty, gold);
      cv.set(midX - 2, ty + 1, gold);
      if (midX + 1 < tx + chestW) cv.set(midX + 1, ty + 1, gold);
      cv.set(midX - 2, ty + 2, gold);
      cv.set(midX + 1, ty + 2, gold);
      cv.rect(midX - 1, ty + 3, 2, 2, goldDark);
      // Puntos dorados en el abdomen/costillas
      cv.set(midX - 2, ty + 5, goldDark);
      cv.set(midX + 1, ty + 5, goldDark);
      cv.set(midX - 1, ty + 6, gold);
      cv.set(midX, ty + 6, gold);
    } else if (isBack) {
      const spineX = cx - (diag ? fx : 0);
      cv.rect(spineX - 1, ty, 2, 8, sDeep);
      for (let y = ty + 1; y <= ty + 6; y += 2) cv.rect(spineX - 1, y, 2, 1, sLight);
      // Tiras doradas cruzadas en la espalda
      cv.set(spineX - 2, ty + 1, goldDark);
      if (spineX + 1 < tx + chestW) cv.set(spineX + 1, ty + 1, goldDark);
      cv.set(spineX - 2, ty + 2, gold);
      if (spineX + 1 < tx + chestW) cv.set(spineX + 1, ty + 2, gold);
    }
  } else {
    const tx = cx - 3;
    cv.shaded(tx, ty, 6, 5, sBase, sLight, sDark);
    cv.shaded(tx + 1, ty + 5, 5, 3, sDark, sBase, sDeep);
    const frontX = fx > 0 ? tx + 5 : tx;
    cv.set(frontX, ty + 1, gold);
    cv.set(frontX - fx, ty + 2, gold);
    cv.set(frontX - fx, ty + 4, goldDark);
    cv.set(frontX - fx * 2, ty + 6, goldDark);
  }

  // ---------------- 5) LOS 4 BRAZOS (PAR SUPERIOR + PAR INFERIOR CON GARRAS)
  if (sideOnly) {
    drawProfileArms(stride, false);
  } else {
    for (const side of [-1, 1]) {
      const swing = Math.round((side * stride) / 2);
      const shX = straight
        ? (side < 0 ? cx - 6 : cx + 4)
        : (side < 0 ? cx - 5 : cx + 3);
      const shY = ty + (swing > 0 ? 1 : 0);
      const farArm = diag && side !== fx;
      const armBase = farArm ? sDark : sBase;
      const armLight = farArm ? sBase : sLight;

      // Hombrera con franja dorada horizontal como en la imagen
      cv.shaded(shX, shY, 2, 3, armBase, armLight, sDark);
      cv.rect(shX, shY + 1, 2, 1, gold);

      // Brazo principal superior: uno levantado con garras abiertas y el otro extendido abajo con garras
      const raised = (isFront && (diag ? side === fx : side > 0)) || (isBack && (diag ? side === fx : side < 0));
      if (raised) {
        // Brazo inferior secundario baja por debajo del codo levantado
        const lowX = shX + (side < 0 ? -1 : 1);
        cv.rect(lowX, shY + 5, 2, 4, sDark);
        cv.set(lowX + (side < 0 ? 0 : 1), shY + 9, tooth);
        cv.set(lowX + (side < 0 ? 1 : 0), shY + 9, gold);

        const armX = shX + (diag ? fx : 0);
        cv.rect(armX, shY + 3, 2, 3, armBase);
        const clawX = armX + (diag ? fx : side);
        const clawY = shY - 1;
        cv.shaded(clawX, clawY + 1, 2, 3, armBase, armLight, sDark);
        cv.set(clawX, clawY, tooth);
        cv.set(clawX + 1, clawY, tooth);
        cv.set(clawX - (diag ? fx : side), clawY + 1, gold);
      } else {
        // Brazo secundario se abre en diagonal hacia afuera
        const armX = shX;
        const lowX = armX + (side < 0 ? -1 : 2);
        cv.rect(lowX, shY + 4, 2, 5, sDark);
        cv.set(lowX, shY + 9, tooth);
        cv.set(lowX + 1, shY + 9, gold);

        cv.shaded(armX, shY + 3, 2, 5, armBase, armLight, sDark);
        cv.rect(armX, shY + 8, 2, 2, sDark);
        cv.set(armX, shY + 10, tooth);
        cv.set(armX + 1, shY + 10, gold);
      }
    }
  }

  // ---------------- 6) CABEZA ALIENÍGENA CON CRESTA ESPINOSA Y COLMILLOS (y = 1..11)
  const hy = 2 + bob;
  if (straight) {
    // Púas superiores de la cresta (como en la imagen de referencia)
    cv.rect(cx - 3, hy - 1, 2, 2, sBase);
    cv.rect(cx - 1, hy - 2, 2, 3, sLight);
    cv.rect(cx + 1, hy - 1, 2, 2, sBase);
    cv.shaded(cx - 4, hy + 1, 8, 5, sBase, sLight, sDark);
    cv.shaded(cx - 3, hy + 6, 6, 4, sDark, sBase, sDeep);

    if (isFront) {
      // Líneas quitinosas de la cresta frontal
      cv.rect(cx - 2, hy + 2, 1, 2, sLight);
      cv.rect(cx, hy + 1, 1, 3, sLight);
      cv.rect(cx + 2, hy + 2, 1, 2, sLight);
      // Fauces feroces sin ojos: encía rojiza y colmillos amarillos arriba y abajo
      cv.rect(cx - 2, hy + 5, 5, 4, sDeep);
      cv.rect(cx - 2, hy + 5, 5, 1, gum);
      cv.set(cx - 2, hy + 6, tooth);
      cv.set(cx, hy + 6, tooth);
      cv.set(cx + 2, hy + 6, tooth);
      cv.set(cx - 1, hy + 8, tooth);
      cv.set(cx + 1, hy + 8, tooth);
    } else {
      // De espaldas: cresta espinosa dorsal
      cv.rect(cx - 1, hy, 2, 9, sDeep);
      for (let y = hy + 1; y <= hy + 7; y += 2) cv.rect(cx - 2, y, 4, 1, sLight);
    }
  } else if (diag) {
    const hx = cx - 4;
    // Púas inclinadas hacia atrás (-fx)
    cv.rect(cx - fx * 2, hy - 1, 2, 2, sBase);
    cv.rect(cx - fx, hy - 2, 2, 3, sLight);
    cv.shaded(hx, hy + 1, 8, 5, sBase, sLight, sDark);
    cv.shaded(hx + 1, hy + 6, 6, 4, sDark, sBase, sDeep);

    if (isFront) {
      // Fauces en 3/4 desplazadas hacia fx
      const mawX = fx > 0 ? cx - 1 : cx - 3;
      cv.rect(mawX, hy + 5, 4, 4, sDeep);
      cv.rect(mawX, hy + 5, 4, 1, gum);
      cv.set(mawX, hy + 6, tooth);
      cv.set(mawX + 2, hy + 6, tooth);
      cv.set(mawX + 3, hy + 6, tooth);
      cv.set(mawX + 1, hy + 8, tooth);
      cv.set(mawX + 2, hy + 8, tooth);
    } else {
      // 3/4 de espaldas: nuca espinosa y un colmillo asomando en el borde fx
      const spineX = cx - fx;
      cv.rect(spineX, hy + 1, 1, 8, sDeep);
      const edgeX = fx > 0 ? hx + 7 : hx;
      cv.set(edgeX, hy + 6, tooth);
      cv.set(edgeX, hy + 7, sDeep);
    }
  } else {
    // Cabeza de perfil con púas barridas hacia atrás (-fx) y mandíbula dentada hacia fx
    const hx = cx - 4;
    const backDir = -fx;
    cv.rect(cx + backDir * 2, hy - 2, 2, 3, sLight);
    cv.rect(cx + backDir * 4, hy, 2, 2, sBase);
    cv.rect(cx + backDir * 5, hy + 2, 2, 2, sBase);
    cv.shaded(hx, hy + 1, 9, 5, sBase, sLight, sDark);
    cv.shaded(hx + 1, hy + 6, 7, 4, sDark, sBase, sDeep);

    const jawX = fx > 0 ? hx + 5 : hx;
    cv.rect(jawX, hy + 5, 4, 4, sDeep);
    cv.rect(jawX, hy + 5, 4, 1, gum);
    cv.set(jawX + 1, hy + 6, tooth);
    cv.set(jawX + 3, hy + 6, tooth);
    cv.set(jawX + 2, hy + 8, tooth);
  }

  return addOutline(cv, outline);
}

function makeScout() {
  const framesPerDir = 4;
  const sheet = new Canvas(32 * framesPerDir, 32 * DIRECTIONS.length);
  DIRECTIONS.forEach(([fx, fy], row) => {
    for (let col = 0; col < framesPerDir; col++) {
      sheet.blit(drawOutrider(fx, fy, col), col * 32, row * 32);
    }
  });
  return sheet;
}

// Chitauri (enemigo que dispara, SENTINEL): 8 direcciones (orden DIRECTIONS) x 4 cuadros de 32x32.
// Fiel a las figuras de Chitauri Footsoldier / Commander:
// - Piel alienígena gris ceniza pálida en pecho superior, bíceps, muslos y pies de 3 dedos.
// - Casco/máscara de bronce dorado envejecido con pómulos angulares, boca esquelética y tubos/rastas oscuras en el cuello.
// - Arnés pectoral y faldón central de bronce dorado sobre tela borgoña oscura con pequeños nodos azules en la cadera.
// - Cañón Chitauri dorado curvo con núcleo azul montado en el antebrazo (deja ver todo el torso y la armadura).
function drawChitauri(fx, fy, frameIdx) {
  const cv = new Canvas(32, 32);
  const outline = hex('#0b0c10');
  // Piel alienígena gris ceniza pálida (pecho alto, brazos, muslos y pies)
  const skinLight = hex('#ced3db');
  const skinBase = hex('#9ea4ae');
  const skinDark = hex('#686e78');
  // Bronce dorado envejecido de la armadura y el cañón Chitauri
  const goldBright = hex('#e3c578');
  const goldLight = hex('#c4a456');
  const goldBase = hex('#967938');
  const goldDark = hex('#5e4a1f');
  // Metal oscuro (cuello, rodilleras, cavidades del pecho y grebas) y tela borgoña
  const metalLight = hex('#525866');
  const metalBase = hex('#323640');
  const metalDark = hex('#191b22');
  const wineCloth = hex('#4d2422');
  // Energía azul Chitauri
  const blueGlow = hex('#2d9aff');
  const blueBright = hex('#8ce6ff');

  const strides = [-2, -1, 2, 1];
  const bobs = [0, -1, 0, -1];
  const stride = strides[frameIdx] ?? 0;
  const bob = bobs[frameIdx] ?? 0;

  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const isFront = fy > 0;
  const isBack = fy < 0;
  const ty = 12 + bob;

  // ---------------- 1) PIERNAS (muslos grises con placas bronce, rodilleras negras, grebas bronce/oscuras y pies grises de 3 dedos)
  const hipY = 20 + bob;
  if (!sideOnly) {
    for (const side of [-1, 1]) {
      const step = side * stride;
      const lift = step > 0 ? -1 : 0;
      const sep = straight ? 3 : 2;
      const diagShift = diag ? Math.round((fx * side * stride) / 3) : 0;
      const lx = cx + side * sep - 1 + diagShift;
      const farLeg = diag && side !== fx;
      const sB = farLeg ? skinDark : skinBase;
      const sL = farLeg ? skinBase : skinLight;

      // Muslo: piel gris pálida adentro + placa bronce estriada afuera (como en la foto 2)
      cv.rect(lx, hipY, 3, 4, sB);
      cv.rect(lx + (side < 0 ? 1 : 0), hipY, 2, 3, sL);
      cv.rect(lx + (side < 0 ? 0 : 2), hipY, 1, 3, goldBase);
      cv.set(lx + (side < 0 ? 0 : 2), hipY + 1, goldLight);

      // Rodillera negra articulada
      const kneeY = hipY + 4 + lift;
      cv.rect(lx, kneeY, 3, 2, metalDark);
      cv.set(lx + 1, kneeY, metalLight);

      // Greba / canillera bronce y metal oscuro
      const shinX = lx + (straight ? (side > 0 ? 1 : -1) * (Math.abs(stride) >= 2 ? 1 : 0) : fx);
      cv.rect(shinX, kneeY + 2, 3, 3, metalBase);
      cv.rect(shinX + (side < 0 ? 0 : 1), kneeY + 2, 2, 2, goldBase);
      cv.set(shinX + 1, kneeY + 2, goldLight);

      // Pie alienígena descalzo gris pálido de 3 dedos
      const footY = Math.min(30, kneeY + 5);
      const footX = shinX - (side < 0 && straight ? 1 : 0);
      cv.rect(footX, footY, 4, 2, sB);
      cv.set(footX, footY + 1, sL);
      cv.set(footX + 1, footY + 1, metalDark);
      cv.set(footX + 2, footY + 1, sL);
      cv.set(footX + 3, footY + 1, sL);
    }
  } else {
    // Piernas en perfil (tijera)
    for (const layer of [-1, 1]) {
      const step = layer * stride;
      const dark = layer < 0;
      const sB = dark ? skinDark : skinBase;
      const sL = dark ? skinBase : skinLight;
      const thighX = cx - 1 + Math.round(step * 0.6);
      const kneeX = cx - 1 + step;
      const lift = step * fx > 0 ? -1 : 0;
      cv.rect(thighX, hipY, 3, 4, sB);
      cv.rect(thighX + 1, hipY, 1, 3, goldBase);
      cv.set(thighX + (fx > 0 ? 2 : 0), hipY + 1, sL);
      cv.rect(kneeX, hipY + 4 + lift, 3, 2, metalDark);
      cv.rect(kneeX, hipY + 6 + lift, 3, 3, metalBase);
      cv.rect(kneeX + (fx > 0 ? 1 : 0), hipY + 6 + lift, 2, 2, goldBase);
      const footY = Math.min(30, hipY + 9 + lift);
      const footX = fx > 0 ? kneeX : kneeX - 1;
      cv.rect(footX, footY, 4, 2, sB);
      cv.set(footX + (fx > 0 ? 3 : 0), footY + 1, sL);
      cv.set(footX + (fx > 0 ? 1 : 2), footY + 1, sL);
    }
  }

  // ---------------- 2) BRAZO LEJANO EN PERFIL
  const drawProfileArm = (swing, isFar) => {
    const sB = isFar ? skinDark : skinBase;
    const sL = isFar ? skinBase : skinLight;
    const shX = cx - 1 + Math.round(swing * 0.4);
    // Hombrera bronce y bíceps gris pálido
    cv.rect(shX, ty, 3, 2, goldBase);
    cv.set(shX + 1, ty, goldLight);
    cv.rect(shX, ty + 2, 3, 3, sB);
    cv.set(shX + 1, ty + 2, sL);
    if (!isFar) {
      // En el brazo cercano lleva montado el cañón Chitauri dorado curvo con núcleo azul apuntando hacia fx
      const gunX = fx > 0 ? shX : shX - 6;
      const gunY = ty + 4;
      cv.rect(gunX, gunY, 9, 3, goldBase);
      cv.rect(gunX + 1, gunY, 7, 1, goldBright);
      cv.rect(gunX + 2, gunY + 1, 5, 1, blueBright);
      cv.set(fx > 0 ? gunX + 8 : gunX, gunY + 1, blueGlow);
      cv.rect(gunX + 2, gunY + 2, 5, 1, goldDark);
    } else {
      // Mano gris pálida adelantada
      cv.rect(shX + fx * 2, ty + 4, 2, 2, sB);
    }
  };

  if (sideOnly) {
    drawProfileArm(-stride, true);
  }

  // ---------------- 3) TORSO ESCULPIDO (pecho gris pálido arriba, arnés bronce con huecos oscuros y faldón bronce/borgoña)
  if (!sideOnly) {
    const chestW = straight ? 10 : 8;
    const waistW = straight ? 8 : 6;
    const tx = cx - Math.floor(chestW / 2);
    const midX = cx + (diag ? fx : 0);

    // Parte superior del pecho: piel gris pálida expuesta en las clavículas/pectorales (como en ambas fotos)
    cv.shaded(tx, ty, chestW, 4, skinBase, skinLight, skinDark);
    // Cintura y cadera con tela borgoña oscura a los lados
    cv.rect(cx - Math.floor(waistW / 2), ty + 4, waistW, 4, wineCloth);

    if (isFront) {
      // Arnés pectoral de bronce dorado con las 2 cavidades oscuras bajo el pecho (idéntico a la foto del Commander)
      cv.rect(tx, ty, 2, 2, goldBase);
      cv.rect(tx + chestW - 2, ty, 2, 2, goldBase);
      cv.rect(midX - 4, ty + 2, 8, 3, goldBase);
      cv.rect(midX - 3, ty + 2, 6, 1, goldBright);
      // Las dos aberturas oscuras del arnés pectoral
      cv.rect(midX - 3, ty + 3, 2, 1, metalDark);
      cv.rect(midX + 1, ty + 3, 2, 1, metalDark);
      cv.rect(midX - 1, ty + 2, 2, 3, goldLight);

      // Placa abdominal y faldón/taparrabos largo de bronce entre los muslos (y = 16..23)
      cv.rect(midX - 2, ty + 5, 4, 7, goldBase);
      cv.rect(midX - 1, ty + 5, 2, 6, goldLight);
      cv.rect(midX - 2, ty + 11, 4, 1, goldDark);
      // Líneas doradas y luces azules Chitauri en las caderas
      cv.set(midX - 3, ty + 6, goldBright);
      cv.set(midX + 2, ty + 6, goldBright);
      cv.set(midX - 3, ty + 7, blueBright);
      cv.set(midX + 2, ty + 7, blueBright);
    } else if (isBack) {
      // Espalda musculosa gris con columna y placas dorsales de bronce
      const spineX = cx - (diag ? fx : 0);
      cv.shaded(tx + 1, ty + 1, chestW - 2, 4, goldDark, goldBase, metalDark);
      cv.rect(spineX - 1, ty, 2, 8, metalDark);
      for (let y = ty + 1; y <= ty + 6; y += 2) cv.rect(spineX - 1, y, 2, 1, goldLight);
      cv.rect(spineX - 2, ty + 7, 4, 4, wineCloth);
    }
  } else {
    const tx = cx - 3;
    cv.shaded(tx, ty, 6, 4, skinBase, skinLight, skinDark);
    cv.shaded(tx, ty + 2, 6, 4, goldBase, goldLight, goldDark);
    cv.rect(tx + 1, ty + 6, 4, 5, goldDark);
    cv.set(tx + 2, ty + 7, blueBright);
  }

  // ---------------- 4) BRAZOS MUSCULOSOS Y CAÑÓN DE BRAZO CHITAURI (deja libre el pecho)
  if (sideOnly) {
    drawProfileArm(stride, false);
  } else {
    for (const side of [-1, 1]) {
      const swing = Math.round((side * stride) / 2);
      const shX = straight
        ? (side < 0 ? cx - 8 : cx + 5)
        : (side < 0 ? cx - 6 : cx + 4);
      const shY = ty + (swing > 0 ? 1 : 0);
      const farArm = diag && side !== fx;
      const sB = farArm ? skinDark : skinBase;
      const sL = farArm ? skinBase : skinLight;

      // El hombro derecho del sprite (side > 0) tiene la hombrera oscura asimétrica y el cañón Chitauri en el brazo (como en la foto 2)
      const hasCannon = (isFront && side > 0) || (isBack && side < 0);
      if (hasCannon) {
        // Hombrera asimétrica oscura/bronce
        cv.shaded(shX, shY - 1, 3, 3, metalBase, metalLight, metalDark);
        cv.rect(shX, shY, 3, 1, goldLight);
        // Bíceps gris pálido
        cv.rect(shX + (side > 0 ? 1 : -1), shY + 2, 3, 3, sB);
        cv.set(shX + 1, shY + 2, sL);
        // Cañón Chitauri dorado alargado montado en el antebrazo (con ranura azul brillante y punta oscura)
        const gunX = shX + (side > 0 ? 1 : -1);
        const gunY = shY + 4;
        cv.rect(gunX, gunY, 3, 7, goldBase);
        cv.rect(gunX + (side > 0 ? 1 : 0), gunY, 1, 6, goldBright);
        cv.rect(gunX + 1, gunY + 2, 1, 3, blueBright);
        cv.set(gunX + 1, gunY + 1, blueGlow);
        cv.rect(gunX + 1, gunY + 6, 2, 2, metalDark); // boca del cañón
      } else {
        // Hombro con tira bronce, bíceps/antebrazo gris ceniza musculoso, brazalete bronce y mano con garras
        cv.rect(shX, shY, 3, 2, goldBase);
        cv.set(shX + 1, shY, goldBright);
        const armX = shX - (side < 0 && straight ? 1 : 0);
        cv.shaded(armX, shY + 2, 3, 4, sB, sL, skinDark);
        cv.rect(armX, shY + 6, 3, 2, goldBase);
        cv.set(armX + 1, shY + 6, blueGlow); // gema azul del guantelete (visible en la foto 1 y 2)
        cv.rect(armX, shY + 8, 3, 2, sL);
        cv.set(armX + 1, shY + 9, metalDark);
      }
    }
  }

  // ---------------- 5) CABEZA: CASCO BRONCE ABOVEDADO, PÓMULOS DORADOS, BOCA ESQUELÉTICA Y TUBOS DEL CUELLO (y = 2..11)
  const hy = 2 + bob;
  if (straight) {
    // Tubos/rastas cibernéticas oscuras que se abren a los lados del cuello hasta los hombros (muy distintivas en las 2 fotos)
    cv.rect(cx - 5, hy + 5, 2, 5, metalDark);
    cv.rect(cx + 3, hy + 5, 2, 5, metalDark);
    cv.set(cx - 5, hy + 6, metalLight);
    cv.set(cx - 4, hy + 8, metalLight);
    cv.set(cx + 4, hy + 6, metalLight);
    cv.set(cx + 3, hy + 8, metalLight);

    // Domo superior redondeado del casco (sin orejas cuadradas: angosto arriba, ancho en las sienes)
    cv.shaded(cx - 3, hy, 6, 2, goldBase, goldBright, goldDark);
    cv.set(cx - 1, hy, metalDark); // hendidura central de la corona del casco
    cv.set(cx, hy, metalDark);
    cv.shaded(cx - 4, hy + 2, 8, 4, goldBase, goldLight, goldDark);
    cv.rect(cx - 3, hy + 6, 6, 4, skinDark);

    if (isFront) {
      // Placa frontal bronce en V sobre el tabique nasal y los pómulos
      cv.rect(cx - 3, hy + 2, 2, 2, goldBright);
      cv.rect(cx + 1, hy + 2, 2, 2, goldBright);
      cv.rect(cx - 1, hy + 3, 2, 3, goldLight);
      // Cuencas oculares oscuras hundidas bajo las cejas doradas
      cv.rect(cx - 3, hy + 4, 2, 1, metalDark);
      cv.rect(cx + 1, hy + 4, 2, 1, metalDark);
      cv.set(cx - 2, hy + 4, blueBright);
      cv.set(cx + 1, hy + 4, blueBright);
      // Pómulos de bronce a los lados de la mandíbula
      cv.rect(cx - 4, hy + 5, 1, 3, goldBase);
      cv.rect(cx + 3, hy + 5, 1, 3, goldBase);
      // Boca/mandíbula esquelética gris y negra con dientes verticales (como en ambas fotos)
      cv.rect(cx - 3, hy + 6, 6, 3, metalDark);
      cv.rect(cx - 2, hy + 6, 1, 3, skinLight);
      cv.rect(cx, hy + 6, 1, 3, skinBase);
      cv.rect(cx + 1, hy + 6, 1, 3, skinLight);
      cv.rect(cx - 3, hy + 7, 6, 1, metalDark);
    } else {
      // Nuca del casco con placas bronce y tubos traseros
      cv.shaded(cx - 3, hy + 2, 6, 5, goldDark, goldBase, metalDark);
      cv.rect(cx - 4, hy + 6, 8, 3, metalDark);
      cv.set(cx - 2, hy + 7, metalLight);
      cv.set(cx + 1, hy + 7, metalLight);
    }
  } else if (diag) {
    const hx = cx - 4;
    // Tubos del cuello del lado visible
    cv.rect(cx - fx * 4, hy + 5, 2, 5, metalDark);
    cv.set(cx - fx * 4, hy + 6, metalLight);
    cv.shaded(hx + 1, hy, 6, 2, goldBase, goldBright, goldDark);
    cv.shaded(hx, hy + 2, 8, 4, goldBase, goldLight, goldDark);
    cv.rect(hx + 1, hy + 6, 6, 4, metalDark);

    if (isFront) {
      const faceX = fx > 0 ? cx - 2 : cx - 4;
      cv.rect(faceX, hy + 2, 5, 2, goldBright);
      cv.rect(faceX, hy + 4, 2, 1, metalDark);
      cv.rect(faceX + 3, hy + 4, 2, 1, metalDark);
      cv.set(faceX + 1, hy + 4, blueBright);
      cv.set(faceX + 4, hy + 4, blueBright);
      // Mandíbula esquelética en 3/4
      cv.rect(faceX + 1, hy + 6, 4, 3, metalDark);
      cv.set(faceX + 1, hy + 6, skinLight);
      cv.set(faceX + 3, hy + 6, skinLight);
      cv.set(faceX + 2, hy + 8, skinBase);
      cv.set(faceX + 4, hy + 8, skinLight);
    } else {
      cv.shaded(hx + 1, hy + 2, 6, 5, goldDark, goldBase, metalDark);
    }
  } else {
    // Cabeza de perfil con casco bronce abovedado, tubos en la nuca y mandíbula gris dentada adelante
    const hx = cx - 4;
    const backX = fx > 0 ? hx : hx + 5;
    cv.rect(backX, hy + 4, 3, 6, metalDark);
    cv.set(backX + 1, hy + 5, metalLight);
    cv.set(backX + 1, hy + 7, metalLight);
    cv.shaded(hx + 1, hy, 6, 2, goldBase, goldBright, goldDark);
    cv.shaded(hx, hy + 2, 8, 4, goldBase, goldLight, goldDark);
    const faceX = fx > 0 ? hx + 5 : hx;
    cv.rect(faceX, hy + 2, 3, 2, goldBright);
    cv.set(faceX + (fx > 0 ? 1 : 1), hy + 4, blueBright);
    cv.rect(faceX, hy + 5, 3, 4, metalDark);
    cv.set(faceX + (fx > 0 ? 2 : 0), hy + 6, skinLight);
    cv.set(faceX + 1, hy + 8, skinLight);
  }

  return addOutline(cv, outline);
}

function makeSentinel() {
  const framesPerDir = 4;
  const sheet = new Canvas(32 * framesPerDir, 32 * DIRECTIONS.length);
  DIRECTIONS.forEach(([fx, fy], row) => {
    for (let col = 0; col < framesPerDir; col++) {
      sheet.blit(drawChitauri(fx, fy, col), col * 32, row * 32);
    }
  });
  return sheet;
}

// Doombot (reemplaza a los bichos gorditos en BRUTE): 8 direcciones (orden DIRECTIONS) x 4 cuadros de 32x32.
// Basado en la 3ra imagen: capucha y capa verde oscuro estilo Doctor Doom, máscara de titanio con ojos
// amarillo-verdosos brillantes, hombreras metálicas angulares gigantes, pechera verde militar blindada y faldón verde con borde claro.
function drawDoombot(fx, fy, frameIdx) {
  const cv = new Canvas(32, 32);
  const outline = hex('#090d07');
  const gLight = hex('#58703a');
  const gBase = hex('#3d4f27');
  const gDark = hex('#253117');
  const gDeep = hex('#161e0d');
  const trim = hex('#95ad68');
  const stLight = hex('#c4cad4');
  const stBase = hex('#8a919e');
  const stDark = hex('#525863');
  const stDeep = hex('#2a2e36');
  const eyeGlow = hex('#ebff6e');
  const eyeDim = hex('#a8cf32');

  const strides = [-2, -1, 2, 1];
  const bobs = [0, -1, 0, -1];
  const stride = strides[frameIdx] ?? 0;
  const bob = bobs[frameIdx] ?? 0;

  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const isFront = fy > 0;
  const isBack = fy < 0;
  const ty = 11 + bob;

  // ---------------- 1) CAPA VERDE DE DOOM (en vistas frontales y de perfil cae por detrás)
  if (!isBack) {
    const capeW = straight ? 14 : sideOnly ? 7 : 12;
    const capeX = sideOnly ? (fx > 0 ? cx - 6 : cx - 1) : cx - Math.floor(capeW / 2);
    cv.shaded(capeX, ty + 1, capeW, 15, gDark, gBase, gDeep);
    // Puntas desgarradas abajo de la capa (como en la imagen de referencia)
    for (let x = capeX; x < capeX + capeW; x += 2) {
      cv.set(x, ty + 16, gDeep);
    }
  }

  // ---------------- 2) BOTAS Y PIERNAS BLINDADAS PESADAS (y = 21..30)
  const hipY = 20 + bob;
  if (!sideOnly) {
    for (const side of [-1, 1]) {
      const step = side * stride;
      const lift = step > 0 ? -1 : 0;
      const sep = straight ? 4 : 3;
      const lx = cx + side * sep - 2;
      const bootY = Math.min(29, hipY + 6 + lift);
      cv.shaded(lx, hipY + 2, 4, 5, stDark, stBase, stDeep);
      cv.shaded(lx - (side < 0 ? 1 : 0), bootY, 5, 3, stDeep, stDark, outline);
      cv.rect(lx, bootY, 3, 1, stLight);
    }
  } else {
    for (const layer of [-1, 1]) {
      const step = layer * stride;
      const lift = step * fx > 0 ? -1 : 0;
      const lx = cx - 2 + step;
      cv.shaded(lx, hipY + 2, 4, 5, layer < 0 ? stDeep : stDark, stBase, stDeep);
      const bootY = Math.min(29, hipY + 6 + lift);
      cv.shaded(lx, bootY, 5, 3, stDeep, stDark, outline);
      cv.set(lx + (fx > 0 ? 3 : 1), bootY, stLight);
    }
  }

  // ---------------- 3) TORSO ANCHO ("GORDITO") Y FALDÓN TÚNICA VERDE CON BORDE CLARO
  if (!sideOnly) {
    const chestW = straight ? 12 : 10;
    const tx = cx - Math.floor(chestW / 2);
    const midX = cx + (diag ? fx : 0);

    // Pechera verde militar pesada y cinturón metálico en V
    cv.shaded(tx, ty, chestW, 8, gBase, gLight, gDark);
    cv.shaded(midX - 3, ty + 7, 6, 3, stBase, stLight, stDark);

    // Faldón verde abierto a los costados + tabardo central con ribete verde claro (idéntico a la imagen 3)
    cv.shaded(tx - 1, ty + 8, chestW + 2, 7, gBase, gLight, gDark);
    cv.rect(tx - 1, ty + 14, chestW + 2, 1, trim);
    cv.shaded(midX - 2, ty + 9, 4, 7, gLight, trim, gBase);
    cv.rect(midX - 1, ty + 10, 2, 5, gBase);

    if (isFront) {
      // Placas pectorales angulares y núcleo hexagonal oscuro en el pecho
      cv.rect(midX - 4, ty + 1, 2, 2, stLight);
      cv.rect(midX + 2, ty + 1, 2, 2, stLight);
      cv.rect(midX - 1, ty + 2, 2, 2, stDeep);
      cv.rect(midX - 3, ty + 4, 6, 1, gLight);
      cv.rect(midX - 2, ty + 6, 4, 1, stLight);
    }
  } else {
    const tx = cx - 4;
    cv.shaded(tx, ty, 8, 8, gBase, gLight, gDark);
    cv.shaded(tx, ty + 8, 8, 7, gBase, gLight, gDark);
    cv.rect(tx, ty + 14, 8, 1, trim);
    cv.rect(fx > 0 ? tx + 5 : tx + 1, ty + 7, 2, 7, stBase);
  }

  // ---------------- 4) HOMBRERAS METÁLICAS GIGANTES Y BRAZOS ROBÓTICOS
  if (sideOnly) {
    const shX = cx - 2;
    // Hombrera angular plateada con relieve
    cv.shaded(shX - 1, ty - 1, 5, 5, stBase, stLight, stDark);
    cv.rect(shX, ty, 3, 2, stLight);
    // Brazo y guantelete blindado
    cv.shaded(shX + fx, ty + 4, 4, 6, stDark, stBase, stDeep);
    cv.rect(shX + fx + 1, ty + 5, 2, 3, stLight);
  } else {
    for (const side of [-1, 1]) {
      const swing = Math.round((side * stride) / 2);
      const shX = straight
        ? (side < 0 ? cx - 10 : cx + 6)
        : (side < 0 ? cx - 8 : cx + 5);
      const shY = ty - 1 + (swing > 0 ? 1 : 0);
      // Hombrera grande de titanio en punta hacia arriba (4x5)
      cv.shaded(shX, shY, 4, 5, stBase, stLight, stDark);
      cv.rect(shX + 1, shY - 1, 2, 2, stLight);
      cv.set(shX + (side < 0 ? 1 : 2), shY + 2, stDeep);
      // Brazo y guantelete de acero
      cv.shaded(shX + (side < 0 ? 0 : 0), shY + 5, 4, 6, stDark, stBase, stDeep);
      cv.rect(shX + 1, shY + 6, 2, 2, stLight);
    }
  }

  // ---------------- 5) CAPA DORSAL COMPLETA (cuando está de espaldas o en 3/4 de espaldas)
  if (isBack) {
    const capeW = straight ? 14 : 12;
    const capeX = cx - Math.floor(capeW / 2) - (diag ? fx : 0);
    cv.shaded(capeX, ty, capeW, 16, gBase, gLight, gDark);
    cv.rect(capeX + 1, ty + 14, capeW - 2, 1, trim);
    // Borde inferior rasgado de la capa
    for (let x = capeX; x < capeX + capeW; x += 2) {
      cv.rect(x, ty + 16, 1, 2, gDark);
    }
  }

  // ---------------- 6) CAPUCHA VERDE Y MÁSCARA METÁLICA DE DOCTOR DOOM (y = 1..11)
  const hy = 1 + bob;
  if (straight) {
    // Capucha verde ancha y en punta
    cv.shaded(cx - 4, hy, 8, 2, gBase, gLight, gDark);
    cv.shaded(cx - 5, hy + 2, 10, 8, gBase, gLight, gDark);
    if (isFront) {
      // Hueco de la capucha y máscara metálica con ojos amarillo-verdosos encendidos
      cv.rect(cx - 4, hy + 3, 8, 7, gDeep);
      cv.shaded(cx - 3, hy + 3, 6, 6, stBase, stLight, stDark);
      // Ojos brillantes de Doombot
      cv.rect(cx - 3, hy + 5, 2, 1, eyeGlow);
      cv.rect(cx + 1, hy + 5, 2, 1, eyeGlow);
      cv.set(cx - 2, hy + 6, eyeDim);
      cv.set(cx + 1, hy + 6, eyeDim);
      // Respirador / rejilla bucal metálica
      cv.rect(cx - 2, hy + 7, 4, 2, stDeep);
      cv.set(cx - 1, hy + 7, stLight);
      cv.set(cx + 1, hy + 7, stLight);
    } else {
      // Pliegues traseros de la capucha
      cv.rect(cx - 1, hy + 2, 2, 7, gDark);
      cv.rect(cx - 3, hy + 8, 6, 2, trim);
    }
  } else if (diag) {
    const hx = cx - 5;
    cv.shaded(hx + 1, hy, 8, 2, gBase, gLight, gDark);
    cv.shaded(hx, hy + 2, 10, 8, gBase, gLight, gDark);
    if (isFront) {
      const maskX = fx > 0 ? cx - 2 : cx - 4;
      cv.rect(maskX, hy + 3, 6, 6, stBase);
      cv.rect(maskX, hy + 5, 2, 1, eyeGlow);
      cv.rect(maskX + 3, hy + 5, 2, 1, eyeGlow);
      cv.rect(maskX + 1, hy + 7, 4, 2, stDeep);
      cv.set(maskX + 2, hy + 7, stLight);
    } else {
      cv.rect(cx - fx, hy + 2, 2, 7, gDark);
    }
  } else {
    // Capucha de perfil adelantada sobre la máscara metálica
    const hx = cx - 4;
    cv.shaded(hx + 1, hy, 7, 2, gBase, gLight, gDark);
    cv.shaded(hx, hy + 2, 9, 8, gBase, gLight, gDark);
    const faceX = fx > 0 ? hx + 6 : hx;
    cv.rect(faceX, hy + 3, 3, 6, stBase);
    cv.rect(faceX + (fx > 0 ? 1 : 0), hy + 5, 2, 1, eyeGlow);
    cv.rect(faceX, hy + 7, 2, 2, stDeep);
  }

  return addOutline(cv, outline);
}

function makeBrute() {
  const framesPerDir = 4;
  const sheet = new Canvas(32 * framesPerDir, 32 * DIRECTIONS.length);
  DIRECTIONS.forEach(([fx, fy], row) => {
    for (let col = 0; col < framesPerDir; col++) {
      sheet.blit(drawDoombot(fx, fy, col), col * 32, row * 32);
    }
  });
  return sheet;
}

// Minimisil, apuntando a la derecha (se rota en el juego).
function makeMissile() {
  const cv = new Canvas(12, 8);
  cv.rect(1, 3, 2, 2, hex('#ff8a2a')); // llama
  cv.set(1, 3, hex('#ffd166'));
  cv.rect(3, 3, 6, 2, hex('#d9dde6')); // cuerpo
  cv.rect(3, 3, 6, 1, hex('#ffffff'));
  cv.rect(3, 2, 2, 1, hex('#8b93a3')); // aletas
  cv.rect(3, 5, 2, 1, hex('#8b93a3'));
  cv.rect(9, 3, 1, 2, hex('#e23b3b')); // punta
  cv.set(10, 3, hex('#e23b3b'));
  cv.set(10, 4, hex('#a51f1f'));
  return addOutline(cv, hex('#1a1a22'));
}

// Fuego en el piso (misiles incendiarios): círculo plano de brasas, hoja de 3 cuadros de 32x32
// (las chispas cambian de lugar para que titile). Sin contorno: brilla.
function makeFire() {
  const sheet = new Canvas(96, 32);
  const cols = [hex('#7a1d12'), hex('#c4321c'), hex('#ff6a1f'), hex('#ffb23a'), hex('#fff3c4')];
  for (let f = 0; f < 3; f++) {
    const cv = new Canvas(32, 32);
    const rnd = mulberry32(77 + f * 13);
    fillEllipse(cv, 15.5, 15.5, 15, 15, (dx, dy) => {
      const d = Math.sqrt(dx * dx + dy * dy);
      return d > 0.85 ? cols[0] : d > 0.6 ? cols[1] : d > 0.3 ? cols[2] : cols[3];
    });
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 11;
      const x = 15.5 + Math.cos(a) * r;
      const y = 15.5 + Math.sin(a) * r;
      cv.set(x, y, r < 6 ? cols[4] : cols[3]);
    }
    sheet.blit(cv, f * 32, 0);
  }
  return sheet;
}

// Disparo del repulsor, apuntando a la derecha (se rota en el juego).
function makeBolt() {
  const cv = new Canvas(8, 8);
  fillEllipse(cv, 3.5, 3.5, 3.9, 2.4, () => hex('#6fd8ff'));
  fillEllipse(cv, 3.5, 3.5, 2.6, 1.3, () => hex('#e9fcff'));
  return cv;
}


// Escudo del Capitán (círculo con estrella), 10x10.
function makeShield() {
  const cv = new Canvas(10, 10);
  fillEllipse(cv, 4.5, 4.5, 4.6, 4.6, () => hex('#c8202a'));
  fillEllipse(cv, 4.5, 4.5, 3.4, 3.4, () => hex('#f2f2f2'));
  fillEllipse(cv, 4.5, 4.5, 2.4, 2.4, () => hex('#2a50b8'));
  cv.rect(4, 3, 2, 4, hex('#ffffff'));
  cv.rect(3, 4, 4, 2, hex('#ffffff'));
  return addOutline(cv, hex('#150909'));
}

// Telaraña de Spider-Man (estrella blanca), 8x8.
function makeWeb() {
  const cv = new Canvas(8, 8);
  const w = hex('#f2f2f2');
  const g = hex('#aab3c0');
  cv.rect(3, 0, 2, 8, g);
  cv.rect(0, 3, 8, 2, g);
  for (let i = 1; i < 7; i++) {
    cv.set(i, i, w);
    cv.set(7 - i, i, w);
  }
  cv.rect(3, 3, 2, 2, w);
  return cv;
}

// Rayo de Thor: zigzag vertical de 16x40 (la punta de abajo es donde pega).
function makeThunder() {
  const cv = new Canvas(16, 40);
  const pts = [[8, 0], [5, 8], [10, 14], [6, 22], [11, 28], [8, 39]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(x0 + ((x1 - x0) * t) / steps);
      const y = Math.round(y0 + ((y1 - y0) * t) / steps);
      cv.rect(x - 1, y, 3, 1, hex('#6fd8ff'));
      cv.rect(x, y, 1, 1, hex('#ffffff'));
    }
  }
  return cv;
}

// ---------------------------------------------------------------- vista previa (solo desarrollo)

function previewOf(cv, scale, bg = hex('#5f8f58')) {
  const out = new Canvas(cv.w * scale, cv.h * scale);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const c = cv.get(Math.floor(x / scale), Math.floor(y / scale));
      out.set(x, y, c[3] > 0 ? c : bg);
    }
  return out;
}

// ---------------------------------------------------------------- main

console.log('Generando recursos provisionales...');
// Íconos de las mejoras permanentes (tienda).
{
  const sheet = buildMetaIconSheet();
  const cv = new Canvas(sheet.width, sheet.height);
  cv.px.set(sheet.px);
  save(cv, 'ui/meta-items.png');
}

const ironIdle = buildIronManSheet(IM_IDLE_FRAMES);
const ironWalk = buildIronManSheet(IM_WALK_FRAMES);
save(ironIdle, 'characters/ironman/ironman-idle.png');
save(ironWalk, 'characters/ironman/ironman-walk.png');
const idle = ironIdle;
const walk = ironWalk;
const heroSheets = {};
for (const id of Object.keys(HEROES)) if (id !== 'ironman' && !DRAWN_HEROES.includes(id)) heroSheets[id] = saveHero(id);
for (const id of DRAWN_HEROES) {
  const idleSheet = buildDrawnSheet(id, DRAWN_IDLE);
  const walkSheet = buildDrawnSheet(id, DRAWN_WALK);
  save(idleSheet, `characters/${id}/${id}-idle.png`);
  save(walkSheet, `characters/${id}/${id}-walk.png`);
  heroSheets[id] = { idle: idleSheet, walk: walkSheet };
}
save(makeGround(), 'tiles/ground.png');
save(makeTree(), 'props/tree.png');
const rock = makeRock();
const crate = makeCrate();
save(rock, 'props/rock.png');
save(crate, 'props/crate.png');
const drone = makeDrone();
const sentinel = makeSentinel();
const overlord = makeOverlord();
save(drone, 'enemies/drone.png');
save(sentinel, 'enemies/sentinel.png');
save(overlord, 'enemies/overlord.png');
const scout = makeScout();
const brute = makeBrute();
save(scout, 'enemies/scout.png');
save(brute, 'enemies/brute.png');
save(makeBolt(), 'projectiles/repulsor.png');
save(makeShield(), 'projectiles/shield.png');
save(makeWeb(), 'projectiles/web.png');
save(makeThunder(), 'effects/thunder.png');
save(makeAuraOuter(), 'effects/aura-outer.png');
save(makeAuraInner(), 'effects/aura-inner.png');
{
  const strangeIdle = buildStrangeSheet(STRANGE_IDLE);
  const strangeWalk = buildStrangeSheet(STRANGE_WALK);
  save(strangeIdle, 'characters/strange/strange-idle.png');
  save(strangeWalk, 'characters/strange/strange-walk.png');
  heroSheets.strange = { idle: strangeIdle, walk: strangeWalk };
  save(strangeFrame(STRANGE_ARMS_REF, {}), 'characters/strange/strange-arms.png');
}
const missile = makeMissile();
save(missile, 'projectiles/missile.png');
const fire = makeFire();
save(fire, 'effects/fire.png');

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx !== -1) {
  const dir = process.argv[previewIdx + 1];
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'idle.png'), encodePng(previewOf(idle, 4)));
  writeFileSync(join(dir, 'walk.png'), encodePng(previewOf(walk, 4)));
  for (const [id, sheets] of Object.entries(heroSheets)) {
    writeFileSync(join(dir, `${id}-idle.png`), encodePng(previewOf(sheets.idle, 4)));
    writeFileSync(join(dir, `${id}-walk.png`), encodePng(previewOf(sheets.walk, 4)));
  }
  writeFileSync(join(dir, 'drone.png'), encodePng(previewOf(drone, 6)));
  writeFileSync(join(dir, 'sentinel.png'), encodePng(previewOf(sentinel, 6)));
  writeFileSync(join(dir, 'rock.png'), encodePng(previewOf(rock, 8)));
  writeFileSync(join(dir, 'crate.png'), encodePng(previewOf(crate, 8)));
  writeFileSync(join(dir, 'overlord.png'), encodePng(previewOf(overlord, 6)));
  writeFileSync(join(dir, 'scout.png'), encodePng(previewOf(scout, 6)));
  writeFileSync(join(dir, 'brute.png'), encodePng(previewOf(brute, 6)));
  writeFileSync(join(dir, 'missile.png'), encodePng(previewOf(missile, 10)));
  writeFileSync(join(dir, 'fire.png'), encodePng(previewOf(fire, 8)));
  console.log('  vistas previas en', dir);
}
