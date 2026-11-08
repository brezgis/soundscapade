#!/usr/bin/env python3
"""Generate the continuous panoramas in chains.py through Codex's $imagegen.

  python3 run_chains.py [channel ...] [--redo name ...] [--from name]

Panels land in art/raw/<channel>/chain/<name>.png. Each channel's chain runs in
order (every panel needs the one before it); channels run in parallel.
Existing panels are kept, so a re-run picks up where it stopped. --redo drops
the named panels; --from drops that panel and everything after it.
"""
import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from chains import CHAINS, SEED, SIZE, prompt  # noqa: E402

RAW = Path(__file__).resolve().parent.parent / "raw"
GREY = (128, 128, 128)


def edge(img, side):
    """The SEED-wide strip at one side of a panel."""
    w, h = SIZE
    k = round(w * SEED)
    return img.crop((0, 0, k, h)) if side == "left" else img.crop((w - k, 0, w, h))


def seed_canvas(ch, i, edges):
    """Grey canvas with the neighbours' edges pasted where this panel must match them."""
    c = CHAINS[ch]
    panels = c["panels"]
    out = RAW / ch / "chain"
    w, h = SIZE
    k = round(w * SEED)
    canvas = Image.new("RGB", SIZE, GREY)
    lead, trail = ("left", "right") if c["side"] == "left" else ("right", "left")
    prev = Image.open(out / f"{panels[i - 1][0]}.png").convert("RGB").resize(SIZE)
    canvas.paste(edge(prev, trail), (0, 0) if lead == "left" else (w - k, 0))
    if trail in edges:   # closing the loop: match panel 0's leading edge too
        first = Image.open(out / f"{panels[0][0]}.png").convert("RGB").resize(SIZE)
        canvas.paste(edge(first, lead), (w - k, 0) if trail == "right" else (0, 0))
    return canvas


def gen(ch, i):
    out = RAW / ch / "chain"
    out.mkdir(parents=True, exist_ok=True)
    name, edges, body = prompt(ch, i)
    if (out / f"{name}.png").exists():
        return f"skip {ch}/{name}"
    cmd = ["nice", "-n", "10", "codex", "exec", "-C", str(out), "--skip-git-repo-check",
           "-s", "workspace-write", "-c", "model_reasoning_effort=low"]
    text = (f"Use the $imagegen tool to produce exactly one image at size {SIZE[0]}x{SIZE[1]} (landscape) "
            f"and save it in the current directory as {name}.png. Do not write any other files. {body}")
    if edges:
        seed_canvas(ch, i, edges).save(out / f"{name}.seed.png")
        cmd += [text, "-i", str(out / f"{name}.seed.png")]
    else:
        cmd += [text]
    for attempt in (1, 2):
        with open(out / f"{name}.log", "w") as log:
            subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=1200)
        if (out / f"{name}.png").exists():
            return f"ok   {ch}/{name}" + (" (retry)" if attempt == 2 else "")
    return f"FAIL {ch}/{name}"


def chain(ch, redo, start):
    names = [p[0] for p in CHAINS[ch]["panels"]]
    drop = set(redo) | (set(names[names.index(start):]) if start in names else set())
    for n in drop & set(names):
        (RAW / ch / "chain" / f"{n}.png").unlink(missing_ok=True)
    lines = []
    for i in range(len(names)):
        line = gen(ch, i)
        print(line, flush=True)
        lines.append(line)
        if line.startswith("FAIL"):
            break
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("channels", nargs="*", default=list(CHAINS))
    ap.add_argument("--redo", nargs="*", default=[])
    ap.add_argument("--from", dest="start")
    a = ap.parse_args()
    with ThreadPoolExecutor(len(a.channels)) as pool:
        list(pool.map(lambda ch: chain(ch, a.redo, a.start), a.channels))


if __name__ == "__main__":
    main()
