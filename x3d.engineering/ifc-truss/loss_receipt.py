#!/usr/bin/env python3
"""IFC to X3D loss receipt for one building: identity, quantities, and what did not cross.

Reads the Confluence studio's IFC model and the X3D scene its server wrote from it (x3d.demo, read-only),
matches every element by GlobalId, recomputes three quantities per element on both sides (bounding box,
surface area, volume) and lists, per IFC class, what the X3D file does not carry.

  python3 loss_receipt.py [--demo /path/to/x3d.demo]      writes results/loss-receipt.json
Needs ifcopenshell (the second reader of the IFC) and nothing else outside the standard library.
"""
from __future__ import annotations
import collections, hashlib, json, math, os, sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
REL = "docs/demos/confluence-ifc/v1/snapshot"


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def tri_quantities(verts, tris):
    """Bounding box, area and enclosed volume of a triangle mesh (volume by the divergence theorem)."""
    lo = [min(v[i] for v in verts) for i in range(3)]
    hi = [max(v[i] for v in verts) for i in range(3)]
    area = vol = 0.0
    for a, b, c in tris:
        p, q, r = verts[a], verts[b], verts[c]
        u = [q[i] - p[i] for i in range(3)]; w = [r[i] - p[i] for i in range(3)]
        cx = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])
        area += 0.5 * math.sqrt(cx[0] ** 2 + cx[1] ** 2 + cx[2] ** 2)
        vol += (p[0] * cx[0] + p[1] * cx[1] + p[2] * cx[2]) / 6.0
    return {"bbox_min": lo, "bbox_max": hi, "area": area, "volume": abs(vol)}


def rot_axis_angle(ax, v):
    x, y, z, ang = ax
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, s = math.cos(ang), math.sin(ang)
    d = x * v[0] + y * v[1] + z * v[2]
    cr = (y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0])
    return [v[i] * c + cr[i] * s + (x, y, z)[i] * d * (1 - c) for i in range(3)]


def read_x3d(path: Path, undo_frame=True, mutate=None):
    """Every element under IFC_ZUP_TO_YUP that carries a MetadataSet with a guid: its metadata and its mesh, in the
    IFC frame (z up, metres). Handles Transform or CADPart, IndexedTriangleSet or IndexedFaceSet, DEF/USE.
    undo_frame=False returns the coordinates as X3D sees them (y up): the control that skips the frame.
    mutate(root) lets a control edit the parsed scene before it is read."""
    root = ET.parse(path).getroot()
    if mutate:
        mutate(root)
    defs = {e.get("DEF"): e for e in root.iter() if e.get("DEF")}
    resolve = lambda e: defs[e.get("USE")] if e is not None and e.get("USE") else e
    frame = defs["IFC_ZUP_TO_YUP"]
    frame_rot = [float(x) for x in frame.get("rotation").split()]
    out = {}
    for t in frame.iter():
        ms = t.find("MetadataSet")
        if ms is None or t.tag not in ("Transform", "CADPart"):
            continue
        meta = {m.get("name"): m.get("value").strip('"') for m in ms}
        if "guid" not in meta:
            continue
        geo = next((resolve(g) for g in t.iter() if g.tag in ("IndexedTriangleSet", "IndexedFaceSet")), None)
        coord = resolve(geo.find("Coordinate"))
        pts = [float(x) for x in coord.get("point").replace(",", " ").split()]
        if geo.tag == "IndexedTriangleSet":
            idx = [int(x) for x in geo.get("index").split()]
            tris = [tuple(idx[i:i + 3]) for i in range(0, len(idx), 3)]
        else:
            tris, poly = [], []
            for x in (int(v) for v in geo.get("coordIndex").replace(",", " ").split()):
                if x == -1:
                    tris += [(poly[0], poly[i], poly[i + 1]) for i in range(1, len(poly) - 1)]; poly = []
                else:
                    poly.append(x)
        tr = [float(x) for x in t.get("translation", "0 0 0").split()]
        ro = [float(x) for x in t.get("rotation", "0 0 1 0").split()]
        sc = [float(x) for x in t.get("scale", "1 1 1").split()]
        verts = []
        for i in range(0, len(pts), 3):
            v = rot_axis_angle(ro, [pts[i] * sc[0], pts[i + 1] * sc[1], pts[i + 2] * sc[2]])
            v = [v[j] + tr[j] for j in range(3)]
            verts.append(v if undo_frame else rot_axis_angle(frame_rot, v))
        app = next((a for a in t.iter("Appearance")), None)
        out[meta["guid"]] = {"meta": meta, "q": tri_quantities(verts, tris), "triangles": len(tris), "def": t.get("DEF"),
                             "appearance": None if app is None else (app.get("DEF") or app.get("USE"))}
    return out, {"frame_rotation": frame.get("rotation"), "version": root.get("version"), "profile": root.get("profile"),
                 "head_meta": {m.get("name"): m.get("content") for m in root.find("head").findall("meta")}}


