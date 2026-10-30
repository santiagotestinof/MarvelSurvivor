# Thor importado

Origen: carpeta `Assets de Marvel/Thor`, provista por Lucas. Copia de los originales en `source.zip`.

Idle: una pose por dirección. Caminata: siete cuadros por dirección a 10 FPS
(el nombre de la animación menciona seis, pero contiene siete).
Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.

Cuadros de 92×92. Las poses originales de 64×64 se centran con 14 px de margen
transparente. La caminata se copia sin recortar, redibujar ni escalar sus píxeles.
Anclaje: (46, 77). Escala en partida: 2/3. Colisión en el mundo: 10×8.
Retrato del menú recortado al contenido visible, con el mismo criterio de tamaño
que los otros héroes importados en PERSONAJES.

Reimportar: `python tools/import-thor-assets.py "ruta/Thor"` (también acepta ZIP).
Restaurar las hojas: `node tools/generate-sprites.mjs --only=thor`.
`npm run sprites` conserva el arte importado.
