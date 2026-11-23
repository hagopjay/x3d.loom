"""Generate the compact X3DUOM facts table the R2R feature extractor reads (data/uom-facts.json).

The X3D Unified Object Model (X3DUOM) is the Web3D Consortium's machine-readable statement of every node, field,
field type, range, enumeration and containment rule. R2R grounds its rule vocabulary in it: "this value is outside the
range the X3DUOM declares" is an explanation, a literal string is a coincidence. loomkit stays standard-library only and
must run on a machine without the validator fork, so the facts are generated once and committed, like
x3d-blender-io's behaviour catalogue.

    python3 -I kit/loomkit/r2r/gen_uom.py --fork ~/x3d_mcp [--check]

--check regenerates in memory and exits 1 if the committed file differs (the kit test runs it when the fork is present).
Field-level differences between 4.0 and 4.1 are not kept: the table is 4.1, and each node says whether 4.0 has it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "data" / "uom-facts.json"
SCHEMAS = "src/validation/schemas"


def _fields(idef) -> dict:
    out = {}
    for f in idef.findall("field"):
        row = {"t": f.get("type"), "acc": f.get("accessType")}
        for src, dst in (("default", "d"), ("minInclusive", "min"), ("maxInclusive", "max"), ("minExclusive", "minx"),
                         ("maxExclusive", "maxx"), ("simpleType", "st"), ("acceptableNodeTypes", "accepts"), ("baseType", "bt")):
            if f.get(src) is not None:
                row[dst] = f.get(src)
        if f.get("additionalEnumerationValuesAllowed") is not None:
            row["open"] = f.get("additionalEnumerationValuesAllowed") == "true"
        out[f.get("name")] = row
    return out


def build(fork: Path) -> dict:
    p41 = fork / SCHEMAS / "X3dUnifiedObjectModel-4.1.xml"
    p40 = fork / SCHEMAS / "X3dUnifiedObjectModel-4.0.xml"
    r41, r40 = ET.parse(p41).getroot(), ET.parse(p40).getroot()
    in40 = {n.get("name") for n in r40.iter("ConcreteNode")}
    abstract = {}
    for tag in ("AbstractObjectType", "AbstractNodeType"):
        for n in r41.iter(tag):
            idef = n.find("InterfaceDefinition")
            bases = []
            if idef is not None:
                inh = idef.find("Inheritance")
                if inh is not None and inh.get("baseType"):
                    bases.append(inh.get("baseType"))
                bases += [a.get("baseType") for a in idef.findall("AdditionalInheritance") if a.get("baseType")]
            abstract[n.get("name")] = bases

    def closure(bases: list[str]) -> list[str]:
        seen, todo = [], list(bases)
        while todo:
            b = todo.pop(0)
            if b in seen:
                continue
            seen.append(b)
            todo += abstract.get(b, [])
        return seen

    nodes = {}
    for n in r41.iter("ConcreteNode"):
        idef = n.find("InterfaceDefinition")
        bases = []
        inh = idef.find("Inheritance")
        if inh is not None and inh.get("baseType"):
            bases.append(inh.get("baseType"))
        bases += [a.get("baseType") for a in idef.findall("AdditionalInheritance") if a.get("baseType")]
        comp, cf = idef.find("componentInfo"), idef.find("containerField")
        nodes[n.get("name")] = {
            "isa": closure(bases),
            "since": "4.0" if n.get("name") in in40 else "4.1",
            "component": [comp.get("name"), int(comp.get("level", "1"))] if comp is not None else None,
            "cf": cf.get("default") if cf is not None else None,
            "fields": _fields(idef),
        }
    statements = {}
    for s in r41.iter("Statement"):
        idef = s.find("InterfaceDefinition")
        statements[s.get("name")] = {"fields": _fields(idef) if idef is not None else {}}
    simple = {}
    for s in r41.iter("SimpleType"):
        vals = [e.get("value") for e in s.findall("enumeration")]
        if vals:
            simple[s.get("name")] = {"base": s.get("baseType"), "values": vals}
    ftypes = {f.get("type"): {"tuple": int(f.get("tupleSize", "1")), "array": f.get("isArray") == "true", "regex": f.get("regex", "")}
              for f in r41.iter("FieldType")}
    commit = None
    try:
        r = subprocess.run(["git", "-C", str(fork), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=10)
        commit = r.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        pass
    return {
        "schema": "loom.r2r.uom-facts/1",
        "source": {"x3duom_41_sha256": hashlib.sha256(p41.read_bytes()).hexdigest(),
                   "x3duom_40_sha256": hashlib.sha256(p40.read_bytes()).hexdigest(),
                   "from": "x3d_mcp fork, src/validation/schemas/X3dUnifiedObjectModel-4.{0,1}.xml", "fork_commit": commit},
        "counts": {"nodes": len(nodes), "nodes_40": len(in40), "abstract": len(abstract), "statements": len(statements),
                   "field_rows": sum(len(n["fields"]) for n in nodes.values()), "simple_types": len(simple), "field_types": len(ftypes)},
        "fieldTypes": ftypes, "abstract": abstract, "simpleTypes": simple, "statements": statements, "nodes": nodes,
    }


def dumps(facts: dict) -> str:
    return json.dumps(facts, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fork", required=True)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    facts = build(Path(a.fork).expanduser())
    text = dumps(facts)
    if a.check:
        old = json.loads(OUT.read_text(encoding="utf-8"))
        # the fork commit moves without the X3DUOM moving: compare the facts, and the two source hashes, not the commit
        strip = lambda d: {**d, "source": {k: v for k, v in d["source"].items() if k != "fork_commit"}}  # noqa: E731
        same = strip(old) == strip(facts)
        print("uom-facts: " + ("matches the X3DUOM in this fork" if same else "DIFFERS from the X3DUOM in this fork"))
        return 0 if same else 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT} ({len(text):,} bytes) {facts['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
