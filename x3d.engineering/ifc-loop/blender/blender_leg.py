"""Blender leg of the IFC loop: X3D (ifc2x3d.py) -> x3d-blender-io import -> Blender -> x3d-blender-io export X3D 4.0.

  python blender_leg.py --repo PATH/x3d-blender-io IN.x3d OUT.x3d OUT-blender.json
Runs in the bpy wheel (5.3.0). Records what Blender holds after import: objects, empties, custom-property metadata.
"""
import json, os, sys, importlib, tempfile
import bpy

args = sys.argv[sys.argv.index("--repo") + 1:]
repo, src, out, rep = args[0], args[1], args[2], args[3]
tmp = tempfile.mkdtemp(prefix="x3d_repo_")
os.symlink(os.path.join(os.path.abspath(repo), "source"), os.path.join(tmp, "io_scene_x3d"))
sys.path.insert(0, tmp)
mod = importlib.import_module("io_scene_x3d")
mod.register()
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    mod.register()
except Exception:
    pass
res = bpy.ops.import_scene.x3d(filepath=src)
objs = list(bpy.data.objects)
def flat(o):
    return json.dumps(o.get("x3d_metadata").to_dict() if hasattr(o.get("x3d_metadata"), "to_dict") else o.get("x3d_metadata"), default=str) if o.get("x3d_metadata") is not None else ""
keys = sorted({k for o in objs for k in o.keys()})
with_meta = [o for o in objs if any("GlobalId" in json.dumps(o[k].to_dict() if hasattr(o[k], "to_dict") else o[k], default=str) for k in o.keys())]
scene_keys = list(bpy.context.scene.keys())
info = {"blender": bpy.app.version_string, "addon": mod.bl_info.get("version") if hasattr(mod, "bl_info") else None,
        "import": list(res), "objects": len(objs), "by_type": {}, "custom_keys": keys, "objects_with_ifc_guid": len(with_meta),
        "scene_keys": scene_keys, "parented": sum(1 for o in objs if o.parent is not None)}
for o in objs:
    info["by_type"][o.type] = info["by_type"].get(o.type, 0) + 1
sample = with_meta[0] if with_meta else None
if sample:
    k = next(k for k in sample.keys() if "GlobalId" in json.dumps(sample[k].to_dict() if hasattr(sample[k], "to_dict") else sample[k], default=str))
    info["sample"] = {"object": sample.name, "key": k, "value": json.dumps(sample[k].to_dict() if hasattr(sample[k], "to_dict") else sample[k], default=str)[:1500]}
r2 = bpy.ops.export_scene.x3d(filepath=out, x3d_version="X3D40", use_selection=False, use_hierarchy=True, use_animation=False)
info["export"] = list(r2)
json.dump(info, open(rep, "w"), indent=1)
print(json.dumps({k: v for k, v in info.items() if k != "sample"}, indent=1)); print(info.get("sample"))
