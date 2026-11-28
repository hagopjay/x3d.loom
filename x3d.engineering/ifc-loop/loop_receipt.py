#!/usr/bin/env python3
"""Loop receipt: IFC A -> X3D -> IFC B, compared item by item, with planted controls that must be caught.

  python3 loop_receipt.py A.ifc [--out results/] [--name confluence]

Writes <out>/<name>-loop-receipt.json. Every comparison names what it compares; nothing is typed.
Controls: each edits the X3D in one planted way, rebuilds B, and must make the named check fail.
"""
from __future__ import annotations
import hashlib, json, math, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as ue, ifcopenshell.util.placement as up
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ifc2x3d, x3d2ifc  # noqa: E402

SPATIAL = ("IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace")
ATTR_SKIP = {"id", "type", "OwnerHistory", "ObjectPlacement", "Representation", "RepresentationContexts", "UnitsInContext"}


def attrs(e):
    return {k: v for k, v in e.get_info(recursive=False).items()
            if k not in ATTR_SKIP and not isinstance(v, (ifcopenshell.entity_instance, tuple))}


def psets(e):
    out = {}
    for rel in getattr(e, "IsDefinedBy", []) or []:
        if rel.is_a("IfcRelDefinesByProperties") and rel.RelatingPropertyDefinition.is_a("IfcPropertySet"):
            ps = rel.RelatingPropertyDefinition
            out[ps.Name] = {"psetGlobalId": ps.GlobalId, "relGlobalId": rel.GlobalId,
                            "props": {p.Name: [p.NominalValue.is_a(), p.NominalValue.wrappedValue]
                                      for p in ps.HasProperties if p.is_a("IfcPropertySingleValue") and p.NominalValue}}
    return out


def body(e, scale):
    if not e.Representation:
        return None
    items = []
    for r in e.Representation.Representations:
        for it in r.Items:
            if it.is_a("IfcExtrudedAreaSolid"):
                pa = {k: v for k, v in it.SweptArea.get_info(recursive=False).items() if k not in ("id",) and v is not None}
                pos = None if it.Position is None else [list(it.Position.Location.Coordinates),
                                                        list(it.Position.Axis.DirectionRatios) if it.Position.Axis else None,
                                                        list(it.Position.RefDirection.DirectionRatios) if it.Position.RefDirection else None]
                items.append({"item": it.is_a(), "profile": pa, "Depth": it.Depth, "rep": r.RepresentationType,
                              "dir": list(it.ExtrudedDirection.DirectionRatios), "pos": pos})
            else:
                items.append({"item": it.is_a(), "rep": r.RepresentationType, "closed": it.Closed,
                              "coords": [list(p) for p in it.Coordinates.CoordList],
                              "index": [list(t) for t in it.CoordIndex]})
    return items


def same(a, b, tol=1e-9):
    """Equal structure, numbers within tol."""
    if isinstance(a, dict):
        return isinstance(b, dict) and a.keys() == b.keys() and all(same(a[k], b[k], tol) for k in a)
    if isinstance(a, (list, tuple)):
        return isinstance(b, (list, tuple)) and len(a) == len(b) and all(same(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, float) or isinstance(b, float):
        return isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) <= tol * max(1.0, abs(a))
    return a == b


def relto(e):
    lp = getattr(e, "ObjectPlacement", None)
    return lp.PlacementRelTo.PlacesObject[0].GlobalId if lp is not None and lp.PlacementRelTo is not None else None


def geom_q(f):
    s = ifcopenshell.geom.settings()
    s.set("use-world-coords", True)
    out = {}
    for p in f.by_type("IfcProduct"):
        if not p.Representation:
            continue
        sh = ifcopenshell.geom.create_shape(s, p)
        v = np.array(sh.geometry.verts).reshape(-1, 3)
        t = np.array(sh.geometry.faces).reshape(-1, 3)
        a, b, c = v[t[:, 0]], v[t[:, 1]], v[t[:, 2]]
        cr = np.cross(b - a, c - a)
        out[p.GlobalId] = {"area": float(0.5 * np.linalg.norm(cr, axis=1).sum()),
                           "volume": abs(float((a * cr).sum() / 6.0)),
                           "bbox": v.min(0).tolist() + v.max(0).tolist()}
    return out


