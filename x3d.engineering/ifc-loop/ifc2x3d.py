#!/usr/bin/env python3
"""IFC4 to X3D 4.0 that carries what the #234 loss receipt says is lost: the spatial tree, every property set,
and the parameters of extruded solids. Companion of x3d2ifc.py; loop_receipt.py measures the loop IFC -> X3D -> IFC.

  python3 ifc2x3d.py IN.ifc OUT.x3d

How each IFC thing travels (all standard X3D 4.0, no extension node):
  IfcProject / IfcSite / IfcBuilding / IfcBuildingStorey -> nested Group, MetadataSet name="IFC" on each
  IfcRelAggregates, IfcRelContainedInSpatialStructure -> the nesting itself, plus the relation's GlobalId
  products -> Transform (world placement, metres) holding a Shape; MetadataSet name="IFC"
  every direct attribute (Name, Description, ObjectType, Tag, PredefinedType, Elevation, ...) -> typed Metadata*
  IfcPropertySet -> MetadataSet name=<pset name> reference="IfcPropertySet"; each value typed, IFC value type in `reference`
  IfcExtrudedAreaSolid + IfcRectangleProfileDef -> native X3D Extrusion (crossSection + spine) inside a Transform
      for the solid's Position; exact IFC numbers also in MetadataSet name="ifc:body"
  IfcTriangulatedFaceSet -> IndexedTriangleSet, coordinates copied, indices made 0-based
Lengths are converted to metres with the file's unit scale; the scale is recorded in the head.
Needs ifcopenshell (0.9.0.post1 used).
"""
from __future__ import annotations
import hashlib, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.unit as uu

GEOM = ifcopenshell.geom.settings()

SPATIAL = ("IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace")
SKIP_ATTR = {"id", "type", "OwnerHistory", "ObjectPlacement", "Representation", "RepresentationContexts",
             "UnitsInContext", "GlobalId"}
SURFACE_RGB = {"bronze": "0.55 0.38 0.2", "stone": "0.78 0.75 0.68", "oak": "0.62 0.45 0.28",
               "glass": "0.6 0.75 0.8", "limestone": "0.85 0.82 0.72", "steel": "0.5 0.52 0.55"}


def mfstr(*vals):
    return " ".join('"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"' for v in vals)


def num(x):
    return repr(float(x)) if not float(x).is_integer() else str(int(x)) if abs(x) < 1e15 else repr(float(x))


def defname(guid):
    return "g" + guid.replace("$", "__")  # 22-char GUID: a "$" turns into 2 chars, so no clash


def meta_value(parent, name, value, ifc_type=None):
    """One typed Metadata* child. ifc_type (e.g. IfcLabel) rides in `reference` so the rebuild restores it."""
    if isinstance(value, bool):
        tag, text = "MetadataBoolean", "true" if value else "false"
    elif isinstance(value, int):
        tag, text = "MetadataInteger", str(value)
    elif isinstance(value, float):
        tag, text = "MetadataDouble", repr(value)
    else:
        tag, text = "MetadataString", mfstr(value)
    e = ET.SubElement(parent, tag, {"containerField": "value", "name": name, "value": text})
    if ifc_type:
        e.set("reference", ifc_type)
    return e


