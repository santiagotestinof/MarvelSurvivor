// Genera los recursos gráficos PROVISIONALES del prototipo (arte original, sin material de terceros).
//
//   npm run sprites                       -> escribe en public/assets
//   node tools/generate-sprites.mjs --preview <carpeta>   -> además guarda vistas ampliadas
//
// Hoja de sprites de personajes: una fila por dirección, una columna por cuadro.
// Orden de filas (debe coincidir con src/core/direction.ts):
//   0 abajo, 1 abajo-izq, 2 izquierda, 3 arriba-izq, 4 arriba, 5 arriba-der, 6 derecha, 7 abajo-der

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IRON_MAN_REF } from './ironman-reference.mjs';

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
/** Fila del cuadro donde apoyan los pies. */
const IM_FEET_Y = 41;

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

  // Perfil y diagonales: se aprieta en horizontal y se espeja si mira a la izquierda.
  if (fx !== 0) {
    g = squeezeGrid(g, fy === 0 ? 0.62 : 0.84);
    if (fx < 0) g = g.map((row) => row.reverse());
  }

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

function makeRock() {
  const cv = new Canvas(16, 12);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 7.5) / 7.2, (y - 6.5) / 4.6);
      if (d > 1) continue;
      const t = y / 12 + (x - 8) / 40;
      cv.set(x, y, t > 0.62 ? hex('#6b6f78') : t > 0.35 ? hex('#8b909a') : hex('#aeb3bc'));
    }
  return addOutline(cv, hex('#25272c'));
}

