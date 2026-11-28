#!/usr/bin/env python3
"""Every stated number of the footbridge study into results/bank.json, and the two scenes. About ten seconds."""
import json, math, platform, sys
from pathlib import Path
import numpy as np
import footbridge as fb, scenes as sc

HERE = Path(__file__).resolve().parent
P = fb.P


def rnd(x):
    if isinstance(x, dict): return {k: rnd(v) for k, v in x.items()}
    if isinstance(x, np.ndarray): return [rnd(v) for v in x.tolist()]
    if isinstance(x, (list, tuple)): return [rnd(v) for v in x]
    if isinstance(x, (bool, np.bool_)): return bool(x)
    if isinstance(x, (float, np.floating)): return float(f"{float(x):.9g}")
    if isinstance(x, (int, np.integer)): return int(x)
    return x


def sec_out(s):
    return {k: s[k] for k in ("name", "b", "t", "A", "I", "r", "wall")}


def first_failure(mdl, sections, eta):
    worst = lambda f: max(r["utilisation"] for r in fb.envelope(mdl, sections, crowd_factor=f, eta=eta).values())
    lo, hi = 0.5, 4.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if worst(mid) <= 1.0: lo = mid
        else: hi = mid
    rows = fb.envelope(mdl, sections, crowd_factor=hi, eta=eta)
    return lo, max(rows, key=lambda k: rows[k]["utilisation"])


def one_design(depth=None):
    mdl = fb.model(depth=depth)
    sections, history = fb.size(mdl)
    rows = fb.envelope(mdl, sections)
    ll = fb.line_loads()
    Fpl = fb.load_vector(mdl, fb.udl_on_deck(mdl, ll["crowd"]))
    Fdc = fb.load_vector(mdl, fb.udl_on_deck(mdl, ll["floor"]), fb.steel_weights(mdl, sections))
    d_pl, _ = fb.deflection_stiffness(mdl, sections, Fpl); d_dc, _ = fb.deflection_stiffness(mdl, sections, Fdc)
    masses = fb.nodal_masses(mdl, sections)
    fr = fb.frequencies(mdl, sections, masses)
    frc = fb.frequencies(mdl, sections, fb.nodal_masses(mdl, sections, crowd=1.0))
    steel = sum(P["density"] * sections[m["group"]]["A"] * m["L"] for m in mdl["members"])
    return {"mdl": mdl, "sections": sections, "history": history, "rows": rows, "Fpl": Fpl, "Fdc": Fdc, "d_pl": d_pl, "d_dc": d_dc,
            "masses": masses, "fr": fr, "frc": frc, "steel": steel}


