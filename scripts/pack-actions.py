import os
import math
from collections import deque
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sheet_path = os.path.join(
    root, 'stickers/flip, victory dance, celebration dances and animations.png'
)
sheet = Image.open(sheet_path).convert('RGBA')
sub_all = sheet.crop((155, 0, sheet.width, sheet.height))
w_total, h_total = sub_all.size
a_all = sub_all.split()[3]

# Exact row vertical centers (per-column empty boundaries are refined around these)
rows_info = [
    ('flip', 0, 147),
    ('victory', 147, 289),
    ('celebrate-clap', 289, 403),
    ('celebrate-confetti', 403, 517),
    ('celebrate-happy', 517, 626),
    ('celebrate-cheer', 626, 727),
    ('celebrate-clap-cheer', 727, 827),
    ('celebrate-confetti-dance', 827, 937),
]

num_cols = 12
num_rows = len(rows_info)

# Atlas dimensions for Phaser in-game sprite (kept at 240x360 per cell for Player.ts compatibility)
ATLAS_FW, ATLAS_FH, ATLAS_SP = 240, 360, 4
atlas_w = num_cols * ATLAS_FW + (num_cols - 1) * ATLAS_SP
atlas_h = num_rows * ATLAS_FH + (num_rows - 1) * ATLAS_SP
atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))

# High-resolution 480x480 square canvas for UI sticker animations (matches question.webp / retry.webp aspect)
STICKER_SZ = 480


def draw_4point_star(draw, cx, cy, outer_r, inner_r, fill):
    pts = []
    for i in range(8):
        ang = i * math.pi / 4.0 - math.pi / 2.0
        r = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    draw.polygon(pts, fill=fill)


def draw_confetti_piece(draw, cx, cy, w, h, angle_deg, fill):
    rad = math.radians(angle_deg)
    ca, sa = math.cos(rad), math.sin(rad)
    hw, hh = w / 2.0, h / 2.0
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    pts = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for (x, y) in corners]
    draw.polygon(pts, fill=fill)


def render_hd_particles(anim_name, frame_idx, canvas_size=STICKER_SZ):
    """Draws crisp 2x-supersampled vector sparkles and confetti for UI celebration stickers."""
    ss = 2
    sz = canvas_size * ss
    layer = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    phase = (frame_idx / float(num_cols)) * 2.0 * math.pi

    if anim_name in (
        'celebrate-clap-cheer',
        'celebrate-cheer',
        'celebrate-clap',
        'victory',
    ):
        anchors = [
            (0.16, 0.28, 24, (251, 191, 36), 0.0),
            (0.84, 0.26, 28, (253, 224, 71), 1.1),
            (0.12, 0.52, 20, (56, 189, 248), 2.3),
            (0.87, 0.50, 22, (251, 191, 36), 3.5),
            (0.19, 0.74, 18, (52, 211, 153), 4.2),
            (0.81, 0.72, 20, (244, 114, 182), 5.1),
        ]
        for rx, ry, base_r, col, offset in anchors:
            pulse = 0.70 + 0.30 * math.sin(phase + offset)
            drift_y = math.sin(phase + offset * 0.7) * 7 * ss
            cx = rx * sz
            cy = ry * sz + drift_y
            orad = base_r * pulse * ss * 0.52
            irad = orad * 0.32
            alpha = int(195 + 55 * math.sin(phase + offset))
            draw_4point_star(d, cx, cy, orad, irad, (*col, alpha))
            draw_4point_star(
                d, cx, cy, orad * 0.45, irad * 0.45, (255, 255, 255, alpha)
            )

    if anim_name in (
        'celebrate-confetti',
        'celebrate-confetti-dance',
        'celebrate-happy',
    ):
        confetti_specs = [
            (0.15, 0.24, 16, 8, 25, (244, 63, 94), 0.0),
            (0.85, 0.22, 16, 8, -35, (251, 191, 36), 0.8),
            (0.11, 0.44, 15, 7, 50, (56, 189, 248), 1.6),
            (0.88, 0.42, 15, 7, -55, (168, 85, 247), 2.4),
            (0.16, 0.66, 15, 7, -20, (52, 211, 153), 3.2),
            (0.84, 0.64, 16, 8, 40, (251, 146, 60), 4.0),
            (0.24, 0.16, 13, 6, 15, (253, 224, 71), 4.8),
            (0.76, 0.15, 13, 6, -25, (56, 189, 248), 5.5),
        ]
        for rx, ry, cw, ch, base_ang, col, offset in confetti_specs:
            cx = (rx + 0.02 * math.sin(phase + offset)) * sz
            cy = (ry + 0.045 * math.sin(phase + offset)) * sz
            ang = base_ang + math.sin(phase + offset) * 22
            draw_confetti_piece(d, cx, cy, cw * ss, ch * ss, ang, (*col, 230))

        for rx, ry, base_r, col, offset in [
            (0.18, 0.34, 22, (253, 224, 71), 0.4),
            (0.82, 0.32, 24, (251, 191, 36), 2.1),
            (0.17, 0.56, 18, (56, 189, 248), 3.8),
            (0.83, 0.55, 20, (244, 114, 182), 5.0),
        ]:
            pulse = 0.72 + 0.28 * math.sin(phase + offset)
            orad = base_r * pulse * ss * 0.48
            irad = orad * 0.32
            draw_4point_star(d, rx * sz, ry * sz, orad, irad, (*col, 225))
            draw_4point_star(
                d,
                rx * sz,
                ry * sz,
                orad * 0.45,
                irad * 0.45,
                (255, 255, 255, 225),
            )

    return layer.resize((canvas_size, canvas_size), Image.LANCZOS)


