#!/bin/sh
# compare-views.sh [SERVE_URL] [OUT_DIR]: the six Gobbler viewpoints, the Babylon body against X_ITE 16.5.1 on the same scene file, 640x360, headless both. Correctness only: nothing is timed.
# Needs the scratch folder described in RECEIPT.md served at SERVE_URL (default http://localhost:8124) and Node with playwright (NODE_PATH set).
# X_ITE needs the full Chromium (CHROME=/opt/pw-browsers/chromium): the headless shell crashes on this scene.
URL=${1:-http://localhost:8124}; OUT=${2:-fin}; HERE=$(cd "$(dirname "$0")" && pwd); cd "$HERE"; mkdir -p "$OUT"
for vp in Wide Colossus EyeToEye Inside Flywheel Crown; do
  node grab.js "$URL/gob/compare-gob.html?stub=1&vp=$vp" $OUT/m_$vp.png 8000 >/dev/null 2>&1 &
  CHROME=${CHROME:-/opt/pw-browsers/chromium} node xshot.js "$URL/compare-xite.html?scene=gobbler3.x3d&vp=$vp" $OUT/x_$vp.png 640 360 22000 >/dev/null 2>&1
  wait
  echo "$vp | $(python3 -I metrics.py $OUT/m_$vp.png $OUT/x_$vp.png)"
done
echo ALLDONE