def read_ifc(path: Path):
    import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as ue, ifcopenshell.util.unit as uu
    m = ifcopenshell.open(str(path))
    s = ifcopenshell.geom.settings(); s.set("use-world-coords", True)
    scale = uu.calculate_unit_scale(m)                        # project length unit in metres (0.001 for millimetres)
    out = {}
    for p in m.by_type("IfcProduct"):
        rec = {"class": p.is_a(), "name": p.Name, "psets": ue.get_psets(p), "has_geometry": bool(p.Representation),
               "attrs": {k: v for k, v in p.get_info(recursive=False).items() if k not in ("id", "type", "OwnerHistory", "ObjectPlacement", "Representation") and v is not None},
               "rep_items": sorted({i.is_a() for r in (p.Representation.Representations if p.Representation else []) for i in r.Items})}
        if p.Representation:
            g = ifcopenshell.geom.create_shape(s, p).geometry
            v, f = g.verts, g.faces
            verts = [[v[i], v[i + 1], v[i + 2]] for i in range(0, len(v), 3)]
            rec["q"] = tri_quantities(verts, [tuple(f[i:i + 3]) for i in range(0, len(f), 3)])
            rec["triangles"] = len(f) // 3
        out[p.GlobalId] = rec
    rels = collections.Counter(e.is_a() for e in m.by_type("IfcRelationship"))
    info = {"schema": m.schema, "ifcopenshell": ifcopenshell.version, "unit_scale_to_metre": scale, "relationships": dict(rels),
            "materials": len(m.by_type("IfcMaterial")), "map_conversion": len(m.by_type("IfcMapConversion")),
            "site_latlon": [m.by_type("IfcSite")[0].RefLatitude, m.by_type("IfcSite")[0].RefLongitude]}
    return out, info


def compare(ifc, x3d, unit_trap_scale=1.0):
    """Per element: identity, then the three quantities. unit_trap_scale reproduces a millimetre/metre slip (a control)."""
    rows, by_class = [], collections.defaultdict(lambda: collections.Counter())
    for guid, e in ifc.items():
        c = by_class[e["class"]]; c["ifc"] += 1
        if not e["has_geometry"]:
            c["no_geometry_in_ifc"] += 1
            if guid in x3d: c["x3d"] += 1
            continue
        x = x3d.get(guid)
        if x is None:
            c["missing_in_x3d"] += 1; rows.append({"guid": guid, "class": e["class"], "matched": False}); continue
        c["x3d"] += 1
        qi, qx = e["q"], x["q"]
        bbox = max(max(abs(qi["bbox_min"][i] - qx["bbox_min"][i] * unit_trap_scale), abs(qi["bbox_max"][i] - qx["bbox_max"][i] * unit_trap_scale)) for i in range(3))
        rel = lambda a, b: abs(a - b) / max(abs(a), 1e-12)
        rows.append({"guid": guid, "class": e["class"], "matched": True, "name_equal": e["name"] == x["meta"].get("name"),
                     "class_equal": e["class"] == x["meta"].get("class"), "bbox_max_diff_mm": bbox * 1000,
                     "area_rel": rel(qi["area"], qx["area"] * unit_trap_scale ** 2), "volume_rel": rel(qi["volume"], qx["volume"] * unit_trap_scale ** 3),
                     "ifc_area_m2": qi["area"], "ifc_volume_m3": qi["volume"], "ifc_triangles": e["triangles"], "x3d_triangles": x["triangles"]})
    extra = [g for g in x3d if g not in ifc]
    return rows, by_class, extra


