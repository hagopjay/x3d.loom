#!/usr/bin/env python3
"""Assemble mujoco_bridge_gpu.ipynb: one self-contained Colab notebook for batched GPU rollouts.

SKETCH: built and syntax-checked on the Mac, NOT yet run on Colab. Same pattern as
work/jepa-bridge/build_notebook.py: all code embedded (gzip+base64), a form for the profile,
a doctor cell that must be all ✅, results to the user's Drive.

usage: python3 -I gpu/build_notebook.py [--x3d-mcp DIR] [OUT.ipynb]     (run from bridge/)
Embeds: gpu/rollouts.py, the x3d_mcp fork's src/mujoco_bridge/ (branch bridge/agents-slice),
and samples/contact-arm-experiment.zip as the default input package.
"""
import argparse
import base64
import gzip
import hashlib
import json
import textwrap
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("out", nargs="?", default="gpu/mujoco_bridge_gpu.ipynb")
ap.add_argument("--x3d-mcp", default=str(Path.home() / "Projects/x3d/x3d_mcp-agents-slice"))
args = ap.parse_args()
BRIDGE = Path(__file__).resolve().parent.parent
MB = Path(args.x3d_mcp) / "src" / "mujoco_bridge"
FILES = {
    "rollouts.py": BRIDGE / "gpu" / "rollouts.py",
    "mujoco_bridge/__init__.py": MB / "__init__.py",
    "mujoco_bridge/contract.py": MB / "contract.py",
    "mujoco_bridge/safety.py": MB / "safety.py",
    "mujoco_bridge/scene_io.py": MB / "scene_io.py",
    "mujoco_bridge/sim.py": MB / "sim.py",
    "mujoco_bridge/snapshot.py": MB / "snapshot.py",
    "mujoco_bridge/data/contact_arm_template.xml": MB / "data" / "contact_arm_template.xml",
    "sample/contact-arm-experiment.zip": BRIDGE / "samples" / "contact-arm-experiment.zip",
}
blob = {name: base64.b64encode(gzip.compress(p.read_bytes(), mtime=0)).decode() for name, p in FILES.items()}
digest = hashlib.sha256(json.dumps(blob, sort_keys=True).encode()).hexdigest()[:12]
cells = []


def md(src):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": textwrap.dedent(src).strip("\n")})


def code(src, form=False):
    cells.append({"cell_type": "code", "metadata": {"cellView": "form"} if form else {}, "execution_count": None,
                  "outputs": [], "source": textwrap.dedent(src).strip("\n")})


md(f'''
# X3D ⇄ MuJoCo: batched GPU rollouts of an experiment package (sketch, build {digest})

**Status: a sketch.** It has been built and syntax-checked, never run on a GPU. Expect the doctor cell to find things to fix
on the first run (MJX field names, contact counting, the integrator). Tell a hosted model what it prints.

**What it does.** It reads an **experiment package** (the `.zip` the browser bridge or the MCP `simulate` tool writes:
`manifest.json`, `x3d/scene.x3d`, `mjcf/model.xml`). It sweeps that recipe (joint targets, obstacle position and radius,
link masses), runs every variant at once on the GPU with **MJX** (MuJoCo on JAX), and writes the results back **as experiment
packages**: one results package with `records/gpu-batch.json`, plus the most interesting variants as packages of their own.
Each of those opens in the browser bridge, where *Measure 5 s* replays it on MuJoCo's WASM build.

**How to run it.**
1. Runtime ▸ Change runtime type ▸ **G4 GPU** (signed in as the account that has Colab Pro and the G4).
2. Shift+Enter on each cell, top to bottom, with `PROFILE = "smoke"`. Every doctor line must be ✅.
3. Then `PROFILE = "core"`, and run again from *Configuration* down. `"full"` is the large sweep.
4. Results go to `My Drive/x3d.io/mujoco-bridge-runs/<run>-<profile>/` (small files only), which a hosted model can read.

**Cost.** Compute units are used while the GPU runtime is connected: Runtime ▸ Disconnect and delete runtime when it says DONE.
''')

