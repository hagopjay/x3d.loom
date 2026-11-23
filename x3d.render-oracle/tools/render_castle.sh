#!/usr/bin/env bash
# usage: CASTLE_RENDER=/path/castle-render render_castle.sh OUTDIR SCENE.x3d...   (xvfb, Mesa llvmpipe; castle-render built from x3d.castle/castle-render with the Castle bundle's FPC)
# Rig: --size 128, every other lever at its default (scene's own Viewpoint, Castle's default lighting and colour space).
set -uo pipefail
OUT="$1"; shift; mkdir -p "$OUT/castle"
for s in "$@"; do n=$(basename "$s" .x3d); LP_NUM_THREADS=2 xvfb-run -a "$CASTLE_RENDER" "$s" "$OUT/castle/$n.png" --size 128 >"$OUT/castle/$n.log" 2>&1 || echo "FAIL $n"; done
