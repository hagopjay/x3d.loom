import sys, tempfile, re, hashlib
from pathlib import Path
src, out = sys.argv[1:3]
tmp = tempfile.mkdtemp(); (Path(tmp)/"io_scene_x3d").symlink_to(Path(src).resolve(), target_is_directory=True); sys.path.insert(0, tmp)
import bpy, importlib
a = importlib.import_module("io_scene_x3d"); a.register(); bpy.ops.wm.read_factory_settings(use_empty=True)
try: a.register()
except ValueError: pass
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
bpy.ops.mesh.primitive_monkey_add(location=(3,0,0))
bpy.ops.mesh.primitive_torus_add(location=(-3,0,0))
bpy.ops.export_scene.x3d(filepath=out, x3d_version="X3D40")
t = re.sub(r"<meta [^>]*/>\s*", "", Path(out).read_text())
print("SHA", hashlib.sha256(t.encode()).hexdigest()[:16], len(t))
