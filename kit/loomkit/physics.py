"""Physics witness: does a simulation run carry its own proof, and is every excursion on the record?

New on 13 Nov 2026, from two physics bridges built under the Loom: X3D <-> PhysX 5 (the Marble Machine and an
H-Anim ragdoll) and X3D <-> MuJoCo. A physics claim is not a scene claim: grammar, meaning and traps read a
file, and none of them can tell an engine that drifts from one that does not. The play witness (6 Nov, platformer)
already binds a tape to level bytes and an engine and compares a final state hash on one JavaScript engine. This
witness adds what a stepped physical simulation needs:

  * a hash of EVERY step's state, not only the last, compared across every host the project names (Chromium,
    Firefox, WebKit, Node), so the first step that differs is known;
  * exact references (a closed form or the scheme's own discrete solution) with limits declared before the run;
  * the takeover proof (law 41): when page code replaces a runtime's engine, the old engine is shown off in every
    host and its leaks are listed;
  * tolerances and waivers (law 43): a limit may not be widened after the fact, and an owner's accepted failure is
    a recorded waiver that the profile caps, never a pass.

Input is one JSON record per run, `loom.physics-run/1` (see PHYSICS-PLAYBOOK.md section 4 for the fields). Each
contract has a stable code (law 19), checked in this order; the first broken one stops the check:

  PHYS_SCHEMA               not a loom.physics-run/1 record, or a required field is missing or malformed
  PHYS_NO_RUNS              nothing to judge (a pass over nothing is not a pass, law 36)
  PHYS_MODEL_STALE          the model file's sha256 is not the one the run was recorded on (law 17)
  PHYS_TRACE_TAMPERED       the recorded per-step hashes do not hash to the trace_sha256 the record states
  PHYS_REPLAY_MISSING       a required host has no replay (cross-engine determinism is claimed per host, law 42)
  PHYS_REPLAY_STEPS         a replay ran a different number of steps than the recording
  PHYS_ENGINE_DRIFT         a replay used another engine version than the recording
  PHYS_HASH_DRIFT           a replay's state hash differs from the recording at some step (first step reported)
  PHYS_NO_REFERENCE         no exact reference at all (a physics run must answer to an exact answer, law 19)
  PHYS_LIMIT_WIDENED        a limit is looser than the one declared before the run (law 28, law 43)
  PHYS_FALSE_GREEN          a reference or tolerance marked pass whose own numbers fail it
  PHYS_REFERENCE_FAIL       a reference misses its limit
  PHYS_TOLERANCE_FAIL       a tolerance is exceeded and no waiver covers it
  PHYS_WAIVER_INCOMPLETE    a waiver lacks its owner, date, reason, observed value or limit
  PHYS_WAIVERS_OVER_CAP     more waivers than the profile allows (default none)
  PHYS_CONTROL_SURVIVED     a negative control did not fail (a control that cannot fail proves nothing, law 19)
  PHYS_TAKEOVER_UNPROVEN    the old engine is not shown off on every host that runs it (`applies_to`, default every required
                            host), or a leak is unlisted (law 41)
  PHYS_LOSS_UNREPORTED      authored fields the engine cannot honour were dropped without a loss report (law 40)

Standard library only; every gate raises (no assert), so it holds under python -O (law 18). A record that cannot
be read at all is an instrument error (exit 2), never a fail.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .core import GateError, InstrumentError, need

SCHEMA = "loom.physics-run/1"
WAIVER_FIELDS = ("owner", "date", "reason", "observed", "limit")


def trace_sha256(hashes: list) -> str:
    """The canonical digest of a per-step hash list: the decimal values joined by commas."""
    return hashlib.sha256(",".join(str(h) for h in hashes).encode()).hexdigest()


def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float("inf")


def _holds(item: dict) -> bool:
    return item["observed"] <= item["limit"] if item.get("rule", "at most") == "at most" else item["observed"] >= item["limit"]


def load(path: Path) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise InstrumentError(f"cannot read the physics run record {Path(path).name}: {e}") from None


def check_run(run: dict, root: Path | None = None, required_hosts: list[str] | None = None,
              max_waivers: int = 0, require_takeover: bool = False) -> dict:
    """Judge one run record; raise GateError on the first broken contract, else return its measurements."""
    need(isinstance(run, dict) and run.get("schema") == SCHEMA, "PHYS_SCHEMA", f"schema {run.get('schema')!r}" if isinstance(run, dict) else "not an object")
    rid = run.get("id")
    for key in ("id", "engine", "model", "recorded", "replays"):
        need(key in run, "PHYS_SCHEMA", f"{rid}: missing {key}")
    need(isinstance(run["replays"], list) and isinstance(run["engine"], dict) and run["engine"].get("version"), "PHYS_SCHEMA", f"{rid}: engine.version or replays malformed")
    rec = run["recorded"]
    need(isinstance(rec, dict) and isinstance(rec.get("steps"), int) and rec["steps"] > 0 and rec.get("trace_sha256") and rec.get("host"),
         "PHYS_SCHEMA", f"{rid}: recorded needs host, steps and trace_sha256")

    # 1. the model the run was recorded on is the model on disk (law 17)
    model = run["model"]
    need(isinstance(model, dict) and model.get("sha256"), "PHYS_SCHEMA", f"{rid}: model.sha256")
    if root is not None and model.get("path"):
        p = Path(root) / model["path"]
        need(p.is_file(), "PHYS_MODEL_STALE", f"{rid}: {model['path']} is missing")
        now = hashlib.sha256(p.read_bytes()).hexdigest()
        need(now == model["sha256"], "PHYS_MODEL_STALE", f"{rid}: recorded on {model['sha256'][:12]}, {model['path']} is now {now[:12]}")

    # 2. the recorded trace is what it says it is
    if "hashes" in rec:
        need(trace_sha256(rec["hashes"]) == rec["trace_sha256"], "PHYS_TRACE_TAMPERED", f"{rid}: the {len(rec['hashes'])} step hashes do not hash to the stated trace")
        need(len(rec["hashes"]) == rec["steps"], "PHYS_TRACE_TAMPERED", f"{rid}: {len(rec['hashes'])} hashes for {rec['steps']} steps")

    # 3. every required host replayed the whole run to the same state at every step (law 42)
    hosts = required_hosts if required_hosts is not None else run.get("required_hosts", [])
    need(hosts or run["replays"], "PHYS_NO_RUNS", f"{rid}: no replay and no required host")
    by_host = {r.get("host"): r for r in run["replays"] if isinstance(r, dict)}
    for h in hosts:
        need(h in by_host, "PHYS_REPLAY_MISSING", f"{rid}: no replay in {h}")
    for host, r in by_host.items():
        need(r.get("steps") == rec["steps"], "PHYS_REPLAY_STEPS", f"{rid}: {host} ran {r.get('steps')} steps, recorded {rec['steps']}")
        if r.get("engine_version") is not None:
            need(r["engine_version"] == run["engine"]["version"], "PHYS_ENGINE_DRIFT", f"{rid}: {host} ran {r['engine_version']}, recorded {run['engine']['version']}")
        mism = r.get("mismatches")
        need(isinstance(mism, int) and mism >= 0, "PHYS_SCHEMA", f"{rid}: {host} replay needs integer mismatches")
        need(mism == 0 and r.get("trace_sha256", rec["trace_sha256"]) == rec["trace_sha256"], "PHYS_HASH_DRIFT",
             f"{rid}: {host} differs from the recording at {mism} steps, first at step {r.get('first_mismatch')}")

    # 4. exact references, limits declared before the run
    refs = run.get("references") or []
    need(refs, "PHYS_NO_REFERENCE", f"{rid}: a physics run needs at least one exact reference")
    for it in refs + (run.get("tolerances") or []):
        need(isinstance(it, dict) and it.get("id") and _num(it.get("observed")) and _num(it.get("limit")), "PHYS_SCHEMA", f"{rid}: reference or tolerance {it.get('id') if isinstance(it, dict) else it!r} needs id, observed, limit")
        if it.get("declared_limit") is not None:
            loose = (it["limit"] > it["declared_limit"]) if it.get("rule", "at most") == "at most" else (it["limit"] < it["declared_limit"])
            need(not loose, "PHYS_LIMIT_WIDENED", f"{rid}: {it['id']} limit {it['limit']} is looser than the declared {it['declared_limit']}")
    for it in refs:
        need(not (it.get("status") == "pass" and not _holds(it)), "PHYS_FALSE_GREEN", f"{rid}: {it['id']} is marked pass at {it['observed']} against {it['limit']}")
        need(_holds(it), "PHYS_REFERENCE_FAIL", f"{rid}: {it['id']} {it['observed']} against {it['limit']}")

    # 5. tolerances and waivers (law 43)
    waived = []
    for it in run.get("tolerances") or []:
        ok = _holds(it)
        need(not (it.get("status") == "pass" and not ok), "PHYS_FALSE_GREEN", f"{rid}: {it['id']} is marked pass at {it['observed']} against {it['limit']}")
        if ok:
            continue
        w = it.get("waiver")
        need(isinstance(w, dict) and it.get("status") == "accepted_failure", "PHYS_TOLERANCE_FAIL", f"{rid}: {it['id']} {it['observed']} exceeds {it['limit']} and no waiver covers it")
        missing = [f for f in WAIVER_FIELDS if not w.get(f)]
        need(not missing, "PHYS_WAIVER_INCOMPLETE", f"{rid}: waiver for {it['id']} lacks {missing}")
        need(w["observed"] == it["observed"] and w["limit"] == it["limit"], "PHYS_WAIVER_INCOMPLETE", f"{rid}: waiver for {it['id']} states other numbers than the measurement")
        waived.append({"id": it["id"], "observed": it["observed"], "limit": it["limit"], "owner": w["owner"], "reason": w["reason"]})
    need(len(waived) <= max_waivers, "PHYS_WAIVERS_OVER_CAP", f"{rid}: {len(waived)} waivers, the profile allows {max_waivers}")

    # 6. negative controls must fail
    for c in run.get("controls") or []:
        need(c.get("expect") == "fail" and c.get("observed_failed") is True, "PHYS_CONTROL_SURVIVED", f"{rid}: control {c.get('id')} did not fail")

    # 7. the takeover proof (law 41)
    tk = run.get("takeover")
    if require_takeover or tk is not None:
        need(isinstance(tk, dict) and tk.get("replaces"), "PHYS_TAKEOVER_UNPROVEN", f"{rid}: no takeover record naming what was replaced")
        off = set(tk.get("engine_off_hosts") or [])
        # the old engine only exists in a host that runs the page's own runtime (a browser, not Node): applies_to narrows
        # the proof to those hosts, and every one of them must be a required host with the engine shown off
        scope = set(tk.get("applies_to") or hosts)
        need(scope and scope <= set(hosts), "PHYS_TAKEOVER_UNPROVEN", f"{rid}: takeover applies_to {sorted(scope)} is not a subset of the required hosts {sorted(hosts)}")
        need(scope <= off, "PHYS_TAKEOVER_UNPROVEN", f"{rid}: the old engine is shown off in {sorted(off)}, not in all of {sorted(scope)}")
        for leak in tk.get("leaks") or []:
            need(leak.get("what") and leak.get("handled") in (True, False), "PHYS_TAKEOVER_UNPROVEN", f"{rid}: a leak is listed without saying what it is or whether it is handled")

    # 8. what the engine cannot honour is reported (law 40)
    lo = run.get("losses")
    if lo is not None:
        need(lo.get("reported") is True or not lo.get("authored_fields_dropped"), "PHYS_LOSS_UNREPORTED", f"{rid}: {lo.get('authored_fields_dropped')} authored fields dropped without a loss report")

    return {"id": rid, "engine": f"{run['engine'].get('name')} {run['engine']['version']}", "steps": rec["steps"], "recorded_in": rec["host"],
            "trace_sha256": rec["trace_sha256"], "replayed_in": sorted(by_host), "required_hosts": sorted(hosts),
            "references": [{"id": r["id"], "observed": r["observed"], "limit": r["limit"]} for r in refs],
            "tolerances": len(run.get("tolerances") or []), "waivers": waived, "controls": len(run.get("controls") or []),
            "takeover": bool(tk), "leaks": len((tk or {}).get("leaks") or [])}


def check(paths: list[Path], root: Path | None = None, **kw) -> dict:
    need(paths, "PHYS_NO_RUNS", "no run record matched")
    rows = {}
    for p in paths:
        rows[p.name] = check_run(load(p), root, **kw)
    return {"runs": rows, "waivers": sum(len(r["waivers"]) for r in rows.values())}
