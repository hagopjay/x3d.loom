#!/usr/bin/env python3
"""A geo-placed X3D (geo_place.py) and its glTF -> a 3D Tiles 1.1 tileset that CesiumJS can load.

  python3 x3d_to_3dtiles.py PLACED.x3d MODEL.glb OUT_DIR [--name NAME] [--plant lat-lon-swap|z-up|height+33]

The root transform is the local east-north-up frame at the X3D GeoLocation's geoCoords (WGS84, ellipsoidal height),
column-major as 3D Tiles wants it. 3D Tiles turns glTF's y-up into z-up (+Y up becomes +Z), so the model's local
frame in Cesium is x east, y up, z south: exactly X3D's GeoLocation frame (X_ITE: x = Z_ecef x up, z = x x up).
The bounding box is computed from the glb's own vertices. --plant writes a deliberately wrong tileset (a control).
"""
from __future__ import annotations
import json, math, shutil, struct, sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

A, F_ = 6378137.0, 1 / 298.257223563
E2 = F_ * (2 - F_)


def geodetic_to_ecef(lat, lon, h):
    la, lo = math.radians(lat), math.radians(lon)
    n = A / math.sqrt(1 - E2 * math.sin(la) ** 2)
    return np.array([(n + h) * math.cos(la) * math.cos(lo), (n + h) * math.cos(la) * math.sin(lo), (n * (1 - E2) + h) * math.sin(la)])


def enu_frame(lat, lon, h):
    la, lo = math.radians(lat), math.radians(lon)
    e = np.array([-math.sin(lo), math.cos(lo), 0.0])
    n = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    u = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = e, n, u, geodetic_to_ecef(lat, lon, h)
    return M


def glb_positions(path: Path):
    """All POSITION accessors of a glb, with each mesh node's world matrix applied (y-up glTF frame)."""
    b = path.read_bytes()
    jl = struct.unpack_from("<I", b, 12)[0]
    g = json.loads(b[20:20 + jl])
    bin0 = 20 + jl + 8
    def mat(node):
        if "matrix" in node:
            return np.array(node["matrix"]).reshape(4, 4).T
        M = np.eye(4)
        t, r, s = node.get("translation", [0, 0, 0]), node.get("rotation", [0, 0, 0, 1]), node.get("scale", [1, 1, 1])
        x, y, z, w = r
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M[:3, :3] = R @ np.diag(s); M[:3, 3] = t
        return M
    pts = []
    def walk(i, P):
        node = g["nodes"][i]; W = P @ mat(node)
        if "mesh" in node:
            for prim in g["meshes"][node["mesh"]]["primitives"]:
                acc = g["accessors"][prim["attributes"]["POSITION"]]
                bv = g["bufferViews"][acc["bufferView"]]
                off = bin0 + bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
                stride = bv.get("byteStride", 12)
                v = np.array([struct.unpack_from("<3f", b, off + k * stride) for k in range(acc["count"])])
                pts.append((W @ np.c_[v, np.ones(len(v))].T).T[:, :3])
        for c in node.get("children", []):
            walk(c, W)
    for i in g["scenes"][g.get("scene", 0)]["nodes"]:
        walk(i, np.eye(4))
    return np.vstack(pts)


def main():
    a = sys.argv
    placed, glb, out = Path(a[1]), Path(a[2]), Path(a[3])
    name = a[a.index("--name") + 1] if "--name" in a else glb.stem
    plant = a[a.index("--plant") + 1] if "--plant" in a else None
    gl = next(e for e in ET.parse(placed).getroot().iter("GeoLocation"))
    lat, lon, h = (float(x) for x in gl.get("geoCoords").split())
    if plant == "lat-lon-swap":
        lat, lon = lon, lat
    if plant == "height+33":
        h += 33.0  # the size of the geoid at Blacksburg: an orthometric height read as ellipsoidal
    M = enu_frame(lat, lon, h)
    P = glb_positions(glb)
    if plant == "z-up":  # the content treated as z-up already: the y-up -> z-up turn is undone in the transform
        M = M @ np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)
    T = np.c_[P[:, 0], -P[:, 2], P[:, 1]]  # glTF y-up to the tile's z-up
    lo, hi = T.min(0), T.max(0)
    c, half = (lo + hi) / 2, (hi - lo) / 2
    box = list(c) + [half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]]
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(glb, out / f"{name}.glb")
    ts = {"asset": {"version": "1.1", "generator": "x3d.loom x3d.geo/cesium-leg/x3d_to_3dtiles.py"},
          "geometricError": float(np.linalg.norm(hi - lo)),
          "root": {"transform": [float(x) for x in M.T.reshape(-1)], "boundingVolume": {"box": [float(x) for x in box]},
                   "geometricError": 0.0, "refine": "REPLACE", "content": {"uri": f"{name}.glb"}},
          "extras": {"x3d": placed.name, "geoCoords": [lat, lon, h], "plant": plant}}
    (out / "tileset.json").write_text(json.dumps(ts, indent=1))
    print(json.dumps({"tileset": str(out / "tileset.json"), "geoCoords": [lat, lon, h], "vertices": len(P),
                      "extent_m": [float(x) for x in hi - lo], "plant": plant}))


if __name__ == "__main__":
    main()
