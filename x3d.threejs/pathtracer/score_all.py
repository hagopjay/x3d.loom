#!/usr/bin/env python3
"""FLIP table for the three-gpu-pathtracer leg. usage: score_all.py PTDIR CYCDIR OUT.json [PTDIR_BOUNCE1]
PTDIR holds NAME.pt.png / .raster.png / .xite.png (run-pt.js --xite); CYCDIR holds NAME.cycles.png (RGBA, film transparent, x3d.lab blender_worker render task), composited on the scene's sky colour."""
import sys, os, json, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from flip_score import score
PT, CY, OUT = sys.argv[1:4]; PT1 = sys.argv[4] if len(sys.argv) > 4 else None
SCENES = {"e1-pbr-grid": (0.05, 0.05, 0.06), "e2-cornell-box": (0, 0, 0), "e3-light-ladder": (0.02, 0.02, 0.02)}
tmp = "/tmp/w/_comp"; os.makedirs(tmp, exist_ok=True); res = {}
for n, sky in SCENES.items():
    bg = [c for c in sky]; cy = Image.open(f"{CY}/{n}.cycles.png").convert("RGBA"); base = Image.new("RGBA", cy.size, tuple(int(round(c * 255)) for c in sky) + (255,))
    comp = f"{tmp}/{n}.cycles.rgb.png"; Image.alpha_composite(base, cy).convert("RGB").save(comp)
    X, C, P, R = f"{PT}/{n}.xite.png", comp, f"{PT}/{n}.pt.png", f"{PT}/{n}.raster.png"
    r = {"pt6_vs_xite": score(X, P, bg), "pt6_vs_cycles": score(comp, P, bg), "raster_vs_xite": score(X, R, bg), "raster_vs_cycles": score(comp, R, bg), "cycles_vs_xite": score(X, comp, bg)}
    if PT1 and os.path.exists(f"{PT1}/{n}.pt.png"): r["pt1_vs_xite"] = score(X, f"{PT1}/{n}.pt.png", bg); r["pt1_vs_cycles"] = score(comp, f"{PT1}/{n}.pt.png", bg)
    res[n] = r; print(n, json.dumps(r))
json.dump(res, open(OUT, "w"), indent=1)
