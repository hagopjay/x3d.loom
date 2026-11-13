"""Small helpers that write X3D 4.0 XML text. Single-quoted attributes, 3 decimals, no trailing zeros."""
from __future__ import annotations

import numpy as np


def num(x: float, nd: int = 3) -> str:
    s = f"{float(x):.{nd}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def nums(a, nd: int = 3) -> str:
    return " ".join(num(x, nd) for x in np.asarray(a, dtype=np.float64).ravel())


def ints(a) -> str:
    return " ".join(str(int(x)) for x in np.asarray(a).ravel())


def esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&apos;")


def mfstring(items) -> str:
    """MFString: each item in double quotes, with backslash and double quote escaped by a backslash, then XML-escaped."""
    return " ".join('"' + esc(str(s).replace("\\", "\\\\").replace('"', '\\"')) + '"' for s in items)


def mstr(name: str, items) -> str:
    return f"<MetadataString name='{esc(name)}' value='{mfstring(items)}'/>"


def mflt(name: str, a, nd: int = 3) -> str:
    return f"<MetadataFloat name='{esc(name)}' value='{nums(a, nd)}'/>"


def mint(name: str, a) -> str:
    return f"<MetadataInteger name='{esc(name)}' value='{ints(a)}'/>"


def rotation_y_to(direction: np.ndarray) -> str:
    """Axis-angle rotation taking +Y (a Cylinder's axis) onto direction."""
    d = direction / np.linalg.norm(direction)
    y = np.array([0.0, 1.0, 0.0])
    ax = np.cross(y, d)
    s = np.linalg.norm(ax)
    if s < 1e-9:
        return "1 0 0 0" if d[1] > 0 else "1 0 0 3.14159"
    ax /= s
    return f"{num(ax[0], 5)} {num(ax[1], 5)} {num(ax[2], 5)} {num(np.arctan2(s, d[1]), 5)}"


def shape_mesh(mesh, def_name: str, material: str) -> str:
    """One Shape holding an IndexedTriangleSet with Normal, Color and a FloatVertexAttribute per attribute."""
    attrs = "".join(f"<FloatVertexAttribute name='{k}' numComponents='1' value='{nums(v, 2)}'/>" for k, v in sorted(mesh.attr.items()))
    return (f"<Shape DEF='{def_name}'><Appearance>{material}</Appearance>"
            f"<IndexedTriangleSet index='{ints(mesh.tri)}' colorPerVertex='true' normalPerVertex='true' solid='false'>"
            f"<Coordinate point='{nums(mesh.v)}'/><Normal vector='{nums(mesh.nrm)}'/><Color color='{nums(np.clip(mesh.rgb, 0, 1))}'/>{attrs}"
            f"</IndexedTriangleSet></Shape>")
