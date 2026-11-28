#!/usr/bin/env python3
"""Where does CesiumJS put the geometry? A geo-placed X3D held to CesiumJS's own runtime.

  python3 cesium_check.py PLACED.x3d MODEL.glb TILESET_DIR [--label NAME] [--grid 11] [--chromium EXE] [--shot OUT.png] [--out receipt.json]

Reference (Python, from the X3D and the glb only): the glb's triangles in the GeoLocation's local frame (x east, y up,
z south), a vertical ray at each grid point of the footprint (plus a 25 % margin), the top surface hit or a miss.
Runtime (CesiumJS from node_modules, Chromium headless, SwiftShader, offline): scene.sampleHeightMostDetailed at the
same longitudes and latitudes. Compared: hit or miss per point, and the ellipsoidal height of every hit.
"""
from __future__ import annotations
import functools, hashlib, http.server, json, math, sys, threading
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from x3d_to_3dtiles import glb_positions, enu_frame, geodetic_to_ecef, A, E2  # noqa: E402

TOL_H = 0.05  # metres: Cesium samples heights from a depth pick, not from the triangles


def ecef_to_geodetic(x, y, z):
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - E2))
    for _ in range(8):
        n = A / math.sqrt(1 - E2 * math.sin(lat) ** 2)
        h = p / math.cos(lat) - n
        lat = math.atan2(z, p * (1 - E2 * n / (n + h)))
    n = A / math.sqrt(1 - E2 * math.sin(lat) ** 2)
    return math.degrees(lat), math.degrees(lon), p / math.cos(lat) - n


def triangles(glb):
    """Triangles of the glb in its y-up frame (indexed through each primitive)."""
    import struct
    b = glb.read_bytes()
    jl = struct.unpack_from("<I", b, 12)[0]
    g = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
    P = glb_positions(glb)  # world-space vertices, in primitive order
    tris, base = [], 0
    def prims():
        def walk(i):
            node = g["nodes"][i]
            if "mesh" in node:
                for prim in g["meshes"][node["mesh"]]["primitives"]:
                    yield prim
            for c in node.get("children", []):
                yield from walk(c)
        for i in g["scenes"][g.get("scene", 0)]["nodes"]:
            yield from walk(i)
    for prim in prims():
        n = g["accessors"][prim["attributes"]["POSITION"]]["count"]
        if "indices" in prim:
            acc = g["accessors"][prim["indices"]]; bv = g["bufferViews"][acc["bufferView"]]
            fmt = {5121: "B", 5123: "H", 5125: "I"}[acc["componentType"]]
            off = bin0 + bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            idx = np.array(struct.unpack_from("<%d%s" % (acc["count"], fmt), b, off)) + base
        else:
            idx = np.arange(base, base + n)
        tris.append(P[idx].reshape(-1, 3, 3))
        base += n
    return np.vstack(tris)


def top_heights(T, pts_en):
    """Vertical rays (local up = glTF +y) at (east, north) points: highest hit, or None. glTF z is south."""
    out = []
    X, Zs = T[:, :, 0], -T[:, :, 2]  # east, north
    for e, n in pts_en:
        a, b, c = np.c_[X[:, 0], Zs[:, 0]], np.c_[X[:, 1], Zs[:, 1]], np.c_[X[:, 2], Zs[:, 2]]
        v0, v1, p = c - a, b - a, np.array([e, n]) - a
        d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
        d20, d21 = (p * v0).sum(1), (p * v1).sum(1)
        den = d00 * d11 - d01 * d01
        ok = np.abs(den) > 1e-14
        u = np.where(ok, (d11 * d20 - d01 * d21) / np.where(ok, den, 1), -1)
        v = np.where(ok, (d00 * d21 - d01 * d20) / np.where(ok, den, 1), -1)
        inside = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9)
        if not inside.any():
            out.append(None); continue
        y = T[inside, 0, 1] + u[inside] * (T[inside, 2, 1] - T[inside, 0, 1]) + v[inside] * (T[inside, 1, 1] - T[inside, 0, 1])
        out.append(float(y.max()))
    return out


