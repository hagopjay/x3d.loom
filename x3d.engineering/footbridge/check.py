#!/usr/bin/env python3
"""The witness. Every gate is recomputed here from footbridge.py and the scene, then every planted fault on the card is
run and must fail the gate it names. Exit 0 only when all gates pass and all controls are caught.
Writes results/verdict.json and results/loss.json."""
import json, math, sys
from pathlib import Path
import numpy as np
import footbridge as fb, scenes as sc

HERE = Path(__file__).resolve().parent
P, CARD = fb.P, fb.CARD
BANK = json.loads((HERE / "results" / "bank.json").read_text())
BY_NAME = {s["name"]: s for s in fb.CATALOGUE}
close = lambda a, b, rel=1e-7, ab=1e-6: abs(a - b) <= max(ab, rel * max(abs(a), abs(b)))


def evaluate(patterned=True, dead_relief=True, whole_panels=False, stiff_sign=1.0, sections_depth=None, mb_sign=1.0, force=None, tributary=None,
             coord_scale=1.0, weight_as_mass=False, drop=None, limit_const=4.71, scene_edit=None, ops_override=None):
    g, note = {}, {}
    mdl = fb.model(coord_scale=coord_scale, drop=drop)
    cen = fb.census(mdl)
    g["R6"] = bool(cen["count_ok"] and cen["full_rank"]); note["R6"] = cen
    if not g["R6"]:
        note["mechanism"] = "reported as a mechanism; nothing else was solved"
        return g, note
    sections = {grp: BY_NAME[BANK["sections"][grp]["name"]] for grp in fb.GROUPS}
    sections.update(force or {})
    eta = fb.influence_lines(mdl); xs = np.array([mdl["joints"][j][0] for j in mdl["deck"]]); ids = [m["id"] for m in mdl["members"]]
    rows = fb.envelope(mdl, sections, tributary=tributary, patterned=patterned, dead_relief=dead_relief, whole_panels=whole_panels, eta=eta)
    ll = fb.line_loads(tributary)
    Fpl = fb.load_vector(mdl, fb.udl_on_deck(mdl, ll["crowd"]))
    Fdc = fb.load_vector(mdl, fb.udl_on_deck(mdl, ll["floor"]), fb.steel_weights(mdl, sections))
    d_pl, _ = fb.deflection_stiffness(mdl, sections, Fpl)
    masses = fb.nodal_masses(mdl, sections, weight_as_mass=weight_as_mass, tributary=tributary)
    f1 = fb.frequencies(mdl, sections, masses, 1)[0]["hz"]
    j = fb.judge(mdl, sections, rows, d_pl, f1)
    for r in ("R1", "R2", "R3", "R4"):
        g[r] = j[r]["pass"]; note[r] = j[r]
    # R5: the envelope against one built here from brute-force areas, with patterning and dead-load relief
    Ndc = fb.forces_by_joints(mdl, Fdc); worst = 0.0; recorded = True
    for k, i in enumerate(ids):
        ap, am = fb.brute_areas(xs, eta[k]); nd = Ndc[k]
        nmax = (P["gamma_dc_max"] if nd > 0 else P["gamma_dc_min"]) * nd + P["gamma_pl"] * ll["crowd"] * ap
        nmin = (P["gamma_dc_max"] if nd < 0 else P["gamma_dc_min"]) * nd + P["gamma_pl"] * ll["crowd"] * am
        worst = max(worst, abs(rows[i]["N_max"] - nmax), abs(rows[i]["N_min"] - nmin))
        loaded = lambda segs: sum(b - a for a, b in segs)
        if ap > 1e-6 and not rows[i]["load_for_tension"]: recorded = False
        if am < -1e-6 and not rows[i]["load_for_compression"]: recorded = False
        if abs(ap) > 1e-6 and abs(am) > 1e-6 and not close(loaded(rows[i]["load_for_tension"]) + loaded(rows[i]["load_for_compression"]), mdl["span"], ab=1e-6): recorded = False
    g["R5"] = bool(len(rows) == 37 and worst < 5.0 and recorded); note["R5"] = {"members": len(rows), "largest_difference_N": worst, "arrangements_recorded": recorded}
    # R7: the scene against the bank and the model
    scene = sc.read_scene(HERE / "scenes" / "footbridge.x3d", scene_edit)
    names = {"LengthM": "L", "DeadN": "N_dc", "DemandMaxN": "N_max", "DemandMinN": "N_min", "TensionStrengthN": "cap_t", "CompressionStrengthN": "cap_c",
             "Slenderness": "slenderness", "Utilisation": "utilisation"}
    bad = []
    ref = fb.model()
    for m in ref["members"]:
        s = scene.get(m["id"])
        if s is None: bad.append((m["id"], "missing")); continue
        b = BANK["members"][m["id"]]
        for sn, bn in names.items():
            if not close(s["meta"][sn], b[bn], rel=1e-9, ab=1e-9): bad.append((m["id"], sn))
        if s["meta"]["Section"] != b["section"] or s["meta"]["Governs"] != b["governs"]: bad.append((m["id"], "text"))
        ends = sorted([tuple(np.round(s["a"], 5)), tuple(np.round(s["b"], 5))]); want = sorted([tuple(np.round(ref["joints"][m["a"]], 5)), tuple(np.round(ref["joints"][m["b"]], 5))])
        if ends != want or not close(s["width"], BANK["sections"][m["group"]]["b"], ab=1e-6): bad.append((m["id"], "geometry"))
    g["R7"] = bool(len(scene) == 37 and not bad); note["R7"] = {"members_read": len(scene), "mismatches": bad[:5]}
    # the ladder
    A = fb.areas_of(mdl, sections)
    Ns, _ = fb.solve_stiffness(mdl, A, Fdc, sign=stiff_sign)
    d1 = float(np.abs(Ns - Ndc).max()); g["REF1"] = d1 < 1e-5; note["REF1"] = {"largest_difference_N": d1}
    o = fb.opensees(mdl, sections, Fdc, masses, ops_override); o2 = fb.opensees(mdl, sections, Fpl, masses, ops_override)
    dz = {"force_N": float(np.abs(o["forces"] - Ndc).max()), "deflection_m": abs(o2["midspan"] - d_pl), "f1_hz": abs(o["hz"][0] - f1)}
    g["REF2"] = dz["force_N"] < 1e-5 and dz["deflection_m"] < 1e-9 and dz["f1_hz"] < 1e-6; note["REF2"] = dz
    wt = 1000.0; Nu = fb.forces_by_joints(mdl, fb.load_vector(mdl, fb.udl_on_deck(mdl, wt)))
    h = mdl["h"] if sections_depth is None else sections_depth; M = lambda x: wt * x * (mdl["span"] - x) / 2
    half = mdl["n"] // 2
    s3 = {"bottom": abs(Nu[ids.index(f"BC{half}")] - M((half - 1) * mdl["a"]) / h), "top": abs(Nu[ids.index(f"TC{half}")] + M(half * mdl["a"]) / h)}
    g["REF3"] = max(s3.values()) < 1e-6; note["REF3"] = s3
    d4 = max(float(np.abs(fb.mueller_breslau(mdl, k, mb_sign) - eta[k]).max()) for k in range(len(ids)))
    g["REF4"] = d4 < 1e-9; note["REF4"] = {"largest_difference": d4, "members": len(ids)}
    kt = ids.index(f"TC{half}"); peak = -(half * mdl["a"]) * (mdl["span"] - half * mdl["a"]) / (mdl["span"] * mdl["h"])
    zero_ok = True; zeros = {}
    for i in range(2, half + 1):
        row = eta[ids.index(f"D{i}")]; y0, y1 = row[i - 1], row[i]
        xz = xs[i - 1] + (xs[i] - xs[i - 1]) * y0 / (y0 - y1) if y0 * y1 < 0 else None
        want = mdl["a"] * (i - 1) * mdl["n"] / (mdl["n"] - 1)
        zeros[f"D{i}"] = xz; zero_ok &= xz is not None and close(xz, want, ab=1e-9)
    g["REF5"] = bool(close(eta[kt, half], peak, ab=1e-12) and close(eta[kt].min(), peak, ab=1e-12) and zero_ok); note["REF5"] = {"top_chord_peak": float(eta[kt, half]), "closed_form": peak, "diagonal_zeros_m": zeros}
    d6 = 0.0
    for k in range(len(ids)):
        ap, am, _, _ = fb.signed_areas(xs, eta[k], whole_panels); bp, bm = fb.brute_areas(xs, eta[k]); d6 = max(d6, abs(ap - bp), abs(am - bm))
    g["REF6"] = d6 < 1e-4; note["REF6"] = {"largest_difference_m": d6, "scan_points": 3000}
    dv = fb.deflection_virtual_work(mdl, sections, Fpl); g["REF7"] = close(dv, d_pl, rel=1e-9, ab=1e-12); note["REF7"] = {"virtual_work": dv, "stiffness": float(d_pl)}
    steel_line = sum(P["density"] * sections[m["group"]]["A"] * m["L"] for m in mdl["members"]) * P["connection_allowance"] / mdl["span"]
    per_m = steel_line + P["floor_dead"] * (P["deck_width"] / 2) / P["g"]          # kg/m from the card, not from nodal_masses
    fbm, _ = fb.beam_frequency(mdl, sections, per_m); ratio = f1 / fbm
    g["REF8"] = bool(0.75 <= ratio <= 1.0); note["REF8"] = {"f1": f1, "beam": fbm, "ratio": ratio}
    c9 = fb.e3_continuity(P["Fy"], P["E"], limit_const); g["REF9"] = c9 < 1e-3; note["REF9"] = {"jump_over_Fy": c9}
    return g, note


