// Capitán América y Thor dibujados desde cero (estilo chibi: cabeza grande, cuerpo corto), de frente y de espaldas.
// Las imágenes que mandó Santi se usaron solo como guía de proporciones y colores; ningún píxel está copiado.
// Cada dibujo es una grilla de GW×GH píxeles (letras → colores); el generador la pone en un cuadro de 48×48.

export const GW = 32;
export const GH = 42;
/** Fila del suelo dentro de la grilla (los pies terminan acá; el contorno queda una fila más abajo). */
export const GROUND_ROW = 40;

class Grid {
  constructor() {
    this.g = Array.from({ length: GH }, () => Array(GW).fill('.'));
  }
  set(x, y, ch) {
    if (x >= 0 && y >= 0 && x < GW && y < GH) this.g[y][x] = ch;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < GW && y < GH ? this.g[y][x] : '.';
  }
  rect(x, y, w, h, ch) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
  }
  /** Elipse; `pick(x, y, d)` puede devolver otra letra según la posición (d = distancia normalizada). */
  ell(cx, cy, rx, ry, ch) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 1) this.set(x, y, typeof ch === 'function' ? ch(x, y, d, dx, dy) : ch);
      }
  }
  /** Contorno oscuro de 1 píxel. */
  outline() {
    const marks = [];
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        if (this.g[y][x] !== '.') continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) !== '.')) marks.push([x, y]);
      }
    for (const [x, y] of marks) this.g[y][x] = 'K';
  }
}

export const PALETTES = {
  capitan: {
    K: '#0c1230',
    B: '#2f5bd0', b: '#5a86f0', d: '#1c3a9c', n: '#12256b',
    W: '#f4f4f6', w: '#b8bfcc',
    R: '#d02530', r: '#8c1119', t: '#f05a60',
    S: '#f2cfa6', s: '#c79a70', E: '#1c3a9c',
  },
  thor: {
    K: '#14121c',
    L: '#e4e9f0', M: '#aab3c2', D: '#6f7c92',
    G: '#4c586e', g: '#6d7b94', h: '#2f3748', j: '#1d2230',
    Y: '#f0c548', y: '#c79a22',
    N: '#8a5a2b', n: '#5a3a1a',
    R: '#cc1a22', r: '#8c1119', t: '#f0463c',
    S: '#f2cfa6', s: '#c79a70', E: '#2a60d0',
  },
};

/** Piernas: `lift` = filas que se levanta cada pie al caminar. */
function legs(g, { leftTop, rightTop, pant, pantD, boot, bootD, band, lift = [0, 0] }) {
  const draw = (x0, up) => {
    const top = 29 - up;
    const bottom = GROUND_ROW - up;
    g.rect(x0, top, 5, bottom - 3 - top + 1, pant);
    g.rect(x0 + 4, top, 1, bottom - 3 - top + 1, pantD);
    // bota
    g.rect(x0 - 1, bottom - 3, 6, 4, boot);
    g.rect(x0 + 4, bottom - 3, 1, 4, bootD);
    if (band) g.rect(x0 - 1, bottom - 3, 6, 1, band);
    g.rect(x0 - 1, bottom, 6, 1, bootD);
  };
  draw(leftTop, lift[0]);
  draw(rightTop, lift[1]);
}

