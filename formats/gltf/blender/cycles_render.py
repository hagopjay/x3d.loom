"""Blender Cycles render of a HARNESSED glb (camera 'loom-camera' + one KHR_lights_punctual key light inside the file).

    python -I blender/cycles_render.py IN.glb OUT.png OUT.json [--size 512] [--samples 64]

Runs on the `bpy` wheel (Blender as a Python module), CPU only. Settings mirror the Loom lighting contract:
  world black at strength 0 (no ambient), view transform Standard (piecewise sRGB, no Filmic/AgX), exposure 0, gamma 1,
  light import mode COMPAT (KHR intensity in lux -> sun strength in W/m^2 one to one; the importer default SPEC divides by 683),
  sun angle 0 (a punctual light), film transparent, then composited over #20242c in display space so the clear matches.
Cycles is a path tracer: it casts shadows and inter-reflections the raster engines do not. That is recorded, not hidden.
"""
import json
import sys
import time
import hashlib
import argparse

import bpy
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("glb"); ap.add_argument("png"); ap.add_argument("json")
ap.add_argument("--size", type=int, default=512); ap.add_argument("--samples", type=int, default=64)
a = ap.parse_args(sys.argv[1:])
BG = (32, 36, 44)
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb, export_import_convert_lighting_mode="COMPAT")
sc = bpy.context.scene
cams = [o for o in sc.objects if o.type == "CAMERA" and o.data.name.startswith("loom-camera")] or [o for o in sc.objects if o.type == "CAMERA"]
assert cams, "no camera in the harnessed glb"
sc.camera = cams[0]
cams[0].data.sensor_fit = "VERTICAL"
suns = [o for o in sc.objects if o.type == "LIGHT"]
for s in suns:
    if s.data.type == "SUN":
        s.data.angle = 0.0
world = bpy.data.worlds.new("loom-black")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
sc.world = world
r = sc.render
r.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.cycles.seed = 0
r.resolution_x = r.resolution_y = a.size
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.view_settings.exposure = 0.0
sc.view_settings.gamma = 1.0
sc.display_settings.display_device = "sRGB"
raw = a.png + ".rgba.png"
r.filepath = raw
t1 = time.time()
bpy.ops.render.render(write_still=True)
t2 = time.time()

img = bpy.data.images.load(raw)
px = np.array(img.pixels[:], dtype=np.float32).reshape(a.size, a.size, 4)[::-1]  # Blender pixels are bottom-up, linear float of the saved 8-bit file
# img.pixels of an 8-bit sRGB PNG come back as the stored values / 255 (no linearisation for byte images saved in display space)
rgb, al = px[..., :3], px[..., 3:4]
out = rgb * al + (np.array(BG, dtype=np.float32) / 255.0) * (1 - al)
out8 = np.clip(np.rint(out * 255), 0, 255).astype(np.uint8)
from PIL import Image  # noqa: E402  (PIL is bundled with nothing in bpy; install it next to bpy)
Image.fromarray(out8, "RGB").save(a.png)
receipt = {
    "engine": {"name": "Blender Cycles", "id": "cycles", "version": bpy.app.version_string, "build_hash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash)},
    "host": {"kind": "native", "name": "bpy wheel (Blender as a Python module)", "python": sys.version.split()[0]},
    "gpu": {"api": "none (Cycles CPU)", "adapter": "CPU", "backend": "Cycles CPU", "device_type": "Cpu", "driver": None, "driver_info": None},
    "settings": {"samples": a.samples, "denoise": "OpenImageDenoise", "seed": 0, "view_transform": "Standard", "light_import_mode": "COMPAT",
                 "sun_angle": 0.0, "world_strength": 0.0, "film_transparent": True, "composite": "straight alpha over #20242c in display space"},
    "lights": [{"name": s.name, "type": s.data.type, "energy": s.data.energy} for s in suns],
    "camera": {"name": cams[0].name, "angle_y": cams[0].data.angle_y},
    "timing": {"import_s": round(t1 - t0, 2), "render_s": round(t2 - t1, 2)},
    "png_sha256": hashlib.sha256(open(a.png, "rb").read()).hexdigest(),
    "notes": ["path tracer: shadows and inter-reflection are present; raster engines in this run draw no shadows"],
}
json.dump(receipt, open(a.json, "w"), indent=2)
print(json.dumps(receipt["timing"]), receipt["lights"])
