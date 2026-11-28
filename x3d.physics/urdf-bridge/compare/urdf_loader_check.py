#!/usr/bin/env python3
"""Hold gkjohnson's urdf-loader (the three.js URDF loader) to MuJoCo the same way fk_check.py holds our bridge:
same robots, same seed-7 poses inside the joint limits, every link frame compared.

  npm install            # in this folder: three 0.187.0, urdf-loader 0.13.1 (pinned in package.json)
  python3 urdf_loader_check.py ROBOT.urdf [--poses 100] [--seed 7] [--chromium EXE] [--out receipt.json]

urdf-loader runs where it is meant to, in a browser (Playwright Chromium headless, served from 127.0.0.1), parsing the
URDF itself. Kinematics only: no meshes. Mimic joints are left to urdf-loader (only leaders are set).
"""
from __future__ import annotations
import functools, hashlib, http.server, json, math, random, sys, threading
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import fk_check  # noqa: E402
import mujoco  # noqa: E402
import numpy as np  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402


def poses_for(urdf, n, seed):
    """The exact pose generator of fk_check.run (seed 7: the same 100 poses as our bridge's receipt)."""
    r = ET.parse(urdf).getroot()
    movable = {j.get("name"): j for j in r.findall("joint") if j.get("type") != "fixed"}
    rng = random.Random(seed)
    out = []
    for i in range(n):
        q = {}
        for jn, j in movable.items():
            lim = j.find("limit")
            lo, hi = (float(lim.get("lower")), float(lim.get("upper"))) if lim is not None and lim.get("lower") else (-math.pi, math.pi)
            q[jn] = 0.0 if i == 0 else rng.uniform(lo, hi)
        for jn, j in movable.items():
            mim = j.find("mimic")
            if mim is not None:
                q[jn] = float(mim.get("multiplier", "1")) * q[mim.get("joint")] + float(mim.get("offset", "0"))
        out.append(q)
    return out, movable


def main():
    a = sys.argv
    urdf = Path(a[1])
    n = int(a[a.index("--poses") + 1]) if "--poses" in a else 100
    seed = int(a[a.index("--seed") + 1]) if "--seed" in a else 7
    exe = a[a.index("--chromium") + 1] if "--chromium" in a else None
    poses, movable = poses_for(urdf, n, seed)
    leaders = [{k: v for k, v in q.items() if movable[k].find("mimic") is None} for q in poses]
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE))
    h.log_message = lambda *x: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    # the page imports from /nm/...: map it onto node_modules
    (HERE / "nm").unlink(missing_ok=True)
    (HERE / "nm").symlink_to("node_modules")
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=exe)
            pg = b.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://127.0.0.1:{srv.server_port}/urdf_loader_page.html")
            pg.wait_for_function("window.__ready === true", timeout=60000)
            res = pg.evaluate("([u, q]) => window.fk(u, q, true)", [urdf.read_text(), leaders])
            chromium = b.version
            b.close()
    finally:
        (HERE / "nm").unlink(missing_ok=True)
        srv.shutdown()
    m = fk_check.mujoco_model(urdf)
    d = mujoco.MjData(m)
    links = [l.get("name") for l in ET.parse(urdf).getroot().findall("link")]
    worst_p = worst_r = 0.0
    missing = set()
    per_link = {}
    for q, fr in zip(poses, res["frames"]):
        fl = {k: np.array(v).reshape(4, 4).T for k, v in fr.items()}  # three.js elements are column-major
        fm = fk_check.mujoco_frames(m, d, q, links)
        p_, r_, miss = fk_check.compare(fm, fl)
        missing |= set(miss)
        worst_p, worst_r = max(worst_p, p_), max(worst_r, r_)
        for k in fm:
            if k in fl:
                e = float(np.linalg.norm(fm[k][:3, 3] - fl[k][:3, 3]))
                per_link[k] = max(per_link.get(k, 0.0), e)
    pkg = lambda name: json.loads((HERE / "node_modules" / name / "package.json").read_text())["version"]
    receipt = {"schema": "x3d.loom/urdf-loader-fk-receipt/1", "urdf": urdf.name, "urdf_sha256": hashlib.sha256(urdf.read_bytes()).hexdigest(),
               "loader": {"urdf-loader": pkg("urdf-loader"), "three": pkg("three"), "chromium": chromium, "page_errors": errs},
               "mujoco": mujoco.__version__, "poses": n, "seed": seed, "links_in_loader": res["links"], "joints_in_loader": res["joints"],
               "mimic_in_loader": res["mimic"], "links_missing": sorted(missing),
               "worst_position_m": worst_p, "worst_rotation_rad": worst_r,
               "worst_position_by_link_m": dict(sorted(per_link.items(), key=lambda kv: -kv[1])[:5]),
               "tolerance": {"position_m": fk_check.TOL_POS, "rotation_rad": fk_check.TOL_ROT},
               "pass": worst_p <= fk_check.TOL_POS and worst_r <= fk_check.TOL_ROT and not missing}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
