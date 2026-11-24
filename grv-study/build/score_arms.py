#!/usr/bin/env python3
"""score_arms: the four arms of the generate-refine-verify pilot on ONE generated world, scored against its X3D.

usage: score_arms.py <slug> <spz> [--out DIR]

Arms (all from the same Atlas draft splat, so every comparison is paired):
  G       the splat as Atlas returned it (after a similarity alignment fitted on SENT cameras only)
  G+R     blind refinement: the Athens hygiene pass (drop alpha < 0.03, drop sparse floaters, clamp scales > 0.5 m)
  G+V     the G world unchanged, plus the verify report (defects flagged from sent-camera geometry only)
  G+R+V   refinement passes chosen and gated by verify, using sent cameras only:
            P1 hygiene      kept only if it does not raise sent-camera air or hole counts
            P2 carve        remove visible splats in X3D open air (>= 0.15 m from any surface, not inside a solid)
            P3 fill         add flat splats on X3D surface seen by sent cameras where no splat lies within 50 mm
          each pass kept only if sent-camera geometric error, air share and hole share do not get worse.
Scoring uses only what the arms never saw: the 12 HELD-OUT cameras' X3D surface, and the hidden trap regions.
Geometry only (no colour judge): the render metrics come from render_splat.mjs separately.
"""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "kit"))
import atlas2x3d as A, x3d2atlas as X, x3dcast

VIS_ALPHA, NEAR, AIR_CLEAR = 0.3, 0.05, 0.15

# hidden trap regions (metres, X3D frame): kind "empty" = truth is open air there; "surface" = truth has surface there
TRAPS = {
    "grv-cross-hall": [
        ("T1 floor under the four arms", "surface", [(-2.5, -0.1, -9.0, 2.5, 0.1, -3.1), (-2.5, -0.1, 3.1, 2.5, 0.1, 9.0), (3.1, -0.1, -2.5, 9.0, 0.1, 2.5), (-9.0, -0.1, -2.5, -3.1, 0.1, 2.5)]),
        ("T2 niche backs 0.6 m deep", "surface", [(-0.8, 0.6, -10.1, 0.8, 4.2, -9.9), (-0.8, 0.6, 9.9, 0.8, 4.2, 10.1), (9.9, 0.6, -0.8, 10.1, 4.2, 0.8), (-10.1, 0.6, -0.8, -9.9, 4.2, 0.8)]),
        ("T3 crossing ceiling at 8 m", "surface", [(-2.5, 7.9, -2.5, 2.5, 8.1, 2.5)]),
        ("T3b open air of the crossing above the arm vaults", "empty", [(-2.0, 7.0, -2.0, 2.0, 7.8, 2.0)]),
    ],
    "grv-stairwell": [
        ("T1 stairwell opening is empty", "empty", [(-0.95, -2.45, -0.6, 2.15, -0.05, 0.35)]),
        ("T3 alcove behind the partition", "surface", [(2.85, -0.1, -4.0, 5.0, 3.8, 4.0)]),
        ("T4 stair treads descend", "surface", [(-1.0, -2.6, -1.6, 2.2, -0.2, -0.65)]),
        ("T2 railing (25 mm bars)", "surface", [(-1.0, 0.0, 0.42, 2.2, 1.02, 0.46), (2.22, 0.0, -1.6, 2.26, 1.02, 0.46)]),
    ],
    "grv-courtyard": [
        ("T1 open air under each arm", "empty", [(-1.3, 2.3, -0.3, -0.45, 3.1, 0.3), (0.45, 2.3, -0.3, 1.3, 3.1, 0.3)]),
        ("T3 arcade walkways are open", "empty", [(-6.5, 0.3, -9.2, 6.5, 3.2, -7.4), (-6.5, 0.3, 7.4, 6.5, 3.2, 9.2), (-9.2, 0.3, -6.5, -7.4, 3.2, 6.5), (7.4, 0.3, -6.5, 9.2, 3.2, 6.5)]),
        ("T4 open space under the benches", "empty", [(-0.65, 0.05, 2.98, 0.65, 0.38, 3.42), (-0.65, 0.05, -3.42, 0.65, 0.38, -2.98), (2.98, 0.05, -0.65, 3.42, 0.38, 0.65), (-3.42, 0.05, -0.65, -2.98, 0.38, 0.65)]),
        ("T2 plinth faces", "surface", [(-0.52, 0.1, -0.52, 0.52, 1.6, 0.52)]),
    ],
}


def in_boxes(P, boxes):
    m = np.zeros(len(P), bool)
    for b in boxes:
        lo, hi = np.array(b[:3]), np.array(b[3:])
        m |= ((P >= lo) & (P <= hi)).all(1)
    return m


