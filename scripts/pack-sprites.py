import sys, os
from PIL import Image
root = sys.argv[1]
src = os.path.join(root, 'stickers/character-frames')
groups = ['idle','run_right','run_left','jump_right','jump_left','jump','land','fall']
FW, FH, SP = 240, 360, 4
atlas = Image.new('RGBA', (8*FW + 7*SP, 8*FH + 7*SP), (0,0,0,0))
for r, g in enumerate(groups):
    for c in range(8):
        im = Image.open(os.path.join(src, f'{g}_{c}.png')).convert('RGBA')
        assert im.size == (FW, FH), (g, c, im.size)
        atlas.paste(im, (c*(FW+SP), r*(FH+SP)))
out = os.path.join(root, 'public/stickers/character-atlas.webp')
atlas.save(out, 'WEBP', quality=90, method=6)
print('atlas', atlas.size, os.path.getsize(out)//1024, 'KB')
for name, outname in [('question','question'),('retry','retry'),('goodjob','goodjob'),('climbing figure','climbing-figure')]:
    im = Image.open(os.path.join(root, 'stickers', name + '.png')).convert('RGBA')
    im = im.resize((512, 512), Image.LANCZOS)
    o = os.path.join(root, 'public/stickers', outname + '.webp')
    im.save(o, 'WEBP', quality=90, method=6)
    print(outname, os.path.getsize(o)//1024, 'KB')
