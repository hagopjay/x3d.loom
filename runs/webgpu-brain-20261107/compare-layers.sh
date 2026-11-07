#!/bin/sh
# compare-layers.sh [SERVE_URL] [OUT_DIR]: one row per layer set, the Babylon body against X_ITE 16.6.0 on the same scene and viewpoint, 640x360, headless SwiftShader both.
# Needs the scratch folder described in RECEIPT.md served at SERVE_URL (default http://localhost:8124) and Node with playwright. Correctness only: nothing here is timed.
URL=${1:-http://localhost:8124}; OUT=${2:-fin}; HERE=$(cd "$(dirname "$0")" && pwd); cd "$HERE"; mkdir -p "$OUT"
run() { name=$1; sw=$2; scene=${3:-brain_hero_lite.x3dz}; vp=${4:-VP_HOME}
 node grab.js "$URL/compare-babylon.html?stub=1&sw=$sw&vp=$vp&scene=$scene" $OUT/m_$name.png 6000 >/dev/null 2>&1 &
 node xshot.js "$URL/compare-xite.html?sw=$sw&vp=$vp&scene=$scene" $OUT/x_$name.png 640 360 25000 >/dev/null 2>&1
 wait
 echo "$name | sw=$sw | scene=$scene | $(python3 -I metrics.py $OUT/m_$name.png $OUT/x_$name.png)"; }
OFF="SW_CORTEX:-1,SW_AURA:-1,SW_DEEP:-1,SW_STAGE:-1"
run home ""
run glass "SW_DEEP:-1,SW_AURA:-1,SW_STAGE:-1"
run wet "$OFF,SW_WET:0"
run deep "SW_CORTEX:-1,SW_AURA:-1,SW_STAGE:-1"
run tracts "$OFF,SW_TRACTS:0"
run slices "$OFF,SW_SLICES:0"
run labels "$OFF,SW_LABELS:0"
run torso "" torso_ct_lite.x3dz
echo ALLDONE
