# Ultron bots

Vistas y caminata de PixelLab importadas de `Desktop/Assets de Marvel/Ultron_Bots`.
Los originales y su metadata se conservan en `source/`.

`drone.png` mide 588×672: siete columnas y ocho filas de cuadros de 84×84, en orden:
sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.
Cada fila contiene los siete cuadros de caminata del export, de `frame_000.png`
a `frame_006.png`, reproducidos a 7 FPS. Aunque el nombre de la animación dice
"6-frame", los archivos y la metadata incluyen siete cuadros por dirección.

El juego usa esta hoja para `DRONE`, a escala 0,5, con el suelo en (42, 70).
Las animaciones agregan 10 píxeles de margen a cada lado del diseño de 64×64;
se conservan los cuadros completos y sus píxeles originales.
La colisión conserva sus dimensiones en el mundo: 14×12 píxeles.
Vida, velocidad, daño y aparición en oleadas conservan sus valores.

Para reconstruir la hoja en Windows, desde la raíz del proyecto:

```powershell
./tools/import-ultron-assets.ps1
```

También acepta `-Source 'ruta/al/export'` (carpeta que contiene `metadata.json`).
El importador obtiene el orden de los cuadros de la metadata y comprueba sus dimensiones.
`tools/imported-ultron.mjs` restaura la hoja al ejecutar `npm run sprites`.