code('''
# 1. What machine did we get?
import shutil, subprocess
print(subprocess.run(["nvidia-smi"], capture_output=True, text=True).stdout if shutil.which("nvidia-smi")
      else "No GPU. Runtime > Change runtime type > G4 GPU, then run this cell again.")
''')

code('''
#@title 2. Configuration { display-mode: "form" }
PROFILE = "smoke"  #@param ["smoke", "core", "full"]
RUN_NAME = "sweep1"  #@param {type:"string"}
BACKEND = "mjx"  #@param ["mjx", "warp"]
PACKAGE_PATH = ""  #@param {type:"string"}
TOP_K = 8  #@param {type:"integer"}
DRIVE_BASE = "x3d.io/mujoco-bridge-runs"  #@param {type:"string"}
MUJOCO_VERSION = "3.17.0"  # pinned: the browser bridge's WASM build, so packages replay on the same engine
import os, pathlib
IN_COLAB = "COLAB_RELEASE_TAG" in os.environ
ROOT = pathlib.Path("/content/mjbridge" if IN_COLAB else "/tmp/mjbridge")
ROOT.mkdir(parents=True, exist_ok=True)
print("profile", PROFILE, "| run", RUN_NAME, "| backend", BACKEND, "| package", PACKAGE_PATH or "(embedded sample)")
''', form=True)

code('''
# 3. Google Drive for results (and, if PACKAGE_PATH is a Drive path, for the input package)
DRIVE_OUT = None
if IN_COLAB:
    from google.colab import drive
    drive.mount("/content/drive")
    DRIVE_OUT = pathlib.Path(f"/content/drive/MyDrive/{DRIVE_BASE}/{RUN_NAME}-{PROFILE}")
    DRIVE_OUT.mkdir(parents=True, exist_ok=True)
print("results ->", DRIVE_OUT or "(local only)")
''')

code(f'''
# 4. Install MuJoCo + MJX at the bridge's pinned version, and JAX for the GPU (a few minutes the first time)
import subprocess, sys
pkgs = [f"mujoco=={{MUJOCO_VERSION}}", f"mujoco-mjx=={{MUJOCO_VERSION}}", "jax[cuda12]", "lxml"]
if BACKEND == "warp":
    pkgs.append("mujoco-warp")  # Conjecture: package name to confirm
r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", *pkgs], capture_output=True, text=True)
print(r.stdout[-2000:], r.stderr[-2000:]); print("✅ installed" if r.returncode == 0 else "❌ pip failed")
''')

code(f'''
# 5. Unpack the embedded code (build {digest}): rollouts.py and the bridge contract from x3d_mcp
import base64, gzip, json
BLOB = json.loads({json.dumps(json.dumps(blob))})
for name, data in BLOB.items():
    p = ROOT / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(gzip.decompress(base64.b64decode(data)))
sys.path.insert(0, str(ROOT))
import importlib, rollouts as R; importlib.reload(R)
print("unpacked", len(BLOB), "files")
''')

