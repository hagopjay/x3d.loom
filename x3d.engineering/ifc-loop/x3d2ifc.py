#!/usr/bin/env python3
"""X3D (as written by ifc2x3d.py) back to IFC4, reading nothing but the X3D file.

  python3 x3d2ifc.py IN.x3d OUT.ifc [--witness OUT.json]

Rebuilds: the spatial tree and its relations with their GlobalIds, every product with its class, GlobalId and
direct attributes, every property set with typed values, world placements, and bodies (IfcExtrudedAreaSolid from
X3D Extrusion + its ifc:body numbers; IfcTriangulatedFaceSet from IndexedTriangleSet). The witness file says, per
extrusion, whether the native X3D Extrusion geometry agrees with the ifc:body numbers, so neither carrier is
trusted alone. Lengths are converted back with the head's ifc:lengthUnitScale and rounded to 1e-9 of a file unit.
"""
from __future__ import annotations
import json, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

import ifcopenshell
import ifcopenshell.guid

ROUND = 9


def mf(s):
    """Parse an MFString attribute value into a list of strings."""
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


def meta_value(e):
    tag, v = e.tag, e.get("value", "")
    if tag == "MetadataBoolean":
        return v.strip().lower() == "true"
    if tag == "MetadataInteger":
        return int(v.split()[0])
    if tag == "MetadataDouble" or tag == "MetadataFloat":
        return float(v.split()[0])
    return mf(v)[0] if mf(v) else ""


def ifc_set(node):
    for c in node:
        if c.tag == "MetadataSet" and c.get("name") == "IFC" and c.get("containerField", "metadata") == "metadata":
            return c
    return None


def aa_to_mat(ax):
    x, y, z, a = ax
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, s, t = math.cos(a), math.sin(a), 1 - math.cos(a)
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]


def tr_of(t):
    tr = [float(v) for v in (t.get("translation") or "0 0 0").split()]
    rot = [float(v) for v in (t.get("rotation") or "0 0 1 0").split()]
    return tr, aa_to_mat(rot)


