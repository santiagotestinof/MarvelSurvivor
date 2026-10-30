"""Importa el ZIP de Iron Man sin redibujar ni escalar sus píxeles (requiere Pillow)."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'character-studio/iron-man/imported'
SOURCE.mkdir(parents=True, exist_ok=True)
archive = SOURCE / 'source.zip'
if len(sys.argv) > 1:
    shutil.copyfile(sys.argv[1], archive)

DIRECTIONS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
with ZipFile(archive) as z:
    metadata = json.loads(z.read('metadata.json'))
    idle_state, flying_state = metadata['states']
    animations = next(iter(flying_state['frames']['animations'].values()))
    # La exportación contiene dos variantes de sudeste; elegimos la última.
    selected = {direction: direction if direction in animations else next(key for key in reversed(list(animations)) if key.startswith(direction + '-')) for direction in DIRECTIONS}
    count = len(animations[selected['south']])
    assert all(len(animations[key]) == count for key in selected.values())
    idle = Image.new('RGBA', (92, 92 * 8))
    walk = Image.new('RGBA', (92 * count, 92 * 8))
    for row, direction in enumerate(DIRECTIONS):
        standing = Image.open(BytesIO(z.read(idle_state['frames']['rotations'][direction]))).convert('RGBA')
        assert standing.size == (64, 64)
        idle.paste(standing, (14, row * 92 + 14))
        for column, name in enumerate(animations[selected[direction]]):
            frame = Image.open(BytesIO(z.read(name))).convert('RGBA')
            assert frame.size == (92, 92)
            walk.paste(frame, (column * 92, row * 92))
    idle.save(SOURCE / 'ironman-idle.png')
    walk.save(SOURCE / 'ironman-walk.png')
    portrait = idle.crop((0, 0, 92, 92))
    portrait.crop(portrait.getbbox()).save(SOURCE / 'ironman-menu.png')
    (SOURCE / 'README.md').write_text(
        '# Iron Man v2\n\n'
        'Origen: Crear_un_sprite_de_Iron.zip, descargado por Lucas. Original conservado en source.zip.\n'
        'Idle: ocho poses estáticas. Movimiento: vuelo de siete cuadros por dirección a 10 FPS.\n'
        'Filas: sur, sudoeste, oeste, noroeste, norte, noreste, este, sudeste.\n'
        'Sudeste: variante south-east-cd9c38ca (última del ZIP).\n'
        'Cuadros 92×92, sin escalar ni recortar; las poses de 64×64 llevan margen de 14 px.\n'
        'Anclaje del suelo: (46, 78). Escala en el juego: 2/3 (al menos un píxel de pantalla por píxel del asset).\n'
        'El retrato del menú se ajusta al contenido visible, sin márgenes transparentes.\n'
        'El paquete no incluye ataques, daño ni muerte: no se mezclan con animaciones del diseño anterior.\n\n'
        'Reimportar: python tools/import-ironman-assets.py [ruta-al-zip]\n'
        'Restaurar las hojas en el juego: node tools/generate-sprites.mjs --only=ironman\n', encoding='utf-8')

destination = ROOT / 'public/assets/characters/ironman'
for name in ['ironman-idle.png', 'ironman-walk.png', 'ironman-menu.png']:
    shutil.copyfile(SOURCE / name, destination / name)
print(f'Iron Man importado: 8 direcciones, {count} cuadros de vuelo, lienzos 92×92.')
