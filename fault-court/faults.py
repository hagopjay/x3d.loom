"""The Fault Court's 60 faults and 10 decoys, fixed before any checker ran on them (pre-registered).

Each case gives one edit per format. An edit may change the shared scene state `s` (written the same way by every writer)
or the format's own document. NE = the format cannot state this; NA = the edit is legal in that format (not a fault there).
Families are format-neutral: A references, B geometry data, C transforms and units, D appearance, E animation and
behaviour, F cameras and declared facts. Split for the Loom arm: odd numbers LEARN, even numbers HELD OUT.
"""
import math
NE, NA = "NE", "NA"
nan, inf = float("nan"), float("inf")


def S(**kw):          # shared-state edit, same intent in every format
    return lambda s: s.update(kw)


def xq(X, d):
    return X.find(f".//*[@DEF='{d}']")


def xset(d, **kw):
    def f(X):
        for k, v in kw.items():
            xq(X, d).set(k, v)
    return f


def route(i, **kw):
    def f(X):
        r = X.findall(".//ROUTE")[i]
        for k, v in kw.items():
            r.set(k, v)
    return f


def uset(path, key, val):
    def f(d):
        p = next(p for p in d["prims"] if p[0] == path)
        if val is None:
            p[2].pop(key)
        else:
            p[2][key] = val
    return f


def ulayer(key, val):
    return lambda d: d["layer"].__setitem__(key, val)


def gset(fn):
    return fn


C = []


def case(cid, fam, title, shared=None, x3d=None, gltf=None, usd=None, decoy=False):
    C.append(dict(id=cid, family=fam, title=title, shared=shared, x3d=x3d, gltf=gltf, usd=usd, decoy=decoy))


# ---------------- A references and identity
case("A01", "A", "Reference to an object that does not exist",
     x3d=lambda X: xq(X, "Side")[0].append(__import__("lxml.etree").etree.Element("Shape", USE="Nowhere")),
     gltf=lambda g, a: g["nodes"][1].__setitem__("mesh", 7),
     usd=lambda d: next(p for p in d["prims"] if p[0] == "/World/Body/Cube")[3].__setitem__("material:binding", "</World/Looks/Nowhere>"))
case("A02", "A", "Two objects share one identifier",
     x3d=xset("Side", DEF="Body"), gltf=NE, usd=NE)
case("A03", "A", "Reference to an object of the wrong kind",
     x3d=lambda X: xq(X, "Side").append(__import__("lxml.etree").etree.Element("Shape", USE="Mat")),
     gltf=lambda g, a: g["meshes"][0]["primitives"][0].__setitem__("material", "0"),
     usd=lambda d: next(p for p in d["prims"] if p[0] == "/World/Body/Cube")[3].__setitem__("material:binding", "</World/Side/Box>"))
case("A04", "A", "An object is its own ancestor (a cycle)",
     x3d=lambda X: xq(X, "CubeShape").getparent().append(__import__("lxml.etree").etree.Element("Transform", USE="Body")),
     gltf=lambda g, a: g["nodes"][0].__setitem__("children", [0]),
     usd=NE)
case("A05", "A", "A shape with no geometry",
     x3d=lambda X: xq(X, "CubeShape").remove(xq(X, "Cube")),
     gltf=lambda g, a: g["meshes"][0]["primitives"][0].__setitem__("attributes", {}),
     usd=uset("/World/Body/Cube", "point3f[] points", None))
case("A06", "A", "Texture file is missing", shared=S(texture="missing.png"))
case("A07", "A", "Texture file is not an image", shared=S(texture="notes.png"))
case("A08", "A", "Animation drives an object that does not exist",
     x3d=route(1, toNode="Ghost"), gltf=lambda g, a: g["animations"][0]["channels"][0]["target"].__setitem__("node", 9), usd=NE)
case("A09", "A", "Animation drives a property that does not exist",
     x3d=route(1, toField="set_wobble"), gltf=lambda g, a: g["animations"][0]["channels"][0]["target"].__setitem__("path", "wobble"),
     usd=NE)
case("A10", "A", "Unknown object type",
     x3d=lambda X: X.find("Scene").append(__import__("lxml.etree").etree.Element("Banana")),
     gltf=lambda g, a: g.__setitem__("bananas", [{}]),
     usd=lambda d: d["prims"].append(["/World/Fruit", "Banana", {}, {}]))

# ---------------- B geometry data
def tri_edit(fn):
    return lambda s: fn(s["T"])
