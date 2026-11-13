"""Negative controls run on the REAL PhysX records: each mutates a copy in memory and must be caught with its own code
(law 19). A check that never fails on the real thing proves nothing.   python3 -I x3d.physics/tools/physx_controls.py"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "kit"))
from loomkit import physics                      # noqa: E402
from loomkit.core import GateError               # noqa: E402

REC = ROOT / "runs" / "physx-grand-cascade-chromium.physics.json"
FF = ROOT / "runs" / "physx-grand-cascade-firefox.physics.json"
KW = dict(required_hosts=["chromium", "firefox", "webkit", "node"], max_waivers=3, require_takeover=True)


def drop(r, host): r["replays"] = [x for x in r["replays"] if x["host"] != host]


CASES = [
    ("a single step hash edited in the 1918-step record", "PHYS_TRACE_TAMPERED", lambda r: r["recorded"]["hashes"].__setitem__(1000, r["recorded"]["hashes"][1000] ^ 1), {}),
    ("the WebKit replay left out", "PHYS_REPLAY_MISSING", lambda r: drop(r, "webkit"), {}),
    ("the Firefox replay differs at step 1100", "PHYS_HASH_DRIFT", lambda r: next(x for x in r["replays"] if x["host"] == "firefox").update(mismatches=818, first_mismatch=1100), {}),
    ("a replay on another PhysX version", "PHYS_ENGINE_DRIFT", lambda r: next(x for x in r["replays"] if x["host"] == "node").update(engine_version="5.13.0"), {}),
    ("the pendulum limit widened from 0.5 % to 5 %", "PHYS_LIMIT_WIDENED", lambda r: next(x for x in r["references"] if x["id"].startswith("pendulum, ball")).update(limit=0.05), {}),
    ("free fall marked pass at an error above its limit", "PHYS_FALSE_GREEN", lambda r: next(x for x in r["references"] if x["id"].startswith("free fall: height")).update(observed=2e-4, status="pass"), {}),
    ("the CCD tunnelling reference missed", "PHYS_REFERENCE_FAIL", lambda r: next(x for x in r["references"] if x["id"].startswith("tunnelling")).update(observed=3.0, status="fail"), {}),
    ("the Galton waiver removed, the failure left", "PHYS_TOLERANCE_FAIL", lambda r: r["tolerances"][0].pop("waiver"), {}),
    ("a waiver without a date", "PHYS_WAIVER_INCOMPLETE", lambda r: r["tolerances"][1]["waiver"].update(date=""), {}),
    ("the profile's cap lowered below the recorded waivers", "PHYS_WAIVERS_OVER_CAP", lambda r: None, {"max_waivers": 2}),
    ("the tunnelling control that did not tunnel", "PHYS_CONTROL_SURVIVED", lambda r: r["controls"][0].update(observed_failed=False), {}),
    ("WebKit missing from the engine-off proof", "PHYS_TAKEOVER_UNPROVEN", lambda r: r["takeover"]["engine_off_hosts"].remove("webkit"), {}),
    ("11 authored fields dropped and the loss report off", "PHYS_LOSS_UNREPORTED", lambda r: r["losses"].update(reported=False), {}),
    ("no references at all", "PHYS_NO_REFERENCE", lambda r: r.update(references=[]), {}),
]


def main() -> int:
    base = json.loads(REC.read_text())
    ok = physics.check_run(copy.deepcopy(base), None, **KW)
    ff = physics.check_run(json.loads(FF.read_text()), None, **KW)
    rows = [{"case": "the Chromium record as shipped", "result": "pass", "steps": ok["steps"], "waivers": len(ok["waivers"])},
            {"case": "the Firefox record as shipped", "result": "pass", "steps": ff["steps"], "waivers": len(ff["waivers"])}]
    bad = 0
    for label, code, mutate, kw in CASES:
        r = copy.deepcopy(base); mutate(r)
        try:
            physics.check_run(r, None, **{**KW, **kw})
            got = "NOT CAUGHT"
        except GateError as e:
            got = e.code
        rows.append({"case": label, "expected": code, "caught": got})
        bad += got != code
    out = {"schema": "loom.controls/1", "subject": str(REC.relative_to(ROOT)), "controls": rows, "all_caught": not bad}
    dest = ROOT.parent / "runs" / "physics-20261113" / "controls.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=1) + "\n")
    print(f"{len(CASES)} controls on the real record, {len(CASES) - bad} caught with the intended code ->", dest.relative_to(ROOT.parent))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
