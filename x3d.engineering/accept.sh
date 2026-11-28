#!/bin/sh
# Accept one engineering study under kit/profiles/x3d-engineering.json and write a receipt, then prove the gate bites.
#   x3d.engineering/accept.sh fourbar|ifc-truss [RUN_DIR]
# Needs: the x3d_mcp checkout (LOOM_FORK), and for ifc-truss the x3d.demo checkout (X3D_DEMO) and ifcopenshell.
# fourbar also needs `npm install` in x3d.physics/rigid-engines; its engine runs are re-stepped here into .work/.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"; V1="$(cd "$HERE/.." && pwd)"
STUDY="$1"; ROOT="$HERE/$STUDY"
RUN="${2:-$V1/runs/engineering-$STUDY-$(date -u +%Y%m%d)}"
LOOM="$V1/kit/loom"; PROFILE="$V1/kit/profiles/x3d-engineering.json"; EV="$RUN/evidence"
export PYTHONDONTWRITEBYTECODE=1
mkdir -p "$RUN"; rm -rf "$EV"; mkdir -p "$EV"
find "$ROOT" -name __pycache__ -type d -prune -exec rm -rf {} +

case "$STUDY" in
  # build, then run the witness once so results/ is current: the kit rejects a witness that changes the candidate,
  # so the recorded run below must rewrite the same bytes (which is also the reproducibility check)
  fourbar)   (cd "$ROOT" && python3 -I fourbar.py build && node run_engines.js && python3 -I check.py) > "$RUN/build.log" 2>&1 ;;
  ifc-truss) (cd "$ROOT" && python3 exchange.py build && python3 check.py) > "$RUN/build.log" 2>&1 ;;
esac
"$LOOM" candidate "$ROOT" > "$RUN/candidate.json"
"$LOOM" grammar "$ROOT" --evidence "$EV" --files 'scenes/*.x3d'
"$LOOM" traps   "$ROOT" --evidence "$EV" --files 'scenes/*.x3d'
case "$STUDY" in
  fourbar)   "$LOOM" command "$ROOT" --evidence "$EV" --name requirements -- python3 -I check.py ;;
  ifc-truss) "$LOOM" command "$ROOT" --evidence "$EV" --name requirements -- python3 check.py ;;
esac
for w in second-reader eyes host licensed-engineer-review; do
  "$LOOM" record "$ROOT" --evidence "$EV" --name "$w" --status not_run --grade L --reason "Not run: nobody outside the session has recomputed the numbers, no render was compared, no strict host copy, and no licensed engineer has reviewed the design."
done
"$LOOM" accept  "$ROOT" --evidence "$EV" --profile "$PROFILE"
"$LOOM" receipt "$ROOT" --evidence "$EV" --profile "$PROFILE" --subject "x3d.engineering $STUDY, run of record" --out "$RUN/receipt.json" --force
"$LOOM" verify-receipt "$RUN/receipt.json"

# Negative control on the real study: touch a scene after the witnesses ran -> STALE_WITNESS. Then restore.
SCENE="$(ls "$ROOT"/scenes/*.x3d | head -1)"
cp "$SCENE" "$RUN/.scene.bak"
printf '\n' >> "$SCENE"
if "$LOOM" accept "$ROOT" --evidence "$EV" --profile "$PROFILE" > "$RUN/control-stale.json"; then cp "$RUN/.scene.bak" "$SCENE"; echo "SURVIVING_CONTROL stale"; exit 1; fi
cp "$RUN/.scene.bak" "$SCENE"; rm "$RUN/.scene.bak"
"$LOOM" accept "$ROOT" --evidence "$EV" --profile "$PROFILE" > /dev/null && echo "restored: accepts again"
echo "done: $RUN"
