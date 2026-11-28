#!/usr/bin/env python3
"""X3D <-> OpenUSD that keeps X3D Metadata as typed, namespaced USD attributes, so semantics a domain wrote into X3D
(IFC, CIDOC-CRM, SimReady labels) cross into USD and come back. First corpus: the IFC loop scenes
(x3d.engineering/ifc-loop/scenes/).

  python3 x3dusd.py to-usd IN.x3d OUT.usda
  python3 x3dusd.py to-x3d IN.usda OUT.x3d

The scope is the node set ifc2x3d.py writes (Group, Transform, Shape, Appearance/Material, IndexedTriangleSet,
Extrusion, Metadata*, head meta, WorldInfo). Any other node is refused, not guessed.

How X3D travels in USD (usd-core 26.11):
  Group / Transform        -> Xform; Transform as one xformOp:transform (double4x4); customData x3d:node, x3d:DEF
  Metadata* on a node      -> attributes "x3d:meta:<path>" in order; Boolean->bool[], Integer->int[], Double->double[],
                              Float->float[], String->string[]; customData holds x3d:node, x3d:name, x3d:reference,
                              x3d:order (names are sanitised for USD, the original rides in x3d:name)
  MetadataSet              -> a token attribute "<path>:__set" that holds the set's own name and reference
  the IFC class, if any    -> also UsdSemantics LabelsAPI, taxonomy "ifc", so USD-native tools can read it
  IndexedTriangleSet       -> Mesh (point3f: USD keeps float32, so expect about 1e-7 relative)
  Extrusion                -> Mesh of its tessellation (caps + sides) plus the X3D fields as attributes
                              x3d:extrusion:crossSection / spine (double[]), so the parametric form comes back
  Material diffuseColor    -> primvars:displayColor
  head meta                -> layer customLayerData x3d:meta (ordered list of [name, content])
Stage: metersPerUnit 1, upAxis Y (X3D's own frame; the IFC frame Transform stays a Transform).
"""
from __future__ import annotations
import math, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

from pxr import Gf, Sdf, Usd, UsdGeom, UsdSemantics, Vt

META_TYPES = {"MetadataBoolean": Sdf.ValueTypeNames.BoolArray, "MetadataInteger": Sdf.ValueTypeNames.IntArray,
              "MetadataDouble": Sdf.ValueTypeNames.DoubleArray, "MetadataFloat": Sdf.ValueTypeNames.FloatArray,
              "MetadataString": Sdf.ValueTypeNames.StringArray}
GEOMETRY = {"IndexedTriangleSet", "Extrusion"}


# ---------------------------------------------------------------- small helpers
def mfstring(s):
    out, cur, i, inq = [], "", 0, False
    while i < len(s):
        c = s[i]
        if inq:
            if c == "\\" and i + 1 < len(s):
                cur += s[i + 1]; i += 1
            elif c == '"':
                out.append(cur); cur = ""; inq = False
            else:
                cur += c
        elif c == '"':
            inq = True
        i += 1
    return out


def mf_text(vals):
    return " ".join('"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"' for v in vals)


def ident(name, used):
    """A USD identifier for ``name`` that is unique within ``used``."""
    base = re.sub(r"[^A-Za-z0-9_]", "_", name) or "_"
    if base[0].isdigit():
        base = "_" + base
    out, k = base, 1
    while out in used:
        k += 1; out = f"{base}_{k}"
    used.add(out)
    return out


def aa_mat(t):
    """X3D Transform (translation, rotation, scale; no center or scaleOrientation) as a row-vector Gf.Matrix4d."""
    for f in ("center", "scaleOrientation", "scale"):
        if t.get(f) and f != "scale":
            raise SystemExit(f"Transform {f} not handled: refused")
    tx = [float(v) for v in (t.get("translation") or "0 0 0").split()]
    x, y, z, a = [float(v) for v in (t.get("rotation") or "0 0 1 0").split()]
    s = [float(v) for v in (t.get("scale") or "1 1 1").split()]
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, sn, k = math.cos(a), math.sin(a), 1 - math.cos(a)
    r = [[k * x * x + c, k * x * y - sn * z, k * x * z + sn * y],
         [k * x * y + sn * z, k * y * y + c, k * y * z - sn * x],
         [k * x * z - sn * y, k * y * z + sn * x, k * z * z + c]]
    # USD is row-vector: p' = p * M, so M = S * R^T with translation in the last row
    return Gf.Matrix4d(*[r[j][i] * s[i] for i in range(3) for j in range(3)][0:3], 0.0,
                       *[r[j][1] * s[1] for j in range(3)], 0.0,
                       *[r[j][2] * s[2] for j in range(3)], 0.0,
                       tx[0], tx[1], tx[2], 1.0)


