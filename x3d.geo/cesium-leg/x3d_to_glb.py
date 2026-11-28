"""X3D -> glTF binary through x3d-blender-io and Blender's own glTF exporter (y up, the glTF convention).

  python x3d_to_glb.py --repo PATH/x3d-blender-io IN.x3d OUT.glb
Runs in the bpy wheel (5.3.0). Custom properties (the IFC Metadata the add-on keeps) go to glTF extras.
"""
import importlib, json, os, sys, tempfile
import bpy

args = sys.argv[sys.argv.index("--repo") + 1:]
repo, src, out = args[0], args[1], args[2]
tmp = tempfile.mkdtemp(prefix="x3d_repo_")
os.symlink(os.path.join(os.path.abspath(repo), "source"), os.path.join(tmp, "io_scene_x3d"))
sys.path.insert(0, tmp)
mod = importlib.import_module("io_scene_x3d")
bpy.ops.wm.read_factory_settings(use_empty=True)
mod.register()
bpy.ops.import_scene.x3d(filepath=src)
r = bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_extras=True, export_apply=True)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print(json.dumps({"blender": bpy.app.version_string, "export": list(r), "mesh_objects": len(meshes),
                  "triangles": sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)}))
