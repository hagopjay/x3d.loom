"""Builds `loom.physics-run/1` records from the PhysX bridge's own evidence, so no number in them is retyped by hand
(Loom failure mode 90). It only reads what the bridge's probes and tests wrote; it measures nothing itself.

    python3 -I x3d.physics/tools/physx_run_record.py            # writes x3d.physics/runs/*.physics.json
    kit/loom physics x3d.physics --evidence runs/physics-20261113/evidence --runs 'runs/*.physics.json' \
        --hosts chromium,firefox,webkit,node --max-waivers 3 --require-takeover

What goes where, and what it is NOT:
  recorded / replays   p4-run-{chromium,firefox}.json (every step's FNV-1a state hash) and p4-determinism-*.json
                       (the replay of that run in each host). "(fresh page)" is the host; "(same page)" is kept as
                       `<host>-same-page`, a weaker claim, and is never counted as the host.
  references           p1-analytic.json (Node, one engine build), with the limits the project's tests assert. A limit gets
                       `declared_limit` only where SPEC.md section 7 states that number; the incline limit (2 %) is in
                       the test and not in the SPEC, so it carries none and the widening check does not claim it.
  controls             the tunnelling control: a 5 m/s marble without CCD tunnelled in N of 40 start phases, which is the
                       control failing as it must.
  takeover             p1-enabled-probe-{chromium,firefox,webkit}.json: X_ITE's Bullet moves nothing when disabled.
  tolerances / waivers p5-smoke.json (30 of 33 passed; the three failures under load) reconstructed AFTER the fact from
                       the thread's own note ('user accepted'); the owner should confirm (LOOM-v1 section 10, question 16).
Not in these records, on purpose: the ragdoll (its run hashes were not persisted), the Gravitron 2.97 against 2.22 rad/s gap
(no limit was declared for it), and the limit overshoot of 0.43 rad against 0.2 (no persisted run to attach it to).
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # x3d.physics
PX = ROOT / "physx-bridge"
EV = PX / "evidence"
OUT = ROOT / "runs"
HOSTS = ["chromium", "firefox", "webkit", "node"]
BRIDGE_COMMIT = "9a694e9"               # the sibling thread's HEAD when the evidence was collected


def trace_sha256(hashes: list) -> str:
    return hashlib.sha256(",".join(str(h) for h in hashes).encode()).hexdigest()


def canon_sha256(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def load(name: str) -> dict:
    return json.loads((EV / name).read_text(encoding="utf-8"))


def replays_of(determinism: dict) -> list[dict]:
    out = []
    for key, r in determinism["replays"].items():
        name, _, qual = key.partition(" (")
        host = name if qual in ("", "fresh page)") else f"{name}-same-page"
        row = {"host": host, "steps": r["steps"], "mismatches": r["mismatches"], "first_mismatch": r["firstMismatch"], "ms": round(r["ms"], 1)}
        if r.get("version"):
            row["host_version"] = r["version"]
        out.append(row)
    return out


def references() -> tuple[list[dict], list[dict]]:
    a = load("p1-analytic.json")
    r = a["results"]
    when = a["measured"]
    ff, bounces = r["freeFall"], r["restitution"]["bounces"][:5]

    def item(id_, observed, limit, declared, source, rule="at most"):
        row = {"id": id_, "observed": observed, "limit": limit, "rule": rule, "status": "pass" if (observed <= limit if rule == "at most" else observed >= limit) else "fail",
               "source": source, "measured": when}
        if declared is not None:
            row["declared_limit"] = declared
        return row

    refs = [
        item("free fall: height against the discrete semi-implicit Euler solution, 1 s (m)", abs(ff["errVsDiscrete"]), 1e-4, 1e-4, "p1-analytic.json freeFall; SPEC.md section 7"),
        item("free fall: velocity against -g t, 1 s (m/s)", abs(ff["errV"]), 1e-4, None, "p1-analytic.json freeFall; tests/analytic.test.ts"),
        item("free fall: the continuum gap equals the integrator's 1/2 g h t (m)", abs(ff["errVsContinuum"] - ff["predictedContinuumErr"]), 1e-4, None, "p1-analytic.json freeFall; tests/analytic.test.ts"),
        item("pendulum, ball joint: period against 2 pi sqrt(I/(m g L)) (relative)", abs(r["pendulum_BallJoint"]["relErr"]), 0.005, 0.005, "p1-analytic.json; SPEC.md section 7"),
        item("pendulum, hinge joint: period against 2 pi sqrt(I/(m g L)) (relative)", abs(r["pendulum_SingleAxisHingeJoint"]["relErr"]), 0.005, 0.005, "p1-analytic.json; SPEC.md section 7"),
        item("restitution: rebound speed against e (v + g h), worst of 5 bounces", max(abs(b["ratioWithGh"] - r["restitution"]["e"]) for b in bounces), 1e-3, 1e-3, "p1-analytic.json; SPEC.md section 7"),
        item("incline 30 deg, mu 0.3: sliding acceleration against g (sin t - mu cos t) (relative)", abs(r["incline_mu0.3"]["aMeasured"] - r["incline_mu0.3"]["aExpected"]) / r["incline_mu0.3"]["aExpected"], 0.02, None, "p1-analytic.json; tests/analytic.test.ts"),
        item("incline 30 deg, mu 0.7: a body that must hold moved (m)", r["incline_mu0.7"]["travelled"], 1e-3, None, "p1-analytic.json; tests/analytic.test.ts"),
        item("tunnelling with CCD on: phases (of 40) in which a 5 m/s marble crossed a 5 mm wall", float(r["tunnelling"]["tunnelled"]["withCCD"]), 0.0, 0.0, "p1-analytic.json; SPEC.md section 7"),
    ]
    tun = r["tunnelling"]
    controls = [{"id": f"tunnelling control: with CCD off the marble crossed in {tun['tunnelled']['withoutCCD']} of {tun['startPhases']} start phases (it must)",
                 "expect": "fail", "observed_failed": tun["tunnelled"]["withoutCCD"] > 0, "source": "p1-analytic.json tunnelling"}]
    return refs, controls


def smoke_tolerances() -> list[dict]:
    """The three smoke failures. The numbers are the test's own Expected/Received; the owner and date are what the
    thread's log says (SPEC.md section 7: 'last run 30 passed, 3 failed under load'), written as waivers here."""
    smoke = load("p5-smoke.json")
    stats = smoke["stats"]
    day = stats["startTime"][:10]
    log = (EV / "p5-smoke-log.txt").read_text(encoding="utf-8")
    binned = [int(x) for x in re.findall(r"Expected: >= 225\s+Received:\s+(\d+)", log)]
    turns = re.search(r"Array \[\s*-\s+(\d+),\s*-\s+(\d+),\s*\+\s+(\d+),\s*\+\s+(\d+),", log)
    if stats["unexpected"] != 3 or len(binned) != 2 or not turns:
        raise SystemExit(f"p5-smoke evidence no longer reads as 3 failures (2 Galton, 1 music box): {stats['unexpected']}, {binned}, {bool(turns)}")
    owner = "the project owner (the thread's phase-5 note: '30/33 under heavy machine load (user accepted)'; SPEC.md section 7)"
    why = "failed under machine load while the other browsers' suites ran; logged and accepted by the owner, to be re-run unloaded (SPEC.md section 7, evidence/p5-smoke-log.txt)"

    def row(id_, observed, limit):
        return {"id": id_, "observed": observed, "limit": limit, "rule": "at least", "status": "accepted_failure",
                "waiver": {"owner": owner, "date": day, "reason": why, "observed": observed, "limit": limit}, "source": "p5-smoke.json, p5-smoke-log.txt"}

    return [row("Galton board in Chromium: beads binned of 240 (smoke test)", binned[0], 225),
            row("Galton board in WebKit: beads binned of 240 (smoke test)", binned[1], 225),
            row("music box in WebKit: pegs sounded in the worse of two full turns (smoke test, 18 pegs)", min(int(turns.group(3)), int(turns.group(4))), 18)]


