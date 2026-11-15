import os, sys
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sheet_path = os.path.join(root, 'stickers/flip, victory dance, celebration dances and animations.png')
sheet = Image.open(sheet_path)
w_total, h_total = sheet.size

# Rows in order
rows_info = [
    ('flip', 0, 148),
    ('victory', 150, 288),
    ('celebrate-clap', 290, 404),
    ('celebrate-confetti', 406, 520),
    ('celebrate-happy', 522, 628),
    ('celebrate-cheer', 630, 730),
    ('celebrate-clap-cheer', 732, 828),
    ('celebrate-confetti-dance', 830, 936)
]

scale = 2.25
FW, FH, SP = 240, 360, 4
num_cols = 12
num_rows = len(rows_info)

atlas_w = num_cols * FW + (num_cols - 1) * SP
atlas_h = num_rows * FH + (num_rows - 1) * SP
atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))

anim_frame_dict = {}

for r_idx, (anim_name, y1, y2) in enumerate(rows_info):
    sub = sheet.crop((155, y1, w_total, y2))
    a = sub.split()[3]
    w, h = sub.size
    
    # 11 cut points
    cuts = [0]
    for i in range(1, 12):
        target_x = int(i * (w / 12.0))
        min_x = target_x
        min_sum = 999999
        for x in range(max(0, target_x - 30), min(w, target_x + 30)):
            s = sum(a.getpixel((x, y)) for y in range(h))
            if s < min_sum:
                min_sum = s
                min_x = x
        cuts.append(min_x)
    cuts.append(w)
    
    row_height = y2 - y1
    anim_frames = []
    
    for c_idx in range(num_cols):
        f = sub.crop((cuts[c_idx], 0, cuts[c_idx+1], row_height))
        fb = f.split()[3].getbbox()
        if not fb:
            fb = (0, 0, f.width, f.height)
        
        char_cx = (fb[0] + fb[2]) / 2.0
        fw_scaled = int(f.width * scale)
        fh_scaled = int(f.height * scale)
        f_scaled = f.resize((fw_scaled, fh_scaled), Image.LANCZOS)
        
        canv = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        paste_x = int(FW / 2 - (char_cx * scale))
        paste_y = int(346 - (row_height * scale))
        canv.paste(f_scaled, (paste_x, paste_y), f_scaled)
        
        # Paste into atlas
        dest_x = c_idx * (FW + SP)
        dest_y = r_idx * (FH + SP)
        atlas.paste(canv, (dest_x, dest_y))
        
        anim_frames.append(canv)
    
    anim_frame_dict[anim_name] = anim_frames

out_atlas = os.path.join(root, 'public/stickers/actions-atlas.webp')
atlas.save(out_atlas, 'WEBP', quality=90, method=6)
print(f'Saved actions-atlas.webp: size={atlas.size}, file={os.path.getsize(out_atlas)//1024} KB')

# Now save animated WebP files for each animation (duration ~75ms per frame = 13.3 fps)
for anim_name, frames in anim_frame_dict.items():
    out_anim = os.path.join(root, f'public/stickers/{anim_name}.webp')
    frames[0].save(out_anim, format='WEBP', save_all=True, append_images=frames[1:], duration=75, loop=0)
    print(f'Saved {anim_name}.webp: {os.path.getsize(out_anim)//1024} KB')

print('All actions atlas and animated WebPs generated!')
