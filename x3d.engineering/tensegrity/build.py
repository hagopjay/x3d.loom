#!/usr/bin/env python3
"""Build the bank (every number the study states) and the three scenes.   python3 build.py
Writes results/bank.json and scenes/*.x3d. Deterministic on one host: a second run rewrites the same bytes."""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import tensegrity as tg
import scenes as sc

P, CARD = tg.P, tg.CARD


def rnd(x, nd=9):
    if isinstance(x, dict): return {k: rnd(val, nd) for k, val in x.items()}
    if isinstance(x, (list, tuple)): return [rnd(val, nd) for val in x]
    if isinstance(x, np.ndarray): return rnd(x.tolist(), nd)
    if isinstance(x, (float, np.floating)):
        if not math.isfinite(x): return None
        r = round(float(x), nd); return 0.0 if r == 0 else r
    if isinstance(x, (np.integer,)): return int(x)
    if isinstance(x, (np.bool_,)): return bool(x)
    return x


def twist_root(n, R=0.4, H=1.0, Rt=None):
    f = lambda th: tg.census(*tg.prism(n, R, H, th, Rt))["sigma_min"]
    c = math.pi / 2 + math.pi / n
    return tg.golden(f, c - 0.3, c + 0.25)


def gap_root(L=1.0):
    return tg.golden(lambda g: tg.census(*tg.six_strut(L, g))["sigma_min"], 0.35 * L, 0.68 * L)


def passes(X, M, sec, t0):
    res, aux = tg.analyse(X, M, sec, t0)
    return all(g["pass"] for g in tg.judge(X, M, sec, res, aux).values())


def bisect(X, M, sec, lo, hi, tol=2.0):
    """lo and hi straddle a pass/fail change; returns the last passing and first failing prestress, tol apart."""
    plo = passes(X, M, sec, lo)
    while hi - lo > tol:
        mid = (lo + hi) / 2
        if passes(X, M, sec, mid) == plo: lo = mid
        else: hi = mid
    return (lo, hi) if plo else (hi, lo)


def bank():
    n = P["n"]; X, M = tg.prism(n, P["R"], P["H"]); sec = tg.sections(); cap = tg.capacities(X, M, sec)
    c = tg.census(X, M); tu = tg.unit_stress(X, M); l = tg.lengths(X, M); t0 = P["t0_design"]
    B = {"schema": "loom.eng-bank/1", "study": "tensegrity", "rig": {"python": sys.version.split()[0], "numpy": np.__version__},
         "prism": {"joints": X, "members": M, "lengths_m": l, "unit_stress": tu, "force_density_per_side": (tu / l) / (tu / l)[3 * n],
                   "census": {k: c[k] for k in ("b", "j", "rank", "s", "m", "maxwell", "sigma_min")},
                   "sigma_ratio_min_over_max": c["sigma_min"] / c["sigma_max"]},
         "sections": sec, "capacities": cap}
    # where the shape comes from
    B["twist"] = {"sweep_deg_sigma_min": [[d, tg.census(*tg.prism(n, P["R"], P["H"], math.radians(d)))["sigma_min"]] for d in range(90, 211)],
                  "roots": [{"n": k, "root_rad": twist_root(k), "closed_rad": math.pi / 2 + math.pi / k,
                             "census": {q: tg.census(*tg.prism(k))[q] for q in ("b", "j", "s", "m", "maxwell")}} for k in (3, 4, 5, 6)],
                  "root_other_proportions": [{"R": R, "H": H, "Rt": Rt, "root_rad": twist_root(3, R, H, Rt)} for R, H, Rt in ((0.4, 0.3, 0.4), (0.4, 1.0, 0.2), (1.0, 2.0, 0.5))]}
    # why prestress makes it stiff
    B["stiffness"] = {"by_prestress": [[t, *tg.soft_stiffness(X, M, sec, t)] for t in (0, 100, 200, 400, 600, 800, 1000, 1200, 1400)],
                      "columns": ["prestress N", "softest N/m", "next N/m"]}
    curve = {}
    for t in (200, 600, 1000):
        rows = []
        for Pl in range(0, 1601, 100):
            r = tg.analyse(X, M, sec, t, ["press"], scale=Pl / P["P_press"])[0]["press"]
            rows.append([Pl, r["drop"] * 1e3, abs(r["turn_deg"])])
        curve[str(t)] = rows
    B["press_curve"] = {"columns": ["load N", "drop mm", "turn deg"], "by_prestress": curve}
    # the envelope
    env = []
    for t in sorted(CARD["envelope"]["claimed_prestress_N"] + CARD["envelope"]["probe_prestress_N"]):
        res, aux = tg.analyse(X, M, sec, t); g = tg.judge(X, M, sec, res, aux)
        env.append({"prestress_N": t, "claimed": t in CARD["envelope"]["claimed_prestress_N"], "pass": all(q["pass"] for q in g.values()),
                    "failed": [k for k, q in g.items() if not q["pass"]], "gates": g})
    B["envelope"] = env
    lo = bisect(X, M, sec, 400, 600); hi = bisect(X, M, sec, 1000, 1200)
    B["window"] = {"floor_N": {"last_fail": lo[1], "first_pass": lo[0]}, "ceiling_N": {"last_pass": hi[0], "first_fail": hi[1]}, "resolution_N": 2.0}
    # the design point
    res, aux = tg.analyse(X, M, sec, t0)
    cases = {}
    for name, r in res.items():
        cases[name] = {"load": tg.load_case(X, name), "joints": r["X"], "forces_N": r["t"], "drop_mm": r["drop"] * 1e3, "turn_deg": r["turn_deg"], "move_mm": r["move"] * 1e3}
    worst = {}
    for k, m in enumerate(M):
        w = max(((abs(r["t"][k])), name) for name, r in res.items())
        capk = cap["buckling_N"] if m["kind"] == "strut" else cap["cable_allow_N"]
        worst[m["id"]] = {"length_m": l[k], "prestress_N": aux["t_pre"][k], "worst_N": float(res[w[1]]["t"][k]), "worst_case": w[1], "capacity_N": capk, "utilisation": w[0] / capk}
    B["design"] = {"prestress_N": t0, "rest_lengths_m": aux["L0"], "EA_N": aux["EA"], "cases": cases, "members": worst, "gates": tg.judge(X, M, sec, res, aux)}
    frames = []
    for k in range(17):
        r = tg.analyse(X, M, sec, t0, ["press"], scale=k / 16)[0]["press"]
        frames.append({"load_N": P["P_press"] * k / 16, "joints": r["X"], "forces_N": r["t"]})
    B["press_frames"] = frames
    # the six-strut classic
    L = P["six_L"]; X6, M6 = tg.six_strut(L); c6 = tg.census(X6, M6); t6 = tg.unit_stress(X6, M6); l6 = tg.lengths(X6, M6)
    B["six"] = {"joints": X6, "members": M6, "lengths_m": l6, "unit_stress": t6, "census": {k: c6[k] for k in ("b", "j", "rank", "s", "m", "maxwell", "sigma_min")},
                "gap_root": gap_root(L), "gap_closed": L / 2, "cable_over_strut_length": l6[6] / l6[0], "strut_over_cable_force": -t6[0] / t6[6],
                "gap_sweep_sigma_min": [[g / 200, tg.census(*tg.six_strut(L, g / 200 * L))["sigma_min"]] for g in range(60, 141)]}
    return B, (X, M, sec, cap, res, aux, X6, M6, t6, l6)


