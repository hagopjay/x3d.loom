#!/bin/sh
# compare-views.sh BABYLON_BASE XITE_BASE OUT_DIR: the zoom-ladder views of the demiurge page, the Babylon body against X_ITE 16.5.1 on the same scene files, 960x540, headless both.
# BABYLON_BASE serves a build-demiurge.py output folder, XITE_BASE serves the x3d.onto checkout (the original page). Correctness only: nothing is timed.
# The scene runs on wall-clock timers (sway, tour, orbits), so the two captures are at different phases: PSNR is a sanity figure, not parity.
B=${1:-http://127.0.0.1:8124/s2}; X=${2:-http://127.0.0.1:8125}; OUT=${3:-views}; HERE=$(cd "$(dirname "$0")" && pwd); cd "$HERE"; mkdir -p "$OUT"
for v in face ribcage heart earth village plaza villager feather; do
  node dm-shot.js $OUT/m_$v.png "$B/gobbler-demiurge/index.html?ui=none&view=$v&seed=0" 25000 >/dev/null 2>&1 &
  CHROME=${CHROME:-/opt/pw-browsers/chromium} node dm-xite.js $OUT/x_$v.png "$X/gobbler-demiurge/index.html?ui=none&view=$v&seed=0" 25000 >/dev/null 2>&1
  wait
  echo "$v | $(python3 -I metrics.py $OUT/m_$v.png $OUT/x_$v.png)"
done
echo ALLDONE
