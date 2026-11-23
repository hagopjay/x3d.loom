#!/usr/bin/env bash
# usage: render_wgpu.sh OUTDIR SCENE.x3d...   (needs x3d-view built: cargo build --release -p x3d-render --bin x3d-view in x3d.wgpu)
# Software Vulkan: SwiftShader ICD that ships inside Playwright's Chromium (no GPU in the cloud container).
set -euo pipefail
OUT="$1"; shift
V="${X3D_VIEW:-$HOME/../home/user/x3d.wgpu/target/release/x3d-view}"; [ -x "$V" ] || V=/home/user/x3d.wgpu/target/release/x3d-view
export VK_ICD_FILENAMES="${VK_ICD_FILENAMES:-/opt/pw-browsers/chromium-1243/chrome-linux64/vk_swiftshader_icd.json}"
mkdir -p "$OUT/wgpu"
for s in "$@"; do n=$(basename "$s" .x3d); "$V" render "$s" --size 128x128 -o "$OUT/wgpu/$n.png" >/dev/null 2>"$OUT/wgpu/$n.err" || echo "FAIL $n"; done
"$V" --version > "$OUT/wgpu-version.txt"; "$V" adapters >> "$OUT/wgpu-version.txt" 2>&1 || true
