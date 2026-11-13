#!/bin/sh
# compare-layers.sh BABYLON_SITE XITE_SITE [OUT_DIR] [ROWS]: one row per layer set or mood, the Babylon WebGPU page against the page's own X_ITE 16.5.1 build, same view, 640x360, headless SwiftShader both, lens off.
# BABYLON_SITE is the output of build-manifold.py; XITE_SITE is the Pages folder it was built from. Needs Node with playwright and /tmp/w/serve/babylon.js (babylonjs@9.32.0). Correctness only: nothing here is timed.
# ROWS (default: all of them, moods first): space-separated names from  all euphoria catharsis stillness surface veil flows fibers.  A row whose X_ITE frame already exists in OUT_DIR reuses it (the X_ITE frame does not depend on the Babylon build).
B=$1; X=$2; OUT=${3:-fin}; ROWS=${4:-"all euphoria catharsis stillness surface veil flows fibers"}; HERE=$(cd "$(dirname "$0")" && pwd); cd "$HERE"; mkdir -p "$OUT"
BASE="paused=1&orbit=0&lens=0&quality=1&labels=0&settle=1&t=41.3&az=.62&el=.69&dist=27.6&target=0,-1.5,0"
run() { name=$1; mood=$2; extra=$3
  node shot-babylon.js "$B" $OUT/m_$name.png "mood=$mood&$BASE&$extra" 20000 >/dev/null 2>&1
  [ -s $OUT/x_$name.png ] || node shot-xite.js "$X" $OUT/x_$name.png "mood=$mood&$BASE&$extra" 260000 >/dev/null 2>&1
  echo "$name | mood=$mood $extra | $(python3 -I metrics.py $OUT/m_$name.png $OUT/x_$name.png)"; }
for r in $ROWS; do case $r in
  all) run all 0 "";;
  surface) run surface 0 "veil=0&traces=0&filaments=0";;
  veil) run veil 0 "traces=0&filaments=0";;
  flows) run flows 0 "veil=0&filaments=0";;
  fibers) run fibers 0 "veil=0&traces=0";;
  euphoria) run euphoria 1 "";;
  catharsis) run catharsis 2 "";;
  stillness) run stillness 3 "";;
esac; done
echo ALLDONE
