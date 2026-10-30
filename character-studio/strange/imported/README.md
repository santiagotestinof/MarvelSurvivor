# Doctor Strange importado

Origen: carpeta `Assets de Marvel/Doctor_Strange`, provista por Lucas.
Los originales se conservan en `source.zip`.

Se usa el estado `Create_a_new_Levitat`: siete cuadros de levitación por
dirección a 10 FPS, tanto en reposo como en movimiento. Hay ocho direcciones,
en este orden: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.
Las hojas idle y walk comparten los mismos cuadros del paquete.

Cuadros de 92×92 sin redibujar, recortar ni escalar. Anclaje en (46, 80),
debajo de los pies para conservar la sensación de levitación.
Escala en partida: 2/3. Colisión: 8×6 en el mundo.
El retrato se obtiene de la pose sur del mismo estado y se recorta al contenido.
La ulti usa las ocho poses completas con brazos de `Create_a_new_Ultimat`,
centradas en cuadros de 92×92. Esta carpeta no figura en metadata.json.
`strangeUltimateVisual.ts` combina en un canvas la parte superior de estas poses
con la capa, piernas y pies de los siete cuadros originales de levitación.
La cintura une ambas partes y los brazos oscilan junto al cuerpo a 10 FPS.
Mientras dura Tiempo detenido usa esa animación en la dirección de movimiento;
al finalizar o cancelar vuelve a la levitación normal.

Reimportar: `python tools/import-strange-assets.py "ruta/Doctor_Strange"`
(también acepta ZIP). Restaurar: `node tools/generate-sprites.mjs --only=strange`.
`npm run sprites` también conserva el arte importado.
