"""Loom rules for USD, written from the LEARN-half misses only (A05 A07 B01 B03 B05 B07 B09 C01 C03 C05 C07 C09 D01 D03 D05
D09 E03 F01 F03 F05). Five rules, one property each, chosen to cover the most learn-half misses."""
import math
from pxr import Usd, Sdf, Gf, Vt

def _floats(v):
    if isinstance(v, bool):
        return
    if isinstance(v, (int, float)):
        yield float(v)
    elif isinstance(v, (str, bytes, Sdf.AssetPath)) or v is None:
        return
    else:
        try:
            for x in v:
                yield from _floats(x)
        except TypeError:
            if hasattr(v, "imaginary"):
                yield float(v.real); yield from _floats(list(v.imaginary))

def rules(path):
    try:
        st = Usd.Stage.Open(str(path))
    except Exception:
        return []
    F = []
    lay = st.GetRootLayer()
    for prim in st.Traverse():
        for a in prim.GetAttributes():
            vals = [a.Get()] + [a.Get(t) for t in a.GetTimeSamples()]
            # U1 every number is finite (default values and time samples)
            if any(not math.isfinite(x) for v in vals for x in _floats(v)) or any(not math.isfinite(t) for t in a.GetTimeSamples()):
                F.append(f"U1 non-finite: {a.GetPath()}")
        if prim.GetTypeName() == "Mesh":
            pts = prim.GetAttribute("points").Get() if prim.GetAttribute("points") else None
            idx = prim.GetAttribute("faceVertexIndices").Get() or []
            # U2 face indices name existing points
            if pts is None or any(i < 0 or i >= len(pts) for i in idx):
                F.append(f"U2 indices: {prim.GetPath()} indexes past {0 if pts is None else len(pts)} points")
            # U3 vertex-interpolated arrays have one entry per point
            for a in prim.GetAttributes():
                interp = a.GetMetadata("interpolation")
                v = a.Get()
                if interp == "vertex" and v is not None and pts is not None and len(v) != len(pts):
                    F.append(f"U3 count: {a.GetPath()} has {len(v)} for {len(pts)} points")
        if prim.GetTypeName() == "Shader":
            # U4 UsdPreviewSurface inputs stay inside their documented 0..1 range
            for name in ("opacity", "metallic", "roughness", "diffuseColor", "clearcoat", "fallback"):
                a = prim.GetAttribute("inputs:" + name)
                if a and a.Get() is not None and any(x < 0 or x > 1 for x in _floats(a.Get())):
                    F.append(f"U4 range: {a.GetPath()} = {a.Get()}")
    # U5 dimensional quantities are positive: sizes, unit, focal length, apertures, scale components, near/far
    if lay.pseudoRoot.HasInfo("metersPerUnit"):
        if lay.pseudoRoot.GetInfo("metersPerUnit") <= 0:
            F.append(f"U5 positive: metersPerUnit {lay.pseudoRoot.GetInfo('metersPerUnit')}")
    for prim in st.Traverse():
        for name in ("size", "focalLength", "horizontalAperture", "verticalAperture"):
            a = prim.GetAttribute(name)
            if a and a.Get() is not None and a.Get() <= 0:
                F.append(f"U5 positive: {a.GetPath()} = {a.Get()}")
        a = prim.GetAttribute("xformOp:scale")
        if a and a.Get() is not None and any(x == 0 for x in a.Get()):
            F.append(f"U5 positive: {a.GetPath()} = {a.Get()}")
        a = prim.GetAttribute("clippingRange")
        if a and a.Get() is not None and not (0 < a.Get()[0] < a.Get()[1]):
            F.append(f"U5 positive: {a.GetPath()} = {a.Get()}")
    return F
