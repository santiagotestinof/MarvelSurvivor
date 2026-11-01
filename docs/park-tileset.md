# Terreno Wang de Central Park

## Inspección del recurso

`public/assets/tiles/park-natural-wang.png` es una copia sin cambios del PNG
proporcionado. Dimensiones verificadas: **128×128 píxeles**. La clasificación
de sus cuatro esquinas identifica una grilla **4×4 de piezas de 32×32**, sin
margen ni separación. El tamaño se determinó por las conexiones del dibujo,
no por el tamaño de los tiles del mapa anterior (16 px).

Es un Wang de **esquinas**, con dos terrenos: césped verde oscuro y grava
beige. Sus transiciones son de tierra y hierba, sin el antiguo cordón de piedra.
Las 16 combinaciones están presentes, incluidas ambas diagonales; no faltan
piezas para conectar los senderos actuales.

## Organización

Índices del PNG, de izquierda a derecha y de arriba hacia abajo. Los bits
indican grava: superior izquierda=1, superior derecha=2, inferior izquierda=4,
inferior derecha=8.

| Fila | Índices | Máscaras de grava |
| --- | --- | --- |
| 0 | 0, 1, 2, 3 | 4, 10, 13, 12 |
| 1 | 4, 5, 6, 7 | 9, 14, 15, 7 |
| 2 | 8, 9, 10, 11 | 2, 3, 11, 5 |
| 3 | 12, 13, 14, 15 | 0, 8, 6, 1 |

La pieza 12 es césped completo y la 6 es grava completa. Usar los índices
como máscaras directamente produciría conexiones incorrectas. La tabla
`PARK_TILE_BY_CORNERS` en `ParkTerrainData.ts` convierte máscara a índice.

## Integración

`BootScene` carga la hoja nueva y conserva la anterior únicamente como fuente
del césped puro (pieza 6 de `park-wang-gravel.png`). `ParkTerrain` prepara un
atlas de 128×128: los píxeles verdes del nuevo PNG se sustituyen por el césped
anterior, conservando su fase local. La grava beige y el borde natural se
copian del PNG nuevo. No se dibujan piedras, grava ni vegetación nuevas.
El atlas usa nearest-neighbor y sus píxeles se reutilizan a escala 1:1.

La tabla de `ParkTerrainData` documenta la organización Wang original. La
colocación por vértices de 32 px producía variaciones de ancho al mover las
curvas de una fila a otra. Para dar a los senderos un aspecto planificado,
`ParkPathSurfaceData` calcula distancias a los segmentos continuos de
`ParkPaths`, con un ancho geométrico común de **44 px**. Los cruces usan la
distancia mínima al conjunto de senderos, sin bordes internos.

`ParkPathSurface` toma la grava de la pieza 6 y la transición natural de la
pieza 3 del PNG, distribuyéndolas según esa distancia. No escala los píxeles
ni inventa materiales; las pequeñas irregularidades del borde provienen del
PNG. Se preparan bloques de 256×256 sólo junto a los caminos y se reutilizan
las texturas entre partidas. El césped original queda debajo en un Tilemap.
Los ensanches hacia el interior de Bethesda son graduales; su pavimento,
contorno y fuente no se modifican.

El césped se dibuja a profundidad -1000 y los senderos a -999.5, detrás de
ciudad, fuente, vegetación, objetos y personajes. No crean cuerpos físicos.
`ParkFurniture` coloca los PNG originales de lámpara, papelera y banco según
sus bases visibles, con escalas 1, 0.5 y 0.75 respectivamente. Sólo sus bases
bloquean el paso. Cámara, movimiento, enemigos, personajes, armas y balance
conservan sus sistemas.
