# Capitán América importado

Origen: `Capitan_America.zip`, provisto por Lucas. Original conservado en `source.zip`.

Idle: una pose por dirección. Caminata: siete cuadros por dirección a 10 FPS
(el nombre de la animación menciona seis, pero el ZIP contiene siete).
Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.

Las poses originales de 64×64 y los cuadros de 88×88 / 92×92 se centran en
lienzos transparentes de 92×92 sin recortar, redibujar ni escalar los píxeles.
Anclaje del suelo: (46, 77). Escala en partida: 2/3. Colisión en el mundo: 10×8.
El retrato del menú está recortado al contenido visible.

Reimportar: `python tools/import-capitan-assets.py "ruta/Capitan_America.zip"`.
Restaurar solo estos sprites: `node tools/generate-sprites.mjs --only=capitan`.
La regeneración completa con `npm run sprites` también conserva este arte.