def clean_and_upscale_sprite(crop_img, scale):
    """
    1. Isolates the character connected component (removing neighbor-row hair/shoe bleed and background clouds).
    2. Strips low-saturation grey matte halo around the black cartoon outline.
    3. Upscales with smooth vector contour supersampling so outer outlines are smooth curves without pixel jaggies.
    4. Computes stable horizontal head/torso centroid and foot baseline.
    """
    w, h = crop_img.size
    px = crop_img.load()

    bg = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 148:
                bg[y][x] = True

    for _ in range(3):
        newly_bg = []
        for y in range(h):
            for x in range(w):
                if bg[y][x]:
                    continue
                touches_bg = False
                for nx, ny in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                    (x + 1, y + 1),
                ):
                    if not (0 <= nx < w and 0 <= ny < h) or bg[ny][nx]:
                        touches_bg = True
                        break
                if touches_bg:
                    r, g, b, a = px[x, y]
                    max_c, min_c = max(r, g, b), min(r, g, b)
                    sat = max_c - min_c
                    if (sat < 32 and 52 <= max_c <= 185) or a < 175:
                        newly_bg.append((x, y))
        for x, y in newly_bg:
            bg[y][x] = True

    visited = [[False] * w for _ in range(h)]
    components = []
    for y in range(h):
        for x in range(w):
            if not visited[y][x] and not bg[y][x]:
                comp = []
                q = deque([(x, y)])
                visited[y][x] = True
                min_x, max_x, min_y, max_y = x, x, y, y
                while q:
                    cx, cy = q.popleft()
                    comp.append((cx, cy))
                    if cx < min_x:
                        min_x = cx
                    if cx > max_x:
                        max_x = cx
                    if cy < min_y:
                        min_y = cy
                    if cy > max_y:
                        max_y = cy
                    for nx, ny in (
                        (cx - 1, cy),
                        (cx + 1, cy),
                        (cx, cy - 1),
                        (cx, cy + 1),
                        (cx - 1, cy - 1),
                        (cx + 1, cy - 1),
                        (cx - 1, cy + 1),
                        (cx + 1, cy + 1),
                    ):
                        if (
                            0 <= nx < w
                            and 0 <= ny < h
                            and not visited[ny][nx]
                            and not bg[ny][nx]
                        ):
                            visited[ny][nx] = True
                            q.append((nx, ny))
                components.append(
                    {
                        'pixels': comp,
                        'size': len(comp),
                        'bbox': (min_x, min_y, max_x, max_y),
                    }
                )
    if not components:
        return crop_img, w / 2.0, h - 4

    components.sort(key=lambda c: c['size'], reverse=True)

    mask_1x = Image.new('L', (w, h), 0)
    mpx = mask_1x.load()
    for x, y in components[0]['pixels']:
        mpx[x, y] = 255
    for comp in components[1:]:
        bx1, by1, bx2, by2 = comp['bbox']
        if comp['size'] >= 30 and by1 > 2 and by2 < h - 2:
            for x, y in comp['pixels']:
                mpx[x, y] = 255

    # Close any 1px pinholes on held props (right side of character)
    mask_closed = mask_1x.filter(ImageFilter.MaxFilter(3)).filter(
        ImageFilter.MinFilter(3)
    )
    mcpx = mask_closed.load()
    for y in range(h):
        for x in range(int(w * 0.55), w):
            if mcpx[x, y] > 0:
                mpx[x, y] = 255

    # Stable horizontal centroid from dark head/hair/beard pixels
    head_xs = []
    all_ys = []
    for x, y in components[0]['pixels']:
        r, g, b, _ = px[x, y]
        all_ys.append(y)
        if y < h * 0.65 and max(r, g, b) < 55:
            head_xs.append(x)
    if head_xs:
        cx_1x = (min(head_xs) + max(head_xs)) / 2.0
    else:
        cx_1x = (components[0]['bbox'][0] + components[0]['bbox'][2]) / 2.0
    bot_y_1x = max(all_ys) if all_ys else h - 4

    rgb_1x = Image.new('RGB', (w, h), (18, 18, 22))
    rpx = rgb_1x.load()
    for y in range(h):
        for x in range(w):
            if mpx[x, y] > 0:
                r, g, b, _ = px[x, y]
                if (
                    y < h * 0.32
                    and (max(r, g, b) - min(r, g, b) < 35)
                    and max(r, g, b) > 42
                ):
                    r, g, b = 22, 22, 26
                rpx[x, y] = (r, g, b)

    wf, hf = int(round(w * scale)), int(round(h * scale))
    rgb_up = rgb_1x.resize((wf, hf), Image.LANCZOS)
    rgb_up = rgb_up.filter(
        ImageFilter.UnsharpMask(radius=1.05, percent=65, threshold=3)
    )
    rgb_up = ImageEnhance.Color(rgb_up).enhance(1.06)

    mask_up = mask_1x.resize((wf, hf), Image.BICUBIC)
    mask_smooth = mask_up.filter(
        ImageFilter.GaussianBlur(radius=scale * 0.58)
    )

    fill_alpha = mask_smooth.point(
        lambda p: 0
        if p < 125
        else (255 if p > 165 else int((p - 125) * 255 / 40))
    )
    outline_alpha = mask_smooth.point(
        lambda p: 0
        if p < 78
        else (255 if p > 118 else int((p - 78) * 255 / 40))
    )

    outline_layer = Image.new('RGBA', (wf, hf), (18, 18, 24, 255))
    outline_layer.putalpha(outline_alpha)
    fill_layer = Image.merge('RGBA', (*rgb_up.split(), fill_alpha))
    char_up = Image.alpha_composite(outline_layer, fill_layer)
    return char_up, cx_1x * scale, bot_y_1x * scale


