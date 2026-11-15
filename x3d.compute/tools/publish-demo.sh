#!/bin/sh
# Copies the kernels, CPU twins, fixtures, harness page and the recorded receipt into an x3d.demo version folder.
#   tools/publish-demo.sh /path/to/x3d.demo/docs/demos/webgpu-compute/v1
set -e
dst="$1/compute"; src="$(cd "$(dirname "$0")/.." && pwd)"
[ -n "$1" ] || { echo "usage: $0 <demo version dir>"; exit 2; }
mkdir -p "$dst/src/kernels" "$dst/src/ref" "$dst/fixtures" "$dst/bench" "$dst/receipts"
cp "$src"/src/gpu.js "$dst/src/"; cp "$src"/src/kernels/*.wgsl "$dst/src/kernels/"; cp "$src"/src/ref/*.js "$dst/src/ref/"
cp "$src"/fixtures/*.x3d "$dst/fixtures/"; cp "$src"/bench/page.js "$dst/bench/"; cp "$src"/receipts/full-swiftshader.json "$dst/receipts/"
echo "copied to $dst"
