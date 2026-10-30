"""Importa las ocho direcciones del ZIP de Capitán América (requiere Pillow)."""
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'character-studio/capitan/imported'
DIRECTIONS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']


def main():
    SOURCE.mkdir(parents=True, exist_ok=True)
    archive = SOURCE / 'source.zip'
    if len(sys.argv) > 1:
        shutil.copyfile(sys.argv[1], archive)
    with ZipFile(archive) as z:
        state = json.loads(z.read('metadata.json'))['states'][0]
        animations = next(iter(state['frames']['animations'].values()))
        count = len(animations['south'])
        assert all(len(animations[d]) == count for d in DIRECTIONS)
        idle = Image.new('RGBA', (92, 92 * 8))
        walk = Image.new('RGBA', (92 * count, 92 * 8))

        def place(sheet, name, column, row):
            frame = Image.open(BytesIO(z.read(name))).convert('RGBA')
            assert frame.size in [(64, 64), (88, 88), (92, 92)]
            # Solo márgenes transparentes: conservar píxeles y centrado del exportador.
            sheet.paste(frame, (column * 92 + (92 - frame.width) // 2,
                                row * 92 + (92 - frame.height) // 2))

        for row, direction in enumerate(DIRECTIONS):
            place(idle, state['frames']['rotations'][direction], 0, row)
            for column, name in enumerate(animations[direction]):
                place(walk, name, column, row)
        idle.save(SOURCE / 'capitan-idle.png')
        walk.save(SOURCE / 'capitan-walk.png')
        portrait = idle.crop((0, 0, 92, 92))
        portrait.crop(portrait.getbbox()).save(SOURCE / 'capitan-menu.png')

    destination = ROOT / 'public/assets/characters/capitan'
    destination.mkdir(parents=True, exist_ok=True)
    for name in ['capitan-idle.png', 'capitan-walk.png', 'capitan-menu.png']:
        shutil.copyfile(SOURCE / name, destination / name)
    print(f'Capitán América importado: 8 direcciones, {count} cuadros de caminata, lienzos 92×92.')


if __name__ == '__main__':
    main()
