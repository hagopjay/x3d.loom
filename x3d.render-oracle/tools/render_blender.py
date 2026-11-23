#!/usr/bin/env python3
"""Render X3D files through the x3d-blender-io importer + Cycles to PNG. usage: render_blender.py ADDON_SRC OUTDIR SCENE.x3d...
Rig: 128x128, Cycles CPU 64 spp, no denoise, view transform Standard, default pixel filter. Nothing is added to the scene by this script
(no lights, no world) except the render settings and binding the first imported camera, so what Blender draws is what the importer built. Failures are written to OUTDIR/blender/failures.json."""
import sys, os, json, pathlib, importlib, importlib.util, warnings
warnings.simplefilter('ignore')
import bpy
src, out, *scenes = sys.argv[1:]
src = pathlib.Path(src).resolve(); out = pathlib.Path(out) / 'blender'; out.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('x3d_io_addon', src / '__init__.py', submodule_search_locations=[str(src)])
mod = importlib.util.module_from_spec(spec); sys.modules['x3d_io_addon'] = mod; spec.loader.exec_module(mod); mod.register()
fails = {}
for s in scenes:
    name = pathlib.Path(s).stem
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        r = bpy.ops.import_scene.x3d(filepath=s)
        sc = bpy.context.scene
        if not sc.camera:   # the importer builds the Viewpoint camera but leaves scene.camera unset: bind the first one (19775-1 23.4.1 binds the first Viewpoint at load)
            cams = [o for o in sc.objects if o.type == 'CAMERA']
            if cams: sc.camera = cams[0]
        import re
        m = re.search(r'<Viewpoint[^>]*fieldOfView="([^"]+)"', open(s).read())   # the importer's camera is 16:9 whatever the render shape (the Cycles camera trap, see x3d.loom LEARNINGS threejs-pathtracer): fit it to the vertical angle = X3D fieldOfView of the square rig
        if m and sc.camera: sc.camera.data.sensor_fit = 'VERTICAL'; sc.camera.data.angle = float(m.group(1).split()[0])
        info = dict(result=list(r), camera=bool(sc.camera), world=bool(sc.world), objects=[o.type for o in sc.objects])
        sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.device = 'CPU'; cy.samples = 64; cy.use_denoising = False; cy.seed = 0
        sc.render.resolution_x = sc.render.resolution_y = 128; sc.render.resolution_percentage = 100; 
        sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
        if not sc.camera: raise RuntimeError('importer made no camera: ' + json.dumps(info))
        sc.render.filepath = str(out / f'{name}.png'); bpy.ops.render.render(write_still=True)
        (out / f'{name}.info.json').write_text(json.dumps(info))
    except Exception as e:
        fails[name] = str(e)[:300]
(out / 'failures.json').write_text(json.dumps(fails, indent=1)); (out.parent / 'blender-version.txt').write_text('Blender ' + bpy.app.version_string + ' (bpy 5.3.0 wheel), Cycles CPU, add-on ' + str(src) + '\n')
print(json.dumps(dict(ok=len(scenes) - len(fails), failed=len(fails))))