def tree(f):
    agg = sorted((r.GlobalId, r.RelatingObject.GlobalId, c.GlobalId) for r in f.by_type("IfcRelAggregates") for c in r.RelatedObjects)
    con = sorted((r.GlobalId, r.RelatingStructure.GlobalId, e.GlobalId) for r in f.by_type("IfcRelContainedInSpatialStructure") for e in r.RelatedElements)
    return agg, con


def compare(A, B):
    sa, sb = 1.0, 1.0
    import ifcopenshell.util.unit as uu
    sa, sb = uu.calculate_unit_scale(A), uu.calculate_unit_scale(B)
    ra = {e.GlobalId: e for e in A.by_type("IfcRoot") if e.is_a("IfcObjectDefinition")}
    rb = {e.GlobalId: e for e in B.by_type("IfcRoot") if e.is_a("IfcObjectDefinition")}
    rows = {}

    def row(key, total, ok, detail=None):
        rows[key] = {"carried": ok, "of": total, "pass": ok == total, **({"first_misses": detail[:5]} if detail else {})}

    spa = [g for g, e in ra.items() if e.is_a() in SPATIAL]
    miss = [g for g in spa if g not in rb or rb[g].is_a() != ra[g].is_a() or attrs(rb[g]) != attrs(ra[g])]
    row("spatial elements (class + every direct attribute)", len(spa), len(spa) - len(miss), miss)
    ta, tb = tree(A), tree(B)
    row("IfcRelAggregates edges (rel GlobalId, parent, child)", len(ta[0]), len(set(ta[0]) & set(tb[0])))
    row("IfcRelContainedInSpatialStructure edges", len(ta[1]), len(set(ta[1]) & set(tb[1])))
    prods = [g for g, e in ra.items() if e.is_a("IfcProduct") and e.is_a() not in SPATIAL]
    miss = [g for g in prods if g not in rb or rb[g].is_a() != ra[g].is_a() or attrs(rb[g]) != attrs(ra[g])]
    row("products (class + every direct attribute)", len(prods), len(prods) - len(miss), miss)
    pa = {g: psets(ra[g]) for g in ra}
    keys = [(g, n, k) for g, d in pa.items() for n, ps in d.items() for k in ps["props"]]
    miss = [x for x in keys if x[0] not in rb or psets(rb[x[0]]).get(x[1], {}).get("props", {}).get(x[2]) != pa[x[0]][x[1]]["props"][x[2]]]
    row("property values (pset, key, IFC value type, value)", len(keys), len(keys) - len(miss), [list(m) for m in miss])
    ids = [(g, n) for g, d in pa.items() for n in d]
    miss = [x for x in ids if x[0] not in rb or {k: psets(rb[x[0]]).get(x[1], {}).get(k) for k in ("psetGlobalId", "relGlobalId")}
            != {k: pa[x[0]][x[1]][k] for k in ("psetGlobalId", "relGlobalId")}]
    row("property set and relation GlobalIds", len(ids), len(ids) - len(miss), [list(m) for m in miss])
    ext = tes = ext_ok = tes_ok = 0
    worst_coord = 0.0
    for g in prods:
        ba, bb = body(ra[g], sa), body(rb.get(g), sb) if g in rb else None
        for i, it in enumerate(ba or []):
            other = (bb or [None] * (i + 1))[i] if bb and i < len(bb) else None
            if it["item"] == "IfcExtrudedAreaSolid":
                ext += 1
                ext_ok += bool(other and other["item"] == it["item"] and same(other, it))
            else:
                tes += 1
                if other and other["item"] == it["item"] and other["index"] == it["index"]:
                    d = float(np.abs(np.array(other["coords"]) - np.array(it["coords"])).max())
                    worst_coord = max(worst_coord, d)
                    tes_ok += d <= 1e-6
    row("IfcExtrudedAreaSolid kept as parameters (profile class + every profile number, Position, direction, Depth)", ext, ext_ok)
    placed = [g for g in ra if getattr(ra[g], "ObjectPlacement", None) is not None]
    miss = [g for g in placed if g not in rb or relto(rb[g]) != relto(ra[g])]
    row("placement chain (same PlacementRelTo parent)", len(placed), len(placed) - len(miss), miss)
    row("IfcTriangulatedFaceSet (same indices, coords within 1e-6 unit)", tes, tes_ok)
    pl_worst, pl_n = 0.0, 0
    for g in prods:
        if g in rb and ra[g].ObjectPlacement and rb[g].ObjectPlacement:
            ma = up.get_local_placement(ra[g].ObjectPlacement); mb = up.get_local_placement(rb[g].ObjectPlacement)
            pl_worst = max(pl_worst, float(np.abs(ma[:3, :3] - mb[:3, :3]).max()), float(np.abs(ma[:3, 3] - mb[:3, 3]).max()) * sa)
            pl_n += 1
    qa, qb = geom_q(A), geom_q(B)
    worst = {"volume": 0.0, "area": 0.0, "bbox_m": 0.0}
    for g, q in qa.items():
        o = qb.get(g)
        if not o:
            worst["volume"] = worst["area"] = float("inf"); continue
        worst["volume"] = max(worst["volume"], abs(o["volume"] - q["volume"]) / max(q["volume"], 1e-12))
        worst["area"] = max(worst["area"], abs(o["area"] - q["area"]) / max(q["area"], 1e-12))
        worst["bbox_m"] = max(worst["bbox_m"], max(abs(x - y) for x, y in zip(o["bbox"], q["bbox"])))
    return rows, {"worst_tessellation_coord_unit": worst_coord, "worst_placement": pl_worst, "placements": pl_n,
                  "worst_relative_volume": worst["volume"], "worst_relative_area": worst["area"],
                  "worst_bbox_metres": worst["bbox_m"], "bodies_measured": len(qa),
                  "measured_by": "ifcopenshell.geom " + ifcopenshell.version + " world coords, both files"}


