#!/usr/bin/env python3
"""x3d.mol cinematic stage: MolecularNodes in headless Blender draws the cartoon, Cycles lights it, x3d-blender-io writes X3D.

  python -I -W ignore blender/molcine.py --out cinema [--targets AF-P04637-F1,1aay] [--samples 96] [--width 1280] [--height 720] [--no-render]

Needs a Python 3.13 venv with   pip install bpy==5.3.0 molecularnodes==520.2.0 nodebpy==520.25.0
(molecularnodes 520.2.0 asks for a nodebpy whose builder has arrange_tree; 530.0.3, the newest, does not, and 520.25.0 does).
molecularnodes and Blender are GPL-3.0: they are used as tools here and no code of theirs is copied into this repository.

The stage writes, per target:  <id>-hero.png (Cycles CPU still), <id>.mn.x3d (the evaluated cartoon mesh with its colours, X3D 4.0)
and one cinema/receipt.json that names every version, every input hash, the render settings and every output hash.
The X3D is then gated by blender/gate_export.py (fork validator, plus a data-true check against the source file).
A pass names what it read; it is not a statement about taste. The owner's eye decides the look.
"""
import argparse, gzip, hashlib, importlib.util, json, math, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

import bpy
import mathutils
import molecularnodes as mn

ROOT = Path(__file__).resolve().parent.parent
BLENDER_IO = Path(os.environ.get("XMOL_BLENDER_IO", ROOT.parent.parent / "x3d-blender-io"))
TARGETS = {
    # id: (file under data/, colour scheme for add_style, note)
    "AF-P04637-F1": ("afdb/AF-P04637-F1-model_v6.cif", "plddt", "AlphaFold DB model, coloured by pLDDT (the B-factor column)"),
    "AF-P25490-F1": ("afdb/AF-P25490-F1-model_v6.cif", "plddt", "AlphaFold DB model, coloured by pLDDT"),
    "1aay": ("pdb/pdb1aay.ent.gz", "default", "Zif268 three fingers on DNA, element colours with per-chain carbons"),
    "1ubd": ("pdb/pdb1ubd.ent.gz", "default", "YY1 four fingers on DNA"),
}


def sha256(p: Path) -> str:
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def git(repo: Path, *a) -> str:
    r = subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True)
    return r.stdout.strip()


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mn.register()


def load_molecule(rel: str, scheme: str, tmp: Path):
    src = ROOT / "data" / rel
    path = src
    if src.suffix == ".gz":  # MDAnalysis reads plain PDB text more reliably than gzip here
        path = tmp / src.name[:-3].replace(".ent", ".pdb")
        path.write_bytes(gzip.decompress(src.read_bytes()))
    mol = mn.Molecule.load(path)
    notes = []
    mol.add_style("cartoon", color=scheme)
    try:  # zinc and other hetero atoms as small spheres, so the metal sites show in the render
        # "Mesh" realises icospheres; the default point cloud renders in Cycles but is dropped when the result becomes a mesh for X3D
        mol.add_style("spheres", selection="resname ZN", color=(1.0, 0.72, 0.18, 1.0), sphere="Mesh", quality=2, scale=0.8)
    except Exception as e:  # the style or selection phrase is not available: say so in the receipt
        notes.append("zinc spheres skipped: " + str(e)[:120])
    return mol, src, notes


def evaluated_points(obj):
    import numpy as np
    dg = bpy.context.evaluated_depsgraph_get()
    me = obj.evaluated_get(dg).to_mesh()
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    bf = None
    if "b_factor" in me.attributes:
        bf = np.empty(len(me.vertices), np.float32)
        me.attributes["b_factor"].data.foreach_get("value", bf)
    return co.reshape(-1, 3), len(me.polygons), bf