def bank_gate(g, note):
    """The bank is the build's output; here it must equal what this witness just recomputed."""
    b = BANK; ok = True
    ok &= close(b["judge"]["R1"]["worst"], note["R1"]["worst"], rel=1e-8) and close(b["deflection"]["pedestrian_full"], note["R3"]["deflection"], rel=1e-8)
    ok &= close(b["frequency"]["empty"][0]["hz"], note["R4"]["hz"], rel=1e-8) and close(b["frequency"]["ratio_to_beam"], note["REF8"]["ratio"], rel=1e-6)
    return bool(ok)


CONTROLS = {
    "full-span-only": dict(patterned=False), "whole-panels-only": dict(whole_panels=True), "no-dead-relief": dict(dead_relief=False),
    "stiffness-sign": dict(stiff_sign=-1.0), "sections-wrong-depth": dict(sections_depth=2.7), "mueller-breslau-sign": dict(mb_sign=-1.0),
    "thin-diagonals": dict(force={"diagonal": BY_NAME["SHS 60x4"]}), "both-trusses-load-on-one": dict(tributary=P["deck_width"]),
    "truss-in-millimetres": dict(coord_scale=1000.0), "mass-in-newtons": dict(weight_as_mass=True), "remove-a-diagonal": dict(drop="D3"),
    "transposed-471": dict(limit_const=4.17), "typed-utilisation": dict(scene_edit={("TC5", "Utilisation"): 0.5}),
    "opensees-wrong-area": dict(ops_override={f"BC{i}": BY_NAME[BANK["sections"]["top"]["name"]]["A"] for i in range(1, 11)}),
}


