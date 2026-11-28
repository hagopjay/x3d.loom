#!/usr/bin/env python3
"""Profile one import through the add-on's own chaos harness. Usage (inside the bpy venv):
    X3D_ADDON_SOURCE=.../source python profile_import.py X3D_BLENDER_IO_REPO FILE.x3d OUT.txt"""
import cProfile, io, pstats, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "tools" / "chaos"))
import differential
import bpy
judge = differential.ImportJudge()
bpy.ops.wm.read_factory_settings(use_empty=True)
pr = cProfile.Profile()
t0 = time.time()
pr.enable()
res = bpy.ops.import_scene.x3d(filepath=sys.argv[2])
pr.disable()
s = io.StringIO()
st = pstats.Stats(pr, stream=s)
st.sort_stats("cumulative").print_stats(28)
st.sort_stats("tottime").print_stats(18)
Path(sys.argv[3]).write_text(f"result {res} in {time.time() - t0:.1f} s (profiled)\n" + s.getvalue())
print("done", res, round(time.time() - t0, 1))
