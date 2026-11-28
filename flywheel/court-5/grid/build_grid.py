#!/usr/bin/env python3
"""Build court 5's grid of mistake classes from the X3D object model. No test set is read.

    python3 flywheel/court-5/grid/build_grid.py <X3dUnifiedObjectModel-4.0.xml>
    python3 flywheel/court-5/grid/build_grid.py <X3dUnifiedObjectModel-4.0.xml> --check    # fails if grid.json is stale

The model file ships in x3d_mcp at src/validation/schemas/. Every cell is one (node, field, class) or
(node, class) where the model's own attributes say the class applies (grid/classes.json). The builder keeps the
state and notes of cells that are already in grid.json, so probing results survive a rebuild.
"""
import hashlib, json, sys
import xml.etree.ElementTree as ET
from pathlib import Path

H = Path(__file__).resolve().parent
OFF = {"enabled", "on", "visible", "load"}


def ancestors(root):
    parent = {}
    for kind in ("AbstractNodeTypes", "AbstractObjectTypes", "ConcreteNodes"):
        for n in root.find(kind):
            idef = n.find("InterfaceDefinition")
            if idef is None:
                continue
            parent[n.get("name")] = [e.get("baseType") for e in idef if e.tag in ("Inheritance", "AdditionalInheritance")]

    def up(name, seen):
        for p in parent.get(name, []):
            if p and p not in seen:
                seen.add(p)
                up(p, seen)
        return seen
    return lambda name: up(name, set())


def build(model):
    root = ET.parse(model).getroot()
    anc = ancestors(root)
    cells = []
    for node in sorted(root.find("ConcreteNodes"), key=lambda n: n.get("name")):
        name, idef = node.get("name"), node.find("InterfaceDefinition")
        fields = idef.findall("field")
        names = {f.get("name") for f in fields}
        for f in sorted(fields, key=lambda f: f.get("name")):
            fn, ft, acc = f.get("name"), f.get("type"), f.get("accessType")
            hit = []
            if any(f.get(k) is not None for k in ("minInclusive", "maxInclusive", "minExclusive", "maxExclusive")):
                hit.append("F01-range")
            if f.find("enumeration") is not None and f.get("additionalEnumerationValuesAllowed") != "true":
                hit.append("F02-enumeration")
            if f.get("acceptableNodeTypes"):
                hit.append("F03-child-type")
            if acc in ("outputOnly", "initializeOnly"):
                hit.append("F04-route-to-non-input")
            if acc in ("inputOnly", "initializeOnly"):
                hit.append("F05-route-from-non-output")
            if acc in ("inputOnly", "outputOnly", "inputOutput") and ft not in ("SFNode", "MFNode"):
                hit.append("F06-route-type")
            if ft == "MFInt32" and fn.endswith("Index"):
                hit.append("F07-index")
            if ft == "MFString" and "url" in fn.lower():
                hit.append("F08-address")
            if ft == "SFTime" and acc in ("inputOutput", "initializeOnly"):
                hit.append("F09-time")
            if ft == "SFBool" and acc in ("inputOutput", "initializeOnly") and fn in OFF:
                hit.append("F10-switched-off")
            cells += [{"cell": f"{name}.{fn}:{c}", "node": name, "field": fn, "type": ft, "accessType": acc, "class": c} for c in hit]
        a = anc(name)
        hit = ["N04-def-use", "N05-component"]
        if "X3DSensorNode" in a:
            hit.append("N01-sensor-unheard")
        if {"key", "keyValue"} <= names:
            hit.append("N02-parallel-arrays")
        if "X3DBindableNode" in a:
            hit.append("N03-bindable")
        cells += [{"cell": f"{name}:{c}", "node": name, "class": c} for c in sorted(hit)]
    return root, cells


def main():
    model = Path(sys.argv[1])
    root, cells = build(model)
    out = H / "grid.json"
    old = {c["cell"]: c for c in json.loads(out.read_text())["cells"]} if out.exists() else {}
    for c in cells:
        prev = old.get(c["cell"], {})
        c["state"] = prev.get("state", "unprobed")
        for k in ("check", "probe", "note", "provenance"):
            if k in prev:
                c[k] = prev[k]
    classes, states = {}, {}
    for c in cells:
        classes[c["class"]] = classes.get(c["class"], 0) + 1
        states[c["state"]] = states.get(c["state"], 0) + 1
    doc = {"model": model.name, "model_sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
           "model_version": root.get("version"), "nodes": len(root.find("ConcreteNodes")), "cells_total": len(cells),
           "cells_by_class": dict(sorted(classes.items())), "cells_by_state": dict(sorted(states.items())),
           "read_this_first": "A count of cells is a count of this grid, which holds only the classes in classes.json. "
                              "It is not a count of the ways an X3D scene can be wrong.",
           "cells": cells}
    text = json.dumps(doc, indent=0, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        if not out.exists() or json.loads(out.read_text()) != doc:      # same cells and states, whatever the key order
            sys.exit("grid.json is stale: rerun build_grid.py without --check")
        print("grid.json is current")
    else:
        out.write_text(text)
    print(doc["nodes"], "nodes,", doc["cells_total"], "cells;", doc["cells_by_class"], doc["cells_by_state"])


if __name__ == "__main__":
    main()