def takeover() -> dict:
    off, leaks = [], []
    for b in ("chromium", "firefox", "webkit"):
        d = load(f"p1-enabled-probe-{b}.json")["result"]
        quiet = (d["B_disabledAtLoad"]["positionEvents"] == 0 and d["F_disabledMidFlight"]["newEvents"] == 0
                 and d["G_disabledBeforeReplaceWorld"]["atCreate"] == d["G_disabledBeforeReplaceWorld"]["after120"])
        if quiet:
            off.append(b)
        leaks.append((b, round(d["B_disabledAtLoad"]["atLoad"][1] - 0.32, 6)))
    return {"replaces": "X_ITE 16.7 RigidBodyPhysics engine (Bullet)", "applies_to": ["chromium", "firefox", "webkit"], "engine_off_hosts": off,
            "leaks": [{"what": "loadURL() resolves after Bullet has already stepped once (y 0.32 -> " + ", ".join(f"{0.32 + dy:.6f} {b}" for b, dy in leaks) + ")",
                       "handled": True, "how": "the bridge loads with createX3DFromURL, disables the collection, then replaceWorld: y stays 0.32 for 120 frames in all three browsers"}],
            "source": "p1-enabled-probe-{chromium,firefox,webkit}.json; SPEC.md section 2"}


