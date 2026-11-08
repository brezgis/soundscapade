#!/usr/bin/env python3
"""raw/<channel>/chain/<name>.png -> art/<channel>/<name>-pano.webp, and a strip preview.

Reports how far each panel's seeded edge drifted from its neighbour's (mean
abs difference, 0-255): near 0 means the cross-fade in the player is invisible.
Where it drifted, the neighbour's pixels are pasted back with a soft feather.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

sys.path.insert(0, str(Path(__file__).parent))
from chains import CHAINS, SEED, SIZE  # noqa: E402

ART = Path(__file__).resolve().parent.parent
RAW = ART / "raw"


def feather_paste(dst, src_strip, at_left):
    """Paste the neighbour's strip over dst's seeded edge, fading out over its inner third."""
    w, h = src_strip.size
    mask = Image.new("L", (w, h), 255)
    f = w // 3
    for x in range(f):
        v = round(255 * (1 - (x + 0.5) / f))
        col = (w - f + x) if at_left else (f - 1 - x)
        mask.paste(v, (col, 0, col + 1, h))
    dst.paste(src_strip, (0, 0) if at_left else (dst.width - w, 0), mask)


def main(channels):
    for ch in channels:
        c = CHAINS[ch]
        names = [p[0] for p in c["panels"]]
        ims = {}
        for n in names:
            p = RAW / ch / "chain" / f"{n}.png"
            if not p.exists():
                print(f"missing {ch}/{n}"); return
            ims[n] = Image.open(p).convert("RGB").resize(SIZE, Image.LANCZOS)
        w, h = SIZE
        k = round(w * SEED)
        lead_left = c["side"] == "left"
        for i, n in enumerate(names):
            prev = ims[names[i - 1]]
            if i == 0:
                continue
            # this panel's leading strip should equal the previous panel's trailing strip
            mine = ims[n].crop((0, 0, k, h)) if lead_left else ims[n].crop((w - k, 0, w, h))
            theirs = prev.crop((w - k, 0, w, h)) if lead_left else prev.crop((0, 0, k, h))
            d = sum(ImageStat.Stat(ImageChops.difference(mine, theirs)).mean) / 3
            print(f"{ch}/{n}: seam drift {d:.1f}")
            if d > 0.5:
                feather_paste(ims[n], theirs, lead_left)
        # the loop: panel 0's leading strip against the last panel's trailing strip
        last, first = ims[names[-1]], ims[names[0]]
        a = first.crop((0, 0, k, h)) if lead_left else first.crop((w - k, 0, w, h))
        b = last.crop((w - k, 0, w, h)) if lead_left else last.crop((0, 0, k, h))
        d = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
        print(f"{ch}: loop drift {d:.1f}")
        if d > 0.5:
            feather_paste(last, a, not lead_left)
        for n in names:
            ims[n].save(ART / ch / f"{n}-pano.webp", "WEBP", quality=86, method=6)
        # the whole strip, in world order, for eyeballing
        order = names if lead_left else names[::-1]
        step = w - k
        strip = Image.new("RGB", (step * len(order) + k, h))
        for j, n in enumerate(order):
            strip.paste(ims[n], (j * step, 0))
        strip.thumbnail((6000, 400))
        strip.save(RAW / f"{ch}-strip.jpg", quality=85)
        print(f"{ch}: {len(names)} panels")


if __name__ == "__main__":
    main(sys.argv[1:] or list(CHAINS))