def surface_samples(prims, vps, stride, cache_dir, tag):
    pts = []
    for vp in vps:
        cam = A.parse_camera(X.viewpoint_to_camera(vp, 1280, 720))
        f = cache_dir / f"{tag}-{vp['DEF']}.npz"
        if f.exists():
            z = np.load(f)["depth"].astype(np.float64)
        else:
            z, _, _ = x3dcast.cast(prims, cam)
            np.savez_compressed(f, depth=z.astype(np.float32))
        P = A.unproject(z, cam, stride=stride)
        P = P[0] if isinstance(P, tuple) else P
        P = P.reshape(-1, 3)
        pts.append(P[np.isfinite(P).all(1)])
    return np.vstack(pts)


def air_mask(prims, P, chunk=20000):
    d = np.empty(len(P))
    for i in range(0, len(P), chunk):
        d[i:i + chunk], _ = x3dcast.surface_distance(prims, P[i:i + chunk])
    far = d >= AIR_CLEAR
    inside = np.zeros(len(P), bool)
    idx = np.where(far)[0]
    for k in idx:                                         # inside-a-solid test only where it matters
        inside[k] = bool(x3dcast.inside_any(prims, P[k]))
    return far & ~inside, d


def measure(S, prims, held, sent, traps, rng):
    vis = S.alpha >= VIS_ALPHA
    P = S.positions[vis]
    sub = P if len(P) <= 60000 else P[rng.choice(len(P), 60000, replace=False)]
    air, dist = air_mask(prims, sub)
    tree = cKDTree(P)
    dh, _ = tree.query(held, k=1, distance_upper_bound=NEAR)
    ds, _ = tree.query(sent, k=1, distance_upper_bound=NEAR)
    r = {"splats": int(len(S.alpha)), "visible": int(vis.sum()),
         "geo_err_median_mm": float(1000 * np.median(dist)), "geo_err_p90_mm": float(1000 * np.percentile(dist, 90)),
         "within_50mm_pct": float(100 * (dist < NEAR).mean()), "air_pct": float(100 * air.mean()),
         "holes_held_pct": float(100 * np.isinf(dh).mean()), "holes_sent_pct": float(100 * np.isinf(ds).mean()), "traps": {}}
    for name, kind, boxes in traps:
        if kind == "empty":
            n = int(in_boxes(P, boxes).sum())
            vol = sum(np.prod(np.array(b[3:]) - np.array(b[:3])) for b in boxes)
            r["traps"][name] = {"kind": kind, "visible_splats_inside": n, "per_m3": float(n / vol), "defect": bool(n / vol > 50)}
        else:
            m = in_boxes(held, boxes)
            if m.sum() == 0:
                r["traps"][name] = {"kind": kind, "held_samples": 0, "note": "no held-out camera sees it"}
                continue
            cov = float(100 * (~np.isinf(dh[m])).mean())
            r["traps"][name] = {"kind": kind, "held_samples": int(m.sum()), "covered_pct": cov, "defect": bool(cov < 50)}
    return r


def subset(S, keep):
    return A.Splats(S.positions[keep], S.scales[keep], S.quats[keep], S.alpha[keep], S.rgb[keep])


def hygiene(S):
    keep = S.alpha >= 0.03
    tree = cKDTree(S.positions)
    nb = tree.query_ball_point(S.positions, r=0.25, return_length=True)
    keep &= nb > 3
    T = subset(S, keep)
    T.scales = np.minimum(T.scales, 0.5)
    return T, {"dropped": int((~keep).sum()), "clamped": int((S.scales[keep] > 0.5).any(1).sum())}


def carve(S, prims, rng):
    vis = np.where(S.alpha >= VIS_ALPHA)[0]
    air, _ = air_mask(prims, S.positions[vis])
    keep = np.ones(len(S.alpha), bool); keep[vis[air]] = False
    return subset(S, keep), {"removed": int((~keep).sum())}


def fill(S, sent):
    tree = cKDTree(S.positions[S.alpha >= VIS_ALPHA])
    d, _ = tree.query(sent, k=1, distance_upper_bound=NEAR)
    gaps = sent[np.isinf(d)]
    if len(gaps) == 0:
        return S, {"added": 0}
    gaps = np.unique(np.round(gaps / 0.04) * 0.04, axis=0)          # one splat per 4 cm cell
    t2 = cKDTree(S.positions); _, j = t2.query(gaps, k=1)
    n = len(gaps)
    T = A.Splats(np.vstack([S.positions, gaps]), np.vstack([S.scales, np.full((n, 3), 0.025)]),
                 np.vstack([S.quats, np.tile([0, 0, 0, 1.0], (n, 1))]), np.concatenate([S.alpha, np.full(n, 0.9)]),
                 np.vstack([S.rgb, S.rgb[j]]))
    return T, {"added": int(n)}


