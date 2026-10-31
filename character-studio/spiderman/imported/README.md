# Spider-Man importado

Origen: ocho GIF de 88×88 (uno por dirección, 8 cuadros de caminata cada uno) que pasó Santi; copias en `source/`.
Idle: el primer cuadro de cada dirección (una pose). Caminata: ocho cuadros por dirección a 10 FPS.
Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.

Cuadros de 92×92: los de 88×88 se centran con 2 px de margen transparente, sin tocar sus píxeles.
Anclaje: (46, 77). Escala en partida: 2/3. Colisión en el mundo: 10×8.
Retrato del menú recortado al contenido visible.

Reimportar: `python tools/import-spiderman-assets.py [carpeta con los GIF]`.
Restaurar las hojas: `node tools/generate-sprites.mjs --only=spiderman`.
`npm run sprites` conserva el arte importado.
