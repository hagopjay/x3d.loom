#!/usr/bin/env python3
"""Time the import and the export of one file separately, through the add-on's own chaos harness, and profile the export.
Usage (inside the bpy venv):
    X3D_ADDON_SOURCE=.../source python stage_times.py X3D_BLENDER_IO_REPO FILE.x3d OUT.json [PROFILE.txt]
The sweep driver asks the harness for import followed by export in one call, so its 'seconds' is the sum of both. This
tool says which half the time went to. No watchdog here: the caller sets the limit (timeout(1))."""
import cProfile, io, json, pstats, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "tools" / "chaos"))
import differential
import bpy
judge = differential.ImportJudge()
bpy.ops.wm.read_factory_settings(use_empty=True)
out = Path(sys.argv[3])
row = {"file": sys.argv[2], "stage": "import"}
out.write_text(json.dumps(row) + "\n")           # if the process is stopped, this says where it was
t0 = time.time()
res = bpy.ops.import_scene.x3d(filepath=sys.argv[2])
row.update(import_result=sorted(res)[0], import_seconds=round(time.time() - t0, 2), objects=len(bpy.data.objects),
           meshes=len(bpy.data.meshes), stage="export")
out.write_text(json.dumps(row) + "\n")
target = Path(tempfile.mkdtemp(prefix="stage-")) / "out.x3d"
pr = cProfile.Profile()
t1 = time.time()
pr.enable()
try:
    res = bpy.ops.export_scene.x3d(filepath=str(target))
finally:
    pr.disable()
    if len(sys.argv) > 4:
        s = io.StringIO()
        st = pstats.Stats(pr, stream=s)
        st.sort_stats("cumulative").print_stats(30)
        st.sort_stats("tottime").print_stats(20)
        Path(sys.argv[4]).write_text(s.getvalue())
row.update(export_result=sorted(res)[0], export_seconds=round(time.time() - t1, 2), stage="done",
           export_bytes=target.stat().st_size if target.exists() else None)
out.write_text(json.dumps(row) + "\n")
print(json.dumps(row))