def losses() -> dict:
    text = (EV / "PHASE-2.md").read_text(encoding="utf-8")
    m = re.search(r"lists all (\d+) authored fields PhysX cannot honour", text)
    if not m:
        raise SystemExit("PHASE-2.md no longer states the loss-report count")
    return {"authored_fields_dropped": int(m.group(1)), "reported": True, "source": "PHASE-2.md item 9; scenes/experiments/ode-only-fields.x3d"}


def record(which: str, with_tolerances: bool) -> dict:
    run = load(f"p4-run-{which}.json")
    det = load(f"p4-determinism-{which}.json")
    hashes = run["hashes"]
    steps = det["recorded"]["steps"]
    if len(hashes) != steps:
        raise SystemExit(f"{which}: {len(hashes)} hashes for {steps} recorded steps")
    refs, controls = references()
    rec = {
        "schema": "loom.physics-run/1",
        "id": f"physx-bridge/grand-cascade/recorded-in-{which}",
        "engine": {"name": "PhysX", "version": run["physx"], "build": "physx-js-webidl 2.9.1 (WASM)"},
        "project": {"name": "x3d.physics/physx-bridge", "commit": BRIDGE_COMMIT, "contract": run["model"].get("contract")},
        "model": {"sha256": canon_sha256(run["model"]), "what": "the x3d-physx/0.1 model embedded in the run file, hashed as canonical JSON (the .x3d it was read from is not stored byte for byte)",
                  "source": run["source"]},
        "recorded": {"host": which, "host_version": det["recorded"]["version"], "steps": steps, "fixed_step_s": run["fixedStep"],
                     "batches": det["recorded"]["batches"], "teleports": det["recorded"]["teleports"],
                     "hashes": hashes, "trace_sha256": trace_sha256(hashes)},
        "replays": replays_of(det),
        "required_hosts": HOSTS,
        "references": refs,
        "tolerances": smoke_tolerances() if with_tolerances else [],
        "controls": controls,
        "takeover": takeover(),
        "losses": losses(),
        "sources": {"trace": f"p4-run-{which}.json", "replays": f"p4-determinism-{which}.json", "references": "p1-analytic.json (Node, one engine build; applies to every run on PhysX " + run["physx"] + ")",
                    "tolerances": "p5-smoke.json" if with_tolerances else "carried by the first record only",
                    "takeover": "p1-enabled-probe-*.json", "losses": "PHASE-2.md"},
        "not_shown": ["across machines (every host here ran on one Mac)", "the ragdoll (hash list not persisted)", "a real GPU (the physics does not use one; the picture does)"],
    }
    return rec


def main() -> int:
    OUT.mkdir(exist_ok=True)
    for which, tol in (("chromium", True), ("firefox", False)):
        rec = record(which, tol)
        path = OUT / f"physx-grand-cascade-{which}.physics.json"
        path.write_text(json.dumps(rec, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(path.relative_to(ROOT.parent), rec["recorded"]["steps"], "steps,", len(rec["replays"]), "replays,", len(rec["tolerances"]), "tolerances")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