def look_setup(obj, width, height, samples, core_min=None, fit=1.0, az_deg=32.0, el_deg=18.0):
    import numpy as np
    sc = bpy.context.scene
    pts, nfaces, bf = evaluated_points(obj)
    frame = pts[bf >= core_min] if (core_min is not None and bf is not None and (bf >= core_min).sum() > 200) else pts  # AlphaFold models: frame the confident core, not the loose tails
    lo, hi = frame.min(0), frame.max(0)
    c = (lo + hi) / 2
    r = float(np.linalg.norm(frame - c, axis=1).max())
    sc.render.engine = "CYCLES"
    cy = sc.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.seed = 7
    cy.sample_clamp_indirect = 4.0
    try:
        cy.use_denoising = True
        cy.denoiser = "OPENIMAGEDENOISE"
        denoise = "OpenImageDenoise"
    except Exception:
        cy.use_denoising = False
        denoise = "off"
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = width, height, 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    view = "off"
    for name in ("Khronos PBR Neutral", "AgX", "Filmic", "Standard"):
        try:
            sc.view_settings.view_transform = name
            view = name
            break
        except Exception:
            continue
    try:
        sc.view_settings.look = "None"
    except Exception:
        pass
    # world: a navy gradient that matches the page, lit from above, so the background is part of the frame and gives soft fill
    w = bpy.data.worlds.new("x3d.mol studio")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = -0.35, 0.8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.0, (0.0015, 0.003, 0.009, 1)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, (0.012, 0.045, 0.12, 1)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    # lights: warm key, cool rim, in the structure's own scale
    def sun(name, az, el, color, strength, angle_deg):
        d = bpy.data.lights.new(name, "SUN")
        d.color, d.energy, d.angle = color, strength, math.radians(angle_deg)
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        direction = mathutils.Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)), -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
        o.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        return o
    sun("key", az_deg - 70, 42, (1.0, 0.88, 0.7), 6.0, 5)
    sun("rim", az_deg + 150, 20, (0.55, 0.72, 1.0), 4.0, 4)
    # camera
    cam = bpy.data.cameras.new("cam")
    cam.lens, cam.sensor_width = 85.0, 36.0
    vfov = 2 * math.atan((cam.sensor_width * height / width / 2) / cam.lens)
    dist = r / math.sin(vfov / 2) * fit
    cam.clip_start, cam.clip_end = dist * 0.05, dist * 4
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = 5.6
    target = bpy.data.objects.new("focus", None)
    target.location = mathutils.Vector(c.tolist())
    sc.collection.objects.link(target)
    cam.dof.focus_object = target
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    az, el = math.radians(az_deg), math.radians(el_deg)
    co.location = target.location + mathutils.Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el))) * dist
    con = co.constraints.new("TRACK_TO")
    con.target, con.track_axis, con.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"
    sc.camera = co
    return {"center": [round(float(x), 4) for x in c], "radius_bu": round(r, 4), "evaluated_vertices": int(len(pts)), "framed_on": "pLDDT >= %d residues" % core_min if frame is not pts else "all vertices", "evaluated_faces": int(nfaces),
            "camera": {"lens_mm": 85.0, "fstop": 5.6, "fit": fit, "distance_bu": round(dist, 3), "azimuth": az_deg, "elevation": el_deg}, "view_transform": view, "denoise": denoise}


