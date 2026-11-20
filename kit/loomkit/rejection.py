"""Loom Rejection v1: the record of a candidate that was NOT accepted.

A receipt is written only after acceptance, so a folder of receipts holds no failure (20 Nov 2026 review: 25 receipts,
123 witness entries, 123 pass). A rule miner fed only receipts sees survivors. This record keeps the refusal:

  * every required witness is judged, not only the first that refuses (`accept` stops at the first);
  * each refusal carries `failure_class` (the stable GateError code), the witness's own status and reason, the
    instrument that spoke, and a `locus` when the witness recorded one (file, place, rule);
  * it names the candidate by the same digest a receipt would, so a later receipt for a fixed candidate can be set
    beside it (`prev` links rejection to rejection; a receipt never points at a rejection).

Unsigned, like the receipt: it shows drift, it does not authenticate authorship. It is refused for a candidate that
would be accepted, and it never overwrites.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import accept as acc
from .core import GateError, canonical, candidate, need, sha256_bytes, sha256_file, utc_now

REJECTION_SCHEMA = "loom.rejection/1"
LOCUS_CAP = 20


def _locus(record: dict) -> list[dict] | None:
    """Where the witness says the fault is. Read from `measurements.hits` ({file: [{rule, severity, where, detail}]}, the
    shape traps and pagetraps write). Other witnesses record no place yet: None, never a guess."""
    hits = (record.get("measurements") or {}).get("hits")
    if not isinstance(hits, dict):
        return None
    out = [{"file": f, "rule": h.get("rule"), "where": h.get("where"), "severity": h.get("severity"), "detail": str(h.get("detail", ""))[:200]}
           for f in sorted(hits) for h in hits[f] if isinstance(h, dict) and h.get("severity") == "error"]
    return out[:LOCUS_CAP] or None


def build(subject: str, candidate_root: Path | str, evidence_dir: Path | str, profile: dict, profile_sha256: str,
          prev: Path | None = None) -> dict:
    cand = candidate(candidate_root)
    evidence_dir = Path(evidence_dir)
    rows = []
    for rule in profile["required"]:
        name = rule["witness"]
        try:
            rows.append({**acc.judge(rule, cand, evidence_dir), "verdict": "accepted"})
            continue
        except GateError as e:
            code, detail = e.code, e.detail
        record, path = {}, evidence_dir / f"{name}.json"
        try:
            record = json.loads(path.read_text())
            record = record if isinstance(record, dict) else {}
        except (OSError, ValueError):
            pass
        instrument = record.get("instrument") if isinstance(record.get("instrument"), dict) else {}
        rows.append({"witness": name, "verdict": "refused", "failure_class": code, "detail": detail,
                     "status": record.get("status"), "grade": record.get("grade"), "reason": record.get("reason") or None,
                     "instrument": {k: instrument[k] for k in ("tool", "commit", "rules_sha256") if k in instrument},
                     "locus": _locus(record),
                     "record_sha256": sha256_file(path) if path.is_file() else None})
    refused = [r for r in rows if r["verdict"] == "refused"]
    need(refused, "REJECTION_OF_ACCEPTED", "every required witness is acceptable: write a receipt, not a rejection")
    r = {
        "schema": REJECTION_SCHEMA,
        "kind": "artifact",
        "subject": subject,
        "candidate_sha256": cand["sha256"],
        "candidate_files": len(cand["files"]),
        "profile": profile["name"],
        "inputs": {"candidate_sha256": cand["sha256"], "profile_sha256": profile_sha256},
        "witnesses": rows,
        "refused": len(refused),
        "failure_classes": sorted({x["failure_class"] for x in refused}),
        "written_at": utc_now(),
        "prev": sha256_file(prev) if prev else None,
        "signed": False,
    }
    r["sha256"] = sha256_bytes(canonical(r))
    return r


def write(rejection: dict, dest: Path) -> Path:
    """Never overwrite (law 14). A rejection beside the evidence it describes is fine; inside it is not checked here."""
    dest = Path(dest)
    need(not dest.exists(), "REJECTION_EXISTS", f"{dest} exists; write a new file name")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(rejection, sort_keys=True, indent=2) + "\n")
    return dest


def verify(dest: Path) -> dict:
    r = json.loads(Path(dest).read_text())
    need(r.get("schema") == REJECTION_SCHEMA, "REJECTION_SCHEMA")
    body = {k: v for k, v in r.items() if k != "sha256"}
    need(sha256_bytes(canonical(body)) == r.get("sha256"), "REJECTION_DRIFT")
    return r