code('''
# 6. Doctor: every line must be ✅ before a big run
import mujoco, numpy as np, time
CHECKS = []
def check(label, ok, detail=""):
    CHECKS.append(bool(ok)); print(("✅ " if ok else "❌ ") + label + (f"  ({detail})" if detail else ""))
import jax
devs = jax.devices()
check("JAX sees a GPU", any(d.platform == "gpu" for d in devs), ", ".join(map(str, devs)))
check("MuJoCo version is the bridge's", mujoco.__version__ == MUJOCO_VERSION, mujoco.__version__)
from mujoco import mjx
src = pathlib.Path(PACKAGE_PATH) if PACKAGE_PATH else ROOT / "sample/contact-arm-experiment.zip"
PKG = R.load_package(src.read_bytes())
check("input package reads and is consistent", True, f"{src.name}: target {PKG['target']}")
m = mujoco.MjModel.from_xml_string(PKG["mjcf"])
check("integrator supported by MJX", m.opt.integrator in (0, 3), f"integrator={m.opt.integrator} (implicitfast=3)")
# One world on CPU (float64, exact browser order) vs one world on MJX (float32 by default).
base = R.Variant(PKG["recipe"], PKG["target"])
ref = R.cpu_reference(base, 2500)
res, secs = R.timed(R.mjx_rollout, [base], 2500)
err = float(np.max(np.abs(res["finalQpos"][0] - np.array(ref["finalQpos"]))))
check("MJX matches native MuJoCo on the package's own trial", err < 5e-3, f"max |Δq| = {err:.2e} rad after 2500 steps; {secs:.1f} s incl. compile")
check("contact seen in both", (res["peakContacts"][0] > 0) == (ref["peakContacts"] > 0), f"mjx {res['peakContacts'][0]}, cpu {ref['peakContacts']}")
# Throughput estimate for the chosen profile (second call is compiled).
VARS = R.sweep(PKG["recipe"], PKG["target"], PROFILE)
probe = VARS[: min(len(VARS), 1024)]
_, secs = R.timed(R.mjx_rollout, probe, 200)
rate = len(probe) * 200 / secs
eta = len(VARS) * R.PROFILES[PROFILE]["steps"] / rate
check("throughput measured", rate > 0, f"{rate:,.0f} world-steps/s -> {len(VARS):,} worlds x {R.PROFILES[PROFILE]['steps']} steps ≈ {eta/60:.1f} min")
print("DOCTOR:", "ALL ✅" if all(CHECKS) else "fix the ❌ lines first")
''')

code('''
# 7. The sweep (resume note: re-running repeats it; results are only written in cell 8)
assert all(CHECKS), "doctor has ❌ lines"
RES, SECS = R.timed(R.mjx_rollout, VARS, R.PROFILES[PROFILE]["steps"])
print(f"{len(VARS):,} worlds in {SECS:.1f} s; finite: {RES['finite'].mean():.1%}; touching: {(RES['peakTouchN'] > 0).mean():.1%}")
''')

code('''
# 8. Write packages: results package + TOP_K variant packages (highest peak touch force), and a summary
import json, datetime
OUT = ROOT / f"out-{RUN_NAME}-{PROFILE}"; OUT.mkdir(exist_ok=True)
meta = {"backend": BACKEND, "mujoco": mujoco.__version__, "jax": jax.__version__, "profile": PROFILE, "steps": R.PROFILES[PROFILE]["steps"],
        "seconds": SECS, "controller": "arm-joint-pd-v1", "precision": "float32 (MJX default)",
        "input": {"name": src.name, "recipe": PKG["recipe"], "target": PKG["target"]},
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT / "results.zip").write_bytes(R.results_package(PKG, VARS, RES, meta))
order = np.argsort(-RES["peakTouchN"])[:TOP_K]
for rank, i in enumerate(order, 1):
    row = {"rank": rank, "peakTouchN": float(RES["peakTouchN"][i]), "finalQpos": RES["finalQpos"][i].tolist(), **{"meta": meta}}
    (OUT / f"variant-{rank:02d}.zip").write_bytes(R.variant_package(PKG, VARS[i], row))
(OUT / "summary.json").write_text(json.dumps(R.jsonable({**meta, "worlds": len(VARS), "topK": [int(i) for i in order]}), indent=2))
if DRIVE_OUT:
    for f in OUT.iterdir(): shutil.copy2(f, DRIVE_OUT / f.name)
print("wrote", sorted(p.name for p in OUT.iterdir()), "->", DRIVE_OUT or OUT)
''')

code('''
# 9. Done
print("DONE. Tell a hosted model the results are in Drive. Then Runtime > Disconnect and delete runtime to stop spending compute units.")
''')

nb = {"nbformat": 4, "nbformat_minor": 5, "cells": cells,
      "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "G4"},
                   "kernelspec": {"name": "python3", "display_name": "Python 3"}, "language_info": {"name": "python"}}}
Path(args.out).write_text(json.dumps(nb, indent=1, ensure_ascii=False))
print(f"wrote {args.out} ({Path(args.out).stat().st_size:,} bytes, build {digest}, {len(cells)} cells)")