function captain({ back, stride, bob }) {
  const g = new Grid();
  const lift = [stride > 0 ? 1 : 0, stride < 0 ? 1 : 0];
  // Piernas (azules con botas rojas con franja blanca)
  legs(g, { leftTop: 12, rightTop: 17, pant: 'B', pantD: 'd', boot: 'R', bootD: 'r', band: 'W', lift });
  const y0 = bob;
  // Torso
  g.rect(10, 18 + y0, 12, 10, 'B');
  g.rect(10, 18 + y0, 12, 1, 'b');
  g.rect(20, 19 + y0, 2, 9, 'd');
  if (!back) {
    // estrella blanca
    g.set(17, 19 + y0, 'W');
    g.rect(16, 20 + y0, 3, 1, 'W');
    g.set(17, 21 + y0, 'W');
    g.set(16, 22 + y0, 'W'); g.set(18, 22 + y0, 'W');
    // franjas rojas y blancas
    g.rect(11, 24 + y0, 10, 1, 'R');
    g.rect(11, 25 + y0, 10, 1, 'W');
    g.rect(11, 26 + y0, 10, 1, 'R');
  } else {
    g.rect(11, 24 + y0, 10, 3, 'd');
  }
  g.rect(10, 27 + y0, 12, 2, 'n');
  // Brazo derecho (del lado del dibujo) con guante rojo
  g.rect(22, 19 + y0, 3, 8, 'B');
  g.rect(24, 20 + y0, 1, 7, 'd');
  g.rect(22, 27 + y0, 3, 3, 'R');
  g.set(24, 29 + y0, 'r');
  // Cabeza: capucha azul
  g.ell(16, 9 + y0, 9, 8, (x, y, d, dx, dy) => (dy < -0.45 ? 'b' : dx > 0.55 ? 'd' : 'B'));
  // Alitas blancas a los costados
  g.rect(5, 6 + y0, 3, 4, 'W');
  g.set(5, 6 + y0, '.');
  g.rect(24, 6 + y0, 3, 4, 'W');
  g.set(26, 6 + y0, '.');
  g.rect(6, 9 + y0, 2, 1, 'w');
  g.rect(24, 9 + y0, 2, 1, 'w');
  if (!back) {
    // Cara
    g.rect(10, 10 + y0, 12, 7, 'S');
    g.rect(10, 15 + y0, 12, 2, 'S');
    g.rect(10, 16 + y0, 12, 1, 's');
    g.rect(10, 10 + y0, 12, 1, 'B'); // borde de la capucha sobre la frente
    g.rect(12, 12 + y0, 2, 2, 'W');
    g.rect(18, 12 + y0, 2, 2, 'W');
    g.set(13, 13 + y0, 'E');
    g.set(19, 13 + y0, 'E');
    g.rect(13, 11 + y0, 2, 1, 's');
    g.rect(18, 11 + y0, 2, 1, 's');
    g.rect(14, 15 + y0, 4, 1, 'r');
    // A de la frente
    g.set(16, 4 + y0, 'W');
    g.set(15, 5 + y0, 'W'); g.set(17, 5 + y0, 'W');
    g.rect(15, 6 + y0, 3, 1, 'W');
    g.set(15, 7 + y0, 'W'); g.set(17, 7 + y0, 'W');
  } else {
    g.rect(15, 5 + y0, 2, 9, 'd'); // costura trasera
  }
  // Escudo: del lado del brazo izquierdo (de espaldas queda en el otro lado del dibujo)
  const sx = back ? 25 : 7;
  g.ell(sx, 24 + y0, 7, 7, (x, y, d) => (d > 0.74 ? 'R' : d > 0.5 ? 'W' : d > 0.3 ? 'R' : 'B'));
  if (!back) {
    g.rect(sx - 1, 23 + y0, 3, 1, 'W');
    g.rect(sx - 1, 24 + y0, 3, 1, 'W');
    g.set(sx, 22 + y0, 'W');
    g.set(sx, 25 + y0, 'W');
    g.set(sx - 2, 24 + y0, 'W');
    g.set(sx + 1, 24 + y0, 'W');
  } else {
    g.ell(sx, 24 + y0, 5, 5, (x, y, d) => (d > 0.85 ? 'w' : 'w'));
    g.rect(sx - 1, 23 + y0, 3, 3, 'W');
  }
  g.outline();
  return g;
}