case("B01", "B", "Vertex index out of range", shared=tri_edit(lambda T: T[0].__setitem__(1, 99)))
case("B02", "B", "Face with fewer than three vertices", shared=tri_edit(lambda T: T.__setitem__(0, [0, 2])))
case("B03", "B", "NaN in a vertex position", shared=lambda s: s["P"][2].__setitem__(0, nan))
case("B04", "B", "Infinity in a vertex position", shared=lambda s: s["P"][2].__setitem__(1, inf))
case("B05", "B", "Fewer normals than vertices", shared=lambda s: s["N"].pop())
case("B06", "B", "Fewer texture coordinates than vertices", shared=lambda s: s["UV"].pop())
case("B07", "B", "Fewer colours than vertices", shared=lambda s: s["C"].pop())
case("B08", "B", "Degenerate triangle (a vertex repeated)", shared=tri_edit(lambda T: T.__setitem__(0, [0, 0, 1])))
case("B09", "B", "Negative box size", shared=S(box=-1.0), gltf=NE)
case("B10", "B", "Declared bounds do not contain the geometry",
     x3d=lambda X: xq(X, "Body").set("bboxSize", "0.1 0.1 0.1"),
     gltf=lambda g, a: g.setdefault("_acc_patch", {}).__setitem__("P", {"min": [-0.1, -0.1, -0.1], "max": [0.1, 0.1, 0.1]}),
     usd=uset("/World/Body/Cube", "float3[] extent", "[(-0.1, -0.1, -0.1), (0.1, 0.1, 0.1)]"))

# ---------------- C transforms and units
case("C01", "C", "Zero scale", shared=S(scale=[0, 0, 0]))
case("C02", "C", "NaN in a rotation", shared=S(rotation_axis_angle=[0, 1, 0, nan], quat=[0, nan, 0, 1]))
case("C03", "C", "Rotation with no axis (zero vector or zero quaternion)", shared=S(rotation_axis_angle=[0, 0, 0, 1], quat=[0, 0, 0, 0]))
case("C04", "C", "Rotation axis or quaternion not unit length", shared=S(rotation_axis_angle=[0, 3, 0, 1], quat=[0, 0.9, 0, 0.9]))
case("C05", "C", "Transform given two contradictory ways",
     x3d=NE, gltf=lambda g, a: g["nodes"][0].__setitem__("matrix", [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]),
     usd=uset("/World/Body", "uniform token[] xformOpOrder", '["xformOp:translate", "xformOp:orient", "xformOp:scale", "xformOp:transform"]'))
case("C06", "C", "Length unit declared as zero", shared=S(units_m=0.0), gltf=NE)
case("C07", "C", "Length unit declared negative", shared=S(units_m=-1.0), gltf=NE)
case("C08", "C", "Up axis declared as something that is not an axis", x3d=NE, gltf=NE, usd=ulayer("upAxis", '"W"'))
case("C09", "C", "NaN in a scale", shared=S(scale=[1, nan, 1]))
case("C10", "C", "Infinity in a translation", shared=S(translation=[0, inf, 0]))

# ---------------- D appearance
case("D01", "D", "Base colour above 1", shared=S(base_color=[2.0, 0.8, 0.8]))
case("D02", "D", "Negative base colour", shared=S(base_color=[-0.5, 0.8, 0.8]))
case("D03", "D", "Opacity or transparency above 1", shared=S(alpha=-0.5))
case("D04", "D", "Roughness above 1", shared=S(roughness=2.0))
case("D05", "D", "Metallic above 1", shared=S(metallic=2.0))
case("D06", "D", "Emissive colour above 1 without an intensity extension", shared=S(emissive=[2.0, 0, 0]), usd=NA)
case("D07", "D", "Two materials on one surface",
     x3d=lambda X: xq(X, "Look").append(__import__("lxml.etree").etree.Element("Material", diffuseColor="1 0 0")),
     gltf=NE, usd=NE)
case("D08", "D", "Transparency mode is not one of the allowed words",
     x3d=xset("Look", alphaMode="SOMETIMES"), gltf=lambda g, a: g["materials"][0].__setitem__("alphaMode", "SOMETIMES"),
     usd=uset("/World/Looks/Mat/Surf", "uniform token inputs:opacityMode", '"sometimes"'))
case("D09", "D", "Texture wrap mode is not one of the allowed words",
     x3d=lambda X: xq(X, "Tex").append(__import__("lxml.etree").etree.Element("TextureProperties", boundaryModeS="WOBBLE")),
     gltf=lambda g, a: g["samplers"][0].__setitem__("wrapS", 1234),
     usd=uset("/World/Looks/Mat/Tex", "token inputs:wrapS", '"wobble"'))
case("D10", "D", "Per-vertex colour above 1", shared=lambda s: s["C"].__setitem__(0, [3.0, 0.2, 0.2]), usd=NA)

# ---------------- E animation and behaviour
case("E01", "E", "Key count and value count differ", shared=lambda s: s["keyv"].pop(), usd=NE)
case("E02", "E", "Key times not increasing", shared=S(keys=[0.0, 1.0, 0.5]), usd=NE)
case("E03", "E", "NaN key time", shared=S(keys=[0.0, nan, 1.0]))
case("E04", "E", "Interpolation mode is not one of the allowed words",
     x3d=NE, gltf=lambda g, a: g["animations"][0]["samplers"][0].__setitem__("interpolation", "SMOOTH"), usd=NE)
