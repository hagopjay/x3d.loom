#!/bin/sh
# Copy the kit, the data and the compiled worlds into a demo folder (the page imports ./kit/*.mjs).
# Usage: bin/sync-demo.sh /path/to/x3d.demo/docs/demos/style-loom/v1
set -e
H=$(cd "$(dirname "$0")/.." && pwd); D=$1
mkdir -p "$D/kit" "$D/data" "$D/worlds" "$D/vocab"
cp "$H"/src/*.mjs "$D/kit/"
cp "$H"/styles/catalogue.jsonld "$H"/styles/authored.jsonld "$H"/data/node-city.scene.json "$D/data/"
cp "$H"/out/*.x3d "$D/worlds/"
cp "$H"/out/build-receipt.json "$H"/out/matrix.json "$D/data/"
for f in validate-receipt.json evals-receipt.json rdf-receipt.json gltf-receipt.json; do [ -f "$H/out/$f" ] && cp "$H/out/$f" "$D/data/"; done
cp "$H"/vocab/* "$D/vocab/" 2>/dev/null || true
echo synced to "$D"
