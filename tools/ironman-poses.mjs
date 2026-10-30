/** Vista posterior articulada con la misma paleta y escala que la armadura original. */
function rearArmor(reference, diagonal) {
  const width = reference[0].length;
  const grid = reference.map(() => Array(width).fill('.'));
  const put = (x, y, c) => { if (x >= 0 && x < width && y >= 0 && y < grid.length) grid[y][x] = c; };
  const band = (center, y, span, shade = false) => {
    const start = center - Math.floor(span / 2);
    for (let i = 0; i < span; i++) put(start + i, y,
      i === 0 || i === span - 1 ? 'K' : i >= span - 3 ? 'r' : shade ? 'r' : 'R');
  };
  // Volumen del casco: nuca continua, sombreada y sin facciones frontales.
  [5,9,11,11,13,13,13,13,13,13,13,11,9,7].forEach((span,y) => {
    band(16,y,span);
    if (y === 0 || y === 13) for (let x=0;x<width;x++) if(grid[y][x]!=='.') put(x,y,'K');
    if (y > 3 && y < 11) put(12,y,'r');
  });
  band(16,14,7,true); band(16,15,9,true);
  // Brazos: hombro, bíceps, codo y antebrazo son piezas separadas, no columnas.
  for (const side of [-1,1]) {
    const shoulder = 16 + side * 8;
    [3,5,7,7,5].forEach((span,i) => band(shoulder,15+i,span,diagonal && side<0));
    for(let y=20;y<29;y++) {
      const center=shoulder+side*Math.floor((y-19)/4);
      band(center,y,y===24?4:5,diagonal && side<0);
      if(y===20 || y===25) put(center,y, side<0?'Y':'O');
      if(y===22 || y===27) put(center+side,y,'d');
    }
    const palm=shoulder+side*2;
    [5,7,7,5].forEach((span,i)=>band(palm,28+i,span));
    put(palm,32,'W'); put(palm-1,32,'B'); put(palm+1,32,'B');
  }
  // Espalda en V, cintura de nueve píxeles y cadera suavemente ensanchada.
  [9,11,13,13,11,11,11,9,9,9,9,9,9,9,11].forEach((span,i)=>band(16,16+i,span));
  for(const [x,y,c] of [[12,18,'Y'],[13,18,'Y'],[19,18,'O'],[20,18,'Y'],
    [13,19,'O'],[14,19,'Y'],[18,19,'Y'],[19,19,'O'],[14,20,'O'],[15,20,'Y'],
    [17,20,'Y'],[18,20,'O'],[15,21,'O'],[16,21,'Y'],[17,21,'O'],
    [13,23,'r'],[19,23,'d'],[15,25,'d'],[16,25,'r'],[17,25,'d'],[14,28,'O'],[18,28,'o']]) put(x,y,c);
  // Muslos y pantorrillas: anchura similar a la pose frontal, rodillas y talones definidos.
  for(const center of [12,20]) {
    for(let y=31;y<=43;y++) {
      const span=y<36?6:y===36?5:y<42?5:6;
      band(center,y,span);
      if(y===32) put(center-1,y,'O');
      if(y===35 || y===41) {put(center-1,y,'r');put(center,y,'d');}
      if(y===38) put(center-1,y,'R');
      if(y===42) put(center,y,'r');
    }
    put(center,44,'W');put(center-1,44,'B');put(center+1,44,'B');
  }
  return grid;
}

export function ironManPose(reference, fx, fy) {
  let grid = fy < 0 ? rearArmor(reference, fx !== 0) : reference.map((row) => [...row]);
  // Las vistas frontales conservan todas las proporciones de la referencia.
  if (fy === 0) grid = grid.map((row,y)=>{
    if(y<14 || y>=29)return [...row];
    const result=Array(row.length).fill('.');
    row.forEach((c,x)=>{if(c!=='.' && x+1<row.length)result[x+1]=c;});
    return result;
  });
  if(fy>0 && fx!==0)for(let y=25;y<31;y++){
    const row=[...grid[y]];
    for(let x=24;x<row.length;x++)grid[y][x]='.';
    for(let x=24;x<row.length-1;x++)if(row[x]!=='.')grid[y][x+1]=row[x];
  }
  if(fx<0)grid=grid.map(row=>row.reverse());
  return grid;
}
