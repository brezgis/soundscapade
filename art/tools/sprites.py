#!/usr/bin/env python3
"""Swimmers for Below: single creatures on transparent backgrounds, drawn
translucent and water-tinted between the background and the foreground.

  python3 sprites.py [name ...] [--jobs 3]       generate (art/raw/sprites/<name>.png)
  python3 sprites.py --prep                       trim + WebP -> art/below/sprites/<name>.webp

Every creature is in side view facing RIGHT; the player flips them.
"""
import argparse
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ART = Path(__file__).resolve().parent.parent
RAW = ART / "raw" / "sprites"

SPRITES = {
    "chromis": "a single blue-green chromis damselfish (Chromis viridis), small, iridescent pale blue-green",
    "butterflyfish": "a single threadfin butterflyfish, yellow and white with a dark eye band",
    "turtle": "a single green sea turtle swimming, flippers mid-stroke, seen from the side and slightly below",
    "reef-shark": "a single blacktip reef shark swimming, sleek grey body, black tips on its fins",
    "herring": "a single Pacific herring, slim silver fish with a blue-green back",
    "salmon": "a single chinook salmon swimming, silver flanks with a dark spotted back",
    "arctic-cod": "a single polar cod (Arctic cod), slender pale grey-brown fish with a forked tail",
    "ringed-seal": "a single ringed seal swimming underwater, grey with pale ring markings, body stretched out",
    "jellyfish": "a single moon jellyfish, translucent milky bell with four pale rings and fine trailing tentacles, bell at the top",
    "lanternfish": "a single deep-sea lanternfish, dark silvery body with rows of small glowing blue photophores",
    "atolla": "a single deep-sea Atolla jellyfish, deep red crown-shaped bell with a faint blue bioluminescent ring, long trailing tentacle",
    "sperm-whale": "a single sperm whale swimming, huge blunt square head, dark grey wrinkled skin, long body",
}


def job(name):
    RAW.mkdir(parents=True, exist_ok=True)
    if (RAW / f"{name}.png").exists():
        return f"skip {name}"
    prompt = (f"Use the $imagegen tool to create exactly one image at size 1536x1024 (landscape) and save it in "
              f"the current directory as {name}.png. Do not write any other files. The image must be a PNG with "
              f"a TRANSPARENT background (real alpha channel, background: transparent). Show {SPRITES[name]}, "
              f"underwater, photorealistic like a high-end natural history documentary still, in clean side view "
              f"facing RIGHT, the whole animal in frame with a margin around it, centred, natural underwater "
              f"lighting from above. Nothing else: no water colour, no bubbles, no particles, no seabed, no "
              f"shadow, no other animals. Clean natural edges. No text, no watermark, no border.")
    for attempt in (1, 2):
        with open(RAW / f"{name}.log", "w") as log:
            subprocess.run(["nice", "-n", "10", "codex", "exec", "-C", str(RAW), "--skip-git-repo-check",
                            "-s", "workspace-write", "-c", "model_reasoning_effort=low", prompt],
                           stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=900)
        if (RAW / f"{name}.png").exists():
            return f"ok   {name}" + (" (retry)" if attempt == 2 else "")
    return f"FAIL {name}"


def prep():
    from PIL import Image
    out = ART / "below" / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    for name in SPRITES:
        src = RAW / f"{name}.png"
        if not src.exists():
            print("missing", name); continue
        im = Image.open(src).convert("RGBA")
        a = im.getchannel("A")
        if a.getextrema()[0] == 255:
            print("NO ALPHA", name); continue
        box = a.point(lambda v: 255 if v > 8 else 0).getbbox()
        im = im.crop(box)
        im.thumbnail((640, 640))
        im.save(out / f"{name}.webp", "WEBP", quality=88, method=6)
        print(f"{name}: {im.size}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--prep", action="store_true")
    a = ap.parse_args()
    if a.prep:
        prep()
    else:
        with ThreadPoolExecutor(a.jobs) as pool:
            for line in pool.map(job, a.names or list(SPRITES)):
                print(line, flush=True)
