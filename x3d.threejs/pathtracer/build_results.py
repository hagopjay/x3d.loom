#!/usr/bin/env python3
"""Turn a run into the committed result files.
usage: build_results.py PT6DIR PT1DIR CYCDIR OUTDIR [DEMODIR]
  PT6DIR  run-pt.js --bounces 6 --xite output   PT1DIR  run-pt.js --bounces 1 output   CYCDIR  x3d.lab blender_worker render output (NAME.cycles.png, RGBA)
  OUTDIR  gets results/results.json (the FLIP table + the pass test), results/strips/NAME.webp (X_ITE | Cycles | bridge raster | path tracer)
  DEMODIR (optional) gets img/NAME.webp and index.html built from index.tpl.html with the results inlined (x3d.demo docs/demos/three-pathtracer/v1)
Pass test, the Unreal lane's tier-1 bound (x3d.docs ch12 11): max(PT-X, PT-C) <= X-C + 0.05, X = X_ITE, C = Cycles, all object-pixel FLIP."""
import sys, os, json, shutil, subprocess
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here); from flip_score import score
PT6, PT1, CY, OUT = sys.argv[1:5]; DEMO = sys.argv[5] if len(sys.argv) > 5 else None
SCENES = {"e1-pbr-grid": (0.05, 0.05, 0.06), "e2-cornell-box": (0, 0, 0), "e3-light-ladder": (0.02, 0.02, 0.02)}
os.makedirs(f"{OUT}/results/strips", exist_ok=True); tmp = f"{OUT}/results/.comp"; os.makedirs(tmp, exist_ok=True); res = {}
for n, sky in SCENES.items():
    cy = Image.open(f"{CY}/{n}.cycles.png").convert("RGBA"); comp = f"{tmp}/{n}.cycles.rgb.png"
    Image.alpha_composite(Image.new("RGBA", cy.size, tuple(int(round(c * 255)) for c in sky) + (255,)), cy).convert("RGB").save(comp)
    X, P6, P1, R = f"{PT6}/{n}.xite.png", f"{PT6}/{n}.pt.png", f"{PT1}/{n}.pt.png", f"{PT6}/{n}.raster.png"; bg = list(sky)
    r = {"pt6_vs_xite": score(X, P6, bg)["object"], "pt6_vs_cycles": score(comp, P6, bg)["object"], "pt1_vs_xite": score(X, P1, bg)["object"], "pt1_vs_cycles": score(comp, P1, bg)["object"],
         "raster_vs_xite": score(X, R, bg)["object"], "raster_vs_cycles": score(comp, R, bg)["object"], "cycles_vs_xite": score(X, comp, bg)["object"], "object_share": score(X, P6, bg)["object_share"]}
    r["bound"] = round(r["cycles_vs_xite"] + 0.05, 4); r["within"] = max(r["pt6_vs_xite"], r["pt6_vs_cycles"]) <= r["bound"]; r["raster_within"] = max(r["raster_vs_xite"], r["raster_vs_cycles"]) <= r["bound"]
    res[n] = r
    sheet = Image.new("RGB", (1280, 240)); [sheet.paste(Image.open(f).convert("RGB"), (320 * i, 0)) for i, f in enumerate([X, comp, R, P6])]
    sheet.save(f"{OUT}/results/strips/{n}.webp", quality=88)
    if DEMO: os.makedirs(f"{DEMO}/img", exist_ok=True); shutil.copy(f"{OUT}/results/strips/{n}.webp", f"{DEMO}/img/{n}.webp")
out = {"scenes": res, "metric": "object-pixel FLIP (flip-evaluator 1.7, LDR), mean over pixels where X_ITE or the test picture differs from the sky colour; 320x240", "bound": "max(PT-X, PT-C) <= X-C + 0.05"}
out["note"] = ("Rig: Chromium 153.0.8010.12 on SwiftShader (software Vulkan, no real GPU), three r187, three-gpu-pathtracer 0.0.28, three-mesh-bvh 0.9.18, X_ITE 16.6.0; Cycles from bpy 5.3.0 on CPU through the x3d.lab Blender worker (256 spp, OpenImageDenoise, film transparent, composited on the sky colour). "
  "Path tracer 96 spp; two 96 spp runs of the Cornell box differ from each other by 0.055 (noise floor). Pass bound: max(PT-X, PT-C) <= X-C + 0.05, the Unreal lane's tier-1 bound. Cycles frames the first Viewpoint smaller than X_ITE does in these scenes, which inflates every number that involves it.")
out["limits"] = [
  "No real-GPU timing: every number here comes from software Vulkan (SwiftShader), about one sample per second at 320 x 240. The samples per second this page shows are your own device's.",
  "The path tracer is a reference for light transport, not for X3D semantics: it has no ambient term, ignores the X3D radius cut-off, and turns every emissive surface into a lamp. X_ITE does none of that, so the two are expected to disagree there.",
  "Classic Material (Phong) surfaces are converted to rough dielectrics with diffuse x pi so they land on rho x I under pbr lights; that is a fit, and the indirect light they return is exaggerated by the same factor.",
  "FLIP here is object-pixel LDR FLIP on 8-bit pictures with no tone mapping, the same recipe as the Unreal lane's cell 10c; it says how far two pictures are, not which is right.",
  "Cycles framing differs from X_ITE's, so the spread X-C is wider than the lighting alone would make it and the pass bound is looser than it looks. A Cycles run with an exact camera match is not done.",
  "One camera per scene, one run per cell except the noise-floor pair; no confidence intervals."]
json.dump(out, open(f"{OUT}/results/results.json", "w"), indent=1); shutil.rmtree(tmp); print(json.dumps(res, indent=1))

if DEMO:
    tpl = open(f"{DEMO}/index.tpl.html").read(); open(f"{DEMO}/index.html", "w").write(tpl.replace("/*RESULTS*/null", json.dumps(out)))
