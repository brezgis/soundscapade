#!/usr/bin/env python3
"""Real deep-sea photographs -> translucent sprites, by un-matting them from the water.

  python3 matte.py      art/raw/real-sprites/<name>-src.jpg -> art/below/sprites/<name>.webp

The water behind an ROV photo is smooth, so a wide median of the frame is a good
guess at it. Alpha is how far each pixel stands out from that water; colour is
recovered as if the animal had been laid over the water at that alpha.
Sources (all NOAA Ocean Exploration, via Wikimedia Commons):
  atolla        Atolla wyvillei, Operation Deep Scope 2004, NOAA Ocean Explorer, CC BY-SA 2.0
  beroe         Beroe abyssicola, 2024 Gulf of Alaska seamounts, NOAA Ocean Exploration, public domain
  colobonema    Colobonema sericeum, NOAA Ocean Explorer, CC BY-SA 2.0
  ctenophore    a ctenophore, NOAA Ocean Exploration & Research, CC BY-SA 2.0
  siphonophore  a physonect siphonophore, Puerto Rico 2015, NOAA OER, public domain
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ART = Path(__file__).resolve().parent.parent
SRC = ART / "raw" / "real-sprites"
OUT = ART / "below" / "sprites"
# name: (alpha ramp start, ramp width, rotate degrees so it reads as drifting upward)
SET = {"atolla": (10, 70, 0), "beroe": (14, 70, -35), "colobonema": (12, 55, 0),
       "ctenophore": (10, 50, 0), "siphonophore": (12, 50, 0)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (t0, tw, rot) in SET.items():
        im = Image.open(SRC / f"{name}-src.jpg").convert("RGB")
        small = im.resize((max(8, im.width // 16), max(8, im.height // 16)))
        bg_small = small.filter(ImageFilter.MedianFilter(size=15 if min(small.size) > 30 else 7))
        bg = np.asarray(bg_small.resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(20)), np.float32)
        px = np.asarray(im, np.float32)
        dist = np.abs(px - bg).max(axis=2)
        a = np.clip((dist - t0) / tw, 0, 1)
        # fade to nothing at the frame edges, in case the animal runs out of shot
        h, w = a.shape
        e = max(6, min(h, w) // 25)
        ramp = lambda n: np.minimum(1, np.minimum(np.arange(n), np.arange(n)[::-1]) / e)
        a *= ramp(h)[:, None] * ramp(w)[None, :]
        col = np.clip(bg + (px - bg) / np.maximum(a, 0.05)[..., None], 0, 255)
        rgba = np.dstack([col, a * 255]).astype(np.uint8)
        out = Image.fromarray(rgba, "RGBA")
        if rot:
            out = out.rotate(rot, expand=True, resample=Image.BICUBIC)
        box = out.getchannel("A").filter(ImageFilter.MaxFilter(9)).point(lambda v: 255 if v > 90 else 0).getbbox()
        out = out.crop(box)
        out.thumbnail((640, 640))
        out.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        print(name, out.size)


if __name__ == "__main__":
    main()