def run_loop(a_path, tmp, mutate=None):
    x3d = tmp / "loop.x3d"; b = tmp / "B.ifc"; w = tmp / "w.json"
    ifc2x3d.convert(a_path, x3d)
    if mutate:
        t = ET.parse(x3d); mutate(t.getroot()); t.write(x3d, encoding="unicode")
    x3d2ifc.convert(x3d, b, w)
    return ifcopenshell.open(str(b)), json.loads(w.read_text()), x3d


def first(root, pred):
    return next(e for e in root.iter() if pred(e))


def drop_pset_key(root):  # remove one property from one element
    ps = first(root, lambda e: e.tag == "MetadataSet" and e.get("reference") == "IfcPropertySet")
    ps.remove(first(ps, lambda e: e.get("reference") == "IfcLabel"))


def flatten_tree(root):  # lift the elements out of their containment group: the storey no longer holds them
    par = {c: p for p in root.iter() for c in p}
    hold = first(root, lambda e: e.tag == "Group" and e.get("DEF", "").startswith("c"))
    st = par[hold]
    st.remove(hold)
    for t in [t for t in hold if t.tag == "Transform"]:
        st.append(t)


def bend_extrusion(root):  # widen one native Extrusion without touching ifc:body: witness must disagree
    ext = first(root, lambda e: e.tag == "Extrusion")
    ext.set("crossSection", " ".join(str(float(v) * 1.1) for v in ext.get("crossSection").split()))


