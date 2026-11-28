#!/usr/bin/env python3
"""Import one file, export it, and count what the export holds next to what the source held.
Usage (inside the bpy venv):
    X3D_ADDON_SOURCE=.../source python export_census.py X3D_BLENDER_IO_REPO FILE.x3d OUT.json [KEEP_EXPORT.x3d]"""
import collections, json, re, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "tools" / "chaos"))
import differential
import bpy
WANT = ("TimeSensor", "PositionInterpolator", "OrientationInterpolator", "ScalarInterpolator", "CoordinateInterpolator",
        "Transform", "Shape", "ROUTE")
def census(text):
    c = collections.Counter(re.findall(r"<([A-Za-z0-9]+)[\s/>]", text))
    keys = [len(k.split()) for k in re.findall(r"<(?:Position|Orientation)Interpolator[^>]*?\skey='([^']*)'", text)]
    return {"bytes": len(text.encode()), **{k: c.get(k, 0) for k in WANT}, "keys_per_interpolator_max": max(keys, default=0)}
judge = differential.ImportJudge()
bpy.ops.wm.read_factory_settings(use_empty=True)
src = Path(sys.argv[2])
t0 = time.time(); bpy.ops.import_scene.x3d(filepath=str(src)); ti = time.time() - t0
sc = bpy.context.scene
row = {"file": sys.argv[2], "source": census(src.read_text(encoding="utf-8", errors="replace")), "import_seconds": round(ti, 2),
       "objects": len(bpy.data.objects), "frame_start": sc.frame_start, "frame_end": sc.frame_end, "fps": sc.render.fps,
       "objects_with_action": sum(1 for o in bpy.data.objects if o.animation_data and o.animation_data.action)}
target = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(tempfile.mkdtemp(prefix="census-")) / "out.x3d"
t1 = time.time(); res = bpy.ops.export_scene.x3d(filepath=str(target))
row.update(export_result=sorted(res)[0], export_seconds=round(time.time() - t1, 2),
           export=census(target.read_text(encoding="utf-8", errors="replace")))
Path(sys.argv[3]).write_text(json.dumps(row, indent=1) + "\n")
print(json.dumps(row))
