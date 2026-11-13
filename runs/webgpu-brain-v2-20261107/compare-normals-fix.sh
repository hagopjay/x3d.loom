#!/bin/sh
# compare-normals-fix.sh [SERVE_URL] [OUT_DIR]: the brain and torso comparison of compare-layers.sh, run twice on the Babylon side: with the current src/ (the face[0][0] normals fix, x3d.loom PR 17)
# and with src-old/ (the brain sources as of x3d.loom main 5441ac0, before the fix), both against ONE X_ITE 16.6.0 render per row. Same scenes, viewpoints, 640x360, headless SwiftShader. Correctness only, nothing is timed.
# Scratch folder served at SERVE_URL (default http://localhost:8125): babylon.js, src (link to x3d.webgpu/demo/src/brain), src-old (git archive of the brain folder at 5441ac0), scenes, vendor/x_ite (16.6.0),
# compare-babylon.html, compare-babylon-old.html (the same file with src/ replaced by src-old/), compare-xite.html (the html files, grab.js, xshot.js and metrics.py are from ../webgpu-brain-20261107).
URL=${1:-http://localhost:8125}; OUT=${2:-fix}; HERE=$(cd "$(dirname "$0")" && pwd); H0="$HERE/../webgpu-brain-20261107"; mkdir -p "$OUT"
run() { name=$1; sw=$2; scene=${3:-brain_hero_lite.x3dz}; vp=${4:-VP_HOME}
 node "$H0/grab.js" "$URL/compare-babylon.html?stub=1&sw=$sw&vp=$vp&scene=$scene" $OUT/n_$name.png 6000 >$OUT/n_$name.log 2>&1 &
 node "$H0/xshot.js" "$URL/compare-xite.html?sw=$sw&vp=$vp&scene=$scene" $OUT/x_$name.png 640 360 25000 >$OUT/x_$name.log 2>&1
 wait
 node "$H0/grab.js" "$URL/compare-babylon-old.html?stub=1&sw=$sw&vp=$vp&scene=$scene" $OUT/o_$name.png 6000 >$OUT/o_$name.log 2>&1
 echo "$name | sw=$sw | scene=$scene"; echo "  after the fix : $(python3 -I "$H0/metrics.py" $OUT/n_$name.png $OUT/x_$name.png)"; echo "  before the fix: $(python3 -I "$H0/metrics.py" $OUT/o_$name.png $OUT/x_$name.png)"; }
OFF="SW_CORTEX:-1,SW_AURA:-1,SW_DEEP:-1,SW_STAGE:-1"
run home ""
run glass "SW_DEEP:-1,SW_AURA:-1,SW_STAGE:-1"
run wet "$OFF,SW_WET:0"
run deep "SW_CORTEX:-1,SW_AURA:-1,SW_STAGE:-1"
run tracts "$OFF,SW_TRACTS:0"
run slices "$OFF,SW_SLICES:0"
run labels "$OFF,SW_LABELS:0"
run activ "$OFF,SW_ACTIV:0"
run torso "" torso_ct_lite.x3dz
echo ALLDONE
