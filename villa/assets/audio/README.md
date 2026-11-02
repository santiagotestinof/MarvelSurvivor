# Audio con archivos

Por defecto el juego genera la música y el golpe con Web Audio (sin archivos). Para usar archivos propios:

1. Copiá los archivos en esta carpeta (`.ogg` o `.mp3`, mejor `.ogg`; la música en loop, sin intro ni final, sin voces).
2. Listalos en `manifest.json`. Todo lo que no figure sigue sonando como antes.

```json
{
  "music": { "menu": "music-menu.ogg", "game": "music-game.ogg" },
  "sfx": {
    "hit": "sfx-hit.ogg",
    "kill": "sfx-kill.ogg",
    "levelup": "sfx-levelup.ogg",
    "coin": "sfx-coin.ogg",
    "chest": "sfx-chest.ogg",
    "ultimate": "sfx-ultimate.ogg"
  }
}
```

- `music.menu` suena en los menús y `music.game` en la partida (loop continuo con entrada suave).
- `sfx.hit` es el golpe a un enemigo y `sfx.kill` el golpe que lo derrota; si solo hay `hit`, se usa para los dos.
- `levelup` (sale el menú de mejoras), `coin` (se junta oro), `chest` (se junta un cofre) y `ultimate` (se activa la ulti) solo suenan si tienen archivo.
- Los efectos tienen que ser cortos (menos de ~1 s) y la música no mucho más de 2–3 MB para no hacer pesada la página.
- Los volúmenes de CONFIGURACIÓN (general y música) valen también para los archivos.