def align(S, sent_tree, centre):
    """One similarity: scale about the sent-camera centroid, fitted on SENT-camera surface only."""
    P = S.positions[S.alpha >= VIS_ALPHA]
    P = P[np.random.default_rng(1).choice(len(P), min(len(P), 40000), replace=False)]
    best = None
    for s in np.arange(0.85, 1.1501, 0.005):
        Q = centre + (P - centre) / s
        d, _ = sent_tree.query(Q, k=1)
        m = float(np.median(d))
        if best is None or m < best[1]:
            best = (float(s), m)
    s = best[0]
    T = A.Splats(centre + (S.positions - centre) / s, S.scales / s, S.quats, S.alpha, S.rgb)
    return T, {"scale_atlas_over_x3d": s, "sent_nn_median_mm": 1000 * best[1]}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("slug"); ap.add_argument("spz"); ap.add_argument("--out")
    a = ap.parse_args()
    t0 = time.time(); rng = np.random.default_rng(7)
    world = HERE / "worlds" / f"{a.slug}.x3d"
    prims, _ = x3dcast.load_x3d(world)
    vps = x3dcast.load_viewpoints(world)
    sent_vp = [v for v in vps if v["DEF"].startswith("Cam")]; held_vp = [v for v in vps if v["DEF"].startswith("Hold")]
    cache = HERE / "out" / a.slug / "score-cache"; cache.mkdir(parents=True, exist_ok=True)
    sent = surface_samples(prims, sent_vp, 6, cache, "cast"); held = surface_samples(prims, held_vp, 6, cache, "cast")
    sent = sent[rng.choice(len(sent), min(len(sent), 120000), replace=False)]
    held = held[rng.choice(len(held), min(len(held), 120000), replace=False)]
    centre = np.mean([v["position"] for v in sent_vp], axis=0) if "position" in sent_vp[0] else np.mean([A.parse_camera(X.viewpoint_to_camera(v)).position for v in sent_vp], axis=0)
    S0, hdr = A.read_spz_any(a.spz)
    G, al = align(S0, cKDTree(sent), centre)
    traps = TRAPS[a.slug]
    R = {"slug": a.slug, "spz": str(a.spz), "spz_sha256": A.sha256_file(a.spz), "header": hdr, "align": al,
         "rules": {"visible_alpha": VIS_ALPHA, "near_m": NEAR, "air_clearance_m": AIR_CLEAR, "held_samples": int(len(held)), "sent_samples": int(len(sent))}, "arms": {}}
    R["arms"]["G"] = measure(G, prims, held, sent, traps, rng)
    GR, h = hygiene(G); R["arms"]["G+R"] = measure(GR, prims, held, sent, traps, rng); R["arms"]["G+R"]["passes"] = {"P1 hygiene": h}
    # G+V: world unchanged; the verify report is what V can see on SENT cameras (no held-out data, no trap boxes)
    gv = dict(R["arms"]["G"]); gv["verify_report"] = {"air_pct_sent_side": R["arms"]["G"]["air_pct"], "holes_sent_pct": R["arms"]["G"]["holes_sent_pct"]}
    R["arms"]["G+V"] = gv
    # G+R+V: gated passes, gate reads sent-side numbers only
    cur, cur_m, log = G, R["arms"]["G"], []
    def sent_score(m): return (m["air_pct"], m["holes_sent_pct"], m["geo_err_median_mm"])
    for name, fn in (("P1 hygiene", lambda S: hygiene(S)), ("P2 carve", lambda S: carve(S, prims, rng)), ("P3 fill", lambda S: fill(S, sent))):
        cand, info = fn(cur)
        m = measure(cand, prims, held, sent, traps, rng)
        a0, h0, g0 = sent_score(cur_m); a1, h1, g1 = sent_score(m)
        ok = (a1 <= a0 + 0.1) and (h1 <= h0 + 0.1) and (g1 <= g0 * 1.02)
        log.append({"pass": name, **info, "kept": bool(ok), "sent_before": [a0, h0, g0], "sent_after": [a1, h1, g1]})
        if ok:
            cur, cur_m = cand, m
    R["arms"]["G+R+V"] = dict(cur_m); R["arms"]["G+R+V"]["passes"] = log
    outd = Path(a.out) if a.out else HERE / "out" / a.slug / "arms"; outd.mkdir(parents=True, exist_ok=True)
    for arm, S in (("G", G), ("G+R", GR), ("G+R+V", cur)):
        A.write_spz(outd / f"{a.slug}-{arm.replace('+', '')}.spz", S)
    R["seconds"] = round(time.time() - t0, 1)
    (outd / f"{a.slug}-arms.json").write_text(json.dumps(R, indent=1))
    for k, v in R["arms"].items():
        print(k, {x: (round(y, 2) if isinstance(y, float) else y) for x, y in v.items() if x not in ("traps", "passes", "verify_report")})
        for t, tv in v["traps"].items(): print("   ", t, tv)
    print(json.dumps(R["align"]), R["seconds"], "s")


if __name__ == "__main__":
    main()
