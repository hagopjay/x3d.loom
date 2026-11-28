#!/usr/bin/env python3
"""Run an animated urdf2x3d scene in X_ITE (headless Chromium through Playwright) and hold what X_ITE's own
OrientationInterpolator and ROUTEs put on the joint Transforms to MuJoCo, at every message time and midpoint.

  python3 browser/xite_replay.py ROBOT.urdf RECORDING.mcap ANIMATED.x3d --xite DIR [--chromium EXE] [--out receipt.json]

The --no-split control: build the twin with `ros2_replay.py ... --no-split` and run this on it; it must fail.

DIR holds x_ite/ from `npm pack x_ite@VERSION` (dist folder). The page is served from 127.0.0.1 only.
"""
from __future__ import annotations
import copy, functools, hashlib, http.server, json, shutil, sys, tempfile, threading
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import fk_check, ros2_replay, replay_check  # noqa: E402
import mujoco  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

# SFRotation, MFRotation and SFVec3f are single-precision fields in X3D 4.0 (Part 1, 5.3), and X_ITE keeps them in
# Float32Arrays, so a browser carries a joint angle to about 1e-6 rad (float32 at 2 rad: 2.4e-7). The Python witness
# holds doubles and is judged at 1e-9; this leg is judged at 1e-5 m and 1e-5 rad, ten times above float32 noise at
# these magnitudes and far below any real fault (the planted ones are 0.03 m to 3.14 rad).
TOL_POS, TOL_ROT = 1e-5, 1e-5


def main():
    a = sys.argv
    urdf, rec, anim = Path(a[1]), Path(a[2]), Path(a[3]).resolve()
    xite = Path(a[a.index("--xite") + 1]).resolve()
    reader = ros2_replay.load_reader(ros2_replay.DEFAULT_READER)
    rows, _ = ros2_replay.read_joint_states(rec, "/joint_states", reader)
    root = ET.parse(anim).getroot()
    joints = ros2_replay.joints_of(root)
    tr, _, _ = ros2_replay.tracks(rows, joints)
    T = float(next(e for e in root.find("Scene") if e.tag == "TimeSensor").get("cycleInterval"))
    samples = []
    for k, (t, _) in enumerate(rows):
        samples.append(("key", t, {j: tr[j][k][1] for j in joints}))
        if k + 1 < len(rows):
            samples.append(("mid", (t + rows[k + 1][0]) / 2, {j: (tr[j][k][1] + tr[j][k + 1][1]) / 2 for j in joints}))
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        shutil.copytree(xite / "x_ite", td / "x_ite")
        shutil.copy(HERE / "replay.html", td / "replay.html")
        shutil.copy(anim, td / "scene.x3d")
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(td))
        h.log_message = lambda *x: None
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        with sync_playwright() as p:
            exe = a[a.index("--chromium") + 1] if "--chromium" in a else None
            b = p.chromium.launch(executable_path=exe, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
            pg = b.new_page(viewport={"width": 640, "height": 480})
            console = []
            pg.on("console", lambda m: console.append(m.text) if m.type in ("error", "warning") else None)
            pg.goto(f"http://127.0.0.1:{srv.server_port}/replay.html?scene=scene.x3d")
            pg.wait_for_function("window.__ready !== null", timeout=120000)
            ready = pg.evaluate("window.__ready")
            vals = pg.evaluate("fs => window.sample(fs)", [t / T for _, t, _ in samples]) if not ready["errors"] else []
            xv = pg.evaluate("X3D.getBrowser().version") if not ready["errors"] else None
            b.close()
        srv.shutdown()
    m = fk_check.mujoco_model(urdf)
    d = mujoco.MjData(m)
    links = [l.get("name") for l in ET.parse(urdf).getroot().findall("link")]
    nodes_by_def = None
    worst = {"key": [0.0, 0.0], "mid": [0.0, 0.0]}
    for (kind, t, q), row in zip(samples, vals):
        r = copy.deepcopy(root)
        nodes_by_def = {e.get("DEF"): e for e in r.iter() if e.get("DEF")}
        for j, v in row.items():
            nodes_by_def[j].set("rotation" if len(v) == 4 else "translation", " ".join(repr(float(x)) for x in v))
        fx = fk_check.x3d_frames(r, set(links))
        fm = fk_check.mujoco_frames(m, d, q, links)
        pos, rot, _ = fk_check.compare(fm, fx)
        worst[kind] = [max(worst[kind][0], pos), max(worst[kind][1], rot)]
    ok = bool(vals) and all(w[0] <= TOL_POS and w[1] <= TOL_ROT for w in worst.values())
    xs = hashlib.sha256((xite / "x_ite" / "x_ite.min.js").read_bytes()).hexdigest()
    receipt = {"schema": "x3d.loom/ros2-replay-xite-receipt/1", "x3d": anim.name, "x3d_sha256": hashlib.sha256(anim.read_bytes()).hexdigest(),
               "recording": rec.name, "x_ite": xv, "x_ite_min_js_sha256": xs,
               "rig": "Playwright Chromium headless, SwiftShader (software GL), cloud container", "mujoco": mujoco.__version__,
               "routes_seen": len(ready.get("routes", [])), "page_errors": ready["errors"], "console": console[:10],
               "samples": len(vals), "worst_at_messages": {"position_m": worst["key"][0], "rotation_rad": worst["key"][1]},
               "worst_at_midpoints": {"position_m": worst["mid"][0], "rotation_rad": worst["mid"][1]},
               "tolerance": {"position_m": TOL_POS, "rotation_rad": TOL_ROT, "why": "X3D SFRotation is single precision"},
               "console_filtered": "GL driver performance messages and one 404 (favicon) are expected on this rig", "pass": ok}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
