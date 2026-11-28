#!/usr/bin/env python3
"""The truss as files: read the span from the building's IFC, write the truss as IFC4 and as X3D 4.0, read both back.

  python3 exchange.py build [--demo /path/to/x3d.demo]
writes model/truss.ifc, scenes/truss.x3d, scenes/truss-in-court.x3d and results/design.json.
Needs ifcopenshell. Deterministic: GlobalIds are derived from member names, no timestamps are written.
"""
from __future__ import annotations
import hashlib, json, math, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import truss as tr
import loss_receipt as lr

REL = lr.REL


def guid_for(name: str) -> str:
    import ifcopenshell.guid
    return ifcopenshell.guid.compress(hashlib.sha256(("loom-truss:" + name).encode()).hexdigest()[:32])


def span_from_ifc(ifc_path: Path, west="Column -4/1", east="Column 4/1"):
    """R7: the supports are the two court columns; span = distance between their centres, bearing = their tops."""
    import ifcopenshell, ifcopenshell.geom
    m = ifcopenshell.open(str(ifc_path))
    s = ifcopenshell.geom.settings(); s.set("use-world-coords", True)
    got = {}
    for p in m.by_type("IfcColumn"):
        if p.Name in (west, east):
            v = ifcopenshell.geom.create_shape(s, p).geometry.verts
            xs, ys, zs = v[0::3], v[1::3], v[2::3]
            got[p.Name] = {"guid": p.GlobalId, "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2, "top": max(zs)}
    w, e = got[west], got[east]
    return {"west": w, "east": e, "span_m": e["cx"] - w["cx"], "x0_m": w["cx"], "bearing_z_m": (w["top"] + e["top"]) / 2,
            "line_y_m": (w["cy"] + e["cy"]) / 2, "tops_differ_m": abs(w["top"] - e["top"])}


def write_ifc(mdl, design, path: Path):
    import ifcopenshell
    f = ifcopenshell.file(schema="IFC4")
    mm = 1000.0
    P3 = lambda x, y, z: f.create_entity("IfcCartesianPoint", Coordinates=(float(x), float(y), float(z)))
    D3 = lambda x, y, z: f.create_entity("IfcDirection", DirectionRatios=(float(x), float(y), float(z)))
    units = f.create_entity("IfcUnitAssignment", Units=[
        f.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Prefix="MILLI", Name="METRE"),
        f.create_entity("IfcSIUnit", UnitType="AREAUNIT", Name="SQUARE_METRE"),
        f.create_entity("IfcSIUnit", UnitType="VOLUMEUNIT", Name="CUBIC_METRE"),
        f.create_entity("IfcSIUnit", UnitType="FORCEUNIT", Name="NEWTON")])
    world = f.create_entity("IfcAxis2Placement3D", Location=P3(0, 0, 0))
    ctx = f.create_entity("IfcGeometricRepresentationContext", ContextType="Model", CoordinateSpaceDimension=3, Precision=1e-5, WorldCoordinateSystem=world)
    proj = f.create_entity("IfcProject", GlobalId=guid_for("project"), Name="Court canopy truss (x3d.loom engineering study B)", RepresentationContexts=[ctx], UnitsInContext=units)
    place0 = f.create_entity("IfcLocalPlacement", RelativePlacement=world)
    site = f.create_entity("IfcSite", GlobalId=guid_for("site"), Name="Confluence court", ObjectPlacement=place0)
    bld = f.create_entity("IfcBuilding", GlobalId=guid_for("building"), Name="Court canopy", ObjectPlacement=place0)
    f.create_entity("IfcRelAggregates", GlobalId=guid_for("rel-proj"), RelatingObject=proj, RelatedObjects=[site])
    f.create_entity("IfcRelAggregates", GlobalId=guid_for("rel-site"), RelatingObject=site, RelatedObjects=[bld])
    members = []
    for m in mdl["members"]:
        a, b = mdl["joints"][m["a"]], mdl["joints"][m["b"]]
        ax = [(b[i] - a[i]) / m["L"] for i in range(3)]
        prof = f.create_entity("IfcRectangleHollowProfileDef", ProfileType="AREA", ProfileName=m["sec"]["name"], XDim=m["sec"]["b"] * mm, YDim=m["sec"]["b"] * mm, WallThickness=m["sec"]["t"] * mm)
        solid = f.create_entity("IfcExtrudedAreaSolid", SweptArea=prof, ExtrudedDirection=D3(0, 0, 1), Depth=m["L"] * mm)
        rep = f.create_entity("IfcProductDefinitionShape", Representations=[f.create_entity("IfcShapeRepresentation", ContextOfItems=ctx, RepresentationIdentifier="Body", RepresentationType="SweptSolid", Items=[solid])])
        # local z runs along the member; local x is the truss's out-of-plane direction, +y
        pl = f.create_entity("IfcLocalPlacement", PlacementRelTo=place0, RelativePlacement=f.create_entity("IfcAxis2Placement3D", Location=P3(a[0] * mm, a[1] * mm, a[2] * mm), Axis=D3(*ax), RefDirection=D3(0, 1, 0)))
        e = f.create_entity("IfcMember", GlobalId=guid_for(m["id"]), Name=m["id"], ObjectType=m["role"], ObjectPlacement=pl, Representation=rep)
        d = design["members"][m["id"]]
        val = lambda k, v: f.create_entity("IfcPropertySingleValue", Name=k, NominalValue=f.create_entity("IfcReal", float(v)) if isinstance(v, float) else f.create_entity("IfcLabel", str(v)))
        ps = f.create_entity("IfcPropertySet", GlobalId=guid_for("pset:" + m["id"]), Name="Pset_LoomTruss", HasProperties=[
            val("Role", m["role"]), val("Section", m["sec"]["name"]), val("DemandN", d["demand_N"]), val("CapacityN", d["capacity_N"]),
            val("Utilisation", d["utilisation"]), val("GoverningCase", d["governing_case"])])
        f.create_entity("IfcRelDefinesByProperties", GlobalId=guid_for("rel:" + m["id"]), RelatedObjects=[e], RelatingPropertyDefinition=ps)
        members.append(e)
    f.create_entity("IfcRelContainedInSpatialStructure", GlobalId=guid_for("rel-contain"), RelatedElements=members, RelatingStructure=bld)
    path.parent.mkdir(exist_ok=True)
    f.write(str(path))
    # the STEP header carries a timestamp: fix it, so the same design always gives the same bytes
    lines = path.read_text().split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith("FILE_NAME("):
            lines[i] = "FILE_NAME('truss.ifc','2026-11-27T00:00:00',(),(),'IfcOpenShell','x3d.loom x3d.engineering/ifc-truss/exchange.py','');"
    path.write_text("\n".join(lines))


