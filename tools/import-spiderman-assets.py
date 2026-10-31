"""Importa las ocho direcciones de Spider-Man desde GIFs de 88×88 (requiere Pillow).

Uso: python tools/import-spiderman-assets.py [carpeta]
La carpeta (por defecto character-studio/spiderman/imported/source) tiene un GIF por dirección:
south, south-west, west, north-west, north, north-east, east, south-east (.gif).
"""
from pathlib import Path
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / 'character-studio/spiderman/imported'
DIRECTIONS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
CELL = 92


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else STUDIO / 'source'
    gifs = {d: Image.open(source / f'{d}.gif') for d in DIRECTIONS}
    count = gifs['south'].n_frames
    assert all(g.n_frames == count for g in gifs.values())
    idle = Image.new('RGBA', (CELL, CELL * 8))
    walk = Image.new('RGBA', (CELL * count, CELL * 8))
    for row, direction in enumerate(DIRECTIONS):
        gif = gifs[direction]
        for column in range(count):
            gif.seek(column)
            frame = gif.convert('RGBA')
            assert frame.size == (88, 88)
            # Solo márgenes transparentes: se conservan los píxeles tal cual.
            pos = ((CELL - frame.width) // 2, (CELL - frame.height) // 2)
            walk.paste(frame, (column * CELL + pos[0], row * CELL + pos[1]))
            if column == 0:
                idle.paste(frame, (pos[0], row * CELL + pos[1]))
    idle.save(STUDIO / 'spiderman-idle.png')
    walk.save(STUDIO / 'spiderman-walk.png')
    portrait = idle.crop((0, 0, CELL, CELL))
    portrait.crop(portrait.getbbox()).save(STUDIO / 'spiderman-menu.png')

    destination = ROOT / 'public/assets/characters/spiderman'
    destination.mkdir(parents=True, exist_ok=True)
    for name in ['spiderman-idle.png', 'spiderman-walk.png', 'spiderman-menu.png']:
        shutil.copyfile(STUDIO / name, destination / name)
    print(f'Spider-Man importado: 8 direcciones, {count} cuadros de caminata, lienzos {CELL}×{CELL}.')


if __name__ == '__main__':
    main()
