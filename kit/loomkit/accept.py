"""Acceptance: a closed set of current-candidate witnesses, decided by a named profile, never by a score.

Algorithm (Loomsong technical debrief section 14, tightened by Cinematic v2-v4 and the IFC studio):
freeze the candidate, resolve the profile's required set, require one well-formed record per required
witness bound to this exact candidate, check its status, grade, coverage and evidence hashes, and only
then let a receipt be written. Missing, stale, failed, errored, development or ungraded records reject.
"""
from __future__ import annotations

import json
from pathlib import Path

from .core import WITNESS_SCHEMA, GateError, candidate, need, sha256_file

PROFILE_SCHEMA = "loom.profile/1"


def load_profile(path: Path | str) -> dict:
    profile = json.loads(Path(path).read_text())
    need(profile.get("schema") == PROFILE_SCHEMA, "PROFILE_SCHEMA", str(path))
    need(isinstance(profile.get("required"), list) and profile["required"], "EMPTY_PROFILE", str(path))
    names = [r.get("witness") for r in profile["required"]]
    need(all(isinstance(n, str) and n for n in names), "PROFILE_WITNESS_NAME")
    need(len(names) == len(set(names)), "PROFILE_DUPLICATE_WITNESS")
    return profile


def status_acceptable(rule: dict, record: dict) -> None:
    """Decide whether a required witness's status lets the release through.

    Policy chosen for v1 (see LOOM-v1.md, "Status and grade"):
    - `pass` is the only status that satisfies a required witness by default;
    - `deferred` and `not_applicable` satisfy it only when the profile names that status in the rule's
      `allow` list AND the record carries a reason, so a scope decision is always written down;
    - `fail`, `error` and `not_run` never satisfy a required witness. An instrument crash is not a pass,
      and it is not a "caught defect" either.
    """
    status = record.get("status")
    if status == "pass":
        return
    allowed = set(rule.get("allow", []))
    need(status in ("deferred", "not_applicable") and status in allowed, "WITNESS_NOT_PASS",
         f"{record.get('witness')}: {status}")
    need(bool(record.get("reason")), "STATUS_NEEDS_REASON", f"{record.get('witness')}: {status}")


def record_origin(record: dict) -> str:
    """Origin of a record. Records written before 18 Nov 2026 carry none: a hand-written one says so in its instrument."""
    if "origin" in record:
        return record["origin"]
    return "declared" if record.get("instrument", {}).get("tool") == "declared" else "executed"


def coverage_ok(rule_name: str, key: str, expected, record: dict) -> None:
    """Coverage terms a profile can require.

    - `rules_include: [ids]` the witness ran at least these rule ids (instrument.rules is a superset). Trap rule sets
      only grow, so a profile written against 11 rules still binds those 11 after the tool grows to 15, and fails
      loudly if one of them is renamed or removed (review 18 Nov 2026, defect 4: equality on a bare count broke every
      shipped profile the day the tool gained a rule).
    - `{"min": n}` the recorded number is at least n.
    - anything else: exact equality (the original rule).
    """
    cov = record.get("coverage", {})
    if key == "rules_include":
        ran = set(record.get("instrument", {}).get("rules", []))
        missing = sorted(set(expected) - ran)
        need(not missing, "COVERAGE_REQUIRED", f"{rule_name}.rules_include: did not run {missing}")
    elif isinstance(expected, dict) and set(expected) == {"min"}:
        got = cov.get(key)
        need(isinstance(got, (int, float)) and not isinstance(got, bool) and got >= expected["min"],
             "COVERAGE_REQUIRED", f"{rule_name}.{key}: {got} < {expected['min']}")
    else:
        need(cov.get(key) == expected, "COVERAGE_REQUIRED", f"{rule_name}.{key}")


def origin_ok(rule: dict, record: dict) -> None:
    """A pass satisfies a required witness only if it was executed, or the rule names its origin (`origins`), and
    only from the instruments the rule names (`instrument`, a tool name or list), when it names any."""
    name = rule["witness"]
    origin = record_origin(record)
    if record.get("status") == "pass":
        need(origin in rule.get("origins", ["executed"]), "DECLARED_NOT_MEASURED",
             f"{name}: a {origin} pass cannot satisfy a measured witness")
    want = rule.get("instrument")
    if want is not None:
        want = [want] if isinstance(want, str) else list(want)
        need(record.get("instrument", {}).get("tool") in want, "WRONG_INSTRUMENT",
             f"{name}: {record.get('instrument', {}).get('tool')} not in {want}")


def accept(candidate_root: Path | str, evidence_dir: Path | str, profile: dict) -> dict:
    """Return an acceptance summary or raise GateError with a stable code."""
    subject = candidate(candidate_root)
    evidence_dir = Path(evidence_dir)
    rows = []
    for rule in profile["required"]:
        name = rule["witness"]
        path = evidence_dir / f"{name}.json"
        need(path.is_file(), "MISSING_WITNESS", name)
        try:
            record = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            raise GateError("MALFORMED_WITNESS", f"{name}: {e}") from None
        need(record.get("schema") == WITNESS_SCHEMA, "WITNESS_SCHEMA", name)
        need(record.get("witness") == name, "WRONG_WITNESS_NAME", name)
        need(record.get("subject_sha256") == subject["sha256"], "STALE_WITNESS", name)
        need(record.get("development") is False, "DEVELOPMENT_WITNESS", name)
        status_acceptable(rule, record)
        origin_ok(rule, record)
        if record.get("status") == "pass":
            need(record.get("grade") == "C" or (record_origin(record) != "executed" and record_origin(record) in rule.get("origins", [])),
                 "UNMEASURED_REQUIRED_WITNESS", f"{name}: grade {record.get('grade')}")
        for key, expected in rule.get("coverage", {}).items():
            coverage_ok(name, key, expected, record)
        for item in record.get("evidence", []):
            p = evidence_dir / item["path"]
            need(p.is_file() and sha256_file(p) == item["sha256"], "EVIDENCE_DRIFT", f"{name}: {item['path']}")
        rows.append({"witness": name, "status": record["status"], "grade": record["grade"], "origin": record_origin(record),
                     "record_sha256": sha256_file(path)})
    return {"status": "accepted", "profile": profile["name"], "subject_sha256": subject["sha256"],
            "witnesses": rows, "visible_not_run": profile.get("visible_not_run", [])}
