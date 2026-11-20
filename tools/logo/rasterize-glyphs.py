import hashlib
import json
from pathlib import Path

from PIL import ImageFont


font_path = Path(__file__).resolve().parents[2] / 'assets/fonts/PressStart2P-Regular.ttf'
grid = 8
font = ImageFont.truetype(str(font_path), grid, layout_engine=ImageFont.Layout.BASIC)
glyphs = {}

for letter in dict.fromkeys('LINEBREAKER'):
    mask, offset = font.getmask2(letter, mode='1')
    width, height = mask.size
    assert (width, height) == (grid, grid) and offset == (0, 0), (letter, mask.size, offset)
    glyphs[letter] = [
        ''.join('#' if mask[row * grid + column] else '.' for column in range(grid))
        for row in range(grid)
    ]

print('{')
print(f'  "fontSha256": "{hashlib.sha256(font_path.read_bytes()).hexdigest()}",')
print(f'  "grid": {grid},')
print('  "glyphs": {')
print(',\n'.join(f'    "{letter}": {json.dumps(rows)}' for letter, rows in glyphs.items()))
print('  }')
print('}')
