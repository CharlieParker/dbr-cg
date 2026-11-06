"""Cut the mascot poses out of the character sheet as transparent PNGs.

Usage: python3 tools/cut_sprites.py path/to/sheet.jpg assets
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

SCALE = 2          # upscale first so the cut-out edge stays smooth
WHITE = 236        # anything brighter on every channel counts as background
# (left, top, right, bottom) on the 1600x893 sheet
HEAD_TOP, HEAD_BOTTOM = 62, 184
CROPS = {
    "face-neutral": (180, HEAD_TOP, 318, HEAD_BOTTOM),
    "face-shocked": (320, HEAD_TOP, 458, HEAD_BOTTOM),
    "face-greedy": (460, HEAD_TOP, 598, HEAD_BOTTOM),
    "face-triumph": (598, HEAD_TOP, 736, HEAD_BOTTOM),
    "face-nervous": (738, HEAD_TOP, 878, HEAD_BOTTOM),
    "face-angry": (878, HEAD_TOP, 1016, HEAD_BOTTOM),
    "face-suspicious": (1018, HEAD_TOP, 1156, HEAD_BOTTOM),
    "face-sad": (1156, HEAD_TOP, 1296, HEAD_BOTTOM),
    "face-laughing": (1298, HEAD_TOP, 1438, HEAD_BOTTOM),
    "face-calm": (1438, HEAD_TOP, 1578, HEAD_BOTTOM),
    "bull-front": (258, 252, 486, 558),
    "bull-side": (484, 252, 692, 558),
    "bull-hero": (692, 248, 948, 562),
    "bull-cheer": (240, 630, 416, 852),
    "bull-run": (612, 630, 816, 852),
    "bull-read": (814, 630, 998, 852),
    "bull-cash": (1004, 630, 1186, 852),
    "bull-shrug": (1172, 630, 1350, 852),
}
# A hole is a white area enclosed by the outline, such as the gap inside a bent
# arm. Holes this big in the lower part of a sprite are background; the eyes
# sit near the top of the sprite and are always kept.
HOLE_MIN_PX = 60 * SCALE * SCALE
EYE_ZONE = 0.42    # fraction of the sprite height that may contain eyes


def cut(sheet, box, keep_holes, eye_zone=EYE_ZONE):
    crop = sheet.crop(box)
    crop = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
    rgb = np.asarray(crop.convert("RGB"))
    white = (rgb > WHITE).all(axis=2)
    labels, _ = ndi.label(white)
    edge = set(np.unique(np.concatenate(
        [labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    background = np.isin(labels, list(edge))
    if not keep_holes:
        for i, slc in enumerate(ndi.find_objects(labels), start=1):
            if i in edge:
                continue
            area = (labels[slc] == i).sum()
            top = slc[0].start / rgb.shape[0]
            if area >= HOLE_MIN_PX and top > eye_zone:
                background |= labels == i
    # Keep only the largest connected shape to drop stray bits of neighbours.
    solid, count = ndi.label(~background)
    if count > 1:
        sizes = ndi.sum(~background, solid, range(1, count + 1))
        background = solid != (1 + int(np.argmax(sizes)))
    alpha = Image.fromarray(((~background) * 255).astype("uint8"))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = crop.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def main(src, dest):
    sheet = Image.open(src).convert("RGB")
    for name, box in CROPS.items():
        # The cheering pose has closed eyes, so every hole in it is background.
        zone = 0 if name == "bull-cheer" else EYE_ZONE
        sprite = cut(sheet, box, name.startswith("face-"), zone)
        sprite.save(f"{dest}/{name}.png", optimize=True)
        print(name, sprite.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