def nudge_vertex(root):  # move one tessellated vertex 5 mm
    c = first(root, lambda e: e.tag == "Coordinate")
    p = c.get("point").split(); p[0] = repr(float(p[0]) + 0.005); c.set("point", " ".join(p))


def retype_value(root):  # change the IFC value type of one property, keeping its text
    e = first(root, lambda e: e.get("reference") in ("IfcBoolean", "IfcReal", "IfcLabel") and e.tag != "MetadataSet")
    old = e.get("reference"); v = e.get("value")
    e.tag = "MetadataString"; e.set("value", v if v.startswith('"') else '"' + v + '"')
    e.set("reference", "IfcText" if old == "IfcLabel" else "IfcLabel")


CONTROLS = [
    ("drop one property key", drop_pset_key, "property values (pset, key, IFC value type, value)"),
    ("flatten the spatial tree (storey loses its contents)", flatten_tree, "IfcRelContainedInSpatialStructure edges"),
    ("change one property's IFC value type", retype_value, "property values (pset, key, IFC value type, value)"),
    ("move one drawn vertex 5 mm", nudge_vertex, ("IfcTriangulatedFaceSet (same indices, coords within 1e-6 unit)", "WITNESS")),
    ("widen one native Extrusion only", bend_extrusion, ("WITNESS",)),
]


def main():
    a = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE / "results"
    name = sys.argv[sys.argv.index("--name") + 1] if "--name" in sys.argv else a.stem
    out.mkdir(parents=True, exist_ok=True)
    A = ifcopenshell.open(str(a))
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        B, w, x3d = run_loop(a, td)
        rows, q = compare(A, B)
        x3d_bytes = x3d.read_bytes()
        controls = []
        for label, fn, check in CONTROLS:
            checks = check if isinstance(check, tuple) else (check,)
            try:
                Bc, wc, _ = run_loop(a, td, fn)
            except StopIteration:
                controls.append({"control": label, "must_fail": list(checks), "caught": None, "note": "not applicable: nothing to plant in this model"})
                continue
            rc, _ = compare(A, Bc)
            hit = [c for c in checks if (c == "WITNESS" and not wc["all_agree"]) or (c != "WITNESS" and not rc[c]["pass"])]
            controls.append({"control": label, "must_fail": list(checks), "caught": bool(hit), "caught_by": hit})
    receipt = {
        "schema": "x3d.loom/ifc-loop-receipt/1", "source": str(a.name), "source_sha256": hashlib.sha256(a.read_bytes()).hexdigest(),
        "x3d_sha256": hashlib.sha256(x3d_bytes).hexdigest(), "x3d_bytes": len(x3d_bytes),
        "tools": {"ifcopenshell": ifcopenshell.version, "writer": "ifc-loop/ifc2x3d.py", "reader": "ifc-loop/x3d2ifc.py"},
        "rows": rows, "quantities": q,
        "extrusion_witness": {"extrusions": w["extrusions"], "all_agree": w["all_agree"]},
        "controls": controls, "controls_caught": sum(1 for c in controls if c["caught"]), "controls_total": sum(1 for c in controls if c["caught"] is not None),
        "all_rows_pass": all(r["pass"] for r in rows.values()),
    }
    (out / f"{name}-loop-receipt.json").write_text(json.dumps(receipt, indent=1))
    for k, r in rows.items():
        print(f'{r["carried"]:>5} / {r["of"]:<5} {"PASS" if r["pass"] else "FAIL"}  {k}')
    print(json.dumps(q, indent=1))
    print("extrusion witness", w["extrusions"], w["all_agree"])
    print("controls", receipt["controls_caught"], "of", receipt["controls_total"])
    for c in controls:
        print("control", {True: "CAUGHT", False: "MISSED", None: "n/a"}[c["caught"]], c["control"], c.get("caught_by", ""))


if __name__ == "__main__":
    main()
