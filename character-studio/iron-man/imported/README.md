# Iron Man v2

Origen: Crear_un_sprite_de_Iron.zip, descargado por Lucas. Original conservado en source.zip.
Idle: ocho poses estáticas. Movimiento: vuelo de siete cuadros por dirección a 10 FPS.
Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.
Sudeste: variante south-east-cd9c38ca (última del ZIP).
Cuadros 92×92, sin escalar ni recortar; las poses de 64×64 llevan margen de 14 px.
Anclaje del suelo: (46, 78). Escala en el juego: 2/3 (al menos un píxel de pantalla por píxel del asset).
El retrato del menú se ajusta al contenido visible, sin márgenes transparentes.
El paquete no incluye ataques, daño ni muerte: no se mezclan con animaciones del diseño anterior.

Reimportar: python tools/import-ironman-assets.py [ruta-al-zip]
Restaurar las hojas en el juego: node tools/generate-sprites.mjs --only=ironman