function makeCrate() {
  const cv = new Canvas(16, 16);
  const wood = hex('#b07a35');
  const woodLight = hex('#c8924a');
  const woodDark = hex('#6b4519');
  cv.rect(0, 0, 16, 16, wood);
  cv.rect(1, 1, 14, 1, woodLight);
  for (let i = 0; i < 16; i++) {
    cv.set(i, i, woodDark);
    cv.set(15 - i, i, woodDark);
  }
  cv.rect(0, 0, 16, 2, woodDark);
  cv.rect(0, 14, 16, 2, woodDark);
  cv.rect(0, 0, 2, 16, woodDark);
  cv.rect(14, 0, 2, 16, woodDark);
  cv.rect(2, 2, 12, 1, woodLight);
  return addOutline(cv, hex('#2a1a09'));
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

// Dron genérico: hoja de 2 cuadros de 24x24.
function makeDrone() {
  const sheet = new Canvas(48, 24);
  const steel = [hex('#98a2b3'), hex('#667085'), hex('#4a5568')];
  const eye = hex('#ff4444');
  for (let f = 0; f < 2; f++) {
    const cv = new Canvas(24, 24);
    const bob = f;
    cv.rect(f ? 8 : 7, 19, 3, f ? 2 : 3, steel[2]); // patas
    cv.rect(f ? 13 : 14, 19, 3, f ? 3 : 2, steel[2]);
    fillEllipse(cv, 12, 12 - bob, 8.5, 7.5, (dx, dy) => {
      const t = dy + dx * 0.35;
      return t > 0.5 ? steel[2] : t > -0.25 ? steel[1] : steel[0];
    });
    cv.rect(5, 9 - bob, 14, 4, hex('#161b29')); // visor
    cv.rect(7, 10 - bob, 3, 2, eye);
    cv.rect(14, 10 - bob, 3, 2, eye);
    cv.rect(7, 10 - bob, 3, 1, hex('#ff9a9a'));
    cv.rect(14, 10 - bob, 3, 1, hex('#ff9a9a'));
    cv.rect(12, 3 - bob, 1, 3, steel[0]); // antena
    cv.set(12, 2 - bob, eye);
    sheet.blit(addOutline(cv, hex('#0d111b')), f * 24, 0);
  }
  return sheet;
}

// Jefe genérico: hoja de 2 cuadros de 48x48.
function makeOverlord() {
  const sheet = new Canvas(96, 48);
  const purple = [hex('#7a5cc4'), hex('#4b3378'), hex('#2b1d45')];
  const steel = [hex('#c9c1e8'), hex('#8b84a8'), hex('#5a5478')];
  const red = hex('#ff3b3b');
  for (let f = 0; f < 2; f++) {
    const cv = new Canvas(48, 48);
    const bob = f;
    cv.rect(f ? 13 : 12, 41, 8, f ? 4 : 5, purple[2]); // patas
    cv.rect(f ? 27 : 28, 41, 8, f ? 5 : 4, purple[2]);
    cv.shaded(13, 6 - bob, 3, 9, steel[1], steel[0], steel[2]); // cuernos
    cv.shaded(32, 6 - bob, 3, 9, steel[1], steel[0], steel[2]);
    cv.shaded(2, 22 - bob, 8, 12, steel[1], steel[0], steel[2]); // cañones
    cv.shaded(38, 22 - bob, 8, 12, steel[1], steel[0], steel[2]);
    cv.rect(0, 26 - bob, 3, 4, steel[2]);
    cv.rect(45, 26 - bob, 3, 4, steel[2]);
    fillEllipse(cv, 24, 27 - bob, 17, 15, (dx, dy) => {
      const t = dy + dx * 0.35;
      return t > 0.5 ? purple[2] : t > -0.25 ? purple[1] : purple[0];
    });
    cv.rect(10, 20 - bob, 28, 7, hex('#161027')); // visor
    cv.rect(13, 22 - bob, 6, 3, red);
    cv.rect(29, 22 - bob, 6, 3, red);
    cv.rect(13, 22 - bob, 6, 1, hex('#ff9a9a'));
    cv.rect(29, 22 - bob, 6, 1, hex('#ff9a9a'));
    cv.rect(21, 31 - bob, 6, 6, hex('#ff7a3d')); // núcleo
    cv.rect(23, 33 - bob, 2, 2, hex('#ffd9a8'));
    sheet.blit(addOutline(cv, hex('#0d0816')), f * 48, 0);
  }
  return sheet;
}

// Explorador: dron chico y rápido, hoja de 2 cuadros de 20x20 (las alas aletean).
function makeScout() {
  const sheet = new Canvas(40, 20);
  const shell = [hex('#ffd166'), hex('#f4a52a'), hex('#b86a12')];
  const wing = hex('#c8f1ff');
  const eye = hex('#ff3b3b');
  for (let f = 0; f < 2; f++) {
    const cv = new Canvas(20, 20);
    const bob = f;
    if (f === 0) {
      cv.rect(1, 6, 5, 2, wing);
      cv.rect(14, 6, 5, 2, wing);
    } else {
      cv.rect(2, 10, 4, 2, wing);
      cv.rect(14, 10, 4, 2, wing);
    }
    cv.rect(9, 14 - bob, 2, 3, shell[2]); // aguijón
    fillEllipse(cv, 10, 10 - bob, 5.5, 4.5, (dx, dy) => {
      const t = dy + dx * 0.35;
      return t > 0.5 ? shell[2] : t > -0.25 ? shell[1] : shell[0];
    });
    cv.rect(6, 9 - bob, 8, 2, hex('#1b1206')); // visor
    cv.rect(9, 9 - bob, 2, 2, eye);
    cv.set(9, 9 - bob, hex('#ff9a9a'));
    sheet.blit(addOutline(cv, hex('#1a0f04')), f * 20, 0);
  }
  return sheet;
}

// Blindado: robot pesado y lento, hoja de 2 cuadros de 32x32.
function makeBrute() {
  const sheet = new Canvas(64, 32);
  const armor = [hex('#8fa06a'), hex('#5f6e3f'), hex('#3a4426')];
  const steel = [hex('#b9bec8'), hex('#7c8291'), hex('#4f5462')];
  for (let f = 0; f < 2; f++) {
    const cv = new Canvas(32, 32);
    const bob = f;
    cv.rect(f ? 9 : 8, 25, 6, f ? 4 : 5, steel[2]); // piernas
    cv.rect(f ? 17 : 18, 25, 6, f ? 5 : 4, steel[2]);
    cv.shaded(2, 10 - bob, 7, 9, steel[1], steel[0], steel[2]); // hombreras
    cv.shaded(23, 10 - bob, 7, 9, steel[1], steel[0], steel[2]);
    fillEllipse(cv, 16, 17 - bob, 10.5, 9.5, (dx, dy) => {
      const t = dy + dx * 0.35;
      return t > 0.5 ? armor[2] : t > -0.25 ? armor[1] : armor[0];
    });
    cv.rect(9, 12 - bob, 14, 4, hex('#14180c')); // visor
    cv.rect(11, 13 - bob, 10, 2, hex('#ff8a2a'));
    cv.rect(11, 13 - bob, 10, 1, hex('#ffd0a0'));
    cv.shaded(12, 19 - bob, 8, 5, armor[1], armor[0], armor[2]); // placa frontal
    cv.rect(15, 20 - bob, 2, 2, steel[0]);
    sheet.blit(addOutline(cv, hex('#0e1108')), f * 32, 0);
  }
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
const ironIdle = buildIronManSheet(IDLE_FRAMES);
const ironWalk = buildIronManSheet(WALK_FRAMES);
save(ironIdle, 'characters/ironman/ironman-idle.png');
save(ironWalk, 'characters/ironman/ironman-walk.png');
const idle = ironIdle;
const walk = ironWalk;
const heroSheets = {};
for (const id of Object.keys(HEROES)) if (id !== 'ironman') heroSheets[id] = saveHero(id);
save(makeGround(), 'tiles/ground.png');
save(makeTree(), 'props/tree.png');
save(makeRock(), 'props/rock.png');
save(makeCrate(), 'props/crate.png');
const drone = makeDrone();
const overlord = makeOverlord();
save(drone, 'enemies/drone.png');
save(overlord, 'enemies/overlord.png');
const scout = makeScout();
const brute = makeBrute();
save(scout, 'enemies/scout.png');
save(brute, 'enemies/brute.png');
save(makeBolt(), 'projectiles/repulsor.png');
save(makeShield(), 'projectiles/shield.png');
save(makeWeb(), 'projectiles/web.png');
save(makeThunder(), 'effects/thunder.png');
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
  writeFileSync(join(dir, 'drone.png'), encodePng(previewOf(drone, 8)));
  writeFileSync(join(dir, 'overlord.png'), encodePng(previewOf(overlord, 6)));
  writeFileSync(join(dir, 'scout.png'), encodePng(previewOf(scout, 8)));
  writeFileSync(join(dir, 'brute.png'), encodePng(previewOf(brute, 8)));
  writeFileSync(join(dir, 'missile.png'), encodePng(previewOf(missile, 10)));
  writeFileSync(join(dir, 'fire.png'), encodePng(previewOf(fire, 8)));
  console.log('  vistas previas en', dir);
}