def bank():
    D = one_design()
    mdl, sections, rows = D["mdl"], D["sections"], D["rows"]
    ids = [m["id"] for m in mdl["members"]]
    eta = fb.influence_lines(mdl); xs = np.array([mdl["joints"][j][0] for j in mdl["deck"]])
    ll = fb.line_loads(); w = ll["crowd"]
    mb = max(float(np.abs(fb.mueller_breslau(mdl, k) - eta[k]).max()) for k in range(len(ids)))
    # what patterning adds: factored demand with the crowd on the whole span only, against the patterned envelope
    full = fb.envelope(mdl, sections, patterned=False)
    pat = {}
    for i in ids:
        r, f = rows[i], full[i]
        pat[i] = {"N_max_full_only": f["N_max"], "N_min_full_only": f["N_min"], "N_max": r["N_max"], "N_min": r["N_min"],
                  "tension_missed_N": r["N_max"] - f["N_max"], "compression_missed_N": f["N_min"] - r["N_min"], "reverses": r["reverses"],
                  "reverses_full_only": f["N_max"] > 1e-6 and f["N_min"] < -1e-6}
    # the crowd walks on from the left
    fronts = [mdl["span"] * q / 20 for q in range(21)]
    walk_force = {i: [rows[i]["N_dc"] + w * fb.area_to_front(xs, eta[k], f) for f in fronts] for k, i in enumerate(ids)}
    nmid = fb.forces_by_joints(mdl, fb.load_vector(mdl, {fb.midspan_joint(mdl): 1.0}))
    areas = fb.areas_of(mdl, sections)
    eta_defl = np.array([sum(eta[k, q] * nmid[k] * m["L"] / (P["E"] * areas[m["id"]]) for k, m in enumerate(mdl["members"])) for q in range(len(xs))])
    walk_defl = [w * fb.area_to_front(xs, eta_defl, f) for f in fronts]
    # displacement of every joint for a unit downward load at each deck joint (for drawing the sag; scaled up when drawn)
    disp = {jn: {"x": [0.0] * len(xs), "y": [0.0] * len(xs)} for jn in mdl["names"]}
    for q, dj in enumerate(mdl["deck"]):
        if (dj, 1) in mdl["supports"]: continue
        _, u = fb.solve_stiffness(mdl, areas, fb.load_vector(mdl, {dj: 1.0}))
        for jn in mdl["names"]:
            disp[jn]["x"][q] = u[fb.dof(mdl, jn, 0)]; disp[jn]["y"][q] = u[fb.dof(mdl, jn, 1)]
    # mass and frequency
    total = sum(D["masses"].values()); per_m = total / mdl["span"]
    fbeam, Ieq = fb.beam_frequency(mdl, sections, per_m)
    crowd_kg_m2 = P["pedestrian"] / P["g"]
    crowd_fracs = [0, 0.1, 0.25, 0.5, 0.75, 1.0]
    f_vs_crowd = [fb.frequencies(mdl, sections, fb.nodal_masses(mdl, sections, crowd=c), 1)[0]["hz"] for c in crowd_fracs]
    # probes
    ff, ff_member = first_failure(mdl, sections, eta)
    probes = []
    for f in (1.0, 1.25, 1.5, 2.0):
        rr = fb.envelope(mdl, sections, crowd_factor=f, eta=eta)
        probes.append({"crowd_factor": f, "worst": max(r["utilisation"] for r in rr.values()), "over": sorted(k for k, r in rr.items() if r["utilisation"] > 1.0)})
    depths = []
    for h in (2.0, 2.5, 3.0, 3.5, 4.0):
        d = one_design(h); m2 = d["mdl"]
        ok = all(r["utilisation"] <= 1.0 and r["slenderness"] <= r["slender_limit"] for r in d["rows"].values())
        depths.append({"depth": h, "span_over_depth": mdl["span"] / h, "sections": {g: d["sections"][g]["name"] for g in fb.GROUPS}, "sized_ok": ok,
                       "steel_kg": d["steel"], "worst": max(r["utilisation"] for r in d["rows"].values()), "deflection_pl": d["d_pl"],
                       "span_over_deflection": mdl["span"] / d["d_pl"], "f1": d["fr"][0]["hz"], "f1_crowded": d["frc"][0]["hz"]})
    tc = sections["top"]; v5 = {"with_V5_length": mdl["a"], "with_V5_slenderness": mdl["a"] / tc["r"], "without_V5_length": 2 * mdl["a"],
                                "without_V5_slenderness": 2 * mdl["a"] / tc["r"], "limit": P["slender_compression"],
                                "strength_with": fb.capacities(tc, mdl["a"])["compression"], "strength_without": fb.capacities(tc, 2 * mdl["a"])["compression"],
                                "V5_dead_force": rows["V5"]["N_dc"], "V5_crowd_area": rows["V5"]["area_full"]}
    t60 = next(c for c in fb.CATALOGUE if c["name"] == "SHS 60x4"); ld = next(m["L"] for m in mdl["members"] if m["id"] == "D5")
    thin = {"section": t60["name"], "slenderness": ld / t60["r"], "limit": P["slender_compression"], "compression_strength": fb.capacities(t60, ld)["compression"],
            "worst_diagonal_compression": -min(rows[i]["N_min"] for i in ids if rows[i]["group"] == "diagonal")}
    # the independent code
    o = fb.opensees(mdl, sections, D["Fdc"], D["masses"]); o2 = fb.opensees(mdl, sections, D["Fpl"], D["masses"])
    Nj = fb.forces_by_joints(mdl, D["Fdc"]); Ns, _ = fb.solve_stiffness(mdl, areas, D["Fdc"])
    wt = 1000.0; Fu = fb.load_vector(mdl, fb.udl_on_deck(mdl, wt)); Nu = fb.forces_by_joints(mdl, Fu)
    M = lambda x: wt * x * (mdl["span"] - x) / 2
    j = fb.judge(mdl, sections, rows, D["d_pl"], D["fr"][0]["hz"])
    gov = max(rows, key=lambda k: rows[k]["utilisation"])
    return rnd({
        "schema": "loom.eng-bank/1", "study": "footbridge",
        "rig": {"python": platform.python_version(), "numpy": np.__version__, "openseespy": o["version"]},
        "params": P, "census": fb.census(mdl), "line_loads": ll,
        "geometry": {"span": mdl["span"], "panels": mdl["n"], "panel": mdl["a"], "depth": mdl["h"], "joints": mdl["joints"],
                     "members": [{"id": m["id"], "a": m["a"], "b": m["b"], "group": m["group"], "L": m["L"]} for m in mdl["members"]]},
        "sections": {g: sec_out(sections[g]) for g in fb.GROUPS}, "sizing_history": D["history"], "wall_limit": P["wall_limit_const"] * math.sqrt(P["E"] / P["Fy"]),
        "members": rows, "governing": {"member": gov, "utilisation": rows[gov]["utilisation"], "governs": rows[gov]["governs"]},
        "influence": {"x": xs, "eta": {i: eta[k] for k, i in enumerate(ids)}, "midspan_deflection_per_N": eta_defl, "joint_displacement_per_N": disp, "mueller_breslau_max_difference": mb},
        "patterning": {"members": pat, "reversing": sorted(i for i in ids if rows[i]["reverses"]), "reversing_full_only": sorted(i for i in ids if pat[i]["reverses_full_only"]),
                       "largest_tension_missed": max(pat.items(), key=lambda kv: kv[1]["tension_missed_N"])[0],
                       "largest_compression_missed": max(pat.items(), key=lambda kv: kv[1]["compression_missed_N"])[0]},
        "walk": {"fronts": fronts, "force": walk_force, "midspan_deflection": walk_defl},
        "deflection": {"pedestrian_full": D["d_pl"], "limit": mdl["span"] / P["deflection_ratio"], "span_over": mdl["span"] / D["d_pl"], "dead_camber": D["d_dc"],
                       "virtual_work": fb.deflection_virtual_work(mdl, sections, D["Fpl"])},
        "mass": {"total_per_truss_kg": total, "per_m": per_m, "steel_kg": D["steel"], "steel_with_allowance_kg": D["steel"] * P["connection_allowance"],
                 "crowd_kg_per_m2": crowd_kg_m2, "people_per_m2_at_80kg": crowd_kg_m2 / 80.0},
        "frequency": {"empty": [{"hz": f["hz"], "vertical_share": f["vertical_share"]} for f in D["fr"]], "crowded": [f["hz"] for f in D["frc"]],
                      "mode1_deck_shape": [D["fr"][0]["shape"][fb.dof(mdl, jn, 1)] for jn in mdl["deck"]],
                      "mode1_shape": {jn: [D["fr"][0]["shape"][fb.dof(mdl, jn, 0)], D["fr"][0]["shape"][fb.dof(mdl, jn, 1)]] for jn in mdl["names"]},
                      "beam_formula": fbeam, "I_chords": Ieq, "ratio_to_beam": D["fr"][0]["hz"] / fbeam, "limit": P["frequency_min"],
                      "crowd_fraction": crowd_fracs, "f1_vs_crowd": f_vs_crowd},
        "probes": {"crowd_factor": probes, "first_failure_factor": ff, "first_failure_member": ff_member, "depth": depths, "V5": v5, "thin_diagonal": thin},
        "cross_checks": {"joints_vs_stiffness_N": float(np.abs(Nj - Ns).max()), "opensees_force_N": float(np.abs(o["forces"] - Nj).max()),
                         "opensees_deflection_m": abs(o2["midspan"] - D["d_pl"]), "opensees_f1_hz": abs(o["hz"][0] - D["fr"][0]["hz"]), "opensees_hz": o["hz"],
                         "sections": {"line_load": wt, "BC5_statics": Nu[ids.index("BC5")], "BC5_hand": M(4 * mdl["a"]) / mdl["h"],
                                      "TC5_statics": Nu[ids.index("TC5")], "TC5_hand": -M(5 * mdl["a"]) / mdl["h"]},
                         "e3_continuity": fb.e3_continuity(P["Fy"], P["E"])},
        "judge": j})


def write_scenes(b):
    mdl = fb.model()
    (HERE / "scenes").mkdir(exist_ok=True)
    (HERE / "scenes" / "footbridge.x3d").write_text(sc.design_scene(mdl, b))
    (HERE / "scenes" / "footbridge-walk.x3d").write_text(sc.walk_scene(mdl, b))


if __name__ == "__main__":
    b = bank()
    (HERE / "results").mkdir(exist_ok=True)
    (HERE / "results" / "bank.json").write_text(json.dumps(b, indent=1))
    write_scenes(b)
    g = b["governing"]
    print(f"sections {[s['name'] for s in b['sections'].values()]}; governing {g['member']} {g['utilisation']:.3f}; deflection {b['deflection']['pedestrian_full']*1e3:.1f} mm; f1 {b['frequency']['empty'][0]['hz']:.2f} Hz")
