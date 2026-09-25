"""Split the jelly logo into its 4 alpha-connected pieces (GR, LS, CR, Y).

Each piece is written on the FULL logo canvas (transparent elsewhere), cut from
the same resized WebP the flat logo uses, so the pieces share its pixel grid
exactly and re-assemble to it. Every non-transparent pixel goes to the nearest
big component. pieces.json holds each piece's box as % of the logo (used for
per-piece transform origins).
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

NAMES = {'gr': (0.009, 0.188), 'ls': (0.529, 0.016), 'cr': (0.186, 0.579), 'y': (0.671, 0.470)}  # bbox origin, fraction of logo

def split(width):
    im = Image.open(f'images/brand/grlscry-logo-{width}.webp').convert('RGBA')
    rgba = np.array(im); W, H = im.size; alpha = rgba[..., 3]
    core, n = ndimage.label(alpha > 128)
    sizes = ndimage.sum(alpha > 128, core, range(1, n + 1))
    big = [i + 1 for i, s in enumerate(sizes) if s > 3000 * (width / 1800) ** 2]
    assert len(big) == 4, f'{width}w: expected 4 pieces, got {len(big)}'
    seed = np.where(np.isin(core, big), core, 0)
    _, (iy, ix) = ndimage.distance_transform_edt(seed == 0, return_indices=True)
    owner = seed[iy, ix]
    objs = ndimage.find_objects(core)
    boxes = {}
    for lbl in big:
        sl = objs[lbl - 1]
        name = min(NAMES, key=lambda k: abs(NAMES[k][0] - sl[1].start / W) + abs(NAMES[k][1] - sl[0].start / H))
        mask = (owner == lbl) & (alpha > 0)
        piece = rgba.copy(); piece[..., 3] = np.where(mask, alpha, 0)
        Image.fromarray(piece).save(f'images/brand/logo-piece-{name}-{width}.webp', quality=90, method=6)
        ys, xs = np.where(mask)
        boxes[name] = {'left': 100 * xs.min() / W, 'top': 100 * ys.min() / H,
                       'right': 100 * (xs.max() + 1) / W, 'bottom': 100 * (ys.max() + 1) / H}
    return boxes

boxes = split(1800); split(900)
out = {k: {'cx': round((b['left'] + b['right']) / 2, 2), 'cy': round((b['top'] + b['bottom']) / 2, 2),
           'bottom': round(b['bottom'], 2)} for k, b in boxes.items()}
json.dump(out, open('images/brand/pieces.json', 'w'), indent=2)
print(json.dumps(out))
