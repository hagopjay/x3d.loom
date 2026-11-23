"""Build the abstract data scene 'X3D node city' for the style kit.

One mark per concrete X3D 4.0 node (260). District = X3D component (36), grouped into
8 families. Height = number of fields the node declares (x3d.py). Alert = the three.js
bridge has not drawn the node yet (status 'todo' in x3d.threejs/bridge/NODES.json).
Hero = the node with the most fields. Links = one per component to Core (every X3D
component builds on Core; ISO/IEC 19775-1 clause 7).

The scene carries roles and data only: no colour, no material, no light. Those come
from a style (see ../SPEC.md).

Usage: python3 tools/build_scene.py   (run from x3d.style/; writes data/node-city.scene.json)
"""
import contextlib, io, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
with contextlib.redirect_stdout(io.StringIO()):
    import x3d
import importlib.metadata as md

nodes = json.load(open(os.path.join(ROOT, "..", "x3d.threejs", "bridge", "NODES.json")))["nodes"]

FAMILIES = [
    ("Foundation", ["Core", "Time", "Grouping", "Networking", "Scripting", "EventUtilities"]),
    ("Geometry", ["Rendering", "Geometry3D", "Geometry2D", "NURBS", "CADGeometry", "Text"]),
    ("Appearance", ["Shape", "Texturing", "Texturing3D", "CubeMapTexturing", "TextureProjection", "Shaders"]),
    ("Light and air", ["Lighting", "EnvironmentalEffects", "Sound"]),
    ("Motion", ["Interpolation", "Followers", "HAnim"]),
    ("Interaction", ["PointingDeviceSensor", "KeyDeviceSensor", "EnvironmentalSensor", "Picking", "Navigation"]),
    ("Space", ["Geospatial", "Layering", "Layout", "DIS"]),
    ("Simulation", ["RigidBodyPhysics", "ParticleSystems", "VolumeRendering"]),
]
fam_of = {c: i for i, (_, cs) in enumerate(FAMILIES) for c in cs}

def fields(name):
    cls = getattr(x3d, name, None)
    return len(cls.FIELD_DECLARATIONS()) if cls is not None else None

rows, missing = [], []
for n, v in nodes.items():
    f = fields(n)
    if f is None:
        missing.append(n); f = 0
    rows.append({"id": n, "component": v["component"], "fields": f, "alert": v["three"] == "todo"})
assert all(r["component"] in fam_of for r in rows), sorted({r["component"] for r in rows} - set(fam_of))
fmax = max(r["fields"] for r in rows)
hero = max(rows, key=lambda r: (r["fields"], r["id"]))["id"]

# Layout: families in two rows of four, components as lots inside a family, one cell per node.
CELL, PAD, GAP = 1.5, 0.9, 1.6
by_comp = {}
for r in rows:
    by_comp.setdefault(r["component"], []).append(r)
lots = {}
for c, rs in by_comp.items():
    rs.sort(key=lambda r: (-r["fields"], r["id"]))
    cols = math.ceil(math.sqrt(len(rs)))
    rws = math.ceil(len(rs) / cols)
    lots[c] = (cols, rws, cols * CELL + 2 * PAD, rws * CELL + 2 * PAD)

fam_boxes = []
for fi, (fname, comps) in enumerate(FAMILIES):
    comps = sorted(comps, key=lambda c: -len(by_comp[c]))
    target = math.sqrt(sum(lots[c][2] * lots[c][3] for c in comps)) * 1.25
    x = z = rowh = 0.0
    place, w = [], 0.0
    for c in comps:
        _, _, lw, ld = lots[c]
        if x > 0 and x + lw > target:
            x, z, rowh = 0.0, z + rowh + GAP, 0.0
        place.append((c, x, z)); x += lw + GAP; rowh = max(rowh, ld); w = max(w, x - GAP)
    fam_boxes.append({"name": fname, "place": place, "w": w, "d": z + rowh})

FGAP = 3.2
districts, marks = [], []
zc = 0.0
for row in range(2):
    fs = fam_boxes[row * 4:(row + 1) * 4]
    xc = 0.0
    depth = max(f["d"] for f in fs)
    for k, f in enumerate(fs):
        fi = row * 4 + k
        for c, lx, lz in f["place"]:
            cols, rws, lw, ld = lots[c]
            x0, z0 = xc + lx, zc + lz + (depth - f["d"]) / 2
            districts.append({"id": c, "label": c, "family": fi, "x": x0 + lw / 2, "z": z0 + ld / 2, "w": lw, "d": ld, "count": len(by_comp[c])})
            for i, r in enumerate(by_comp[c]):
                cx = x0 + PAD + (i % cols + 0.5) * CELL
                cz = z0 + PAD + (i // cols + 0.5) * CELL
                marks.append({"id": r["id"], "district": c, "family": fi, "x": cx, "z": cz, "value": round(r["fields"] / fmax, 4),
                              "raw": r["fields"], "alert": r["alert"], "hero": r["id"] == hero})
        xc += f["w"] + FGAP
    zc += depth + FGAP
# centre on the origin
xs = [d["x"] + s * d["w"] / 2 for d in districts for s in (-1, 1)]
zs = [d["z"] + s * d["d"] / 2 for d in districts for s in (-1, 1)]
ox, oz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
for o in districts + marks:
    o["x"] = round(o["x"] - ox, 3); o["z"] = round(o["z"] - oz, 3)
extent = round(max(max(xs) - min(xs), max(zs) - min(zs)), 3)
links = [{"from": d["id"], "to": "Core"} for d in districts if d["id"] != "Core"]

scene = {
    "@type": "xst:Scene", "id": "node-city", "title": "X3D node city",
    "about": "The 260 concrete nodes of X3D 4.0. District = component, height = declared fields, alert = not yet drawn by the three.js bridge, hero = most fields, links = component builds on Core.",
    "sources": {
        "nodes": "x3d.loom x3d.threejs/bridge/NODES.json (260 nodes, component, three.js bridge status)",
        "fields": f"x3d.py {md.version('x3d')} FIELD_DECLARATIONS() length per node class",
        "links": "ISO/IEC 19775-1 clause 7: every component builds on Core",
    },
    "extent": extent, "cell": CELL, "valueMax": fmax, "hero": hero,
    "families": [f for f, _ in FAMILIES], "districts": districts, "marks": marks, "links": links,
    "counts": {"marks": len(marks), "districts": len(districts), "links": len(links), "alerts": sum(m["alert"] for m in marks), "noFieldData": missing},
}
out = os.path.join(ROOT, "data", "node-city.scene.json")
json.dump(scene, open(out, "w"), separators=(",", ":"))
print(json.dumps({k: scene[k] for k in ("extent", "valueMax", "hero", "counts")}), os.path.getsize(out), "bytes")
