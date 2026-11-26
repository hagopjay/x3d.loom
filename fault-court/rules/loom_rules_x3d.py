"""Loom rules for X3D, written from the LEARN-half misses only (A03, A07, B05, B07, C01, F03). One property per rule."""
import math, re
from pathlib import Path
from lxml import etree

IMG_MAGIC = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"GIF8", b"RIFF")
nums = lambda v: [float(x) for x in re.split(r"[\s,]+", v.strip()) if x]

def rules(path):
    X = etree.parse(str(path)).getroot(); F = []
    defs = {e.get("DEF"): e for e in X.iter() if isinstance(e.tag, str) and e.get("DEF")}
    # R1 a USE names a DEF of the same node type
    for e in X.iter():
        if isinstance(e.tag, str) and e.get("USE") in defs and defs[e.get("USE")].tag != e.tag:
            F.append(f"R1 USE type: <{e.tag} USE='{e.get('USE')}'> names a {defs[e.get('USE')].tag}")
    # R2 per-vertex arrays have one entry per coordinate (when no separate index is given)
    for g in X.iter("IndexedFaceSet", "IndexedTriangleSet"):
        c = g.find("Coordinate"); n = len(nums(c.get("point", ""))) // 3 if c is not None else None
        for tag, attr, k, idx in (("Normal", "vector", 3, "normalIndex"), ("Color", "color", 3, "colorIndex"), ("TextureCoordinate", "point", 2, "texCoordIndex")):
            e = g.find(tag)
            if e is not None and n is not None and not g.get(idx) and len(nums(e.get(attr, ""))) // k != n:
                F.append(f"R2 count: {tag} has {len(nums(e.get(attr, ''))) // k} entries for {n} coordinates")
    # R3 every texture url names a readable image
    for t in X.iter("ImageTexture"):
        urls = re.findall(r'"([^"]+)"', t.get("url", ""))
        ok = False
        for u in urls:
            p = Path(path).parent / u
            if p.exists() and p.read_bytes()[:8].startswith(IMG_MAGIC):
                ok = True
        if urls and not ok:
            F.append(f"R3 texture: none of {urls} is a readable image")
    # R4 a Transform scale has no zero or non-finite component
    for t in X.iter("Transform"):
        if t.get("scale"):
            try:
                v = nums(t.get("scale"))
                if any(x == 0 or not math.isfinite(x) for x in v):
                    F.append(f"R4 scale: {t.get('DEF')} scale {t.get('scale')}")
            except ValueError:
                pass
    # R5 Viewpoint clip distances: near is -1 (automatic) or > 0; far is -1 or > near
    for v in X.iter("Viewpoint", "OrthoViewpoint"):
        try:
            n, f = float(v.get("nearDistance", "-1")), float(v.get("farDistance", "-1"))
        except ValueError:
            continue
        if not (n == -1 or n > 0) or not (f == -1 or f > max(n, 0)):
            F.append(f"R5 clip: near {n}, far {f}")
    return F