def mat_tr(m):
    """Row-vector Gf.Matrix4d (no scale) -> X3D translation, rotation text."""
    r = [[m[j][i] for j in range(3)] for i in range(3)]
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
    t = (m[3][0], m[3][1], m[3][2])
    return (" ".join(repr(v) for v in t) if any(t) else None,
            " ".join(repr(v) for v in ax) if ax[3] else None)


def extrusion_mesh(ext):
    """Tessellate a straight-spine X3D Extrusion (closed crossSection, two spine points, no scale/orientation)."""
    for f in ("scale", "orientation"):
        if ext.get(f):
            raise SystemExit(f"Extrusion {f} not handled: refused")
    cs = [float(v) for v in ext.get("crossSection").split()]
    sp = [float(v) for v in ext.get("spine").split()]
    if len(sp) != 6 or sp[0] or sp[2] or sp[3] or sp[5]:
        raise SystemExit("Extrusion spine must be two points on +Y from the origin: refused")
    ring = [(cs[i], cs[i + 1]) for i in range(0, len(cs), 2)]
    if ring[0] == ring[-1]:
        ring = ring[:-1]
    y0, y1, n = sp[1], sp[4], len(ring)
    pts = [(x, y0, z) for x, z in ring] + [(x, y1, z) for x, z in ring]
    counts, idx = [], []
    for i in range(n):
        j = (i + 1) % n
        counts.append(4); idx += [i, j, n + j, n + i]
    counts += [n, n]
    idx += list(range(n - 1, -1, -1)) + list(range(n, 2 * n))
    return pts, counts, idx


# ---------------------------------------------------------------- X3D -> USD
def write_meta(prim, metas, prefix="x3d:meta"):
    used, order = set(), [0]

    def put(e, pre):
        name = e.get("name", "")
        key = f"{pre}:{ident(name, used)}"
        cd = {"x3d_node": e.tag, "x3d_name": name, "x3d_order": order[0]}
        order[0] += 1
        if e.get("reference") is not None:
            cd["x3d_reference"] = e.get("reference")
        if e.get("containerField") not in (None, "value", "metadata"):
            cd["x3d_containerField"] = e.get("containerField")
        if e.tag == "MetadataSet":
            a = prim.CreateAttribute(key + ":__set", Sdf.ValueTypeNames.Token, custom=True)
            a.Set("MetadataSet"); a.SetCustomData(cd)
            for c in e:
                if c.tag.startswith("Metadata"):
                    put(c, key)
            return
        v = e.get("value", "")
        if e.tag == "MetadataString":
            val = mfstring(v)
        elif e.tag == "MetadataBoolean":
            val = [w.lower() == "true" for w in v.replace(",", " ").split()]
        elif e.tag == "MetadataInteger":
            val = [int(w) for w in v.replace(",", " ").split()]
        else:
            val = [float(w) for w in v.replace(",", " ").split()]
        a = prim.CreateAttribute(key, META_TYPES[e.tag], custom=True)
        a.Set(val); a.SetCustomData(cd)

    for m in metas:
        put(m, prefix)


def ifc_class(metas):
    for m in metas:
        if m.tag == "MetadataSet" and m.get("name") == "IFC":
            for c in m:
                if c.get("name") == "class":
                    return (mfstring(c.get("value")) or [None])[0]
    return None


