#!/usr/bin/env python3
"""Object-pixel FLIP, the Unreal lane's metric (x3d.lab notebooks/unreal/colab_g4/leg_e_cells.py, cell 10c): flip_evaluator LDR, mean over the pixels where
either picture differs from the background colour (the Unreal lane keys a magenta background; here the background is the scene's own, read from the top-left pixel of the X_ITE picture).
usage: flip_score.py REF.png TEST.png [--bg R,G,B]   -> one JSON line {frame, object, object_share}"""
import sys, json, numpy as np, flip_evaluator as flip
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB"), np.float32) / 255.0
def score(ref, test, bg=None, tol=6 / 255):
    A, B = load(ref), load(test)
    if A.shape != B.shape: B = np.asarray(Image.fromarray((B * 255).astype(np.uint8)).resize(A.shape[1::-1]), np.float32) / 255
    emap, mean, _ = flip.evaluate(A, B, "LDR", applyMagma=False); emap = np.squeeze(emap)
    bg = np.array(bg if bg is not None else A[0, 0], np.float32)
    m = ~((np.abs(A - bg) < tol).all(-1) & (np.abs(B - bg) < tol).all(-1))
    return {"frame": round(float(mean), 4), "object": round(float(emap[m].mean()) if m.any() else float("nan"), 4), "object_share": round(float(m.mean()), 3)}
if __name__ == "__main__":
    a = sys.argv[1:]; bg = None
    if "--bg" in a: i = a.index("--bg"); bg = [float(x) for x in a[i + 1].split(",")]; del a[i:i + 2]
    print(json.dumps(score(a[0], a[1], bg)))
