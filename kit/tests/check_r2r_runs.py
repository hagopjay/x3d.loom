"""Re-check the sealed R2R runs against their receipts, on a machine that has no Blender and no x3d.py.

    python3 -I kit/tests/check_r2r_runs.py CHAOS_DIR      # CHAOS_DIR: where runs/r2r-receipts-20261123/chaos-*.tar.xz were unpacked

For every candidate rule of the two add-on runs, using only what is in this repository:
  1. each source failure that is a chaos mutant exists, has the sha256 the candidate recorded, and the rule fires on it;
  2. the rule fires on no more of the files its instrument PASSED than its proof says (0 for every clean rule);
  3. the candidate is still a candidate: not promoted, proposer recorded, grade recomputed from its proof is unchanged.

What this cannot re-check is the probes: they need the instrument. Their recipes are in probes.jsonl for a machine
that has it (`kit/loom r2r replay`). Exit 0 when everything holds, 1 with the first mismatch otherwise.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))

from loomkit.r2r import grade as grading  # noqa: E402
from loomkit.r2r.cli import Manifest, load_run  # noqa: E402
from loomkit.r2r.events import Case, EventSet  # noqa: E402
from loomkit.r2r.rule import Rule  # noqa: E402

RUNS = KIT.parent / "runs"
PAIRS = [("r2r-blender-io-271-20261123", "blender-io-2.7.1.json"), ("r2r-blender-io-273-20261123", "blender-io-2.7.3.json")]


def main(chaos_dir: str) -> int:
    report = []
    for run_name, manifest_name in PAIRS:
        man = Manifest(RUNS / "r2r-receipts-20261123" / "manifests" / manifest_name, [f"chaos={chaos_dir}"])
        evs, _ = man.events(log=lambda m: None)
        es = EventSet(evs)
        _run_doc, _clusters, cands = load_run(RUNS / run_name)
        sources = fired = 0
        for c in cands:
            rule = Rule.from_json(c["rule"])
            if c["status"] != "candidate" or c["promoted"] is not False:
                print(f"{run_name} {c['id']}: not a plain candidate"); return 1
            claims = [c] + c.get("also_explains", [])     # a rule found under two signatures carries two claims
            for claim in claims:
                again = grading.grade(claim["proof"])
                if again["grade"] != claim["grade"]["grade"]:
                    print(f"{run_name} {c['id']}: grade {claim['grade']['grade']} recorded, {again['grade']} recomputed"); return 1
            for s in (s for claim in claims for s in claim["sources"]):
                p = Path(man.resolve(s["file"]))
                if not s["file"].startswith("chaos:"):
                    continue
                data = p.read_bytes()
                if hashlib.sha256(data).hexdigest() != s["sha256"]:
                    print(f"{run_name} {c['id']}: {s['file']} is not the file the candidate recorded"); return 1
                sources += 1
                if not rule.fires(Case(str(p), data).sites):
                    print(f"{run_name} {c['id']}: does not fire on its own source {s['file']}"); return 1
                fired += 1
            alarms = {"train": set(), "held": set()}
            for e in es.events:
                if e.instrument == c["instrument"] and e.outcome == "pass" and e.split in alarms:
                    case = es.example(e).case
                    if rule.could_fire(case.bag) and rule.fires(case.sites):
                        alarms[e.split].add(case.sha256)
            allowed = (max(x["proof"]["known_good"]["false_alarms"] for x in claims),
                       max(x["proof"]["held_out"]["false_alarms"] for x in claims))
            if len(alarms["train"]) > allowed[0] or len(alarms["held"]) > allowed[1]:
                print(f"{run_name} {c['id']}: fires on {len(alarms['train'])} training and {len(alarms['held'])} held-out "
                      f"passing files; its proof says {allowed[0]} and {allowed[1]}"); return 1
        if _run_doc["candidates"] != len(cands) or sum(_run_doc["grades"].values()) != len(cands):
            print(f"{run_name}: run.json counts {_run_doc['candidates']} candidates, the folder holds {len(cands)}"); return 1
        report.append({"run": run_name, "candidates": len(cands), "chaos_sources_rechecked": sources, "fired_on": fired,
                       "receipt_events": len(es.events), "files_not_on_this_machine": len(es.skipped)})
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
