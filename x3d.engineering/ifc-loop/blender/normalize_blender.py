#!/usr/bin/env python3
"""Turn an X3D written by x3d-blender-io's X3D 4.0 export back into the form ifc2x3d.py writes, so that
x3d2ifc.py can rebuild IFC from it unchanged. Reads only the X3D. Refuses rather than guesses.

  python3 normalize_blender.py BLENDER.x3d OUT.x3d [--report OUT.json]

What it undoes, and why (all observed on x3d-blender-io 2.9.0 under Blender 5.3.0):
  - every node becomes a Transform with DEF "OB_<name>"           -> the frame and IFC hosts are found by metadata
  - spatial elements and the containment holder export as identity Transforms -> Groups again (identity checked)
  - IndexedTriangleSet exports as IndexedFaceSet                    -> triangles again (fan split, counted)
  - extra Transforms appear between a product and its Shape         -> folded into the coordinates or the solid frame
Lengths stay as Blender wrote them (Blender keeps float32, so expect about 1e-6 m of noise).
"""
from __future__ import annotations
import json, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

SPATIAL = {"IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace", "IfcRelContainedInSpatialStructure"}


def ifc_class(e):
    for m in e:
        if m.tag == "MetadataSet" and m.get("name") == "IFC":
            for c in m:
                if c.get("name") == "class":
                    return c.get("value", "").strip('"')
    return None


