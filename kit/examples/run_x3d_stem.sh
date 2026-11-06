#!/bin/sh
# Accept an x3d.STEM study under its profile and write a receipt, then prove the gate bites on it.
#   kit/examples/run_x3d_stem.sh kerr2|turing-garden [RUN_DIR]
# The study folder itself is the candidate (its .work/ is excluded). Builders are not rerun here: the
# science gate checks that the shipped builder and solver produced the manifests, by hash.
set -eu
V1="$(cd "$(dirname "$0")/../.." && pwd)"
STUDY="$1"
ROOT="$(cd "$V1/../../x3d.STEM/studies/$STUDY" && pwd)"
RUN="${2:-$V1/runs/$STUDY-$(date -u +%Y%m%d)}"
LOOM="$V1/kit/loom"
PROFILE="$V1/kit/profiles/x3d-stem-$STUDY.json"
EV="$RUN/evidence"
export PYTHONDONTWRITEBYTECODE=1
rm -rf "$EV" "$RUN/control-evidence"; mkdir -p "$EV"
find "$ROOT" -name __pycache__ -type d -prune -exec rm -rf {} +

"$LOOM" candidate "$ROOT"
"$LOOM" grammar "$ROOT" --evidence "$EV" --files 'scenes/*.x3d'
"$LOOM" traps   "$ROOT" --evidence "$EV" --files 'scenes/*.x3d'
"$LOOM" pagetraps "$ROOT" --evidence "$EV" --files 'src/*.js,index.html'
"$LOOM" sci     "$ROOT" --evidence "$EV" --profile "$PROFILE"
case "$STUDY" in
  kerr2)
    "$LOOM" command "$ROOT" --evidence "$EV" --name eyes -- python3 -E -s tools/check_reconstruction.py
    for w in behaviour host gpu-location paired-visual-review; do
      "$LOOM" record "$ROOT" --evidence "$EV" --name "$w" --status not_run --grade L --reason "Not run in pass 1: no scripted interaction test, no strict host copy, no GPU timing, no paired human review."
    done ;;
  turing-garden|electron-cloud|chirp|living-heart|vortex-sound|manifold)
    "$LOOM" command "$ROOT" --evidence "$EV" --name behaviour -- python3 -E -s tools/check_browser.py
    if [ "$STUDY" = chirp ]; then
      "$LOOM" record "$ROOT" --evidence "$EV" --name listening-test --status not_run --grade L --reason "No person has listened to the published tracks on calibrated speakers; the browser run was muted and checked clocks only."
    fi
    for w in eyes host gpu-location paired-visual-review; do
      "$LOOM" record "$ROOT" --evidence "$EV" --name "$w" --status not_run --grade L --reason "Not run in pass 1: no offline-render comparison of frames, no strict host copy, no GPU timing, no paired human review."
    done ;;
esac
"$LOOM" accept  "$ROOT" --evidence "$EV" --profile "$PROFILE"
"$LOOM" receipt "$ROOT" --evidence "$EV" --profile "$PROFILE" --subject "x3d.STEM $STUDY, pass 1" --out "$RUN/receipt.json" --force
"$LOOM" verify-receipt "$RUN/receipt.json"

# Negative control on the real study: touch a scene after the witnesses ran -> STALE_WITNESS. Then restore.
SCENE="$(ls "$ROOT"/scenes/*.x3d | head -1)"
cp "$SCENE" "$RUN/.scene.bak"
printf '\n' >> "$SCENE"
if "$LOOM" accept "$ROOT" --evidence "$EV" --profile "$PROFILE" > "$RUN/control-stale.json"; then cp "$RUN/.scene.bak" "$SCENE"; echo "SURVIVING_CONTROL stale"; exit 1; fi
cp "$RUN/.scene.bak" "$SCENE"; rm "$RUN/.scene.bak"
cat "$RUN/control-stale.json"
"$LOOM" accept "$ROOT" --evidence "$EV" --profile "$PROFILE" > /dev/null && echo "restored: accepts again"
echo "done: $RUN"
