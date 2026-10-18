#!/usr/bin/env python3
"""raw/<channel>/<name>-back.png|-front.png  ->  art/<channel>/<name>-back.webp|-front.webp

Backgrounds become plain WebP; foregrounds keep their alpha. Also writes
contact sheets (art/raw/<channel>-sheet.jpg) to eyeball a whole channel.
"""
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from manifest import CHANNELS  # noqa: E402

ART = Path(__file__).resolve().parent.parent
RAW = ART / "raw"


def main(channels):
    for ch in channels:
        out = ART / ch
        out.mkdir(exist_ok=True)
        tiles = []
        for name, _ in CHANNELS[ch]["panels"]:
            back, front = RAW / ch / f"{name}-back.png", RAW / ch / f"{name}-front.png"
            if back.exists():
                im = Image.open(back).convert("RGB")
                im.save(out / f"{name}-back.webp", "WEBP", quality=85, method=6)
                if front.exists():
                    fr = Image.open(front).convert("RGBA")
                    fr.save(out / f"{name}-front.webp", "WEBP", quality=88, method=6)
                    comp = im.convert("RGBA")
                    comp.alpha_composite(fr.resize(im.size))
                    tiles.append(comp.convert("RGB"))
                else:
                    tiles.append(im)
            else:
                print(f"missing {ch}/{name}-back")
        if tiles:
            tw, th = (480, 320) if CHANNELS[ch]["orient"] == "h" else (240, 360)
            cols = 4
            sheet = Image.new("RGB", (cols * tw, -(-len(tiles) // cols) * th), "#111")
            for i, t in enumerate(tiles):
                t = t.copy(); t.thumbnail((tw, th))
                sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
            sheet.save(RAW / f"{ch}-sheet.jpg", quality=85)
            print(f"{ch}: {len(tiles)} panels -> {out}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(CHANNELS))
