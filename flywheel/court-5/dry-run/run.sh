#!/usr/bin/env bash
# Dry run of every court 5 script on the dummy set in this folder (helper file, intent lines, two sets, a repeat).
# It must pass before any author is briefed (PLAN.md, gate G2).
#
#   flywheel/court-5/dry-run/run.sh <old x3d_mcp checkout> <new x3d_mcp checkout> <x_ite dist dir> <work dir>
#
# Needs: a Python with x3d_mcp's dependencies on PATH, node with Playwright (set NODE_PATH for a global install).
set -euo pipefail
OLD=$1; NEW=$2; XITE=$3; WORK=$4
C=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$WORK/score"
python3 "$C/prior/build_prior.py"
python3 "$C/intent/strip_intent.py" "$C/dry-run" "$WORK/arm-f"
python3 "$C/score/run_kernel.py" "$OLD" "$WORK/arm-f" "$WORK/score/results-old.json"
python3 "$C/score/run_kernel.py" "$NEW" "$WORK/arm-f" "$WORK/score/results-new.json"
python3 "$C/score/build_packet.py" "$WORK/arm-f" "$WORK/score"
python3 "$C/dry-run/fake_reader.py" "$C/dry-run" "$WORK/score"
node "$C/play/play.mjs" "$XITE" "$C/dry-run" "$WORK/score/play.json"
python3 "$C/score/score.py" "$WORK/score" > "$WORK/score/score-out.txt"
python3 - "$WORK/score" <<'PY'
import json, sys
d = sys.argv[1]
r = json.load(open(f"{d}/results.json")); h = json.load(open(f"{d}/helpers.json")); p = json.load(open(f"{d}/packet.json"))
assert h == ["a/helper-bracket.x3d"], h
assert len(p) == 9 and "dummy_" not in json.dumps(p)
assert r["all_faults"]["faults"] == 4 and r["headline"]["faults"] == 3 and r["repeats_of_earlier_courts"]["faults"] == 1
assert r["intent_arm"]["new_faults_with_an_assertion"] == 2 and r["intent_arm"]["caught_by_play"] == ["a/fault-01.x3d", "a/fault-02.x3d"]
assert r["intent_arm"]["legal_files_that_fail_their_own_intent"] == [] and r["intent_arm"]["lines_not_understood"] == 0
print("dry run passed:", "headline proven old", r["headline"]["proven"]["old"], "new", r["headline"]["proven"]["new"], "of", r["headline"]["faults"],
      "| named old", r["headline"]["named"]["old"], "new", r["headline"]["named"]["new"], "| play caught", len(r["intent_arm"]["caught_by_play"]))
PY