def to_usd(src: Path, out: Path):
    root = ET.parse(src).getroot()
    stage = Usd.Stage.CreateNew(str(out))
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
    layer = stage.GetRootLayer()
    heads = list(root.find("head").iter("meta"))
    layer.customLayerData = {"x3d_metaNames": Vt.StringArray([m.get("name") for m in heads]),
                             "x3d_metaContents": Vt.StringArray([m.get("content") for m in heads]),
                             "x3d_profile": root.get("profile"), "x3d_version": root.get("version"),
                             "x3d_source": src.name}
    world = UsdGeom.Xform.Define(stage, "/World")
    stage.SetDefaultPrim(world.GetPrim())
    counts = {"xforms": 0, "meshes": 0, "extrusions": 0, "meta_attributes": 0, "labels": 0}

    def node(e, parent_path, used):
        tag = e.tag
        metas = [c for c in e if c.tag.startswith("Metadata") and c.get("containerField", "metadata") == "metadata"]
        if tag in ("Group", "Transform"):
            name = ident(e.get("DEF") or tag, used)
            x = UsdGeom.Xform.Define(stage, parent_path.AppendChild(name))
            p = x.GetPrim()
            p.SetCustomDataByKey("x3d_node", tag)
            if e.get("DEF"):
                p.SetCustomDataByKey("x3d_DEF", e.get("DEF"))
            if tag == "Transform" and (e.get("translation") or e.get("rotation") or e.get("scale")):
                x.AddTransformOp(UsdGeom.XformOp.PrecisionDouble).Set(aa_mat(e))
            write_meta(p, metas)
            cls = ifc_class(metas)
            if cls:
                lab = UsdSemantics.LabelsAPI.Apply(p, "ifc")
                lab.CreateLabelsAttr().Set([cls]); counts["labels"] += 1
            counts["xforms"] += 1
            kids = set()
            for c in e:
                if not c.tag.startswith("Metadata"):
                    node(c, p.GetPath(), kids)
        elif tag == "Shape":
            geom = [c for c in e if c.tag in GEOMETRY]
            other = [c for c in e if not c.tag.startswith("Metadata") and c.tag not in GEOMETRY and c.tag != "Appearance"]
            if len(geom) != 1 or other:
                raise SystemExit(f"Shape with {[c.tag for c in e]}: refused")
            g = geom[0]
            name = ident(e.get("DEF") or "Shape", used)
            mesh = UsdGeom.Mesh.Define(stage, parent_path.AppendChild(name))
            p = mesh.GetPrim()
            p.SetCustomDataByKey("x3d_node", "Shape")
            p.SetCustomDataByKey("x3d_geometry", g.tag)
            if g.tag == "IndexedTriangleSet":
                pts = [float(v) for v in g.find("Coordinate").get("point").split()]
                idx = [int(v) for v in g.get("index").split()]
                mesh.CreatePointsAttr([Gf.Vec3f(*pts[i:i + 3]) for i in range(0, len(pts), 3)])
                mesh.CreateFaceVertexCountsAttr([3] * (len(idx) // 3))
                mesh.CreateFaceVertexIndicesAttr(idx)
            else:
                pts, fc, idx = extrusion_mesh(g)
                mesh.CreatePointsAttr([Gf.Vec3f(*q) for q in pts])
                mesh.CreateFaceVertexCountsAttr(fc)
                mesh.CreateFaceVertexIndicesAttr(idx)
                for f in ("crossSection", "spine"):
                    p.CreateAttribute(f"x3d:extrusion:{f}", Sdf.ValueTypeNames.DoubleArray, custom=True).Set(
                        [float(v) for v in g.get(f).split()])
                for f in ("beginCap", "endCap", "solid"):
                    if g.get(f) is not None:
                        p.CreateAttribute(f"x3d:extrusion:{f}", Sdf.ValueTypeNames.Bool, custom=True).Set(g.get(f) == "true")
                counts["extrusions"] += 1
            mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
            mesh.CreateDoubleSidedAttr(g.get("solid", "true") != "true")
            mat = e.find("Appearance/Material")
            if mat is not None and mat.get("diffuseColor"):
                mesh.CreateDisplayColorAttr([Gf.Vec3f(*[float(v) for v in mat.get("diffuseColor").split()])])
            write_meta(p, metas)
            counts["meshes"] += 1
        elif tag == "WorldInfo":
            stage.GetRootLayer().customLayerData = dict(stage.GetRootLayer().customLayerData, **{"x3d_WorldInfo_title": e.get("title", "")})
        else:
            raise SystemExit(f"node {tag} not handled: refused")

    used = set()
    for c in root.find("Scene"):
        node(c, world.GetPrim().GetPath(), used)
    counts["meta_attributes"] = sum(1 for p in stage.Traverse() for a in p.GetAttributes() if a.GetName().startswith("x3d:meta"))
    stage.GetRootLayer().Save()
    return counts


# ---------------------------------------------------------------- USD -> X3D
def read_meta(prim):
    """Rebuild the ordered Metadata* trees from x3d:meta attributes."""
    attrs = [a for a in prim.GetAttributes() if a.GetName().startswith("x3d:meta:")]
    attrs.sort(key=lambda a: a.GetCustomData().get("x3d_order", 0))
    nodes = {}
    tops = []
    for a in attrs:
        nm = a.GetName()
        cd = a.GetCustomData()
        is_set = nm.endswith(":__set")
        key = nm[:-6] if is_set else nm
        parent_key = key.rsplit(":", 1)[0]
        e = ET.Element(cd["x3d_node"], {"name": cd.get("x3d_name", "")})
        if "x3d_reference" in cd:
            e.set("reference", cd["x3d_reference"])
        if not is_set:
            v = list(a.Get())
            if e.tag == "MetadataString":
                e.set("value", mf_text(v))
            elif e.tag == "MetadataBoolean":
                e.set("value", " ".join("true" if b else "false" for b in v))
            elif e.tag == "MetadataInteger":
                e.set("value", " ".join(str(int(i)) for i in v))
            else:
                e.set("value", " ".join(repr(float(d)) for d in v))
        nodes[key] = e
        if parent_key in nodes:
            e.set("containerField", cd.get("x3d_containerField", "value"))
            nodes[parent_key].append(e)
        else:
            e.set("containerField", "metadata")
            tops.append(e)
    return tops


def to_x3d(src: Path, out: Path):
    stage = Usd.Stage.Open(str(src))
    cld = stage.GetRootLayer().customLayerData
    root = ET.Element("X3D", {"profile": cld.get("x3d_profile", "Immersive"), "version": cld.get("x3d_version", "4.0"),
                              "xmlns:xsd": "http://www.w3.org/2001/XMLSchema-instance",
                              "xsd:noNamespaceSchemaLocation": "https://www.web3d.org/specifications/x3d-4.0.xsd"})
    head = ET.SubElement(root, "head")
    for name, content in zip(cld.get("x3d_metaNames", []), cld.get("x3d_metaContents", [])):
        ET.SubElement(head, "meta", {"name": name, "content": content})
    scene = ET.SubElement(root, "Scene")
    if "x3d_WorldInfo_title" in cld:
        ET.SubElement(scene, "WorldInfo", {"title": cld["x3d_WorldInfo_title"]})

    def emit(p, parent):
        cd = p.GetCustomData()
        kind = cd.get("x3d_node")
        if kind in ("Group", "Transform"):
            e = ET.SubElement(parent, kind)
            if cd.get("x3d_DEF"):
                e.set("DEF", cd["x3d_DEF"])
            if kind == "Transform":
                ops = UsdGeom.Xformable(p).GetOrderedXformOps()
                if ops:
                    t, r = mat_tr(ops[0].Get())
                    if t: e.set("translation", t)
                    if r: e.set("rotation", r)
            for m in read_meta(p):
                e.append(m)
            for c in p.GetChildren():
                emit(c, e)
        elif kind == "Shape":
            e = ET.SubElement(parent, "Shape")
            for m in read_meta(p):
                e.append(m)
            mesh = UsdGeom.Mesh(p)
            dc = mesh.GetDisplayColorAttr().Get()
            if dc:
                ET.SubElement(ET.SubElement(e, "Appearance"), "Material",
                              {"diffuseColor": " ".join(repr(round(float(v), 7)) for v in dc[0])})
            if cd.get("x3d_geometry") == "Extrusion":
                g = {"crossSection": " ".join(repr(v) for v in p.GetAttribute("x3d:extrusion:crossSection").Get()),
                     "spine": " ".join(repr(v) for v in p.GetAttribute("x3d:extrusion:spine").Get())}
                for f in ("beginCap", "endCap", "solid"):
                    a = p.GetAttribute(f"x3d:extrusion:{f}")
                    if a and a.HasValue():
                        g[f] = "true" if a.Get() else "false"
                ET.SubElement(e, "Extrusion", g)
            else:
                pts = mesh.GetPointsAttr().Get()
                idx = list(mesh.GetFaceVertexIndicesAttr().Get())
                its = ET.SubElement(e, "IndexedTriangleSet", {"solid": "false" if mesh.GetDoubleSidedAttr().Get() else "true",
                                                              "index": " ".join(map(str, idx))})
                # float32 points written as the shortest text that reads back to the same float32
                ET.SubElement(its, "Coordinate", {"point": " ".join(f"{float(c):.9g}" for q in pts for c in q)})
        else:
            raise SystemExit(f"prim {p.GetPath()} has no x3d:node: refused")

    for c in stage.GetDefaultPrim().GetChildren():
        emit(c, scene)
    ET.indent(root)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n")


if __name__ == "__main__":
    cmd, a, b = sys.argv[1:4]
    print(to_usd(Path(a), Path(b)) if cmd == "to-usd" else to_x3d(Path(a), Path(b)))