case("E05", "E", "Animation value type does not match the property it drives",
     x3d=route(1, toField="set_rotation"),
     gltf=lambda g, a: g["animations"][0]["channels"][0]["target"].__setitem__("path", "rotation"),
     usd=uset("/World/Body", "double3 xformOp:translate.timeSamples", '{0: 1.5, 24: 2.5}'))
case("E06", "E", "Clock period of zero", shared=S(cycle=0.0), gltf=NE, usd=ulayer("timeCodesPerSecond", "0"))
case("E07", "E", "Animation values not a whole number of vectors",
     x3d=lambda X: xq(X, "Mover").set("keyValue", "0 0 0, 0 1 0, 0 0"),
     gltf=NE, usd=NE)
case("E08", "E", "Animation range ends before it starts", x3d=NE, gltf=NE,
     usd=lambda d: (d["layer"].__setitem__("startTimeCode", "48"), d["layer"].__setitem__("endTimeCode", "0")))
case("E09", "E", "Event wired from a property that cannot send", x3d=route(1, fromNode="Body", fromField="set_translation", toNode="Side"),
     gltf=NE, usd=NE)
case("E10", "E", "Two animations write the same property at once", x3d=NA,
     gltf=lambda g, a: g["animations"][0]["channels"].append({"sampler": 0, "target": {"node": 0, "path": "translation"}}), usd=NE)

# ---------------- F cameras and declared facts
case("F01", "F", "Field of view of zero", shared=S(fov=0.0))
case("F02", "F", "Field of view of 4 radians (more than half a turn)", shared=S(fov=4.0))
case("F03", "F", "Near clip distance is negative", shared=S(near=-1.0))
case("F04", "F", "Far clip nearer than near clip", shared=S(near=10.0, far=1.0))
case("F05", "F", "Aspect ratio of zero", x3d=NE, shared=S(aspect=0.0))
case("F06", "F", "Declared metadata number is not a number", shared=S(meta_float="heavy"), gltf=NE, usd=NE)
case("F07", "F", "Humanoid joint name not in the standard list",
     x3d=lambda X: X.find("Scene").append(__import__("lxml.etree").etree.fromstring(
         '<HAnimHumanoid DEF="H" name="H" version="2.0"><HAnimJoint DEF="J" name="l_wristy" containerField="skeleton"/></HAnimHumanoid>')),
     gltf=NE, usd=NE)
case("F08", "F", "Format version missing", x3d=lambda X: X.attrib.pop("version"), gltf=lambda g, a: g["asset"].pop("version"), usd=NE)
case("F09", "F", "Format version that does not exist", x3d=lambda X: X.set("version", "9.9"),
     gltf=lambda g, a: g["asset"].__setitem__("version", "9.9"), usd=lambda d: d.__setitem__("header", "#usda 9.9"))
case("F10", "F", "Camera projection is not one of the allowed words", x3d=NE,
     gltf=lambda g, a: g["cameras"][0].__setitem__("type", "fisheye"), usd=uset("/World/Cam", "token projection", '"fisheye"'))

# ---------------- decoys: legal but unusual; a checker that flags these raises a false alarm
case("Z01", "Z", "Very large but finite coordinates", shared=lambda s: s.update(P=[[c * 1e5 for c in p] for p in s["P"]]), decoy=True)
case("Z02", "Z", "Millimetre units declared", shared=S(units_m=0.001), gltf=NE, decoy=True)
case("Z03", "Z", "Colour exactly 1 and exactly 0", shared=S(base_color=[1.0, 0.0, 1.0]), decoy=True)
case("Z04", "Z", "Key times beyond 1 (seconds, not fractions)", shared=S(keys=[0.0, 5.0, 10.0]), decoy=True)
case("Z05", "Z", "Wide but legal field of view (3 radians)", shared=S(fov=3.0), decoy=True)
case("Z06", "Z", "Long thin but valid triangle", shared=lambda s: s["P"].__setitem__(1, [1000.0, -1.0, -1.0]), decoy=True)
case("Z07", "Z", "Fully transparent material", shared=S(alpha=0.0), decoy=True)
case("Z08", "Z", "Non-ASCII text in metadata", shared=S(meta_float="0.5"), decoy=True,
     x3d=lambda X: X.find("head").append(__import__("lxml.etree").etree.Element("meta", name="description", content="Գոբլեր ✓")),
     gltf=lambda g, a: g["asset"].__setitem__("copyright", "Գոբլեր ✓"), usd=lambda d: d["layer"].__setitem__("doc", '"Գոբլեր ✓"'))
case("Z09", "Z", "Animation with a single key", shared=S(keys=[0.0], keyv=[[0, 0, 0]]), decoy=True)
case("Z10", "Z", "Near clip very small but positive", shared=S(near=1e-6), decoy=True)

assert len([c for c in C if not c["decoy"]]) == 60 and len([c for c in C if c["decoy"]]) == 10