def main():
    gates, note = evaluate()
    gates["bank-reproduces"] = bank_gate(gates, note)
    controls = []
    for c in CARD["controls"]:
        gc, nc = evaluate(**CONTROLS[c["id"]])
        failed = sorted(k for k, ok in gc.items() if not ok)
        controls.append({"id": c["id"], "what": c["what"], "expected_to_fail": c["expect_fail"], "failed": failed,
                         "caught": bool(set(c["expect_fail"]) <= set(failed)), "note": nc.get("mechanism", "")})
    b = BANK
    findings = {
        "members_that_reverse": b["patterning"]["reversing"], "members_that_reverse_under_full_span_only": b["patterning"]["reversing_full_only"],
        "opensees_wrong_area_fails_only": next(c["failed"] for c in controls if c["id"] == "opensees-wrong-area"),
        "strength_or_stiffness_governs": "strength" if b["governing"]["utilisation"] > b["deflection"]["pedestrian_full"] / b["deflection"]["limit"] else "stiffness",
        "f1_empty_hz": b["frequency"]["empty"][0]["hz"], "f1_full_crowd_hz": b["frequency"]["crowded"][0]}
    summary = {"gates": len(gates), "gates_passed": sum(bool(v) for v in gates.values()), "controls": len(controls), "controls_caught": sum(c["caught"] for c in controls),
               "failures": [k for k, v in gates.items() if not v] + [c["id"] for c in controls if not c["caught"]],
               "grade": "C measured here; Likely until a second reader recomputes (law 44)"}
    out = {"schema": "loom.eng-verdict/1", "study": "footbridge", "rig": b["rig"], "gates": {k: bool(v) for k, v in gates.items()}, "detail": fb_json(note),
           "controls": controls, "findings": findings, "summary": summary}
    (HERE / "results" / "verdict.json").write_text(json.dumps(out, indent=1))
    loss = {"schema": "loom.eng-loss/1", "study": "footbridge",
            "carried_in_the_scene": ["member centre lines and section widths (read back and compared, R7)", "13 numbers and labels per member as metadata", "the crowd walk as colours keyed from 21 static solutions"],
            "not_in_the_scene": ["supports, loads and load factors", "the influence lines themselves", "wall thickness (a Box has no wall)", "deflection, mode shape and frequency", "which code clause each number answers to"],
            "note": "X3D 4.0 has no node for a load, a support or a section property. The numbers ride as metadata that a viewer may ignore."}
    (HERE / "results" / "loss.json").write_text(json.dumps(loss, indent=1))
    print(json.dumps(summary, indent=1))
    return 0 if not summary["failures"] else 1


def fb_json(x):
    if isinstance(x, dict): return {str(k): fb_json(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [fb_json(v) for v in x]
    if isinstance(x, (np.bool_, bool)): return bool(x)
    if isinstance(x, (np.floating, float)): return float(f"{float(x):.9g}")
    if isinstance(x, (np.integer,)): return int(x)
    return x


if __name__ == "__main__":
    sys.exit(main())