def main():
    a = sys.argv
    placed, glb, tiles = Path(a[1]), Path(a[2]), Path(a[3])
    label = a[a.index("--label") + 1] if "--label" in a else tiles.name
    k = int(a[a.index("--grid") + 1]) if "--grid" in a else 11
    exe = a[a.index("--chromium") + 1] if "--chromium" in a else None
    gl = next(e for e in ET.parse(placed).getroot().iter("GeoLocation"))
    lat, lon, h = (float(x) for x in gl.get("geoCoords").split())
    T = triangles(glb)
    e_lo, e_hi = T[:, :, 0].min(), T[:, :, 0].max()
    n_lo, n_hi = (-T[:, :, 2]).min(), (-T[:, :, 2]).max()
    me, mn = 0.25 * (e_hi - e_lo), 0.25 * (n_hi - n_lo)
    grid = [(e, n) for e in np.linspace(e_lo - me, e_hi + me, k) for n in np.linspace(n_lo - mn, n_hi + mn, k)]
    ref_local = top_heights(T, grid)
    M = enu_frame(lat, lon, h)
    samples, ref_h = [], []
    for (e, n), y in zip(grid, ref_local):
        g = M @ np.array([e, n, 0.0 if y is None else y, 1.0])
        la, lo_, hh = ecef_to_geodetic(*g[:3])
        samples.append([lo_, la]); ref_h.append(None if y is None else hh)
    h_ = functools.partial(http.server.SimpleHTTPRequestHandler, directory="/")
    h_.log_message = lambda *x: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h_)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    nm = HERE / "node_modules"
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 960, "height": 640})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        # serve the page and node_modules from one origin: /nm -> node_modules, everything else from the filesystem
        base = f"http://127.0.0.1:{srv.server_port}"
        pg.route("**/nm/**", lambda r: r.continue_(url=r.request.url.replace(f"{base}/nm/", f"{base}{nm}/")))
        pg.goto(f"{base}{HERE / 'cesium_page.html'}")
        pg.wait_for_function("window.__ready === true", timeout=120000)
        pg.evaluate("window.globeOff(true)")  # sample the tileset only, not the ellipsoid under it
        res = pg.evaluate("([u, s, d]) => window.measure(u, s, d)", [f"{base}{tiles.resolve() / 'tileset.json'}", samples, [lat, lon, h]])
        if "--shot" in a:
            pg.evaluate("window.globeOff(false)"); pg.evaluate("window.shot()"); pg.wait_for_timeout(1500)
            pg.screenshot(path=a[a.index("--shot") + 1])
        chromium = b.version
        b.close()
    srv.shutdown()
    rows = list(zip(ref_h, res["heights"]))
    both = [(r, c) for r, c in rows if r is not None and c is not None]
    ref_only = sum(1 for r, c in rows if r is not None and c is None)
    ces_only = sum(1 for r, c in rows if r is None and c is not None)
    worst = max((abs(r - c) for r, c in both), default=None)
    enu_c = np.array(res["cesiumEnuAtDeclared"]).reshape(4, 4).T
    receipt = {"schema": "x3d.loom/cesium-placement-receipt/1", "label": label, "x3d": placed.name,
               "x3d_sha256": hashlib.sha256(placed.read_bytes()).hexdigest(), "glb_sha256": hashlib.sha256(glb.read_bytes()).hexdigest(),
               "tileset_extras": json.loads((tiles / "tileset.json").read_text()).get("extras"),
               "declared_geoCoords": [lat, lon, h], "cesium": res["version"], "chromium": chromium,
               "rig": "Playwright Chromium headless, ANGLE on SwiftShader; offline: no ion, no imagery, ellipsoid terrain",
               "grid": f"{k} x {k} over the footprint plus 25 % margin", "points": len(rows),
               "hits_reference": sum(1 for r in ref_h if r is not None), "hits_cesium": sum(1 for c in res["heights"] if c is not None),
               "hit_in_both": len(both), "hit_reference_only": ref_only, "hit_cesium_only": ces_only,
               "worst_height_difference_m": worst, "tolerance_m": TOL_H,
               "cesium_enu_vs_ours_max_abs": float(np.abs(enu_c - M).max()),
               "bounding_sphere_center_deg": res["boundingSphereCenterDeg"], "page_errors": errs[:5],
               "pass": res["loaded"] and ref_only == 0 and ces_only == 0 and worst is not None and worst <= TOL_H}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps({k2: receipt[k2] for k2 in ("label", "points", "hits_reference", "hits_cesium", "hit_reference_only", "hit_cesium_only",
                                                 "worst_height_difference_m", "cesium_enu_vs_ours_max_abs", "page_errors", "pass")}))


if __name__ == "__main__":
    main()