def _g(x):
    s = f"{x:.9g}"
    return "0" if s in ("-0", "0") else s


def ramp(u):
    """Utilisation 0..1 to a colour: slate, teal, amber, red. Above 1 is magenta."""
    stops = [(0.0, (0.30, 0.38, 0.52)), (0.35, (0.16, 0.60, 0.56)), (0.70, (0.91, 0.66, 0.18)), (1.0, (0.82, 0.20, 0.16))]
    if u > 1:
        return (0.85, 0.10, 0.75)
    for (u0, c0), (u1, c1) in zip(stops, stops[1:]):
        if u <= u1:
            k = (u - u0) / (u1 - u0)
            return tuple(c0[i] + k * (c1[i] - c0[i]) for i in range(3))
    return stops[-1][1]


def tube(a, b, sec):
    """A square hollow tube from a to b as 16 vertices and 16 quads, wound counter-clockwise seen from outside."""
    L = math.dist(a, b)
    w = [(b[i] - a[i]) / L for i in range(3)]                     # along the member
    u = (0.0, 1.0, 0.0)                                            # out of the truss plane
    v = (w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0])    # w x u, in the truss plane
    ho, hi = sec["b"] / 2, sec["b"] / 2 - sec["t"]
    ring = lambda c, h: [tuple(c[i] + su * h * u[i] + sv * h * v[i] for i in range(3)) for su, sv in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    pts = ring(a, ho) + ring(b, ho) + ring(a, hi) + ring(b, hi)    # 0-3 outer a, 4-7 outer b, 8-11 inner a, 12-15 inner b
    quads = []
    for k in range(4):
        n = (k + 1) % 4
        quads.append((k, 4 + k, 4 + n, n))                        # outer wall
        quads.append((8 + k, 8 + n, 12 + n, 12 + k))              # inner wall, facing the hole
        quads.append((k, n, 8 + n, 8 + k))                        # end ring at a
        quads.append((4 + k, 12 + k, 12 + n, 4 + n))              # end ring at b
    # The ring order above is counter-clockwise only when u x v points from a to b, which depends on the member's
    # direction. Measure the enclosed volume and turn every face round when it is negative, so solid="true" with
    # ccw="true" is a true statement for every member (found by x3d_mcp's mesh-inside-out check, 28 Nov 2026).
    def vol(qs):
        t = 0.0
        for q in qs:
            for i in (1, 2):
                p0, p1, p2 = pts[q[0]], pts[q[i]], pts[q[i + 1]]
                t += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6
        return t
    if vol(quads) < 0:
        quads = [tuple(reversed(q)) for q in quads]
    assert vol(quads) > 0, "tube mesh encloses no positive volume"
    return pts, quads


def truss_group(mdl, design):
    out = ['<CADAssembly DEF="CourtCanopyTruss" name="CourtCanopyTruss">']
    for m in mdl["members"]:
        d = design["members"][m["id"]]
        gid = guid_for(m["id"]); key = hashlib.sha256(gid.encode()).hexdigest()[:12]
        pts, quads = tube(mdl["joints"][m["a"]], mdl["joints"][m["b"]], m["sec"])
        col = ramp(d["utilisation"])
        ms = lambda n, v: f'<MetadataString containerField="value" name="{n}" value=\'"{v}"\'/>'
        md = lambda n, v: f'<MetadataDouble containerField="value" name="{n}" value="{_g(v)}"/>'
        out.append(
            f'<CADPart DEF="ifc_{key}" name="{m["id"]}">'
            f'<MetadataSet containerField="metadata" name="IFC">{ms("guid", gid)}{ms("name", m["id"])}{ms("class", "IfcMember")}'
            f'{ms("Role", m["role"])}{ms("Section", m["sec"]["name"])}{md("DemandN", d["demand_N"])}{md("CapacityN", d["capacity_N"])}'
            f'{md("Utilisation", d["utilisation"])}{ms("GoverningCase", d["governing_case"])}</MetadataSet>'
            f'<CADFace name="{m["id"]}_body"><Shape containerField="shape"><Appearance><Material diffuseColor="{_g(col[0])} {_g(col[1])} {_g(col[2])}" specularColor="0.2 0.2 0.2" shininess="0.3"/></Appearance>'
            f'<IndexedFaceSet solid="true" ccw="true" convex="true" creaseAngle="0" coordIndex="{" ".join(" ".join(map(str, q)) + " -1" for q in quads)}">'
            f'<Coordinate point="{" ".join(" ".join(_g(c) for c in p) for p in pts)}"/></IndexedFaceSet></Shape></CADFace></CADPart>')
    out.append("</CADAssembly>")
    return "\n".join(out)


def scene(mdl, design, context=None, title="Court canopy truss"):
    span, z0, y = mdl["span"], mdl["z0"], mdl["y"]
    cx = mdl["x0"] + span / 2
    ctx = ""
    if context:
        boxes = []
        for c in context:
            lo, hi = c["lo"], c["hi"]
            size = [hi[i] - lo[i] for i in range(3)]; mid = [(hi[i] + lo[i]) / 2 for i in range(3)]
            boxes.append(f'<Transform translation="{_g(mid[0])} {_g(mid[1])} {_g(mid[2])}"><Shape><Appearance><Material diffuseColor="{c["rgb"]}" transparency="{c["alpha"]}"/></Appearance>'
                         f'<Box size="{_g(size[0])} {_g(size[1])} {_g(size[2])}"/></Shape></Transform>')
        ctx = '<Group DEF="BuildingContext">\n' + "\n".join(boxes) + "\n</Group>\n"
    worst = max(design["members"].items(), key=lambda kv: kv[1]["utilisation"])
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">\n'
            '<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">\n<head>\n'
            '<component name="CADGeometry" level="2"/>\n'
            f'<meta name="title" content="{title}"/>\n'
            f'<meta name="description" content="Pratt truss, span {_g(span)} m read from the IFC columns, {len(mdl["members"])} members. Colour is utilisation (demand over design strength); the highest is {worst[0]} at {worst[1]["utilisation"]:.3f}. A worked study, not for construction."/>\n'
            '<meta name="generator" content="x3d.loom x3d.engineering/ifc-truss/exchange.py"/>\n'
            '<meta name="ifc:lengthUnit" content="IFC file in millimetres; this scene in metres"/>\n</head>\n<Scene>\n'
            f'<WorldInfo title="{title}" info=\'"Not a certified design and not for construction."\'/>\n'
            '<Background skyColor="0.06 0.08 0.11"/>\n<NavigationInfo type=\'"EXAMINE" "ANY"\'/>\n'
            f'<Viewpoint DEF="Front" description="Front elevation" position="{_g(cx)} {_g(z0 + 0.5)} {_g(-y + 9)}" centerOfRotation="{_g(cx)} {_g(z0 + 0.5)} {_g(-y)}"/>\n'
            f'<Viewpoint DEF="Court" description="From the arrival steps" position="{_g(cx + 9)} {_g(z0 + 5)} 19" orientation="-0.50 0.86 0.13 0.55" centerOfRotation="{_g(cx)} {_g(z0)} {_g(-y)}"/>\n'
            '<DirectionalLight direction="-0.4 -0.8 -0.45" intensity="0.9"/>\n<DirectionalLight direction="0.5 -0.3 0.8" intensity="0.35"/>\n'
            '<Transform DEF="IFC_ZUP_TO_YUP" rotation="1 0 0 -1.5707963267948966">\n'
            + truss_group(mdl, design) + "\n" + ctx + '</Transform>\n</Scene>\n</X3D>\n')


