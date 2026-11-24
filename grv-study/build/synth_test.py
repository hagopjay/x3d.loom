"""synthetic self-test for score_arms: a splat from X3D truth (sent cams), noised, scaled 1.05, with planted defects"""
import sys, json
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "kit")); sys.path.insert(0, str(HERE / "build"))
import atlas2x3d as A, x3d2atlas as X, x3dcast, score_arms as SA
slug = sys.argv[1]; rng = np.random.default_rng(0)
w = HERE / "worlds" / f"{slug}.x3d"; prims, _ = x3dcast.load_x3d(w)
vps = [v for v in x3dcast.load_viewpoints(w) if v["DEF"].startswith("Cam")]
cache = HERE / "out" / slug / "score-cache"; cache.mkdir(parents=True, exist_ok=True)
P = SA.surface_samples(prims, vps, 6, cache, "cast"); P = P[rng.choice(len(P), 150000, replace=False)]
P = P + rng.normal(0, 0.02, P.shape)
traps = SA.TRAPS[slug]
for name, kind, boxes in traps:              # plant: fill every empty trap with junk, delete every surface trap
    if kind == "empty":
        for b in boxes:
            lo, hi = np.array(b[:3]), np.array(b[3:]); P = np.vstack([P, lo + rng.random((3000, 3)) * (hi - lo)])
    else:
        P = P[~SA.in_boxes(P, boxes)]
P = np.vstack([P, rng.uniform(P.min(0), P.max(0), (2000, 3))])       # floaters in the air
c = np.mean([A.parse_camera(X.viewpoint_to_camera(v)).position for v in vps], axis=0)
P = c + (P - c) * 1.05
n = len(P)
S = A.Splats(P, np.full((n, 3), 0.02), np.tile([0, 0, 0, 1.0], (n, 1)), np.full(n, 0.8), rng.random((n, 3)))
A.write_spz(HERE / "out" / slug / "synthetic.spz", S); print("wrote", n)
