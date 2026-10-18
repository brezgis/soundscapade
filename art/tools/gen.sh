#!/usr/bin/env bash
# gen.sh OUTDIR NAME ORIENT "subject"   (ORIENT = h | v)
# Paints one panorama panel through Codex's $imagegen (no API key on north).
set -euo pipefail
out=$1 name=$2 orient=$3 subject=$4
style="Soft gouache painting with visible matte brush texture, like a quiet Studio Ghibli background painting or a meditation-app landscape. Muted, harmonious palette, gentle atmospheric perspective, calm and contemplative, no people as the focus, no text, no lettering, no border, no frame, no vignette."
if [ "$orient" = h ]; then
  size="1536x1024 (landscape)"
  seam="This is one panel of a long horizontal scrolling panorama. Keep the horizon or main ground line at about 62% of the image height. The leftmost and rightmost 12% of the image must dissolve smoothly into soft, nearly featureless haze, so neighbouring panels can be cross-faded together invisibly."
else
  size="1024x1536 (portrait)"
  seam="This is one panel of a tall vertical scrolling panorama that the viewer travels through up or down. The top 12% and bottom 12% of the image must dissolve smoothly into soft, nearly featureless open space of the scene's ambient colour, so stacked panels can be cross-faded together invisibly. Nothing important is cut off at the top or bottom edge."
fi
prompt="Use the \$imagegen tool to create exactly one image at size $size and save it in the current directory as $name.png. Do not write any other files. Image description: $style $seam Scene: $subject"
nice -n 10 codex exec -C "$out" --skip-git-repo-check -s workspace-write -c model_reasoning_effort=low "$prompt" < /dev/null > "$out/$name.log" 2>&1 || true
ls -la "$out/$name.png" 2>/dev/null || { echo "FAILED $name"; tail -5 "$out/$name.log"; }