anim_sticker_dict = {}

for r_idx, (anim_name, y1_approx, y2_approx) in enumerate(rows_info):
    # Find column cuts using opaque character pixels (alpha > 150) so background noise never skews cuts
    col_opaque = [
        sum(
            1
            for y in range(y1_approx, y2_approx)
            if a_all.getpixel((x, y)) > 150
        )
        for x in range(w_total)
    ]
    cuts = [0]
    for i in range(1, num_cols):
        target_x = int(i * (w_total / float(num_cols)))
        best_x = min(
            range(max(0, target_x - 35), min(w_total, target_x + 35)),
            key=lambda x: (col_opaque[x], abs(x - target_x)),
        )
        cuts.append(best_x)
    cuts.append(w_total)

    sticker_frames = []

    for c_idx in range(num_cols):
        x1, x2 = cuts[c_idx], cuts[c_idx + 1]
        # Per-column exact vertical boundaries so hair/shoes from adjacent rows never bleed in
        if r_idx == 0:
            y_top = 0
        else:
            y_top = min(
                range(
                    max(0, y1_approx - 8), min(h_total, y1_approx + 9)
                ),
                key=lambda y: (
                    sum(
                        1
                        for x in range(x1, x2)
                        if a_all.getpixel((x, y)) > 160
                    ),
                    abs(y - y1_approx),
                ),
            )
        y_bot = min(
            range(max(0, y2_approx - 8), min(h_total, y2_approx + 9)),
            key=lambda y: (
                sum(
                    1
                    for x in range(x1, x2)
                    if a_all.getpixel((x, y)) > 160
                ),
                abs(y - y2_approx),
            ),
        )

        f_crop = sub_all.crop((x1, y_top, x2, y_bot))

        # 1. Atlas frame (240x360, scale 2.25) for Phaser Player.ts
        atlas_char, atlas_cx, atlas_bot_y = clean_and_upscale_sprite(
            f_crop, 2.25
        )
        atlas_canv = Image.new('RGBA', (ATLAS_FW, ATLAS_FH), (0, 0, 0, 0))
        ax = int(round(ATLAS_FW / 2.0 - atlas_cx))
        # Preserve vertical jump arc relative to row bottom while anchoring standing baseline at y=342
        row_bot_offset = max(0, (y_bot - y_top) * 2.25 - atlas_bot_y)
        ay = int(round(342 - atlas_bot_y - row_bot_offset * 0.5))
        atlas_canv.paste(atlas_char, (ax, ay), atlas_char)

        dest_x = c_idx * (ATLAS_FW + ATLAS_SP)
        dest_y = r_idx * (ATLAS_FH + ATLAS_SP)
        atlas.paste(atlas_canv, (dest_x, dest_y))

        # 2. High-res Sticker frame (480x480, scale 3.0) with HD vector sparkles/confetti for UI
        st_scale = 3.0
        st_char, st_cx, st_bot_y = clean_and_upscale_sprite(f_crop, st_scale)
        st_canv = render_hd_particles(anim_name, c_idx, STICKER_SZ)
        sx = int(round(STICKER_SZ / 2.0 - st_cx))
        st_row_bot_offset = max(0, (y_bot - y_top) * st_scale - st_bot_y)
        sy = int(round(418 - st_bot_y - st_row_bot_offset * 0.45))
        st_canv.paste(st_char, (sx, sy), st_char)
        sticker_frames.append(st_canv)

    anim_sticker_dict[anim_name] = sticker_frames

out_atlas = os.path.join(root, 'public/stickers/actions-atlas.webp')
atlas.save(out_atlas, 'WEBP', quality=94, method=6)
print(
    f'Saved actions-atlas.webp: size={atlas.size}, file={os.path.getsize(out_atlas)//1024} KB'
)

# Relaxed, natural frame durations (210ms = ~4.76 fps for celebrations so they don't move frantically)
anim_durations = {
    'flip': 105,
    'victory': 185,
}

for anim_name, frames in anim_sticker_dict.items():
    dur = anim_durations.get(anim_name, 210)
    out_anim = os.path.join(root, f'public/stickers/{anim_name}.webp')
    frames[0].save(
        out_anim,
        format='WEBP',
        save_all=True,
        append_images=frames[1:],
        duration=dur,
        loop=0,
        quality=95,
        method=6,
    )
    print(
        f'Saved {anim_name}.webp ({STICKER_SZ}x{STICKER_SZ}, duration={dur}ms): {os.path.getsize(out_anim)//1024} KB'
    )

print('All actions atlas and high-res animated WebPs generated!')