def write_scenes(B, ctx):
    X, M, sec, cap, res, aux, X6, M6, t6, l6 = ctx
    views = [("ThreeQuarter", "Three quarter", (1.75, 1.2, 1.95)), ("Top", "From above: the 150 degree twist", (0, 3.7, 0)), ("Side", "Side", (0, 0.5, 2.8))]
    forces = {mid: {"length_m": w["length_m"], "prestress_N": w["prestress_N"], "worst_N": w["worst_N"], "capacity_N": w["capacity_N"], "utilisation": w["utilisation"]}
              for mid, w in B["design"]["members"].items()}
    d1 = (f'Three-strut tensegrity prism, radius {P["R"]:g} m, height {P["H"]:g} m, top turned 150 degrees. Drawn at rest with {P["t0_design"]:g} N in each side cable. '
          'Struts red (compression), cables blue (tension), cables drawn at twice true diameter. Each member carries its length, prestress, worst force over 14 load cases, capacity and utilisation as metadata.')
    (HERE / "scenes" / "prism.x3d").write_text(sc.static_scene("tensegrity-prism", d1, X, M, forces, views, (0, 0.5, 0), 0.8))
    frames = [np.array(f["joints"]) for f in B["press_frames"]]
    util = [[(-f["forces_N"][k] / cap["buckling_N"]) if m["kind"] == "strut" else f["forces_N"][k] / cap["cable_allow_N"] for k, m in enumerate(M)] for f in B["press_frames"]]
    d2 = (f'The same prism pressed with 0 to {P["P_press"]:g} N and released, 8 s per cycle, true scale. Positions are static solutions at 17 load steps, played by interpolators; no physics engine runs. '
          'Colour is utilisation (blue low, amber, red at 1). The faint lines are the unloaded shape.')
    (HERE / "scenes" / "prism-press.x3d").write_text(sc.press_scene("tensegrity-prism-press", d2, X, M, frames, util, views, (0, 0.5, 0), 0.8, arrows=(3, 4, 5)))
    # six-strut, stood on one of its cable triangles
    nrm = np.array([1, 1, 1]) / math.sqrt(3); rot = sc.y_to(nrm)                      # rotation taking +y to the face normal
    Xs = np.array([sc.rotate((rot[0], rot[1], rot[2], -rot[3]), p) for p in X6])     # inverse: face normal to +y
    Xs = -Xs; Xs[:, 0] *= -1                                                          # put that face down, keep handedness
    Xs[:, 1] -= Xs[:, 1].min() - sc.R_JOINT
    f6 = {m["id"]: {"length_m": l6[k], "prestress_ratio": t6[k]} for k, m in enumerate(M6)}
    cy = float(Xs[:, 1].mean())
    v6 = [("ThreeQuarter", "Three quarter", (1.5, cy + 0.75, 1.75)), ("Top", "From above", (0, 3.4, 0)), ("Side", "Side", (0, cy, 2.6))]
    d3 = ('Six-strut tensegrity (expanded octahedron): 6 struts of 1 m in three parallel pairs half a strut apart, 24 cables of 0.612 m. No strut touches another. '
          'Metadata gives each member its length and its share of the one self-stress (cable 1, strut -2.449).')
    (HERE / "scenes" / "six-strut.x3d").write_text(sc.static_scene("tensegrity-six-strut", d3, Xs, M6, f6, v6, (0, cy, 0), 0.8))


if __name__ == "__main__":
    B, ctx = bank()
    (HERE / "results").mkdir(exist_ok=True); (HERE / "scenes").mkdir(exist_ok=True)
    (HERE / "results" / "bank.json").write_text(json.dumps(rnd(B), indent=1) + "\n")
    write_scenes(rnd(B), ctx)
    w = B["window"]; print("bank written: window", w["floor_N"], w["ceiling_N"], "| design gates", {k: g["pass"] for k, g in B["design"]["gates"].items()})
