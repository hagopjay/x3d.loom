"""Loom rules for glTF, written from the LEARN-half misses only (C01). One property per rule."""
import json, math

def rules(path):
    try:
        g = json.loads(open(path).read())
    except ValueError:
        return []
    F = []
    # G1 a node scale has no zero or non-finite component
    for i, n in enumerate(g.get("nodes", [])):
        s = n.get("scale")
        if s and any((not isinstance(x, (int, float))) or x == 0 or not math.isfinite(x) for x in s):
            F.append(f"G1 scale: /nodes/{i}/scale {s}")
    return F
