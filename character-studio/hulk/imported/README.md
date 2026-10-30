# Hulk importado

Origen: carpeta `Assets de Marvel/HULK`, provista por Lucas.
Copia de los originales en `source.zip`.

Ocho poses de reposo y siete cuadros de caminata por dirección a 10 FPS.
Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.
Los originales de 64×64 (reposo) y 88×88 (caminata) se centran en lienzos
transparentes de 92×92, sin recortar, redibujar ni escalar sus píxeles.
Anclaje: (46, 77). Escala en partida: (2/3) × 1,15. Colisión: 12×8 en el mundo.
El retrato del menú se recorta al contenido visible y usa el mismo criterio
de tamaño que los otros héroes importados en PERSONAJES.

Reimportar: `python tools/import-hulk-assets.py "ruta/HULK"` (también admite ZIP).
Restaurar: `node tools/generate-sprites.mjs --only=hulk`.
`npm run sprites` conserva este arte.
