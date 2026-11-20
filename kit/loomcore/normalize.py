#!/usr/bin/env python3
"""loom-core: read the claim files the demos write in their own dialects and emit ONE shape.

Why (review of 20 Nov 2026): four grade predicates and three grade scales across demos, 0 of 144 claims with a hash,
20 `@id` values holding a space and 9 relative ones. A query over "every Likely claim" could not be written.

    python3 -I kit/loomcore/normalize.py <dialect>=<file> [...] --out DIR [--commit SHA]   write DIR/<dialect>.claims.jsonld + REPORT.json
    python3 -I kit/loomcore/normalize.py --check DIR                                       re-verify hashes, ids and the SHACL shapes

One claim out:
  @id         an absolute IRI with no space (repairs are listed in REPORT.json, never silent)
  grade       C | L | S, the strength of the evidence. A native value that is not on that scale is NOT forced onto it.
  verdict     supported | refuted | untested. "False" in the Giza atlas is a refuted claim, not a fourth grade.
  gradeNative the value exactly as the demo wrote it
  sha256      of the claim object as found in the source file, canonical JSON (sorted keys, no spaces, UTF-8)
  source / instrument / derivedFrom / part   whichever the dialect carries

The source files are not changed. A dialect is a small table below; an unknown grade value stops the run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRADE = {"C": "C", "L": "L", "S": "S", "Confirmed": "C", "Likely": "L", "Suspected": "S",
         "urn:x3d:grade:C": "C", "urn:x3d:grade:L": "L", "urn:x3d:grade:S": "S"}
VERDICT = {"False": "refuted", "Untested": "untested"}
IRI = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>\"{}|\\^`]+$")


def canonical(v) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _id(v):
    return v.get("@id") if isinstance(v, dict) else v


def _ids(v):
    return [_id(x) for x in (v if isinstance(v, list) else [v])] if v is not None else []


# dialect -> how to find the claims and where each core field lives. `base` makes a relative id absolute.
DIALECTS = {
    "heritage-crm": {"rows": lambda j: [x for x in j["@graph"] if x.get("@type") == "crm:E13_Attribute_Assignment"],
                     "grade": lambda x: _id(x.get("crm:P2_has_type")), "statement": lambda x: x.get("crm:P141_assigned"),
                     "about": lambda x: _id(x.get("crm:P140_assigned_attribute_to")), "source": lambda x: x.get("dct:source"),
                     "part": lambda x: _ids(x.get("x3d:hasPart"))},
    "medprov": {"rows": lambda j: [x for x in j["@graph"] if x.get("@type") == "prov:Entity"], "base": "urn:x3d:medprov:v7:source:",
                "grade": lambda x: x.get("grade"), "statement": lambda x: x.get("skos:note"), "instrument": lambda x: x.get("instrument"),
                "derivedFrom": lambda x: _ids(x.get("prov:wasDerivedFrom"))},
    "mathlab": {"rows": lambda j: [x for x in j["@graph"] if x.get("@type") in ("x3d:MappingClaim", "x3d:GapClaim")],
                "grade": lambda x: _id(x.get("x3d:grade")), "about": lambda x: _id(x.get("x3d:lesson")), "source": lambda x: x.get("x3d:source"),
                "statement": lambda x: x.get("skos:prefLabel") or x.get("dct:description"), "instrument": lambda x: x.get("prov:wasGeneratedBy"),
                "derivedFrom": lambda x: _ids(x.get("x3d:term"))},
    "gobbler-px": {"rows": lambda j: [x for x in j["@graph"] if x.get("@type") == "px:Statement"], "base": "https://polyxandria.example/kg#",
                   "id": lambda x: x["@id"].replace("px:", "https://polyxandria.example/kg#", 1),
                   "grade": lambda x: x.get("grade"), "statement": lambda x: x.get("name"), "source": lambda x: x.get("prov")},
    "giza-atlas": {"rows": lambda j: j["claims"], "id": lambda x: "urn:x3d:giza-atlas:v4:claim:" + x["id"],
                   "grade": lambda x: x.get("number"), "statement": lambda x: x.get("wonder"), "source": lambda x: x.get("source"),
                   "native_extra": lambda x: {"design": x.get("design")}},
}


def repair(iri: str, base: str, repairs: list, where: str):
    """(iri, locator). A value with a space is split at the first space: the IRI stays, the rest becomes a locator.
    A value with no scheme is put under the dialect's base. Every change is recorded."""
    loc = None
    if " " in iri:
        head, loc = iri.split(" ", 1)
        repairs.append({"where": where, "kind": "space", "was": iri, "now": head, "locator": loc})
        iri = head
    if not IRI.match(iri):
        if not base:
            raise SystemExit(f"NOT_AN_IRI {where}: {iri!r} and the dialect has no base")
        now = base + re.sub(r"[^A-Za-z0-9._~/-]", "_", iri)
        repairs.append({"where": where, "kind": "relative", "was": iri, "now": now})
        iri = now
    return iri, loc


