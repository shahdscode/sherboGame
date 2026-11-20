"""Make the phone-sized (SD) copies of the character sprite sheets.

Phones show the climber about 104 css px tall at no more than 2x render resolution,
so 240x360 frames are far more than needed there and cost ~57MB of GPU memory.
This writes public/stickers/<name>-sd.webp with every frame scaled to 144x216
(same grid, same 4px spacing). Desktop and tablet keep the full-size sheets
(see SD_ATLAS_MAX_SCREEN_SIDE in src/game/characterAtlas.ts).

Run after regenerating character-atlas.webp or actions-atlas.webp:
    python3 scripts/make-sd-atlases.py .
"""
import os
import sys

from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else '.'
FW, FH, SP = 240, 360, 4  # full-size frame and spacing (Player.ts HD_ATLAS)
SD_FW, SD_FH = 144, 216  # 60% (Player.ts SD_ATLAS)

for name in ['character-atlas', 'actions-atlas']:
    src = os.path.join(root, 'public/stickers', f'{name}.webp')
    atlas = Image.open(src).convert('RGBA')
    cols = (atlas.width + SP) // (FW + SP)
    rows = (atlas.height + SP) // (FH + SP)
    assert (cols * (FW + SP) - SP, rows * (FH + SP) - SP) == atlas.size, (name, atlas.size)

    out = Image.new('RGBA', (cols * (SD_FW + SP) - SP, rows * (SD_FH + SP) - SP), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            x, y = c * (FW + SP), r * (FH + SP)
            frame = atlas.crop((x, y, x + FW, y + FH))
            # Resize premultiplied so transparent pixels don't bleed dark fringes into edges.
            small = frame.convert('RGBa').resize((SD_FW, SD_FH), Image.LANCZOS).convert('RGBA')
            out.paste(small, (c * (SD_FW + SP), r * (SD_FH + SP)))

    dst = os.path.join(root, 'public/stickers', f'{name}-sd.webp')
    out.save(dst, 'WEBP', quality=90, method=6)
    print(f'{name}-sd', out.size, os.path.getsize(dst) // 1024, 'KB')