class Builder:
    def __init__(self, scale):
        self.f = ifcopenshell.file(schema="IFC4")
        self.scale = scale
        f = self.f
        prefix = {0.001: ".MILLI."}.get(scale)
        units = [f.createIfcSIUnit(None, "LENGTHUNIT", prefix and prefix.strip("."), "METRE"),
                 f.createIfcSIUnit(None, "AREAUNIT", None, "SQUARE_METRE"),
                 f.createIfcSIUnit(None, "VOLUMEUNIT", None, "CUBIC_METRE")]
        self.units = f.createIfcUnitAssignment(units)
        wcs = f.createIfcAxis2Placement3D(f.createIfcCartesianPoint((0.0, 0.0, 0.0)), None, None)
        self.ctx = f.createIfcGeometricRepresentationContext(None, "Model", 3, 1.0e-5, wcs, None)
        self.body = f.createIfcGeometricRepresentationSubContext("Body", "Model", None, None, None, None, self.ctx,
                                                                 None, "MODEL_VIEW", None)
        self.witness = []
        self.world, self.relto = {}, {}

    def L(self, x):
        return round(x / self.scale, ROUND) + 0.0

    def placement(self, origin, m):
        f = self.f
        loc = f.createIfcCartesianPoint(tuple(self.L(c) for c in origin))
        z = tuple(round(m[i][2], 12) + 0.0 for i in range(3))
        x = tuple(round(m[i][0], 12) + 0.0 for i in range(3))
        return f.createIfcAxis2Placement3D(loc, f.createIfcDirection(z), f.createIfcDirection(x))

    def entity(self, ms):
        vals = {e.get("name"): (e, meta_value(e)) for e in ms if e.tag.startswith("Metadata") and e.tag != "MetadataSet"}
        cls = vals["class"][1]
        ent = self.f.create_entity(cls, GlobalId=vals["GlobalId"][1])
        for name, (e, v) in vals.items():
            if e.get("reference") == "attr":
                setattr(ent, name, v)
        for ps in ms:
            if ps.tag == "MetadataSet" and ps.get("reference") == "IfcPropertySet":
                self.pset(ent, ps)
        rel = vals.get("relGlobalId")
        return ent, (rel[1], rel[0].get("reference")) if rel else None

    def pset(self, ent, ps):
        f = self.f
        props, pg, rg = [], None, None
        for e in ps:
            n = e.get("name")
            if n == "psetGlobalId":
                pg = meta_value(e)
            elif n == "relGlobalId":
                rg = meta_value(e)
            elif e.get("reference"):
                props.append(f.createIfcPropertySingleValue(n, None, f.create_entity(e.get("reference"), meta_value(e)), None))
        pset = f.createIfcPropertySet(pg or ifcopenshell.guid.new(), None, ps.get("name"), None, props)
        f.createIfcRelDefinesByProperties(rg or ifcopenshell.guid.new(), None, None, None, [ent], pset)

    def profile(self, ms):
        kw = {e.get("name"): meta_value(e) for e in ms if e.get("reference") == "attr"}
        return self.f.create_entity(ms.get("reference"), **kw)

    def extrusion(self, bm_el):
        f = self.f
        vals = {e.get("name"): e for e in bm_el if e.tag != "MetadataSet"}
        prof = self.profile(next(e for e in bm_el if e.tag == "MetadataSet" and e.get("name") == "SweptArea"))
        pos = None
        if "Position" in vals:
            v = [float(x) for x in vals["Position"].get("value").split()]
            pos = f.createIfcAxis2Placement3D(f.createIfcCartesianPoint(tuple(v[0:3])), f.createIfcDirection(tuple(v[3:6])),
                                              f.createIfcDirection(tuple(v[6:9])))
        d = tuple(float(x) for x in vals["ExtrudedDirection"].get("value").split())
        return f.createIfcExtrudedAreaSolid(prof, pos, f.createIfcDirection(d), meta_value(vals["Depth"]))

    def mesh_witness(self, item, its):
        """The triangles a viewer draws against the solid the numbers rebuild: bounding box and volume."""
        import ifcopenshell.geom
        g = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), item)
        pts = [float(v) for v in its.find("Coordinate").get("point").split()]
        idx = [int(v) for v in its.get("index").split()]

        def q(p, ix):
            v = [p[i:i + 3] for i in range(0, len(p), 3)]
            vol = 0.0
            for k in range(0, len(ix), 3):
                a, b, c = v[ix[k]], v[ix[k + 1]], v[ix[k + 2]]
                vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
            return [min(x[i] for x in v) for i in range(3)] + [max(x[i] for x in v) for i in range(3)], abs(vol)
        bx, vx = q(pts, idx)
        bi, vi = q(list(g.verts), list(g.faces))
        return {"bbox_m": {"ifc_body": 0.0, "x3d_extrusion": max(abs(a - b) for a, b in zip(bx, bi)),
                           "agree": max(abs(a - b) for a, b in zip(bx, bi)) <= 1e-6},
                "volume": {"ifc_body": vi, "x3d_extrusion": vx, "agree": abs(vi - vx) <= 1e-6 * max(vi, 1e-12)}}

    def body_items(self, t):
        """Bodies under a product Transform: (item, representation type)."""
        f = self.f
        out = []
        for c in t:
            if c.tag == "Shape":
                bm = next((e for e in c if e.tag == "MetadataSet" and e.get("name") == "ifc:body"), None)
                if bm is not None:  # an extrusion with no native X3D node: rebuilt from its numbers
                    item = self.extrusion(bm)
                    self.witness.append(self.mesh_witness(item, c.find("IndexedTriangleSet")))
                    out.append((item, "SweptSolid"))
                    continue
                its = c.find("IndexedTriangleSet")
                if its is None:
                    raise SystemExit("unhandled Shape geometry: refused")
                pts = [float(v) for v in its.find("Coordinate").get("point").split()]
                idx = [int(v) for v in its.get("index").split()]
                coords = f.createIfcCartesianPointList3D([tuple(self.L(c) for c in pts[i:i + 3]) for i in range(0, len(pts), 3)])
                tris = [tuple(i + 1 for i in idx[k:k + 3]) for k in range(0, len(idx), 3)]
                out.append((f.createIfcTriangulatedFaceSet(coords, None, its.get("solid", "true") == "true", tris, None),
                            "Tessellation"))
            elif c.tag == "Transform" and c.find("Transform/Shape/Extrusion") is not None:
                shape = c.find("Transform/Shape")
                ext = shape.find("Extrusion")
                bm = next(e for e in shape if e.tag == "MetadataSet" and e.get("name") == "ifc:body")
                item = self.extrusion(bm)
                cs = [float(v) for v in ext.get("crossSection").split()]
                sp = [float(v) for v in ext.get("spine").split()]
                xs, zs = cs[0::2], cs[1::2]
                geo = {"XDim": self.L(max(xs) - min(xs)), "YDim": self.L(max(zs) - min(zs)),
                       "Depth": self.L(math.dist(sp[0:3], sp[3:6]))}
                ref = {"XDim": item.SweptArea.XDim, "YDim": item.SweptArea.YDim, "Depth": item.Depth}
                o, m = tr_of(c)
                if item.Position is not None:
                    po = item.Position.Location.Coordinates
                    geo["Position"] = max(abs(self.L(o[i]) - po[i]) for i in range(3)); ref["Position"] = 0.0
                self.witness.append({k: {"ifc_body": ref[k], "x3d_extrusion": geo[k],
                                         "agree": abs(ref[k] - geo[k]) <= 1e-6 * max(1.0, abs(ref[k]))} for k in geo})
                out.append((item, "SweptSolid"))
        return out

    def product(self, t):
        ms = ifc_set(t)
        ent, _ = self.entity(ms)
        self.world[ent.GlobalId] = tr_of(t)
        self.relto[ent.GlobalId] = next((meta_value(e) for e in ms if e.get("name") == "placementRelTo"), None)
        reps = [self.f.createIfcShapeRepresentation(self.body, "Body", rt, [it]) for it, rt in self.body_items(t)]
        if reps:
            ent.Representation = self.f.createIfcProductDefinitionShape(None, None, reps)
        return ent

    def walk(self, g, parent=None, aggs=None):
        ms = ifc_set(g)
        ent, rel = self.entity(ms)
        pw = next((e for e in ms if e.get("name") == "placementWorld"), None)
        if pw is not None:
            v = [float(x) for x in pw.get("value").split()]
            z, x = v[3:6], v[6:9]
            y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
            self.world[ent.GlobalId] = ([c * self.scale for c in v[0:3]], [[x[i], y[i], z[i]] for i in range(3)])
            self.relto[ent.GlobalId] = next((meta_value(e) for e in ms if e.get("name") == "placementRelTo"), None)
        if ent.is_a("IfcProject"):
            ent.RepresentationContexts = [self.ctx]
            ent.UnitsInContext = self.units
        if parent is not None and rel:
            aggs.setdefault((parent, rel[0]), []).append(ent)
        for c in g:
            if c.tag != "Group":
                continue
            cms = ifc_set(c)
            cls = next(meta_value(e) for e in cms if e.get("name") == "class")
            if cls == "IfcRelContainedInSpatialStructure":
                rg = next(meta_value(e) for e in cms if e.get("name") == "GlobalId")
                prods = [self.product(t) for t in c if t.tag == "Transform"]
                self.f.createIfcRelContainedInSpatialStructure(rg, None, None, None, prods, ent)
            else:
                self.walk(c, ent, aggs)
        return ent

    def place_all(self):
        """Placements last, parents first: a relative placement is inverse(parent world) x world, so the IFC keeps
        its placement chain while the X3D keeps world transforms a viewer can draw."""
        f, done = self.f, {}
        byid = {e.GlobalId: e for e in f.by_type("IfcProduct")}

        def place(g):
            if g in done:
                return done[g]
            o, m = self.world[g]
            par = self.relto.get(g)
            if par:
                plp = place(par)
                po, pm = self.world[par]
                d = [o[i] - po[i] for i in range(3)]
                o = [sum(pm[k][i] * d[k] for k in range(3)) for i in range(3)]
                m = [[sum(pm[k][i] * m[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
            else:
                plp = None
            lp = f.createIfcLocalPlacement(plp, self.placement(o, m))
            byid[g].ObjectPlacement = lp
            done[g] = lp
            return lp

        for g in self.world:
            place(g)


def convert(src: Path, out: Path, witness: Path | None = None):
    root = ET.parse(src).getroot()
    metas = {m.get("name"): m.get("content") for m in root.iter("meta")}
    b = Builder(float(metas["ifc:lengthUnitScale"]))
    frame = next(e for e in root.iter("Transform") if e.get("DEF") == "IFC_ZUP_TO_YUP")
    aggs = {}
    for g in frame:
        if g.tag == "Group":
            b.walk(g, None, aggs)
    b.place_all()
    for (parent, rg), kids in aggs.items():
        b.f.createIfcRelAggregates(rg, None, None, None, parent, kids)
    b.f.header.file_name.name = metas.get("ifc:headerFileName", out.name)
    b.f.write(str(out))
    if witness:
        witness.write_text(json.dumps({"extrusions": len(b.witness),
                                       "all_agree": all(v["agree"] for w in b.witness for v in w.values()),
                                       "rows": b.witness}, indent=1))
    return len(b.witness)


if __name__ == "__main__":
    w = Path(sys.argv[sys.argv.index("--witness") + 1]) if "--witness" in sys.argv else None
    print(convert(Path(sys.argv[1]), Path(sys.argv[2]), w))