def context_from_ifc(ifc_path: Path):
    """Bounding boxes of the building's big elements, for a picture only. They carry no identity and are never measured."""
    import ifcopenshell, ifcopenshell.geom
    m = ifcopenshell.open(str(ifc_path))
    s = ifcopenshell.geom.settings(); s.set("use-world-coords", True)
    look = {"IfcColumn": ("0.72 0.70 0.66", 0.0), "IfcSlab": ("0.55 0.54 0.50", 0.0), "IfcWall": ("0.62 0.60 0.56", 0.35), "IfcRoof": ("0.40 0.42 0.45", 0.45), "IfcBeam": ("0.55 0.42 0.25", 0.0)}
    out = []
    for cls, (rgb, alpha) in look.items():
        for p in m.by_type(cls):
            v = ifcopenshell.geom.create_shape(s, p).geometry.verts
            out.append({"lo": [min(v[i::3]) for i in range(3)], "hi": [max(v[i::3]) for i in range(3)], "rgb": rgb, "alpha": alpha})
    return out


def build(argv):
    demo = Path(argv[argv.index("--demo") + 1]) if "--demo" in argv else Path(os.environ.get("X3D_DEMO", HERE.parents[2] / "x3d.demo"))
    ifc_p = demo / REL / "model.ifc"
    sp = span_from_ifc(ifc_p)
    mdl = tr.model(sp["span_m"], sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"])
    design = tr.design(mdl)
    design["span_from_ifc"] = sp
    design["geometry"] = {"joints": mdl["joints"], "span_m": mdl["span"], "panel_m": mdl["panel"], "depth_m": mdl["depth"]}
    (HERE / "results").mkdir(exist_ok=True); (HERE / "scenes").mkdir(exist_ok=True)
    (HERE / "results" / "design.json").write_text(json.dumps(design, indent=1))
    write_ifc(mdl, design, HERE / "model" / "truss.ifc")
    (HERE / "scenes" / "truss.x3d").write_text(scene(mdl, design))
    (HERE / "scenes" / "truss-in-court.x3d").write_text(scene(mdl, design, context=context_from_ifc(ifc_p), title="Court canopy truss over the Confluence court"))
    print(json.dumps(sp, indent=1)); print("members", len(mdl["members"]), "checks", design["checks"])


if __name__ == "__main__":
    if "build" in sys.argv:
        build(sys.argv)
    else:
        print(__doc__)