def make_export_mesh(obj):
    """Realise the geometry-nodes result as a plain mesh with one colour attribute and one simple material."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    me = obj.data
    ca = me.color_attributes
    if "Color" in ca:
        ca.active_color = ca["Color"]
        ca.render_color_index = ca.find("Color")
        # the molecularnodes pLDDT palette has channels of 1.000169; the X3D 4.0 XSD refuses any colour above 1 and
        # x3d-blender-io (at the commit in the receipt) writes vertex colours unclamped, so clamp here and say so in the receipt
        import numpy as np
        attr = ca["Color"]
        buf = np.empty(len(attr.data) * 4, np.float32)
        attr.data.foreach_get("color", buf)
        clamped = int((buf > 1.0).sum() + (buf < 0.0).sum())
        attr.data.foreach_set("color", np.clip(buf, 0.0, 1.0))
        me["x3d_mol_clamped_channels"] = clamped
    mat = bpy.data.materials.new("x3d.mol cartoon")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.42
        bsdf.inputs["Metallic"].default_value = 0.0
    me.materials.clear()
    me.materials.append(mat)
    return me


def load_io_package():
    name = "io_scene_x3d"
    if name in sys.modules:
        return sys.modules[name]
    src = BLENDER_IO / "source"
    spec = importlib.util.spec_from_file_location(name, src / "__init__.py", submodule_search_locations=[str(src)])
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "cinema"))
    ap.add_argument("--targets", default="AF-P04637-F1,1aay")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    os.environ["BLENDER_X3D_EXPORT_TARGET"] = "MODERN_SCAFFOLD"
    load_io_package()
    from io_scene_x3d import export_x3d
    import importlib.metadata as md
    receipt = {"schema": "x3d.mol.cinema/1", "unsigned": True,
               "tools": {"blender": bpy.app.version_string, "bpy": md.version("bpy"), "molecularnodes": md.version("molecularnodes"), "nodebpy": md.version("nodebpy"),
                         "python": sys.version.split()[0], "x3d_blender_io": {"commit": git(BLENDER_IO, "rev-parse", "HEAD"),
                                                                              "dirty": bool(git(BLENDER_IO, "status", "--porcelain", "--untracked-files=no"))}},
               "script_sha256": sha256(Path(__file__)),
               "units": "1 Blender unit = 10 angstrom (molecularnodes writes source coordinates x 0.1, uncentred)",
               "render": {"engine": "Cycles", "device": "CPU", "samples": a.samples, "seed": 7, "size": [a.width, a.height]},
               "scenes": {}}
    tmp = Path(tempfile.mkdtemp())
    for tid in a.targets.split(","):
        rel, scheme, note = TARGETS[tid]
        t0 = time.time()
        clean_scene()
        mol, src, notes = load_molecule(rel, scheme, tmp)
        info = look_setup(mol.object, a.width, a.height, a.samples, core_min=70 if scheme == "plddt" else None, fit=1.1 if scheme == "plddt" else 0.9)
        entry = {"source": rel, "source_sha256": sha256(src), "note": note, "colour": scheme, "notes": notes, **info}
        if not a.no_render:
            png = out / f"{tid}-hero.png"
            bpy.context.scene.render.filepath = str(png)
            t1 = time.time()
            bpy.ops.render.render(write_still=True)
            render_s = round(time.time() - t1, 1)  # printed for the operator, not kept: this page claims no timing
            entry["png"] = {"file": png.name, "sha256": sha256(png), "bytes": png.stat().st_size}
        me = make_export_mesh(mol.object)
        entry["colour_channels_clamped_to_1"] = int(me.get("x3d_mol_clamped_channels", 0))
        x3d = out / f"{tid}.mn.x3d"
        bpy.ops.object.select_all(action="DESELECT")
        mol.object.select_set(True)
        export_x3d.save(bpy.context, filepath=str(x3d), use_selection=True, use_visible=False, use_mesh_modifiers=False, use_triangulate=False, use_normals=True, use_compress=False,
                        use_hierarchy=True, use_h3d=False, batch_mode="OFF", use_batch_own_dir=False, meta_creator="x3d.mol cinematic stage", meta_title=f"{tid} cartoon from MolecularNodes",
                        meta_description="MolecularNodes cartoon, evaluated to a mesh in Blender and written by x3d-blender-io", meta_reference="x3d.mol", meta_license="see NOTICE")
        entry["x3d"] = {"file": x3d.name, "sha256": sha256(x3d), "bytes": x3d.stat().st_size}
        gz = out / (x3d.name + ".gz")  # what the repository and the page carry; the sha256 above is of the uncompressed file
        gz.write_bytes(gzip.compress(x3d.read_bytes(), 9, mtime=0))
        entry["x3d"]["gz"] = {"file": gz.name, "bytes": gz.stat().st_size}
        if not a.no_render:
            from PIL import Image
            jpg = out / f"{tid}-hero.jpg"  # the page shows a JPEG; the PNG stays local
            Image.open(png).convert("RGB").save(jpg, quality=88, optimize=True, progressive=True)
            entry["jpg"] = {"file": jpg.name, "sha256": sha256(jpg), "bytes": jpg.stat().st_size}
        receipt["scenes"][tid] = entry
        print(tid, entry["evaluated_vertices"], "vertices", entry["evaluated_faces"], "faces", "render", locals().get("render_s"), "s, total", round(time.time() - t0, 1), "s", flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
    (out / "receipt.json").write_text(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
