"""Perturbation probe: which Blender properties change the X3D 4.0 export when they change?
Usage: python perturb.py ADDON_SOURCE_DIR OUT.json
A property whose change leaves the file byte-identical (head meta removed) is 'inert': the exporter does not carry it."""
import json, os, re, sys, tempfile
from pathlib import Path

src, out = sys.argv[1:3]
tmp = tempfile.mkdtemp(prefix="perturb_")
(Path(tmp) / "io_scene_x3d").symlink_to(Path(src).resolve(), target_is_directory=True)
sys.path.insert(0, tmp)
import bpy, importlib

addon = importlib.import_module("io_scene_x3d")
addon.register()
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    addon.register()
except ValueError:
    pass


def build():
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
    cube = bpy.context.object
    cube.name = "Probe"
    mat = bpy.data.materials.new("ProbeMat")
    mat.use_nodes = True
    cube.data.materials.append(mat)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    lights = {}
    for i, kind in enumerate(("POINT", "SUN", "SPOT", "AREA")):
        d = bpy.data.lights.new(kind.title(), kind)
        o = bpy.data.objects.new(kind.title(), d)
        o.location = (3 + i, -3, 4)
        bpy.context.scene.collection.objects.link(o)
        lights[kind] = d
    cam_d = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_d)
    cam.location = (6, -6, 4)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    return cube, mat, bsdf, lights, cam_d, world


def export(path):
    r = bpy.ops.export_scene.x3d(filepath=path, x3d_version="X3D40")
    assert r == {"FINISHED"}, r
    text = Path(path).read_text()
    return re.sub(r"<meta [^>]*/>\s*", "", text)


def perturb_value(v, prop=None):
    if isinstance(v, bool):
        return not v
    if isinstance(v, int):
        return v + 1
    if isinstance(v, float):
        lo, hi = (prop.hard_min, prop.hard_max) if prop is not None and hasattr(prop, "hard_min") else (-1e30, 1e30)
        cand = v * 0.5 + 0.37
        if abs(cand - v) < 1e-6:
            cand = v + 0.21
        cand = max(lo, min(hi, cand))
        if abs(cand - v) < 1e-9:
            cand = max(lo, min(hi, v - 0.21))
        return cand
    return None


def rna_targets(owner, label):
    for prop in owner.bl_rna.properties:
        pid = prop.identifier
        if pid in ("rna_type", "name") or prop.is_readonly:
            continue
        if prop.type not in ("BOOLEAN", "INT", "FLOAT", "ENUM"):
            continue
        yield label, pid, prop


def try_rna(owner, pid, prop):
    old = getattr(owner, pid)
    if prop.type == "ENUM":
        if prop.is_enum_flag:
            return None
        ids = [e.identifier for e in prop.enum_items]
        if len(ids) < 2 or old not in ids:
            return None
        new = ids[(ids.index(old) + 1) % len(ids)]
        setattr(owner, pid, new)
        return lambda: setattr(owner, pid, old)
    if getattr(prop, "is_array", False) or getattr(prop, "array_length", 0):
        vals = list(old) if not hasattr(old[0], "__len__") else None
        if vals is None:
            return None
        new = list(vals)
        new[0] = perturb_value(vals[0], prop)
        if new[0] is None:
            return None
        setattr(owner, pid, new)
        return lambda: setattr(owner, pid, vals)
    new = perturb_value(old, prop)
    if new is None:
        return None
    setattr(owner, pid, new)
    return lambda: setattr(owner, pid, old)


cube, mat, bsdf, lights, cam_d, world = build()
work = tempfile.mkdtemp(prefix="perturb_out_")
base = export(os.path.join(work, "base.x3d"))
base2 = export(os.path.join(work, "base2.x3d"))
rows = []
state = {"base": base}


def run(group, name, apply):
    try:
        undo = apply()
    except Exception as exc:  # property refuses the write in this state
        rows.append(dict(group=group, prop=name, result="unsettable", why=str(exc)[:80]))
        return
    if undo is None:
        rows.append(dict(group=group, prop=name, result="skipped"))
        return
    try:
        text = export(os.path.join(work, "p.x3d"))
        rows.append(dict(group=group, prop=name, result="carried" if text != state["base"] else "inert"))
    except Exception as exc:
        rows.append(dict(group=group, prop=name, result="export_error", why=str(exc)[:120]))
    finally:
        try:
            undo()
        except Exception:
            pass
        after = export(os.path.join(work, "u.x3d"))
        if after != state["base"]:
            rows[-1]["undo_drift"] = True
            state["base"] = after


# 1. Principled BSDF inputs
for sock in bsdf.inputs:
    if not hasattr(sock, "default_value"):
        rows.append(dict(group="principled", prop=sock.name, result="skipped"))
        continue

    def apply(sock=sock):
        old = sock.default_value
        if isinstance(old, (bool, int, float)):
            new = perturb_value(old)
            if isinstance(old, float):
                new = min(1.0, max(0.0, new)) if sock.name not in ("IOR", "Emission Strength", "Thin Film Thickness", "Thin Film IOR", "Coat IOR", "Subsurface Scale") else old + 0.6
                if abs(new - old) < 1e-9:
                    new = 0.5 if old != 0.5 else 0.25
            sock.default_value = new
            return lambda: setattr(sock, "default_value", old)
        vals = list(old)
        new = list(vals)
        new[0] = 0.5 if abs(vals[0] - 0.5) > 1e-6 else 0.25
        sock.default_value = new
        return lambda: setattr(sock, "default_value", vals)

    run("principled", sock.name, apply)

# 2. RNA properties of the datablocks
owners = [("object", cube), ("mesh", cube.data), ("material", mat), ("camera", cam_d), ("world", world),
          ("light.point", lights["POINT"]), ("light.sun", lights["SUN"]), ("light.spot", lights["SPOT"]), ("light.area", lights["AREA"])]
for label, owner in owners:
    for group, pid, prop in rna_targets(owner, label):
        run(group, pid, lambda owner=owner, pid=pid, prop=prop: try_rna(owner, pid, prop))

summary = {}
for r in rows:
    summary.setdefault(r["group"], {}).setdefault(r["result"], 0)
    summary[r["group"]][r["result"]] += 1
json.dump(dict(blender=bpy.app.version_string, python=sys.version.split()[0], deterministic_baseline=(base == base2),
               baseline_bytes=len(base), summary=summary, rows=rows), open(out, "w"), indent=1)
print(json.dumps(summary, indent=1))
print("deterministic baseline:", base == base2)
