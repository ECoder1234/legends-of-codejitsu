#!/usr/bin/env python3
"""Generate exact-size pixel-art assets listed in requires-image.md."""

from __future__ import annotations

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "generated"
FONT = ImageFont.load_default()
RNG = Random(1337)


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def save(img: Image.Image, rel: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def pixel_canvas(size: tuple[int, int], factor: int, bg=(0, 0, 0, 0)):
    low = (size[0] // factor, size[1] // factor)
    img = Image.new("RGBA", low, bg)
    return img, ImageDraw.Draw(img, "RGBA")


def upscale(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    return img.resize(size, Image.Resampling.NEAREST)


def pix_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fill: tuple[int, int, int, int],
    scale: int = 1,
) -> None:
    x, y = xy
    glyphs = {
        "0": ["111", "101", "101", "101", "111"],
        "1": ["010", "110", "010", "010", "111"],
        "A": ["010", "101", "111", "101", "101"],
        "B": ["110", "101", "110", "101", "110"],
        "C": ["111", "100", "100", "100", "111"],
        "E": ["111", "100", "110", "100", "111"],
        "I": ["111", "010", "010", "010", "111"],
        "K": ["101", "101", "110", "101", "101"],
        "O": ["111", "101", "101", "101", "111"],
        "P": ["110", "101", "110", "100", "100"],
        "R": ["110", "101", "110", "101", "101"],
        "S": ["111", "100", "111", "001", "111"],
        "T": ["111", "010", "010", "010", "010"],
        "X": ["101", "101", "010", "101", "101"],
        "[": ["110", "100", "100", "100", "110"],
        "]": ["011", "001", "001", "001", "011"],
        " ": ["0", "0", "0", "0", "0"],
    }
    cx = x
    for char in text.upper():
        glyph = glyphs.get(char, glyphs[" "])
        for row, line in enumerate(glyph):
            for col, bit in enumerate(line):
                if bit == "1":
                    draw.rectangle(
                        [
                            cx + col * scale,
                            y + row * scale,
                            cx + (col + 1) * scale - 1,
                            y + (row + 1) * scale - 1,
                        ],
                        fill=fill,
                    )
        cx += (len(glyph[0]) + 1) * scale


def draw_elder(draw: ImageDraw.ImageDraw, x: int, y: int, s: int, icon: bool = False) -> None:
    dark = rgba("#0b0918")
    robe = rgba("#5a4232")
    mint = rgba("#90d2b7")
    skin = rgba("#cdbdcb")
    shadow = rgba("#070511", 160)

    draw.ellipse([x - 34 * s, y + 58 * s, x + 38 * s, y + 78 * s], fill=shadow)
    draw.polygon(
        [
            (x - 26 * s, y + 18 * s),
            (x + 24 * s, y + 16 * s),
            (x + 34 * s, y + 80 * s),
            (x + 12 * s, y + 98 * s),
            (x - 32 * s, y + 88 * s),
        ],
        fill=robe,
    )
    draw.polygon(
        [(x - 16 * s, y + 28 * s), (x + 8 * s, y + 30 * s), (x - 6 * s, y + 86 * s)],
        fill=dark,
    )
    for kx, ky in [(-22, 40), (20, 38), (-15, 62), (16, 68), (0, 48)]:
        draw.rectangle([x + kx * s, y + ky * s, x + (kx + 8) * s, y + (ky + 6) * s], fill=dark)
        draw.rectangle([x + (kx + 1) * s, y + (ky + 1) * s, x + (kx + 7) * s, y + (ky + 2) * s], fill=mint)

    draw.rectangle([x - 17 * s, y - 5 * s, x + 18 * s, y + 27 * s], fill=skin)
    draw.rectangle([x - 21 * s, y + 2 * s, x - 15 * s, y + 20 * s], fill=skin)
    draw.rectangle([x + 16 * s, y + 2 * s, x + 22 * s, y + 20 * s], fill=skin)
    draw.rectangle([x - 22 * s, y - 12 * s, x + 20 * s, y + 1 * s], fill=dark)
    draw.rectangle([x - 12 * s, y + 9 * s, x - 6 * s, y + 13 * s], fill=mint)
    draw.rectangle([x + 7 * s, y + 9 * s, x + 13 * s, y + 13 * s], fill=mint)
    draw.rectangle([x - 2 * s, y + 16 * s, x + 4 * s, y + 20 * s], fill=rgba("#5a4232"))
    beard_points = [
        (x - 15 * s, y + 23 * s),
        (x + 16 * s, y + 23 * s),
        (x + 10 * s, y + 48 * s),
        (x + 1 * s, y + 60 * s),
        (x - 10 * s, y + 48 * s),
    ]
    draw.polygon(beard_points, fill=rgba("#d8e2d7", 225))
    draw.line([x - 2 * s, y + 25 * s, x - 6 * s, y + 54 * s], fill=rgba("#90d2b7", 180), width=max(1, s))
    if not icon:
        draw.line([x + 31 * s, y + 38 * s, x + 44 * s, y + 106 * s], fill=rgba("#90d2b7"), width=2 * s)


def keybind_elder_portrait() -> Image.Image:
    img, draw = pixel_canvas((256, 320), 2)
    draw_elder(draw, 64, 42, 1)
    draw.rectangle([18, 130, 102, 151], fill=rgba("#0b0918", 120))
    draw.line([20, 139, 100, 139], fill=rgba("#90d2b7", 160), width=1)
    return upscale(img, (256, 320))


def keybind_elder_icon() -> Image.Image:
    img, draw = pixel_canvas((192, 192), 2)
    draw_elder(draw, 48, 32, 1, icon=True)
    draw.ellipse([10, 10, 86, 86], outline=rgba("#90d2b7", 220), width=2)
    return upscale(img, (192, 192))


def sentinel_frame(state: int) -> Image.Image:
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    red = rgba("#d64f45")
    dark = rgba("#3a1f44")
    ember = rgba("#f0c36b")
    if state == 2:
        d.ellipse([22, 70, 78, 84], fill=(0, 0, 0, 90))
        d.rectangle([22, 58, 68, 70], fill=dark)
        d.rectangle([28, 46, 56, 60], fill=red)
        d.rectangle([60, 50, 74, 58], fill=red)
        d.line([18, 54, 78, 76], fill=ember, width=3)
        d.rectangle([37, 36, 55, 48], fill=dark)
        return img

    ox = -4 if state == 1 else 0
    d.ellipse([24 + ox, 72, 72 + ox, 86], fill=(0, 0, 0, 90))
    d.rectangle([36 + ox, 22, 58 + ox, 42], fill=dark)
    d.rectangle([31 + ox, 38, 64 + ox, 68], fill=red)
    d.rectangle([37 + ox, 42, 58 + ox, 66], fill=dark)
    d.rectangle([24 + ox, 42, 35 + ox, 62], fill=red)
    d.rectangle([61 + ox, 42, 72 + ox, 62], fill=red)
    d.rectangle([34 + ox, 67, 45 + ox, 82], fill=dark)
    d.rectangle([51 + ox, 67, 62 + ox, 82], fill=dark)
    d.rectangle([41 + ox, 29, 47 + ox, 34], fill=ember)
    d.rectangle([51 + ox, 29, 57 + ox, 34], fill=ember)
    if state == 1:
        d.line([68, 41, 92, 25], fill=ember, width=4)
        d.rectangle([73, 20, 92, 28], fill=red)
    else:
        d.line([70, 40, 80, 76], fill=ember, width=3)
    return img


def sage_rescue_minions() -> Image.Image:
    sheet = Image.new("RGBA", (288, 96), (0, 0, 0, 0))
    for i in range(3):
        sheet.alpha_composite(sentinel_frame(i), (i * 96, 0))
    return sheet


def keiko_radio_overlay() -> Image.Image:
    img = Image.new("RGBA", (320, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    gold = rgba("#f0c36b")
    dark = rgba("#0b0918")
    d.rectangle([8, 8, 312, 88], fill=(11, 9, 24, 96), outline=gold, width=4)
    d.rectangle([22, 22, 298, 74], fill=(11, 9, 24, 62), outline=rgba("#5a4232", 210), width=2)
    for y in range(24, 74, 5):
        d.line([24, y, 296, y], fill=(240, 195, 107, 42), width=1)
    for _ in range(80):
        x = RNG.randrange(26, 294)
        y = RNG.randrange(24, 72)
        d.point((x, y), fill=(255, 255, 255, RNG.randrange(45, 150)))
    for x in range(36, 120, 10):
        h = RNG.randrange(8, 34)
        d.rectangle([x, 70 - h, x + 4, 70], fill=rgba("#90d2b7", 170))
    d.text((178, 42), "KEIKO RADIO", fill=rgba("#f0c36b", 215), font=FONT)
    d.rectangle([0, 0, 319, 95], outline=dark, width=2)
    return img


def null_warden_extended() -> Image.Image:
    img, d = pixel_canvas((256, 384), 2)
    dark = rgba("#0b0918")
    purple = rgba("#b85dff")
    red = rgba("#d64f45")
    steel = rgba("#3a1f44")
    d.ellipse([32, 168, 96, 184], fill=(0, 0, 0, 130))
    d.polygon([(58, 26), (75, 26), (94, 64), (101, 148), (70, 176), (35, 150), (41, 62)], fill=dark)
    d.polygon([(42, 60), (90, 60), (82, 102), (50, 102)], fill=steel)
    d.rectangle([50, 18, 82, 48], fill=dark)
    d.rectangle([45, 28, 88, 38], fill=steel)
    d.rectangle([55, 32, 62, 37], fill=purple)
    d.rectangle([72, 32, 79, 37], fill=red)
    d.polygon([(36, 65), (16, 105), (28, 122), (49, 80)], fill=dark)
    d.polygon([(94, 64), (116, 101), (104, 122), (82, 78)], fill=dark)
    d.rectangle([52, 103, 63, 170], fill=steel)
    d.rectangle([73, 103, 84, 170], fill=steel)
    for x1, y1, x2, y2, color in [
        (52, 62, 76, 62, purple),
        (48, 78, 88, 86, red),
        (41, 112, 91, 118, purple),
        (56, 142, 78, 153, purple),
    ]:
        d.line([x1, y1, x2, y2], fill=color, width=2)
    d.line([22, 90, 110, 156], fill=rgba("#b85dff", 160), width=1)
    return upscale(img, (256, 384))


def null_gate_foreground_pillars() -> Image.Image:
    img = Image.new("RGBA", (1280, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    dark = rgba("#05030b", 238)
    rim = rgba("#b85dff", 130)
    for side in [0, 1]:
        base_x = 0 if side == 0 else 1280
        sign = 1 if side == 0 else -1
        for i, w in enumerate([120, 82, 58]):
            x0 = base_x + sign * (i * 90)
            if side == 0:
                box = [x0, 18 + i * 18, x0 + w, 320]
                rim_x = x0 + w
            else:
                box = [x0 - w, 18 + i * 18, x0, 320]
                rim_x = x0 - w
            d.rectangle(box, fill=dark)
            d.line([rim_x, box[1], rim_x, 318], fill=rim, width=4)
            d.rectangle([box[0], box[1], box[2], box[1] + 22], fill=rgba("#0b0918", 245))
    d.polygon([(0, 272), (1280, 292), (1280, 320), (0, 320)], fill=rgba("#05030b", 230))
    d.line([0, 274, 1280, 294], fill=rgba("#b85dff", 90), width=3)
    return img


def dawn_gradient(width: int, height: int, top: str, mid: str, bottom: str) -> Image.Image:
    img = Image.new("RGBA", (width, height), rgba(bottom))
    d = ImageDraw.Draw(img, "RGBA")
    topc, midc, botc = rgba(top), rgba(mid), rgba(bottom)
    for y in range(height):
        if y < height // 2:
            t = y / (height // 2)
            c = tuple(int(topc[i] * (1 - t) + midc[i] * t) for i in range(4))
        else:
            t = (y - height // 2) / (height // 2)
            c = tuple(int(midc[i] * (1 - t) + botc[i] * t) for i in range(4))
        d.line([0, y, width, y], fill=c)
    return img


def compass_rose(d: ImageDraw.ImageDraw, x: int, y: int, r: int, color) -> None:
    d.ellipse([x - r, y - r, x + r, y + r], outline=color, width=1)
    for dx, dy in [(0, -r), (r, 0), (0, r), (-r, 0)]:
        d.line([x, y, x + dx, y + dy], fill=color, width=1)
    d.polygon([(x, y - r - 5), (x - 4, y - 4), (x + 4, y - 4)], fill=color)


def arc_fractured_hub() -> Image.Image:
    low = dawn_gradient(320, 180, "#4fc3f7", "#273f58", "#0a1424")
    d = ImageDraw.Draw(low, "RGBA")
    d.polygon([(0, 78), (58, 48), (112, 84), (176, 44), (248, 82), (320, 52), (320, 132), (0, 132)], fill=rgba("#102238"))
    d.polygon([(0, 108), (320, 98), (320, 180), (0, 180)], fill=rgba("#18243a"))
    d.polygon([(0, 124), (320, 112), (320, 180), (0, 180)], fill=rgba("#0a1424"))
    for sx in [95, 165, 235]:
        compass_rose(d, sx, 91, 14, rgba("#4fc3f7", 120))
        d.rectangle([sx - 10, 74, sx + 10, 112], fill=rgba("#5a4232"))
        d.polygon([(sx - 16, 75), (sx, 58), (sx + 16, 75)], fill=rgba("#24364d"))
        d.rectangle([sx - 5, 82, sx + 5, 96], fill=rgba("#0a1424"))
        d.line([sx - 13, 76, sx + 12, 76], fill=rgba("#4fc3f7", 130), width=1)
    for _ in range(34):
        x = RNG.randrange(0, 320)
        y = RNG.randrange(108, 172)
        d.line([x, y, x + RNG.randrange(8, 22), y - RNG.randrange(1, 4)], fill=rgba("#4fc3f7", RNG.randrange(24, 70)))
    out = upscale(low, (1280, 720)).convert("RGBA")
    out.putalpha(255)
    return out


def arc_fractured_trial() -> Image.Image:
    low = dawn_gradient(320, 180, "#f0c36b", "#42516c", "#0a1424")
    d = ImageDraw.Draw(low, "RGBA")
    d.polygon([(0, 74), (55, 50), (110, 80), (176, 42), (248, 82), (320, 56), (320, 118), (0, 118)], fill=rgba("#293751", 220))
    d.polygon([(120, 180), (154, 96), (166, 96), (204, 180)], fill=rgba("#5a4232", 230))
    d.polygon([(0, 128), (134, 104), (188, 104), (320, 128), (320, 180), (0, 180)], fill=rgba("#0a1424"))
    for x in [42, 262, 86, 235]:
        base = RNG.randrange(116, 148)
        d.rectangle([x, base - 26, x + 4, base + 8], fill=rgba("#11101a"))
        d.line([x + 2, base - 18, x - 12, base - 30], fill=rgba("#11101a"), width=2)
        d.line([x + 2, base - 14, x + 15, base - 25], fill=rgba("#11101a"), width=2)
    for y in range(96, 180, 9):
        d.line([150 - (y - 96), y, 170 + (y - 96), y], fill=rgba("#f0c36b", 36), width=1)
    out = upscale(low, (1280, 720)).convert("RGBA")
    out.putalpha(255)
    return out


def oni_frame(frame: int) -> Image.Image:
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    cyan = rgba("#4fc3f7")
    violet = rgba("#8f7dff")
    dark = rgba("#0b0918")
    cloud = rgba("#dff6ff", 120)
    dx = [0, -7, 5, 0, 0, 0][frame]
    crouch = 12 if frame == 5 else 0
    for cx, cy in [(50, 166), (67, 184), (196, 164), (180, 190)]:
        d.ellipse([cx - 20, cy - 10, cx + 25, cy + 10], fill=cloud)
    d.ellipse([74 + dx, 198, 182 + dx, 224], fill=(0, 0, 0, 95))
    d.rectangle([100 + dx, 64 + crouch, 156 + dx, 130 + crouch], fill=dark)
    d.polygon([(84 + dx, 92 + crouch), (54 + dx, 146), (78 + dx, 154), (108 + dx, 108 + crouch)], fill=violet)
    d.polygon([(170 + dx, 94 + crouch), (202 + dx, 146), (178 + dx, 154), (148 + dx, 108 + crouch)], fill=violet)
    d.rectangle([96 + dx, 36 + crouch, 160 + dx, 76 + crouch], fill=cyan)
    d.rectangle([108 + dx, 50 + crouch, 120 + dx, 58 + crouch], fill=dark)
    d.rectangle([138 + dx, 50 + crouch, 150 + dx, 58 + crouch], fill=dark)
    d.polygon([(96 + dx, 34 + crouch), (78 + dx, 18 + crouch), (102 + dx, 44 + crouch)], fill=violet)
    d.polygon([(160 + dx, 34 + crouch), (180 + dx, 18 + crouch), (154 + dx, 44 + crouch)], fill=violet)
    d.rectangle([106 + dx, 130, 122 + dx, 202], fill=dark)
    d.rectangle([138 + dx, 130, 154 + dx, 202], fill=dark)
    if frame == 2:
        d.line([176 + dx, 120, 234, 90], fill=cyan, width=8)
    if frame == 3:
        d.ellipse([188, 84, 238, 134], outline=cyan, width=6)
        d.ellipse([198, 94, 228, 124], fill=rgba("#8f7dff", 120))
    if frame == 4:
        d.rectangle([92 + dx, 36, 164 + dx, 140], outline=rgba("#f0c36b", 190), width=4)
    if frame == 5:
        d.line([82, 64, 180, 194], fill=rgba("#8f7dff", 130), width=5)
    return img


def arc_sky_null_oni() -> Image.Image:
    sheet = Image.new("RGBA", (1536, 256), (0, 0, 0, 0))
    for i in range(6):
        sheet.alpha_composite(oni_frame(i), (i * 256, 0))
    return sheet


def arc_silent_codex_hub() -> Image.Image:
    low = Image.new("RGBA", (320, 180), rgba("#0c0b18"))
    d = ImageDraw.Draw(low, "RGBA")
    for y in range(180):
        alpha = int(190 * (1 - abs(y - 92) / 130))
        d.line([0, y, 320, y], fill=rgba("#b85dff", max(0, min(alpha, 120))))
    d.rectangle([0, 122, 320, 180], fill=rgba("#09070d"))
    for x in range(0, 320, 26):
        d.rectangle([x, 24, x + 14, 116], fill=rgba("#141020"))
        d.line([x + 15, 25, x + 15, 115], fill=rgba("#5a4232", 100))
    for sx in [96, 165, 235]:
        d.polygon([(sx - 18, 126), (sx + 18, 126), (sx + 28, 160), (sx - 28, 160)], fill=rgba("#5a4232"))
        d.rectangle([sx - 14, 110, sx + 14, 126], fill=rgba("#0c0b18"))
        d.rectangle([sx - 10, 102, sx + 10, 113], fill=rgba("#20152c"))
        d.line([sx - 8, 106, sx + 8, 106], fill=rgba("#b85dff", 230), width=1)
        d.ellipse([sx - 26, 90, sx + 26, 140], outline=rgba("#b85dff", 70), width=1)
    d.polygon([(0, 140), (320, 126), (320, 180), (0, 180)], fill=rgba("#0c0b18", 230))
    out = upscale(low, (1280, 720)).convert("RGBA")
    out.putalpha(255)
    return out


def mirror_frame(frame: int) -> Image.Image:
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    gold = rgba("#f0c36b", 185)
    cream = rgba("#cdbdcb", 135)
    dx = [0, 4, -3, 0][frame]
    if frame == 3:
        for x, y in [(28, 40), (48, 32), (60, 54), (38, 66)]:
            d.polygon([(x, y), (x + 12, y + 5), (x + 4, y + 18)], fill=gold)
        return img
    d.ellipse([28 + dx, 74, 68 + dx, 84], fill=(0, 0, 0, 65))
    d.rectangle([39 + dx, 24, 57 + dx, 44], fill=cream)
    d.rectangle([34 + dx, 42, 62 + dx, 68], fill=gold)
    d.rectangle([26 + dx, 48, 37 + dx, 60], fill=gold)
    d.rectangle([59 + dx, 48, 70 + dx, 60], fill=gold)
    d.line([70 + dx, 40, 84 + dx, 20], fill=cream, width=3)
    if frame == 1:
        d.rectangle([22, 20, 74, 72], outline=rgba("#cdbdcb", 130), width=2)
    if frame == 2:
        d.line([64, 47, 91, 47], fill=gold, width=5)
    return img


def checksum_frame(frame: int) -> Image.Image:
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    purple = rgba("#ce93d8", 200)
    dark = rgba("#3a1f44", 220)
    dx = [0, 2, -2, 0][frame]
    if frame == 3:
        for r in [10, 18, 26]:
            d.ellipse([48 - r, 52 - r, 48 + r, 52 + r], outline=purple, width=2)
        return img
    pix_text(d, (43, 10), "1" if frame % 2 else "0", purple, scale=3)
    d.ellipse([28 + dx, 28, 68 + dx, 70], fill=purple)
    d.rectangle([34 + dx, 52, 62 + dx, 78], fill=purple)
    d.rectangle([38 + dx, 42, 44 + dx, 48], fill=dark)
    d.rectangle([54 + dx, 42, 60 + dx, 48], fill=dark)
    if frame == 1:
        d.ellipse([20, 70, 78, 86], fill=rgba("#ce93d8", 65))
    if frame == 2:
        d.line([64, 52, 88, 40], fill=purple, width=4)
    return img


def codex_warden_frame(frame: int) -> Image.Image:
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    purple = rgba("#b85dff")
    brown = rgba("#5a4232")
    dark = rgba("#0c0b18")
    dx = [0, 0, -5, 5, 0, 0][frame]
    hdrop = 24 if frame == 5 else 0
    d.ellipse([60 + dx, 208, 196 + dx, 234], fill=(0, 0, 0, 110))
    d.polygon([(92 + dx, 44 + hdrop), (166 + dx, 44 + hdrop), (198 + dx, 204), (58 + dx, 204)], fill=dark)
    d.rectangle([102 + dx, 34 + hdrop, 154 + dx, 82 + hdrop], fill=dark)
    d.rectangle([114 + dx, 56 + hdrop, 124 + dx, 64 + hdrop], fill=purple)
    d.rectangle([138 + dx, 56 + hdrop, 148 + dx, 64 + hdrop], fill=purple)
    for bx, by in [(70, 104), (156, 104), (90, 142), (144, 150), (110, 180)]:
        d.rectangle([bx + dx, by, bx + dx + 28, by + 18], fill=brown)
        d.line([bx + dx + 4, by + 7, bx + dx + 24, by + 7], fill=purple, width=2)
    for y in [92, 124, 160]:
        d.line([52 + dx, y, 205 + dx, y + 20], fill=rgba("#cdbdcb", 130), width=3)
    if frame == 1:
        d.rectangle([42, 122, 74, 210], fill=brown)
    if frame == 2:
        d.line([168, 118, 236, 102], fill=purple, width=8)
    if frame == 4:
        d.rectangle([78, 48, 180, 202], outline=rgba("#f0c36b", 180), width=5)
    if frame == 5:
        d.line([70, 70, 188, 214], fill=rgba("#b85dff", 120), width=5)
    return img


def spritesheet(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * w, 0))
    return sheet


def arc_waypoint_glow() -> Image.Image:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    center = (64, 64)
    for r in range(62, 3, -2):
        t = r / 62
        c = (
            int(79 * (1 - t) + 184 * t),
            int(195 * (1 - t) + 93 * t),
            int(247 * (1 - t) + 255 * t),
            int(22 + (1 - t) * 180),
        )
        d.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=c)
    d.ellipse([20, 20, 108, 108], outline=rgba("#f6ead3", 120), width=2)
    for a in range(0, 360, 45):
        if a % 90 == 0:
            x2 = 64 + (42 if a == 0 else -42 if a == 180 else 0)
            y2 = 64 + (42 if a == 90 else -42 if a == 270 else 0)
            d.line([64, 64, x2, y2], fill=rgba("#0b0918", 130), width=2)
    pix_text(d, (54, 58), "10", rgba("#0b0918", 160), scale=2)
    return img


def arc_reward_banner() -> Image.Image:
    img = Image.new("RGBA", (480, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    gold = rgba("#f0c36b")
    dark = rgba("#0b0918", 230)
    d.polygon([(16, 16), (464, 16), (448, 48), (464, 80), (16, 80), (32, 48)], fill=gold)
    d.rectangle([42, 24, 438, 72], fill=dark)
    d.rectangle([48, 30, 432, 66], outline=gold, width=2)
    for x in range(54, 426, 24):
        d.arc([x, 38, x + 32, 70], 180, 360, fill=rgba("#f0c36b", 90), width=2)
    d.text((190, 41), "TRIAL CLEARED", fill=rgba("#f0c36b", 230), font=FONT)
    return img


def exit_beacon_banner() -> Image.Image:
    img = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    gold = rgba("#f0c36b")
    brown = rgba("#5a4232")
    dark = rgba("#0b0918")
    d.polygon([(14, 20), (218, 20), (242, 48), (218, 76), (14, 76), (30, 48)], fill=gold)
    d.rectangle([32, 30, 205, 66], fill=rgba("#5a4232", 215))
    d.polygon([(166, 36), (202, 48), (166, 60), (174, 51), (98, 51), (98, 45), (174, 45)], fill=dark)
    d.rectangle([38, 36, 76, 60], outline=dark, width=3)
    return img


def keiko_mentor_overlay() -> Image.Image:
    img, d = pixel_canvas((256, 320), 2)
    gold = rgba("#f0c36b")
    dark = rgba("#0b0918")
    mint = rgba("#90d2b7")
    skin = rgba("#f6ead3")
    d.ellipse([30, 150, 102, 164], fill=(0, 0, 0, 110))

    # Hair silhouette and face, pushed large so it reads in the helper modal.
    d.polygon([(42, 22), (70, 10), (96, 28), (91, 74), (75, 92), (50, 80)], fill=dark)
    d.rectangle([54, 27, 81, 55], fill=skin)
    d.rectangle([48, 28, 58, 68], fill=dark)
    d.rectangle([78, 28, 92, 82], fill=dark)
    d.rectangle([56, 38, 62, 43], fill=dark)
    d.rectangle([73, 38, 79, 43], fill=dark)
    d.line([61, 50, 76, 50], fill=rgba("#d64f45"), width=1)

    # Light armor with gold trim, angled into a 3/4 mentor stance.
    d.polygon([(43, 61), (86, 58), (101, 118), (68, 136), (36, 118)], fill=mint)
    d.polygon([(55, 64), (82, 64), (89, 114), (67, 125), (49, 112)], fill=dark)
    d.line([45, 62, 88, 61], fill=gold, width=2)
    d.line([48, 78, 94, 100], fill=gold, width=2)
    d.line([42, 112, 98, 112], fill=gold, width=2)

    # Arms and blade/cane silhouette.
    d.polygon([(35, 68), (47, 75), (40, 125), (28, 120)], fill=gold)
    d.polygon([(92, 66), (106, 72), (111, 118), (99, 123)], fill=gold)
    d.line([105, 54, 124, 22], fill=gold, width=2)
    d.line([107, 54, 126, 22], fill=dark, width=1)

    d.rectangle([53, 126, 64, 158], fill=dark)
    d.rectangle([75, 124, 87, 158], fill=dark)
    d.rectangle([48, 154, 66, 160], fill=gold)
    d.rectangle([73, 154, 91, 160], fill=gold)
    return upscale(img, (256, 320))


def helper_dismiss_arrow() -> Image.Image:
    img = Image.new("RGBA", (64, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([0, 0, 63, 23], radius=4, fill=rgba("#0b0918", 240), outline=rgba("#cdbdcb", 230), width=2)
    d.text((11, 7), "[SPACE]", fill=rgba("#f6ead3"), font=FONT)
    return img


def main() -> None:
    save(keybind_elder_portrait(), "chapter1/keybind-elder-portrait.png")
    save(keybind_elder_icon(), "chapter1/keybind-elder-icon.png")
    save(sage_rescue_minions(), "chapter1/sage-rescue-minions.png")
    save(keiko_radio_overlay(), "ui/keiko-radio-overlay.png")
    save(null_warden_extended(), "chapter1/null-warden-extended.png")
    save(null_gate_foreground_pillars(), "chapter1/null-gate-foreground-pillars.png")
    save(arc_fractured_hub(), "chapter3/arcs/arc-fractured-hub.png")
    save(arc_fractured_trial(), "chapter3/arcs/arc-fractured-trial.png")
    save(arc_sky_null_oni(), "chapter3/arcs/arc-sky-null-oni.png")
    save(arc_silent_codex_hub(), "chapter3/arcs/arc-silent-codex-hub.png")
    save(spritesheet([mirror_frame(i) for i in range(4)]), "chapter3/arcs/arc-mirror-shade.png")
    save(spritesheet([checksum_frame(i) for i in range(4)]), "chapter3/arcs/arc-checksum-shade.png")
    save(spritesheet([codex_warden_frame(i) for i in range(6)]), "chapter3/arcs/arc-codex-warden.png")
    save(arc_waypoint_glow(), "chapter3/arcs/arc-waypoint-glow.png")
    save(arc_reward_banner(), "chapter3/arcs/arc-reward-banner.png")
    save(exit_beacon_banner(), "ui/exit-beacon-banner.png")
    save(keiko_mentor_overlay(), "ui/keiko-mentor-overlay.png")
    save(helper_dismiss_arrow(), "ui/helper-dismiss-arrow.png")


if __name__ == "__main__":
    main()
