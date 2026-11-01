export interface SidewalkPatterns {
  regular: Uint8ClampedArray[];
  worn: Uint8ClampedArray[];
}

/** El tono de fondo se estima con la mediana para que las grietas no lo oscurezcan. */
function medianColor(pixels: Uint8ClampedArray, size: number, interiorOnly = false): number[] {
  const histograms = Array.from({ length: 3 }, () => new Uint32Array(256));
  let count = 0;
  for (let y = interiorOnly ? 1 : 0; y < size; y++) for (let x = interiorOnly ? 1 : 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (pixels[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) histograms[c][pixels[i + c]]++;
    count++;
  }
  return histograms.map((histogram) => {
    let total = 0;
    for (let value = 0; value < 256; value++) {
      total += histogram[value];
      if (total >= count / 2) return value;
    }
    return 0;
  });
}

/** Losas de 32 px (~75 % del patrón original), todas con las mismas juntas. */
export function buildSidewalkPatterns(regular: Uint8ClampedArray, worn: Uint8ClampedArray): SidewalkPatterns {
  const result: SidewalkPatterns = { regular: [], worn: [] };
  const grey = medianColor(regular, 128);
  for (const variant of ['regular', 'worn'] as const) {
    const source = variant === 'regular' ? regular : worn;
    const size = variant === 'regular' ? 128 : 96;
    const columns = variant === 'regular' ? [0, 42, 87, 128] : [0, 31, 63, 96];
    // La última fila del PNG principal continúa por arriba al repetir la textura.
    const rows = variant === 'regular' ? [35, 77, 120, 163] : [0, 31, 63, 96];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      for (let orientation = 0; orientation < 8; orientation++) {
        const slab = new Uint8ClampedArray(32 * 32 * 4);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          let pixels = source;
          let index: number;
          if (x === 0 || y === 0) {
            // Las juntas proceden siempre del primer PNG, incluso en las losas rotadas.
            pixels = regular;
            const sx = x === 0 ? 42 : 44 + Math.floor((x - 1) * 39 / 31);
            const sy = y === 0 ? 77 : 79 + Math.floor((y - 1) * 39 / 31);
            index = (sy * 128 + sx) * 4;
          } else {
            let u = x - 1;
            let v = y - 1;
            if (orientation & 4) u = 30 - u;
            for (let turn = 0; turn < (orientation & 3); turn++) [u, v] = [30 - v, u];
            const sx = columns[col] + 1 + Math.floor(u * (columns[col + 1] - columns[col] - 2) / 31);
            const sy = (rows[row] + 1 + Math.floor(v * (rows[row + 1] - rows[row] - 2) / 31)) % size;
            index = (sy * size + sx) * 4;
          }
          for (let c = 0; c < 4; c++) slab[(y * 32 + x) * 4 + c] = pixels[index + c];
        }
        // Igualar la paleta de fondo: la variante deteriorada aporta grietas, no cuadros beige.
        // Sólo cambia el color de cada píxel; no hay suavizado espacial ni cambios en las juntas.
        const background = medianColor(slab, 32, true);
        const shade = ((row * 3 + col) * 8 + orientation) % 5 - 2;
        const contrast = variant === 'worn' ? 0.72 : 0.88;
        for (let y = 1; y < 32; y++) for (let x = 1; x < 32; x++) {
          const i = (y * 32 + x) * 4;
          for (let c = 0; c < 3; c++) {
            slab[i + c] = Math.round(grey[c] + shade + (slab[i + c] - background[c]) * contrast);
          }
        }
        result[variant].push(slab);
      }
    }
  }
  return result;
}

function slabHash(col: number, row: number): number {
  let hash = Math.imul(col + 1, 0x45d9f3b) ^ Math.imul(row + 1, 0x27d4eb2d);
  hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
  return (hash ^ hash >>> 16) >>> 0;
}

/** Deterioro disperso sin vecinos pegados ni una cadencia fija; no usa el RNG del mapa. */
export function sidewalkSlab(patterns: SidewalkPatterns, col: number, row: number): Uint8ClampedArray {
  const hash = slabHash(col, row);
  let deteriorated = hash < 0x3b000000;
  for (let dy = -1; dy <= 1 && deteriorated; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && slabHash(col + dx, row + dy) <= hash) { deteriorated = false; break; }
  }
  const bank = deteriorated ? patterns.worn : patterns.regular;
  return bank[(hash >>> 8) % bank.length];
}
