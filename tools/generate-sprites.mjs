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

// fx, fy: hacia dónde mira (-1, 0, 1). stride: -2..2 (zancada). bob: 0/-1 (cuerpo arriba).
// head: 0/1 (respiración). pulse: 0..2 (brillo del reactor ARC).
function drawIronMan({ fx, fy, stride = 0, bob = 0, head = 0, pulse = 0 }) {
  const cv = new Canvas(FRAME, FRAME);
  const cx = 16;
  const straight = fx === 0;
  const sideOnly = fx !== 0 && fy === 0;
  const diag = fx !== 0 && fy !== 0;
  const back = fy < 0;

  const torsoW = straight ? 10 : sideOnly ? 8 : 9;
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
      far ? C.redDark : C.red,
      far ? C.red : C.redLight,
      far ? C.redDeep : C.redDark,
    );
    if (!sideOnly) cv.rect(x0 + 1, legTop + 3, 2, 2, far ? C.goldDark : C.gold); // rodillera
    cv.rect(x0, bottom - 3, 4, 1, far ? C.goldDark : C.gold); // tobillo
    cv.rect(x0, bottom - 1, 4, 2, C.redDeep); // bota
  }

  const drawArm = (x, top, dark) => {
    cv.shaded(x, top, 3, 8, dark ? C.redDark : C.red, dark ? C.red : C.redLight, dark ? C.redDeep : C.redDark);
    cv.rect(x, top, 3, 2, dark ? C.goldDark : C.gold); // hombrera
    cv.rect(x, top + 6, 3, 2, dark ? C.goldDark : C.gold); // guantelete
  };
  const armSwing = (side) => (sideOnly ? -fx * side * stride : Math.round((-fy * side * stride) / 2));

  // Brazo lejano (solo en vistas de perfil, queda detrás del torso)
  if (sideOnly) drawArm(cx - 1 + armSwing(-1), ty + 1, true);

  // Torso
  cv.shaded(tx, ty, torsoW, torsoH, C.red, C.redLight, C.redDark);
  cv.shaded(tx + 1, tb - 3, torsoW - 2, 4, C.gold, C.goldLight, C.goldDark); // abdomen dorado

  if (!back) {
    // Reactor ARC
    const off = sideOnly ? fx * 2 : diag ? fx : 0;
    const ax = cx - 1 + off;
    const ay = ty + 2;
    if (!sideOnly) {
      const ring = pulse === 1 ? C.arcDim : C.arcGlow;
      const pts = [
        [ax - 1, ay], [ax - 1, ay + 1], [ax + 2, ay], [ax + 2, ay + 1],
        [ax, ay - 1], [ax + 1, ay - 1], [ax, ay + 2], [ax + 1, ay + 2],
      ];
      for (const [x, y] of pts) if (x >= tx && x <= tx + torsoW - 1) cv.set(x, y, ring);
    }
    cv.rect(ax, ay, 2, 2, pulse === 2 ? C.arcWhite : C.arc);
  } else {
    // Mochila / propulsores en la espalda
    const bx = cx - 2 + (diag ? fx : 0);
    cv.rect(bx, ty + 1, 4, 4, C.goldDark);
    cv.rect(bx, ty + 1, 4, 1, C.gold);
    cv.rect(bx + 1, ty + 4, 2, 1, C.arcDim);
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
  cv.shaded(hx, hy, headW, 9, C.red, C.redLight, C.redDark);

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
    cv.shaded(fxs, hy + 2, fw, 7, C.gold, C.goldLight, C.goldDark);
    for (const [ex, ew] of eyes) cv.rect(ex, hy + 4, ew, 1, C.eye);
    if (!sideOnly) cv.rect(fxs + Math.floor(fw / 2) - 1, hy + 7, 2, 1, C.goldDark); // boca
  } else if (straight) {
    cv.rect(cx, hy + 1, 1, 7, C.redDark); // costura trasera del casco
  } else {
    cv.rect(fx > 0 ? hx + headW - 1 : hx, hy + 3, 1, 4, C.goldDark); // borde del visor asomando
    cv.rect(cx + fx, hy + 1, 1, 7, C.redDark);
  }

  return addOutline(cv, C.outline);
}

// Orden de filas: abajo, abajo-izq, izq, arriba-izq, arriba, arriba-der, der, abajo-der
const DIRECTIONS = [
  [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1],
];

function buildSheet(frames) {
  const sheet = new Canvas(frames.length * FRAME, DIRECTIONS.length * FRAME);
  DIRECTIONS.forEach(([fx, fy], row) => {
    frames.forEach((f, col) => {
      sheet.blit(drawIronMan({ fx, fy, ...f }), col * FRAME, row * FRAME);
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

// Disparo del repulsor, apuntando a la derecha (se rota en el juego).
function makeBolt() {
  const cv = new Canvas(8, 8);
  fillEllipse(cv, 3.5, 3.5, 3.9, 2.4, () => hex('#6fd8ff'));
  fillEllipse(cv, 3.5, 3.5, 2.6, 1.3, () => hex('#e9fcff'));
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
const idle = buildSheet(IDLE_FRAMES);
const walk = buildSheet(WALK_FRAMES);
save(idle, 'characters/ironman/ironman-idle.png');
save(walk, 'characters/ironman/ironman-walk.png');
save(makeGround(), 'tiles/ground.png');
save(makeTree(), 'props/tree.png');
save(makeRock(), 'props/rock.png');
save(makeCrate(), 'props/crate.png');
const drone = makeDrone();
const overlord = makeOverlord();
save(drone, 'enemies/drone.png');
save(overlord, 'enemies/overlord.png');
save(makeBolt(), 'projectiles/repulsor.png');

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx !== -1) {
  const dir = process.argv[previewIdx + 1];
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'idle.png'), encodePng(previewOf(idle, 4)));
  writeFileSync(join(dir, 'walk.png'), encodePng(previewOf(walk, 4)));
  writeFileSync(join(dir, 'drone.png'), encodePng(previewOf(drone, 8)));
  writeFileSync(join(dir, 'overlord.png'), encodePng(previewOf(overlord, 6)));
  console.log('  vistas previas en', dir);
}
