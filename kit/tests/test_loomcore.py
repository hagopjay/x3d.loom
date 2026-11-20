"""loom-core controls (standard library only): the normalizer says no where it should, and the committed files hold.

    python3 -I kit/tests/test_loomcore.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT / "loomcore"))
import normalize as n  # noqa: E402

NORM = KIT / "loomcore" / "normalized"
rows = []


def refused(label, code, fn):
    try:
        fn()
    except SystemExit as e:
        if code not in str(e):
            raise RuntimeError(f"WRONG_DIAGNOSTIC {label}: {e}") from None
        rows.append({"case": label, "caught": code})
        return
    raise RuntimeError(f"SURVIVING_CONTROL {label}")


with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "c.jsonld"
    claim = {"@id": "urn:t:c1", "@type": "x3d:MappingClaim", "x3d:grade": {"@id": "urn:x3d:grade:L"}, "x3d:source": "s",
             "x3d:term": {"@id": "https://example.org/page.html (element x)"}}
    f.write_text(json.dumps({"@graph": [claim]}))
    doc, rep = n.normalize("mathlab", f, None)
    c = doc["@graph"][0]
    assert c["grade"] == "L" and c["verdict"] == "supported" and c["gradeNative"] == "urn:x3d:grade:L"
    assert c["sha256"] == hashlib.sha256(n.canonical(claim)).hexdigest()
    assert c["derivedFrom"] == ["https://example.org/page.html"] and c["locator"] == ["(element x)"]
    assert rep["id_repairs"] == {"space": 1, "relative": 0} and rep["repairs"][0]["was"].endswith("(element x)")
    rows.append({"case": "a space in an @id is split into IRI + locator and recorded", "result": "1 repair"})

    f.write_text(json.dumps({"@graph": [{**claim, "x3d:grade": {"@id": "urn:x3d:grade:A+"}}]}))
    refused("a grade on no known scale stops the run", "UNKNOWN_GRADE", lambda: n.normalize("mathlab", f, None))
    f.write_text(json.dumps({"@graph": [{**claim, "@id": "no scheme here"}]}))
    refused("an id that is not an IRI, in a dialect with no base", "NOT_AN_IRI", lambda: n.normalize("mathlab", f, None))
    f.write_text(json.dumps({"@graph": [claim, claim]}))
    refused("two claims with one id", "DUPLICATE_ID", lambda: n.normalize("mathlab", f, None))
    f.write_text(json.dumps({"claims": [{"id": "a", "number": "False", "design": "Coincidence", "wonder": "w", "source": "s"},
                                        {"id": "b", "number": "Untested", "design": "Unknown", "wonder": "w", "source": "s"}]}))
    doc, rep = n.normalize("giza-atlas", f, None)
    assert [c["verdict"] for c in doc["@graph"]] == ["refuted", "untested"] and all("grade" not in c for c in doc["@graph"])
    assert doc["@graph"][0]["gradeNative"] == {"grade": "False", "design": "Coincidence"}
    rows.append({"case": "False is a refuted claim and Untested is untested: neither is forced onto C/L/S", "result": "no grade written"})

# the committed normalized files
report = json.loads((NORM / "REPORT.json").read_text())
seen, total = set(), 0
for rep in report["files"]:
    j = json.loads((NORM / f"{rep['dialect']}.claims.jsonld").read_text())
    assert len(j["@graph"]) == rep["claims"] and re.fullmatch(r"[0-9a-f]{64}", j["normalizedFrom"]["sha256"])
    for c in j["@graph"]:
        total += 1
        assert n.IRI.match(c["@id"]) and c["@id"] not in seen, c["@id"]
        seen.add(c["@id"])
        assert re.fullmatch(r"[0-9a-f]{64}", c["sha256"]) and c["verdict"] in ("supported", "refuted", "untested")
        assert c.get("grade") in ("C", "L", "S") or c["verdict"] != "supported", c["@id"]
        assert any(k in c for k in ("source", "instrument", "part", "derivedFrom")), c["@id"]
assert total == report["totals"]["claims"] == 369 and report["totals"]["id_repairs"] == 19
rows.append({"case": "committed normalized claims: unique IRI ids, a hash, a verdict, a grade or a reason for none, a source", "result": f"{total} of {total}"})
print(json.dumps({"schema": "loomcore.self-test/1", "controls": rows}, indent=1))
print(f"loom-core: {len(rows)} controls hold; {total} claims in {len(report['files'])} dialects")