def ifc_metadata(parent, ent, rel_guid=None, rel_kind=None):
    ms = ET.SubElement(parent, "MetadataSet", {"containerField": "metadata", "name": "IFC", "reference": "IFC4"})
    meta_value(ms, "GlobalId", ent.GlobalId)
    meta_value(ms, "class", ent.is_a())
    for k, v in ent.get_info(recursive=False).items():
        if k in SKIP_ATTR or v is None or isinstance(v, ifcopenshell.entity_instance) or isinstance(v, tuple):
            continue
        meta_value(ms, k, v, "attr")
    if rel_guid:
        meta_value(ms, "relGlobalId", rel_guid, rel_kind)
    lp = getattr(ent, "ObjectPlacement", None)
    if lp is not None:
        if lp.PlacementRelTo is not None:
            meta_value(ms, "placementRelTo", lp.PlacementRelTo.PlacesObject[0].GlobalId, "IfcLocalPlacement")
        if ent.is_a() in SPATIAL:  # a Group has no transform of its own: its world placement rides here
            o, m = placement_world(lp)
            ET.SubElement(ms, "MetadataDouble", {"containerField": "value", "name": "placementWorld",
                                                 "reference": "origin(file units) z-axis x-axis",
                                                 "value": " ".join(repr(float(c)) for c in o + [m[i][2] for i in range(3)] + [m[i][0] for i in range(3)])})
    for rel in getattr(ent, "IsDefinedBy", []) or []:
        if rel.is_a("IfcRelDefinesByProperties") and rel.RelatingPropertyDefinition.is_a("IfcPropertySet"):
            ps = rel.RelatingPropertyDefinition
            pm = ET.SubElement(ms, "MetadataSet", {"containerField": "value", "name": ps.Name or "",
                                                  "reference": "IfcPropertySet"})
            meta_value(pm, "psetGlobalId", ps.GlobalId)
            meta_value(pm, "relGlobalId", rel.GlobalId)
            for pr in ps.HasProperties:
                if pr.is_a("IfcPropertySingleValue") and pr.NominalValue is not None:
                    meta_value(pm, pr.Name, pr.NominalValue.wrappedValue, pr.NominalValue.is_a())
    return ms


