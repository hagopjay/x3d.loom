#!/usr/bin/env python3
"""Run x3d.lab's Blender worker (render task) on the Leg E scenes with the camera matched to X_ITE.
usage: cycles_job.py LAB_WORKER.py ADDON_SRC OUTDIR [SAMPLES]   (python with bpy, e.g. a venv with `pip install bpy`)
The worker is read, not edited: one line is patched in memory. Why: the add-on sets the Blender camera from an X3D fieldOfView at the 16:9 default resolution; rendering at 320x240 then keeps the
HORIZONTAL angle and widens the vertical one (e3: 0.7854 rad asked, 1.0092 rad drawn, from the horizontal 1.2695 the add-on set at 16:9). X3D fieldOfView applies to the smaller picture axis (19775-1 23.4.2), vertical at 4:3, so the patch sets sensor_fit VERTICAL and angle = fieldOfView."""
import sys, re, json, os, subprocess, tempfile
WORKER, ADDON, OUT = sys.argv[1:4]; SAMPLES = int(sys.argv[4]) if len(sys.argv) > 4 else 256
HERE = os.path.dirname(os.path.abspath(__file__)); SC = os.path.join(HERE, "scenes")
src = open(WORKER).read(); old = 'framing = frame_camera(scn, t.get("camera", "viewpoint") == "viewpoint")'
assert old in src, "worker line not found: update cycles_job.py"
new = old + '\n    if t.get("fov") and scn.camera is not None:\n        scn.camera.data.sensor_fit = "VERTICAL"; scn.camera.data.angle = float(t["fov"])'
work = tempfile.mkdtemp(); w = os.path.join(work, "worker.py"); open(w, "w").write(src.replace(old, new))
os.makedirs(OUT, exist_ok=True); tasks = []
for n in ["e1-pbr-grid", "e2-cornell-box", "e3-light-ladder"]:
    fov = float(re.search(r'<Viewpoint[^>]*fieldOfView="([^"]+)"', open(f"{SC}/{n}.x3d").read()).group(1))
    tasks.append({"id": n, "kind": "render", "src": f"{SC}/{n}.x3d", "out_png": f"{OUT}/{n}.cycles.png", "samples": SAMPLES, "resolution": [320, 240], "denoise": True, "film_transparent": True, "backend": "CPU", "fov": fov})
job = os.path.join(work, "job.json"); json.dump({"addon_src": ADDON, "tasks": tasks}, open(job, "w"))
r = subprocess.run([sys.executable, "-I", w, job], capture_output=True, text=True); open(f"{OUT}/worker.log", "w").write(r.stdout[-20000:])
print("ok" if r.returncode == 0 else r.stderr[-500:])
