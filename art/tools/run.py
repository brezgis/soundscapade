#!/usr/bin/env python3
"""Generate every panel layer in manifest.py through Codex's $imagegen.

  python3 run.py [channel ...] [--only back|front] [--jobs 4] [--redo name ...]

Images land in art/raw/<channel>/<name>-back.png and <name>-front.png.
Existing files are skipped, so it is safe to re-run after a failure.
"""
import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from manifest import CHANNELS, back_prompt, front_prompt  # noqa: E402

RAW = Path(__file__).resolve().parent.parent / "raw"


def job(ch, name, layer, prompt_fn, scene):
    out = RAW / ch
    out.mkdir(parents=True, exist_ok=True)
    fname = f"{name}-{layer}"
    if (out / f"{fname}.png").exists():
        return f"skip {ch}/{fname}"
    size, desc = prompt_fn(ch, name, scene)
    prompt = (f"Use the $imagegen tool to create exactly one image at size {size} and save it in the "
              f"current directory as {fname}.png. Do not write any other files. Image description: {desc}")
    for attempt in (1, 2):
        with open(out / f"{fname}.log", "w") as log:
            subprocess.run(
                ["nice", "-n", "10", "codex", "exec", "-C", str(out), "--skip-git-repo-check",
                 "-s", "workspace-write", "-c", "model_reasoning_effort=low", prompt],
                stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=900)
        if (out / f"{fname}.png").exists():
            return f"ok   {ch}/{fname}" + (" (retry)" if attempt == 2 else "")
    return f"FAIL {ch}/{fname}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("channels", nargs="*", default=list(CHANNELS))
    ap.add_argument("--only", choices=["back", "front"])
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--redo", nargs="*", default=[])
    a = ap.parse_args()

    jobs = []
    for ch in a.channels:
        for name, scene in CHANNELS[ch]["panels"]:
            for layer, fn in (("back", back_prompt), ("front", front_prompt)):
                if a.only and layer != a.only:
                    continue
                if f"{name}-{layer}" in a.redo or name in a.redo:
                    (RAW / ch / f"{name}-{layer}.png").unlink(missing_ok=True)
                jobs.append((ch, name, layer, fn, scene))

    with ThreadPoolExecutor(a.jobs) as pool:
        for line in pool.map(lambda j: job(*j), jobs):
            print(line, flush=True)


if __name__ == "__main__":
    main()