function thor({ back, stride, bob }) {
  const g = new Grid();
  const lift = [stride > 0 ? 1 : 0, stride < 0 ? 1 : 0];
  const y0 = bob;
  // Capa por detrás: se ensancha hacia abajo
  const cape = (top, bottom) => {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const half = 7 + Math.round(t * 5);
      g.rect(16 - half, y, half * 2, 1, 'R');
      g.set(16 - half, y, 'r');
      g.set(16 - half + 1, y, 'r');
      g.set(15 + half, y, 'r');
      g.set(14 + half, y, 'r');
    }
  };
  if (!back) cape(18 + y0, 38);
  // Piernas
  legs(g, { leftTop: 12, rightTop: 17, pant: 'h', pantD: 'j', boot: 'N', bootD: 'n', lift });
  // Torso (armadura gris con tachas doradas y cinturón)
  g.rect(10, 18 + y0, 12, 10, 'G');
  g.rect(10, 18 + y0, 12, 1, 'g');
  g.rect(20, 19 + y0, 2, 9, 'h');
  if (!back) {
    g.rect(11, 20 + y0, 4, 2, 'g');
    g.rect(17, 20 + y0, 4, 2, 'g');
    g.set(12, 23 + y0, 'Y'); g.set(19, 23 + y0, 'Y');
    g.set(12, 24 + y0, 'y'); g.set(19, 24 + y0, 'y');
  }
  g.rect(10, 26 + y0, 12, 2, 'N');
  if (!back) g.rect(15, 26 + y0, 2, 2, 'Y');
  // Brazos con brazales plateados
  g.rect(6, 19 + y0, 4, 7, 'M');
  g.rect(6, 19 + y0, 4, 1, 'L');
  g.rect(9, 20 + y0, 1, 6, 'D');
  g.rect(6, 26 + y0, 4, 3, 'S');
  g.rect(22, 19 + y0, 4, 7, 'M');
  g.rect(22, 19 + y0, 4, 1, 'L');
  g.rect(25, 20 + y0, 1, 6, 'D');
  g.rect(22, 26 + y0, 4, 3, 'S');
  // Martillo en la mano derecha del dibujo
  g.rect(25, 24 + y0, 2, 5, 'N');
  g.rect(23, 29 + y0, 8, 5, 'M');
  g.rect(23, 29 + y0, 8, 1, 'L');
  g.rect(30, 30 + y0, 1, 4, 'D');
  g.rect(23, 33 + y0, 8, 1, 'D');
  g.rect(25, 30 + y0, 2, 3, 'D');
  // Capa de espaldas: tapa la espalda
  if (back) {
    cape(18 + y0, 38);
    g.rect(15, 19 + y0, 2, 18, 'r');
    g.rect(6, 19 + y0, 4, 7, 'R');
    g.rect(22, 19 + y0, 4, 7, 'R');
    g.rect(5, 19 + y0, 1, 7, 'r');
    g.rect(26, 19 + y0, 1, 7, 'r');
    // los pies siguen asomando
    legs(g, { leftTop: 12, rightTop: 17, pant: 'h', pantD: 'j', boot: 'N', bootD: 'n', lift });
    g.rect(23, 29 + y0, 8, 5, 'M');
    g.rect(23, 29 + y0, 8, 1, 'L');
    g.rect(30, 30 + y0, 1, 4, 'D');
    g.rect(23, 33 + y0, 8, 1, 'D');
    g.rect(25, 24 + y0, 2, 5, 'N');
  }
  // Casco plateado y alado
  g.ell(16, 9 + y0, 9, 8, (x, y, d, dx, dy) => (dy < -0.5 ? 'L' : dx > 0.55 ? 'D' : 'M'));
  // Alas del casco
  for (let i = 0; i < 7; i++) {
    g.rect(5 - Math.floor(i / 3), 8 + y0 - i, 3, 1, i > 4 ? 'M' : 'L');
    g.rect(24 + Math.floor(i / 3), 8 + y0 - i, 3, 1, i > 4 ? 'M' : 'L');
  }
  g.set(4, 6 + y0, 'M'); g.set(27, 6 + y0, 'M');
  if (!back) {
    // Cara y pelo rubio
    g.rect(11, 10 + y0, 10, 7, 'S');
    g.rect(11, 16 + y0, 10, 1, 's');
    g.rect(10, 11 + y0, 1, 6, 'Y');
    g.rect(21, 11 + y0, 1, 6, 'Y');
    g.rect(11, 10 + y0, 10, 1, 'M');
    g.rect(13, 12 + y0, 2, 2, 'W' in PALETTES.thor ? 'W' : 'L');
    g.rect(18, 12 + y0, 2, 2, 'L');
    g.set(14, 13 + y0, 'E'); g.set(19, 13 + y0, 'E');
    g.rect(13, 11 + y0, 2, 1, 'y'); g.rect(18, 11 + y0, 2, 1, 'y');
    g.rect(14, 15 + y0, 4, 1, 's');
    // barba corta
    g.rect(12, 16 + y0, 8, 1, 'y');
  } else {
    g.rect(10, 12 + y0, 12, 5, 'Y');
    g.rect(10, 16 + y0, 12, 1, 'y');
    g.rect(15, 6 + y0, 2, 6, 'D');
  }
  g.outline();
  return g;
}

/** Devuelve la grilla de letras [fila][columna] y su paleta. */
export function drawDrawnHero(id, opts) {
  const g = id === 'capitan' ? captain(opts) : thor(opts);
  return { grid: g.g, palette: PALETTES[id] };
}