def normalize(dialect: str, path: Path, commit: str | None):
    d = DIALECTS[dialect]
    raw = path.read_bytes()
    rows = d["rows"](json.loads(raw))
    out, repairs, native = [], [], {}
    for i, x in enumerate(rows):
        cid, _ = repair(d["id"](x) if "id" in d else x["@id"], d.get("base", ""), repairs, f"{dialect}[{i}].@id")
        g = d["grade"](x)
        native[str(g)] = native.get(str(g), 0) + 1
        if g not in GRADE and g not in VERDICT:
            raise SystemExit(f"UNKNOWN_GRADE {dialect}[{i}] {cid}: {g!r} is on no known scale; add it to GRADE or VERDICT on purpose")
        c = {"@id": cid, "@type": "Claim", "dialect": dialect, "verdict": VERDICT.get(g, "supported"), "gradeNative": g,
             "sha256": hashlib.sha256(canonical(x)).hexdigest()}
        if g in GRADE:
            c["grade"] = GRADE[g]
        for k in ("statement", "source", "instrument"):
            v = d[k](x) if k in d else None
            if v not in (None, ""):
                c[k] = v
        if "about" in d and d["about"](x):
            c["about"] = repair(d["about"](x), d.get("base", ""), repairs, f"{dialect}[{i}].about")[0]
        for k in ("derivedFrom", "part"):
            vals, locs = [], []
            for v in (d[k](x) if k in d else []):
                iri, loc = repair(v, d.get("base", ""), repairs, f"{dialect}[{i}].{k}")
                vals.append(iri)
                locs += [loc] if loc else []
            if vals:
                c[k] = vals
            if locs:
                c["locator"] = locs
        if "native_extra" in d:
            c["gradeNative"] = {"grade": g, **d["native_extra"](x)}
        out.append(c)
    need(len({c["@id"] for c in out}) == len(out), f"DUPLICATE_ID in {dialect}")
    doc = {"@context": json.loads((HERE / "context.jsonld").read_text())["@context"],
           "normalizedFrom": {"file": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "commit": commit, "dialect": dialect}, "@graph": out}
    return doc, {"dialect": dialect, "file": path.name, "claims": len(out), "native_grades": dict(sorted(native.items())),
                 "grade": {k: sum(c.get("grade") == k for c in out) for k in "CLS"},
                 "verdict": {k: sum(c["verdict"] == k for c in out) for k in ("supported", "refuted", "untested")},
                 "id_repairs": {"space": sum(r["kind"] == "space" for r in repairs), "relative": sum(r["kind"] == "relative" for r in repairs)},
                 "repairs": repairs}


def need(ok, msg):
    if not ok:
        raise SystemExit(msg)


def check(folder: Path) -> dict:
    """Every normalized file: ids are IRIs, hashes are 64 hex, and the graph conforms to claims.shacl.ttl (needs rdflib, pyshacl)."""
    import rdflib
    from pyshacl import validate
    shapes = rdflib.Graph().parse(HERE / "claims.shacl.ttl", format="turtle")
    total, bad = 0, []
    union = rdflib.Graph()
    for f in sorted(folder.glob("*.claims.jsonld")):
        j = json.loads(f.read_text())
        for c in j["@graph"]:
            total += 1
            if not IRI.match(c["@id"]) or not re.fullmatch(r"[0-9a-f]{64}", c["sha256"]):
                bad.append(c["@id"])
        g = rdflib.Graph().parse(data=json.dumps(j), format="json-ld")
        ok, _, text = validate(g, shacl_graph=shapes)
        if not ok:
            bad.append(f"{f.name}: {text[:400]}")
        union += g
    q = "PREFIX loom: <urn:loom:core:> SELECT ?g (COUNT(?c) AS ?n) WHERE { ?c a loom:Claim ; loom:grade ?g } GROUP BY ?g ORDER BY ?g"
    return {"claims": total, "problems": bad, "one_query_over_every_dialect": {str(r.g).rsplit(":", 1)[-1]: int(r.n) for r in union.query(q)}}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="*"); ap.add_argument("--out"); ap.add_argument("--commit"); ap.add_argument("--check")
    a = ap.parse_args(argv)
    if a.check:
        r = check(Path(a.check)); print(json.dumps(r, indent=1)); return 1 if r["problems"] else 0
    need(a.inputs and a.out, "usage: normalize.py <dialect>=<file> [...] --out DIR [--commit SHA]   |   --check DIR")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    report = {"schema": "loom.core-normalize/1", "source_commit": a.commit, "files": []}
    for spec in a.inputs:
        dialect, _, f = spec.partition("=")
        need(dialect in DIALECTS, f"UNKNOWN_DIALECT {dialect}; known: {sorted(DIALECTS)}")
        doc, rep = normalize(dialect, Path(f), a.commit)
        (out / f"{dialect}.claims.jsonld").write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
        report["files"].append(rep)
        print(f"{dialect:13} {rep['claims']:4} claims  grade {rep['grade']}  verdict {rep['verdict']}  id repairs {rep['id_repairs']}")
    report["totals"] = {"claims": sum(r["claims"] for r in report["files"]), "id_repairs": sum(sum(r["id_repairs"].values()) for r in report["files"])}
    (out / "REPORT.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(report["totals"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