def main(argv):
    demo = Path(argv[argv.index("--demo") + 1]) if "--demo" in argv else Path(os.environ.get("X3D_DEMO", HERE.parents[2] / "x3d.demo"))
    ifc_p, x3d_p = demo / REL / "model.ifc", demo / REL / "scene-0.x3d"
    ifc, info = read_ifc(ifc_p)
    x3d, xinfo = read_x3d(x3d_p)
    rows, by_class, extra = compare(ifc, x3d)
    matched = [r for r in rows if r["matched"]]
    pset_keys = collections.Counter(k for e in ifc.values() for ps in e["psets"].values() for k in ps if k != "id")
    x3d_keys = collections.Counter(k for x in x3d.values() for k in x["meta"])
    per_class = {}
    for cls, c in sorted(by_class.items()):
        rs = [r for r in matched if r["class"] == cls]
        per_class[cls] = {"ifc": c["ifc"], "in_x3d_by_GlobalId": c["x3d"], "missing_in_x3d": c["missing_in_x3d"], "no_geometry_in_ifc": c["no_geometry_in_ifc"],
                          "worst_bbox_diff_mm": max((r["bbox_max_diff_mm"] for r in rs), default=None),
                          "worst_area_rel": max((r["area_rel"] for r in rs), default=None), "worst_volume_rel": max((r["volume_rel"] for r in rs), default=None),
                          "ifc_volume_m3": sum(r["ifc_volume_m3"] for r in rs), "representation_in_ifc": sorted({i for g, e in ifc.items() if e["class"] == cls for i in e["rep_items"]})}
    receipt = {"schema": "loom.eng-loss-receipt/1", "inputs": {"ifc": {"path": f"x3d.demo/{REL}/model.ifc", "sha256": sha256(ifc_p), "bytes": ifc_p.stat().st_size},
                                                              "x3d": {"path": f"x3d.demo/{REL}/scene-0.x3d", "sha256": sha256(x3d_p), "bytes": x3d_p.stat().st_size}},
               "instruments": {"ifc_reader": f"IfcOpenShell {info['ifcopenshell']}", "x3d_reader": "xml.etree, this file"},
               "ifc": info, "x3d": xinfo,
               "identity": {"ifc_products": len(ifc), "ifc_with_geometry": sum(e["has_geometry"] for e in ifc.values()), "x3d_elements": len(x3d),
                            "matched_by_GlobalId": len(matched), "x3d_not_in_ifc": extra, "names_equal": sum(r["name_equal"] for r in matched), "classes_equal": sum(r["class_equal"] for r in matched)},
               "quantities": {"elements": len(matched), "worst_bbox_diff_mm": max(r["bbox_max_diff_mm"] for r in matched),
                              "worst_area_rel": max(r["area_rel"] for r in matched), "worst_volume_rel": max(r["volume_rel"] for r in matched),
                              "total_ifc_volume_m3": sum(r["ifc_volume_m3"] for r in matched)},
               "per_class": per_class,
               "carried": {"x3d_metadata_keys": dict(x3d_keys), "ifc_pset_keys": dict(pset_keys)},
               "elements": rows}
    (HERE / "results").mkdir(exist_ok=True)
    (HERE / "results" / "loss-receipt.json").write_text(json.dumps(receipt, indent=1))
    print(json.dumps({k: receipt[k] for k in ("identity", "quantities", "carried")}, indent=1))
    print(json.dumps(per_class, indent=1)[:1800]); print(info); print(xinfo["frame_rotation"], xinfo["head_meta"].get("ifc:sourceSha256"), receipt["inputs"]["ifc"]["sha256"])


if __name__ == "__main__":
    main(sys.argv)
