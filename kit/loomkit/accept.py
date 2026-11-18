"""Acceptance: a closed set of current-candidate witnesses, decided by a named profile, never by a score.

Algorithm (Loomsong technical debrief section 14, tightened by Cinematic v2-v4 and the IFC studio):
freeze the candidate, resolve the profile's required set, require one well-formed record per required
witness bound to this exact candidate, check its status, grade, coverage and evidence hashes, and only
then let a receipt be written. Missing, stale, failed, errored, development or ungraded records reject.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .core import ORIGINS, WITNESS_SCHEMA, GateError, candidate, need, sha256_file

PROFILE_SCHEMA = "loom.profile/1"


def load_profile(path: Path | str) -> dict:
    return parse_profile(Path(path).read_bytes(), str(path))


def read_profile(path: Path | str) -> tuple[dict, str]:
    """Read the profile file ONCE and return (profile, sha256 of exactly those bytes). Fourth review, 18 Nov 2026,
    defect 1: the receipt parsed the file, then hashed it with a second read, so a file replaced in between was
    evaluated as A and attested as B."""
    import hashlib
    data = Path(path).read_bytes()
    return parse_profile(data, str(path)), hashlib.sha256(data).hexdigest()


def parse_profile(data: bytes, label: str = "profile") -> dict:
    try:
        profile = json.loads(data.decode("utf-8"), parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))
    except (UnicodeDecodeError, ValueError) as e:
        raise GateError("PROFILE_SCHEMA", f"{label}: not strict JSON: {e}") from None
    need(isinstance(profile, dict) and profile.get("schema") == PROFILE_SCHEMA, "PROFILE_SCHEMA", label)
    need(isinstance(profile.get("name"), str) and profile["name"], "PROFILE_SCHEMA", f"{label}: name must be a non-empty string")
    need(isinstance(profile.get("visible_not_run", []), list) and all(isinstance(v, str) and v for v in profile.get("visible_not_run", [])),
         "PROFILE_SCHEMA", f"{label}: visible_not_run must be a list of witness names")
    need(isinstance(profile.get("required"), list) and profile["required"], "EMPTY_PROFILE", label)
    names = [r.get("witness") for r in profile["required"]]
    need(all(isinstance(n, str) and n for n in names), "PROFILE_WITNESS_NAME")
    need(len(names) == len(set(names)), "PROFILE_DUPLICATE_WITNESS")
    for r in profile["required"]:
        need(isinstance(r.get("coverage", {}), dict) and isinstance(r.get("allow", []), list), "PROFILE_SCHEMA", f"{r['witness']}: coverage must be an object, allow a list")
        # a string here would be matched by substring ("declared" in "undeclared"): review round 2, 18 Nov 2026
        if "origins" in r:
            need(isinstance(r["origins"], list) and all(o in ORIGINS for o in r["origins"]), "PROFILE_ORIGINS",
                 f"{r['witness']}: origins must be a list drawn from {list(ORIGINS)}")
        if "instrument" in r:
            need(isinstance(r["instrument"], str) or (isinstance(r["instrument"], list) and all(isinstance(x, str) for x in r["instrument"])),
                 "PROFILE_INSTRUMENT", r["witness"])
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
        # the key must be PRESENT: an absent key read as None used to satisfy an expected null (fourth review)
        need(key in cov and cov[key] == expected, "COVERAGE_REQUIRED", f"{rule_name}.{key}" + ("" if key in cov else " not recorded"))


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


def binding_problem(record, name: str, subject_sha256: str, evidence_dir: Path) -> str:
    """Why a record cannot speak for this candidate, or "" if it can. Used for OPTIONAL (visible) witnesses too, so a
    pass recorded for candidate A is not shown as a pass on candidate B (fourth review, 18 Nov 2026, defect 4)."""
    if not isinstance(record, dict) or record.get("schema") != WITNESS_SCHEMA or record.get("witness") != name:
        return "not a loom.witness/1 record for this witness"
    if record.get("subject_sha256") != subject_sha256:
        return f"recorded for candidate {str(record.get('subject_sha256'))[:12]}, not {subject_sha256[:12]}"
    if record.get("development") is not False:
        return "development record"
    for item in record.get("evidence", []):
        p = Path(evidence_dir) / item.get("path", "")
        if not (p.is_file() and sha256_file(p) == item.get("sha256")):
            return f"evidence {item.get('path')} changed or missing"
    return ""


def accept(candidate_root: Path | str, evidence_dir: Path | str, profile: dict) -> dict:
    """Return an acceptance summary or raise GateError with a stable code."""
    subject = candidate(candidate_root)
    evidence_dir = Path(evidence_dir)
    rows = []
    for rule in profile["required"]:
        name = rule["witness"]
        path = evidence_dir / f"{name}.json"
        need(path.is_file(), "MISSING_WITNESS", name)
        raw = path.read_bytes()   # read once: the bytes parsed are the bytes hashed into the summary
        try:
            record = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
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
                     "record_sha256": hashlib.sha256(raw).hexdigest()})
    return {"status": "accepted", "profile": profile["name"], "subject_sha256": subject["sha256"],
            "witnesses": rows, "visible_not_run": profile.get("visible_not_run", [])}