def mat_to_axis_angle(m):
    """3x3 rotation (rows) to X3D axis-angle."""
    tr = m[0][0] + m[1][1] + m[2][2]
    ang = math.acos(max(-1.0, min(1.0, (tr - 1) / 2)))
    if ang < 1e-12:
        return (0.0, 0.0, 1.0, 0.0)
    if abs(ang - math.pi) < 1e-6:
        xx, yy, zz = [(m[i][i] + 1) / 2 for i in range(3)]
        x, y, z = math.sqrt(max(xx, 0)), math.sqrt(max(yy, 0)), math.sqrt(max(zz, 0))
        if x > 1e-6:
            y, z = math.copysign(y, m[0][1]), math.copysign(z, m[0][2])
        elif y > 1e-6:
            z = math.copysign(z, m[1][2])
        return (x, y, z, ang)
    s = 2 * math.sin(ang)
    return ((m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, ang)


def axis2placement(p):
    """IfcAxis2Placement3D -> (origin, 3x3 matrix with columns x, y, z)."""
    o = list(p.Location.Coordinates) + [0.0] * (3 - len(p.Location.Coordinates))
    z = list(p.Axis.DirectionRatios) if p.Axis else [0.0, 0.0, 1.0]
    x = list(p.RefDirection.DirectionRatios) if p.RefDirection else [1.0, 0.0, 0.0]
    n = math.sqrt(sum(c * c for c in z)); z = [c / n for c in z]
    d = sum(a * b for a, b in zip(x, z)); x = [a - d * b for a, b in zip(x, z)]
    n = math.sqrt(sum(c * c for c in x)); x = [c / n for c in x]
    y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
    return o, [[x[i], y[i], z[i]] for i in range(3)]


def placement_world(lp):
    """IfcLocalPlacement chain -> world (origin, matrix)."""
    o, m = axis2placement(lp.RelativePlacement)
    if lp.PlacementRelTo:
        po, pm = placement_world(lp.PlacementRelTo)
        o = [po[i] + sum(pm[i][k] * o[k] for k in range(3)) for i in range(3)]
        m = [[sum(pm[i][k] * m[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return o, m


def write_transform(parent, origin, m, scale, extra=None):
    t = ET.SubElement(parent, "Transform", extra or {})
    if any(abs(c) > 0 for c in origin):
        t.set("translation", " ".join(num(c * scale) for c in origin))
    ax = mat_to_axis_angle(m)
    if ax[3] != 0.0:
        t.set("rotation", " ".join(repr(c) for c in ax))
    return t


def write_body(t, item, scale, rgb):
    shape = ET.SubElement(t, "Shape")
    app = ET.SubElement(shape, "Appearance")
    ET.SubElement(app, "Material", {"diffuseColor": rgb})
    if item.is_a("IfcTriangulatedFaceSet"):
        its = ET.SubElement(shape, "IndexedTriangleSet", {
            "solid": "true" if item.Closed else "false",
            "index": " ".join(str(i - 1) for tri in item.CoordIndex for i in tri)})
        ET.SubElement(its, "Coordinate", {"point": " ".join(num(c * scale) for p in item.Coordinates.CoordList for c in p)})
        return "IfcTriangulatedFaceSet"
    if item.is_a("IfcExtrudedAreaSolid") and item.SweptArea.Position is None:
        pr = item.SweptArea
        body = ET.Element("MetadataSet", {"containerField": "metadata", "name": "ifc:body",
                                          "reference": "IfcExtrudedAreaSolid"})
        meta_value(body, "Depth", float(item.Depth), "IfcPositiveLengthMeasure")
        ed = ET.SubElement(body, "MetadataDouble", {"containerField": "value", "name": "ExtrudedDirection",
                                                   "value": " ".join(repr(float(c)) for c in item.ExtrudedDirection.DirectionRatios)})
        if item.Position is not None:
            o, m = axis2placement(item.Position)
            ET.SubElement(body, "MetadataDouble", {"containerField": "value", "name": "Position",
                                                   "value": " ".join(repr(float(c)) for c in o + [m[i][2] for i in range(3)] + [m[i][0] for i in range(3)])})
        prof = ET.SubElement(body, "MetadataSet", {"containerField": "value", "name": "SweptArea", "reference": pr.is_a()})
        for k, v in pr.get_info(recursive=False).items():
            if k in ("id", "type") or v is None:
                continue
            if isinstance(v, (ifcopenshell.entity_instance, tuple)):
                raise SystemExit(f"profile {pr.is_a()}.{k} is an entity: refused, not guessed")
            meta_value(prof, k, v, "attr")
        native = pr.is_a() == "IfcRectangleProfileDef" and tuple(item.ExtrudedDirection.DirectionRatios) == (0.0, 0.0, 1.0)
        ed.set("reference", "native X3D Extrusion" if native else "tessellated by ifcopenshell.geom")
        if native:
            hx, hy, d = pr.XDim * scale / 2, pr.YDim * scale / 2, item.Depth * scale
            # Extrusion frame E: spine along +Y; IFC solid frame S: extrude along +z. E -> S is a +90 deg turn
            # about x, so the cross-section point (x, z) in E is the profile point (x, -z): profile (px, py) -> (px, -py).
            cs = [(px, -py) for px, py in [(hx, -hy), (hx, hy), (-hx, hy), (-hx, -hy), (hx, -hy)]]
            shape.remove(app); t.remove(shape)
            ts = write_transform(t, o, m, scale) if item.Position is not None else ET.SubElement(t, "Transform")
            inner = ET.SubElement(ts, "Transform", {"rotation": "1 0 0 " + repr(math.pi / 2)})
            shape = ET.SubElement(inner, "Shape")
            shape.append(body)  # the XSD wants metadata before appearance and geometry
            shape.append(app)
            ET.SubElement(shape, "Extrusion", {
                "crossSection": " ".join(num(c) for p in cs for c in p),
                "spine": "0 0 0 0 " + num(d) + " 0", "beginCap": "true", "endCap": "true", "solid": "true"})
        else:
            # no native X3D node for this profile (a hollow section needs a hole): triangles for the eye, every
            # IFC number in ifc:body for the rebuild.
            g = ifcopenshell.geom.create_shape(GEOM, item)
            shape.insert(0, body)
            ET.SubElement(ET.SubElement(shape, "IndexedTriangleSet", {"solid": "true", "index": " ".join(str(i) for i in g.faces)}),
                          "Coordinate", {"point": " ".join(num(round(c, 12)) for c in g.verts)})
        return "IfcExtrudedAreaSolid"
    raise SystemExit(f"unhandled body {item.is_a()}: refused, not guessed")


def convert(src: Path, out: Path):
    f = ifcopenshell.open(str(src))
    scale = uu.calculate_unit_scale(f)
    root = ET.Element("X3D", {"profile": "Immersive", "version": "4.0",
                              "xmlns:xsd": "http://www.w3.org/2001/XMLSchema-instance",
                              "xsd:noNamespaceSchemaLocation": "https://www.web3d.org/specifications/x3d-4.0.xsd"})
    head = ET.SubElement(root, "head")
    for k, v in [("title", out.name), ("generator", "x3d.loom ifc-loop/ifc2x3d.py"),
                 ("ifc:schema", f.schema), ("ifc:sourceSha256", hashlib.sha256(src.read_bytes()).hexdigest()),
                 ("ifc:lengthUnitScale", repr(scale)), ("ifc:frame", "IFC z-up under Transform IFC_ZUP_TO_YUP"),
                 ("ifc:headerFileName", f.header.file_name.name)]:
        ET.SubElement(head, "meta", {"name": k, "content": v})
    scene = ET.SubElement(root, "Scene")
    ET.SubElement(scene, "WorldInfo", {"title": "IFC loop: " + src.name})
    frame = ET.SubElement(scene, "Transform", {"DEF": "IFC_ZUP_TO_YUP", "rotation": "1 0 0 " + repr(-math.pi / 2)})
    counts = {"spatial": 0, "products": 0, "psets": 0, "extrusions": 0, "tessellations": 0}

    def walk(ent, parent, rel_guid=None, rel_kind=None):
        g = ET.SubElement(parent, "Group", {"DEF": defname(ent.GlobalId)})
        ifc_metadata(g, ent, rel_guid, rel_kind)
        counts["spatial"] += 1
        for rel in getattr(ent, "IsDecomposedBy", []) or []:
            for child in rel.RelatedObjects:
                walk(child, g, rel.GlobalId, "IfcRelAggregates")
        for rel in getattr(ent, "ContainsElements", []) or []:
            holder = ET.SubElement(g, "Group", {"DEF": "c" + defname(rel.GlobalId)[1:]})
            hm = ET.SubElement(holder, "MetadataSet", {"containerField": "metadata", "name": "IFC"})
            meta_value(hm, "class", "IfcRelContainedInSpatialStructure")
            meta_value(hm, "GlobalId", rel.GlobalId)
            for el in sorted(rel.RelatedElements, key=lambda e: e.GlobalId):
                product(el, holder)

    def product(el, parent):
        o, m = placement_world(el.ObjectPlacement)
        t = write_transform(parent, o, m, scale, {"DEF": defname(el.GlobalId)})
        md = ifc_metadata(t, el)
        counts["products"] += 1
        counts["psets"] += sum(1 for e in md if e.get("reference") == "IfcPropertySet")
        surface = next((e.get("value").strip('"') for e in md.iter("MetadataString") if e.get("name") == "Surface"), "")
        rgb = SURFACE_RGB.get(surface.split()[0].lower() if surface else "", "0.7 0.7 0.7")
        for rep in el.Representation.Representations if el.Representation else []:
            for item in rep.Items:
                k = write_body(t, item, scale, rgb)
                counts["extrusions" if k == "IfcExtrudedAreaSolid" else "tessellations"] += 1

    for proj in f.by_type("IfcProject"):
        walk(proj, frame)
    ET.indent(root)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" '
                   '"https://www.web3d.org/specifications/x3d-4.0.dtd">\n' + ET.tostring(root, encoding="unicode") + "\n")
    return counts


if __name__ == "__main__":
    print(convert(Path(sys.argv[1]), Path(sys.argv[2])))