def mat_of(t):
    """4x4 (row-major lists) of an X3D Transform: T * R * S (no center or scaleOrientation expected)."""
    for f in ("center", "scaleOrientation"):
        v = t.get(f)
        if v and any(abs(float(x)) > 1e-9 for x in v.split()[: (3 if f == "center" else 3)]) and f == "center":
            raise SystemExit(f"{t.get('DEF')}: {f} not handled: refused")
    tx = [float(v) for v in (t.get("translation") or "0 0 0").split()]
    x, y, z, a = [float(v) for v in (t.get("rotation") or "0 0 1 0").split()]
    s = [float(v) for v in (t.get("scale") or "1 1 1").split()]
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, sn, k = math.cos(a), math.sin(a), 1 - math.cos(a)
    r = [[k * x * x + c, k * x * y - sn * z, k * x * z + sn * y],
         [k * x * y + sn * z, k * y * y + c, k * y * z - sn * x],
         [k * x * z - sn * y, k * y * z + sn * x, k * z * z + c]]
    return [[r[i][0] * s[0], r[i][1] * s[1], r[i][2] * s[2], tx[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def apply(m, p):
    return [m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3)]


def is_identity(m, tol=1e-6):
    return all(abs(m[i][j] - (1.0 if i == j else 0.0)) <= tol for i in range(4) for j in range(4))


def to_tr(m):
    """4x4 without scale -> (translation text, rotation text)."""
    r = [row[:3] for row in m[:3]]
    tr = (r[0][0] + r[1][1] + r[2][2] - 1) / 2
    ang = math.acos(max(-1.0, min(1.0, tr)))
    if ang < 1e-12:
        ax = (0.0, 0.0, 1.0, 0.0)
    elif abs(ang - math.pi) < 1e-6:
        xx, yy, zz = [math.sqrt(max((r[i][i] + 1) / 2, 0)) for i in range(3)]
        if xx > 1e-6:
            yy, zz = math.copysign(yy, r[0][1]), math.copysign(zz, r[0][2])
        elif yy > 1e-6:
            zz = math.copysign(zz, r[1][2])
        ax = (xx, yy, zz, ang)
    else:
        s = 2 * math.sin(ang)
        ax = ((r[2][1] - r[1][2]) / s, (r[0][2] - r[2][0]) / s, (r[1][0] - r[0][1]) / s, ang)
    return " ".join(repr(m[i][3]) for i in range(3)), " ".join(repr(v) for v in ax)


def normalize(src: Path, out: Path):
    root = ET.parse(src).getroot()
    rep = {"spatial_to_group": 0, "products": 0, "ifs_to_its": 0, "polygons_split": 0, "extrusions": 0,
           "extra_transforms_folded": 0, "worst_non_identity_spatial": 0.0}
    scene = root.find("Scene")
    frame = next(e for e in scene.iter("Transform") if e.get("DEF") in ("IFC_ZUP_TO_YUP", "OB_IFC_ZUP_TO_YUP"))
    new_root = ET.Element("X3D", root.attrib)
    new_root.append(root.find("head"))
    new_scene = ET.SubElement(new_root, "Scene")
    nf = ET.SubElement(new_scene, "Transform", {"DEF": "IFC_ZUP_TO_YUP", "rotation": frame.get("rotation")})

    def meta_children(e):
        return [c for c in e if c.tag.startswith("Metadata")]

    def shapes_under(t, m):
        """(Shape, accumulated 4x4 from the product's frame) for every Shape below t, through plain Transforms."""
        for c in t:
            if c.tag == "Shape":
                yield c, m
            elif c.tag == "Transform" and ifc_class(c) is None:
                rep["extra_transforms_folded"] += 1
                yield from shapes_under(c, mul(m, mat_of(c)))

    def product(t, parent_m, holder):
        m = mul(parent_m, mat_of(t))
        tt, rr = to_tr(m)
        nt = ET.SubElement(holder, "Transform", {"translation": tt, "rotation": rr})
        nt.extend(meta_children(t))
        rep["products"] += 1
        for shape, sm in shapes_under(t, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]):
            body = next((e for e in shape if e.tag == "MetadataSet" and e.get("name") == "ifc:body"), None)
            ext = shape.find("Extrusion")
            if body is not None and ext is not None:
                # x3d2ifc reads the solid from ifc:body; the Transform pair only feeds its witness. sm already holds
                # the solid Position composed with the +90 deg turn, so take the turn back off.
                turn = mat_of(ET.Element("Transform", {"rotation": "1 0 0 " + repr(math.pi / 2)}))
                inv = [[turn[j][i] for j in range(3)] + [0] for i in range(3)] + [[0, 0, 0, 1]]
                pos = mul(sm, inv)
                pt, pr = to_tr(pos)
                ts = ET.SubElement(nt, "Transform", {"translation": pt, "rotation": pr})
                inner = ET.SubElement(ts, "Transform", {"rotation": "1 0 0 " + repr(math.pi / 2)})
                inner.append(shape)
                rep["extrusions"] += 1
                continue
            geom = shape.find("IndexedFaceSet")
            if geom is None:
                geom = shape.find("IndexedTriangleSet")
                if geom is None:
                    raise SystemExit("Shape without a mesh: refused")
                idx = [int(v) for v in geom.get("index").split()]
            else:
                rep["ifs_to_its"] += 1
                ci = [int(v) for v in geom.get("coordIndex").split()]
                idx, face = [], []
                for v in ci + [-1]:
                    if v >= 0:
                        face.append(v); continue
                    if len(face) >= 3:
                        if len(face) > 3:
                            rep["polygons_split"] += 1
                        for k in range(1, len(face) - 1):
                            idx += [face[0], face[k], face[k + 1]]
                    face = []
            pts = [float(v) for v in geom.find("Coordinate").get("point").split()]
            pts = [c for i in range(0, len(pts), 3) for c in apply(sm, pts[i:i + 3])]
            ns = ET.SubElement(nt, "Shape")
            if body is not None:
                ns.append(body)
            its = ET.SubElement(ns, "IndexedTriangleSet", {"solid": geom.get("solid", "true"), "index": " ".join(map(str, idx))})
            ET.SubElement(its, "Coordinate", {"point": " ".join(repr(c) for c in pts)})

    def walk(t, parent_m, holder):
        cls = ifc_class(t)
        m = mul(parent_m, mat_of(t)) if t.tag == "Transform" else parent_m
        if cls in SPATIAL:
            if not is_identity(mat_of(t)) if t.tag == "Transform" else False:
                rep["worst_non_identity_spatial"] = max(rep["worst_non_identity_spatial"], max(abs(v) for v in mat_of(t)[i][:3] for i in range(3)))
                raise SystemExit(f"{cls} {t.get('DEF')} is not an identity Transform: refused")
            g = ET.SubElement(holder, "Group")
            g.extend(meta_children(t))
            rep["spatial_to_group"] += 1
            for c in t:
                if c.tag in ("Transform", "Group"):
                    if ifc_class(c) in SPATIAL:
                        walk(c, m, g)
                    elif ifc_class(c) is not None:
                        product(c, m, g)
            return
        for c in t:
            if c.tag in ("Transform", "Group"):
                walk(c, m, holder)

    for c in frame:
        if c.tag in ("Transform", "Group"):
            walk(c, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], nf)
    ET.indent(new_root)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(new_root, encoding="unicode") + "\n")
    return rep


if __name__ == "__main__":
    r = normalize(Path(sys.argv[1]), Path(sys.argv[2]))
    if "--report" in sys.argv:
        Path(sys.argv[sys.argv.index("--report") + 1]).write_text(json.dumps(r, indent=1))
    print(r)
