#!/usr/bin/env python3
"""The witness for the tensegrity study. Reads card.json (requirements, limits, controls), recomputes every gate from
the mathematics, joins the X3D scene back to the bank, and runs every control, which must FAIL the gate it names.

  python3 check.py            exit 0 only if every gate passes and every control is caught
Writes results/verdict.json and results/loss.json. Needs numpy; results/bank.json and results/page-solver.json must
be current (build.py, then node page_solver_check.js).
"""
from __future__ import annotations
import json, math, re, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import tensegrity as tg
import scenes as sc
import build as bd

CARD, LIM, P = tg.CARD, tg.CARD["limits"], tg.P
BANK = json.loads((HERE / "results" / "bank.json").read_text())
PAGE = json.loads((HERE / "results" / "page-solver.json").read_text())
SCENE = (HERE / "scenes" / "prism.x3d").read_text()


def model(o):
    X, M = tg.prism(P["n"], P["R"], P["H"], o.get("twist"))
    if o.get("cut"):
        M = [m for m in M if m["id"] != o["cut"]]
    if o.get("swap"):
        M = [dict(m, kind={"strut": "cable", "side": "strut"}.get(m["group"], m["kind"])) for m in M]
    return X, M


def g_R1(o):
    X, M = model(o); c = tg.census(X, M)
    uni = bool(c["s"] == 1 and tg.unilateral(M, c["stress"][:, 0]))
    return {"R1": {"value": {"self_stress_states": c["s"], "mechanisms": c["m_counted"], "cables_pull_struts_push": uni},
                   "limit": LIM["self_stress_states"]["equals"], "pass": bool(c["s"] == LIM["self_stress_states"]["equals"] and uni)}}


def g_R2(o):
    X, M = model({}); sec = tg.sections()
    soft, nxt = tg.soft_stiffness(X, M, sec, o.get("t0", P["t0_design"])); zero = tg.soft_stiffness(X, M, sec, 0.0)[0]
    return {"R2": {"value": {"softest_N_per_m": soft, "next_N_per_m": nxt, "softest_at_zero_prestress": zero}, "limit": LIM["soft_stiffness_N_per_m"]["min"],
                   "pass": bool(soft >= LIM["soft_stiffness_N_per_m"]["min"] and abs(zero) < 1e-6)}}


def g_design(o):
    """R3 to R6 at every claimed prestress: the gate carries the worst of them."""
    X, M = model({}); sec = tg.sections(o.get("wall"), o.get("cable")); out = {}
    for t0 in o.get("levels", CARD["envelope"]["claimed_prestress_N"]):
        res, aux = tg.analyse(X, M, sec, t0, scale=o.get("scale", 1.0))
        for k, g in tg.judge(X, M, sec, res, aux).items():
            g = dict(g, prestress_N=t0)
            if k not in out or (out[k]["pass"] and not g["pass"]) or (out[k]["pass"] == g["pass"] and margin(k, g) < margin(k, out[k])):
                out[k] = g
    return out


def margin(k, g):
    v = g["value"]
    if k == "R3": return v["least_fraction_of_prestress"] - g["limit"]
    if k == "R4": return 1 - v["buckling_utilisation"]
    if k == "R5": return 1 - v["utilisation"]
    return min(1 - v["press_drop_mm"] / g["limit"]["drop_mm"], 1 - v["press_turn_deg"] / g["limit"]["turn_deg"], 1 - v["push_move_mm"] / g["limit"]["push_mm"])


def mutate_scene(text, how):
    if how == "joint":
        m = re.search(r'<Transform DEF="J4" translation="([^"]+)"', text); x, y, z = (float(q) for q in m.group(1).split())
        return text.replace(m.group(0), f'<Transform DEF="J4" translation="{x + 0.02:.6f} {y:.6f} {z:.6f}"')
    if how == "force":
        i = text.index('<Transform DEF="V1"'); j = text.index("</MetadataSet>", i); blk = text[i:j]
        m = re.search(r'name="prestress_N" value="([^"]+)"', blk)
        return text[:i] + blk.replace(m.group(0), f'name="prestress_N" value="{float(m.group(1)) + 1:.3f}"') + text[j:]
    return text


def g_R7(o):
    joints, members = sc.read_scene(mutate_scene(SCENE, o.get("scene")))
    Xb = np.array(BANK["prism"]["joints"]); Mb = BANK["prism"]["members"]; W = BANK["design"]["members"]
    names = sorted(joints) == [f"J{i}" for i in range(len(Xb))] and sorted(members) == sorted(m["id"] for m in Mb)
    dj = de = df = float("inf"); ident = False
    if names:
        dj = max(float(np.abs(joints[f"J{i}"] - Xb[i]).max()) for i in range(len(Xb)))
        de = max(max(float(np.abs(members[m["id"]]["a"] - joints[f'J{m["i"]}']).max()), float(np.abs(members[m["id"]]["b"] - joints[f'J{m["j"]}']).max())) for m in Mb)
        df = max(abs(members[mid]["meta"][k] - w[k]) for mid, w in W.items() for k in ("prestress_N", "worst_N", "capacity_N"))
        ident = all(members[m["id"]]["meta"]["kind"] == m["kind"] and members[m["id"]]["meta"]["group"] == m["group"]
                    and members[m["id"]]["meta"]["from"] == f'J{m["i"]}' and members[m["id"]]["meta"]["to"] == f'J{m["j"]}' for m in Mb)
    ok = names and ident and dj <= LIM["scene_position_m"]["max"] and de <= LIM["scene_position_m"]["max"] and df <= LIM["scene_force_N"]["max"]
    return {"R7": {"value": {"joints_by_name": f"{len(joints)} of {len(Xb)}", "members_by_name": f"{len(members)} of {len(Mb)}", "identity_equal": bool(ident),
                             "joint_position_max_m": dj, "member_end_to_joint_max_m": de, "force_max_N": df},
                   "limit": {"position_m": LIM["scene_position_m"]["max"], "force_N": LIM["scene_force_N"]["max"]}, "pass": bool(ok)}}


def g_REF1(o):
    closed = o.get("closed", lambda n: math.pi / 2 + math.pi / n)
    worst = max(abs(bd.twist_root(n) - closed(n)) for n in (3, 4, 5, 6))
    other = max(abs(bd.twist_root(3, R, H, Rt) - closed(3)) for R, H, Rt in ((0.4, 0.3, 0.4), (0.4, 1.0, 0.2), (1.0, 2.0, 0.5)))
    lim = LIM["twist_root_vs_closed_rad"]["max"]
    return {"REF1": {"value": {"n_3_to_6_max_rad": worst, "other_proportions_max_rad": other}, "limit": lim, "pass": bool(worst <= lim and other <= lim)}}


def closed_q(M, n, wrong=False):
    poly = 1.0 if wrong else 1 / (2 * math.sin(math.pi / n))
    return np.array([{"strut": -1.0, "bottom": poly, "top": poly, "side": 1.0}[m["group"]] for m in M])


def g_REF23(o):
    worst2, null_ok, res3 = 0.0, True, 0.0; nullities = []
    for n in (3, 4, 5, 6):
        X, M = tg.prism(n); tu = tg.unit_stress(X, M); l = tg.lengths(X, M)
        q = closed_q(M, n, o.get("density_wrong", False))
        qn = (tu / l) / (tu / l)[3 * n]
        worst2 = max(worst2, float(np.abs(qn - q).max()))
        D = tg.force_density_matrix(M, q, len(X)); ev = np.linalg.eigvalsh(D)
        nul = int(np.sum(np.abs(ev) < 1e-9 * np.abs(ev).max())); nullities.append(nul)
        null_ok &= nul == LIM["fdm_nullity"]["equals"]
        res3 = max(res3, float(np.abs(D @ X).max()))
    return {"REF2": {"value": worst2, "limit": LIM["density_ratio_rel"]["max"], "pass": bool(worst2 <= LIM["density_ratio_rel"]["max"])},
            "REF3": {"value": {"nullity_n_3_to_6": nullities, "D_x_max": res3}, "limit": {"nullity": 4, "D_x": LIM["fdm_residual"]["max"]},
                     "pass": bool(null_ok and res3 <= LIM["fdm_residual"]["max"])}}


def g_REF4(o):
    rb = o.get("rigid", 6); rows = []; ok = True
    shapes = [(f"prism n={n}", tg.prism(n)) for n in (3, 4, 5, 6)] + [("six-strut", tg.six_strut(P["six_L"]))] + [("prism n=3, twist 140 deg", tg.prism(3, twist=math.radians(140)))]
    for name, (X, M) in shapes:
        c = tg.census(X, M); lhs = c["b"] - 3 * c["j"] + rb; rhs = c["s"] - c["m_counted"]
        rows.append({"shape": name, "b": c["b"], "j": c["j"], "s": c["s"], "m": c["m_counted"], "count": lhs, "s_minus_m": rhs}); ok &= lhs == rhs
    return {"REF4": {"value": rows, "limit": "b - 3j + 6 = s - m, with m counted from the null space after the rigid motions are removed", "pass": bool(ok)}}


def g_REF5(o):
    X, M = model({}); sec = tg.sections()
    EA = np.array([sec["EA_strut"] if m["kind"] == "strut" else sec["EA_cable"] for m in M])
    L0 = tg.rest_lengths(X, M, EA, P["t0_design"] * tg.unit_stress(X, M))
    Xd = X + 0.003 * np.sin(np.arange(X.size).reshape(X.shape) * 1.7)          # a generic nearby shape, so every term is exercised
    v = max(tg.stiffness_vs_difference(X, M, EA, L0, o.get("kg", 1.0)), tg.stiffness_vs_difference(Xd, M, EA, L0, o.get("kg", 1.0)))
    return {"REF5": {"value": v, "limit": LIM["stiffness_vs_difference_rel"]["max"], "pass": bool(v <= LIM["stiffness_vs_difference_rel"]["max"])}}


def g_REF6(o):
    X, M = model({}); sec = tg.sections(); t0 = P["t0_design"]
    a, _ = tg.analyse(X, M, sec, t0); b, _ = tg.analyse(X, M, sec, t0, solver="relax", relax_tol=o.get("relax_tol", 1e-7))
    worst = max((float(np.abs(a[c]["X"] - b[c]["X"]).max()), c) for c in a)
    return {"REF6": {"value": {"max_position_diff_m": worst[0], "case": worst[1], "cases": len(a)}, "limit": LIM["two_solvers_m"]["max"], "pass": bool(worst[0] <= LIM["two_solvers_m"]["max"])}}


def g_REF7(o):
    X, M = model({}); sec = tg.sections(); kg = o.get("kg", 1.0); L = LIM["prestress_doubling_ratio"]
    k = {t: tg.soft_stiffness(X, M, sec, t, kg)[0] for t in (300, 600, 1200)}
    r = [k[600] / k[300] if abs(k[300]) > 1e-9 else None, k[1200] / k[600] if abs(k[600]) > 1e-9 else None]
    return {"REF7": {"value": {"softest_N_per_m": {str(t): v for t, v in k.items()}, "ratios": r}, "limit": [L["min"], L["max"]],
                     "pass": bool(all(q is not None and L["min"] <= q <= L["max"] for q in r))}}


def g_REF8(o):
    L = P["six_L"]; gap = o.get("gap"); X, M = tg.six_strut(L, gap); c = tg.census(X, M); l = tg.lengths(X, M)
    root = bd.gap_root(L); val = {"gap_root_over_L": root / L, "self_stress_states": c["s"], "mechanisms": c["m_counted"]}
    ok = abs(root - L / 2) <= LIM["six_gap_root_vs_closed"]["max"] and c["s"] == 1 and c["m_counted"] == 1
    if c["s"] == 1:
        t = c["stress"][:, 0]; ratio = -t[0] / t[6]
        val.update({"cable_over_strut_length": float(l[6] / l[0]), "strut_over_cable_force": float(ratio), "cables_pull_struts_push": tg.unilateral(M, t)})
        ok = ok and tg.unilateral(M, t) and abs(l[6] / l[0] / (math.sqrt(6) / 4) - 1) <= LIM["six_ratio_rel"]["max"] and abs(ratio / math.sqrt(6) - 1) <= LIM["six_ratio_rel"]["max"]
    return {"REF8": {"value": val, "limit": {"gap": "L / 2", "length_ratio": "sqrt(6) / 4", "force_ratio": "sqrt(6)"}, "pass": bool(ok)}}


def g_REF9(o):
    lim = LIM["page_solver_vs_bank_m"]["max"]; cases = PAGE["cases"]
    worst = max(c["max_position_diff_m"] for c in cases.values())
    ok = all(c["found"] for c in cases.values()) and worst <= lim and PAGE["unit_stress_max_diff"] <= 1e-8 and PAGE["six"]["same_members"] and PAGE["six"]["unit_stress_max_diff"] <= 1e-8
    ctl = PAGE["control_wrong_density"]["max_position_diff_m"]
    return {"REF9": {"value": {"cases": len(cases), "max_position_diff_m": worst, "closed_form_stress_vs_null_vector": PAGE["unit_stress_max_diff"], "node": PAGE["node"],
                               "control_wrong_density_diff_m": ctl, "control_caught": bool(ctl > lim)}, "limit": lim, "pass": bool(ok and ctl > lim)}}


def g_bank(o):
    X, M = model({}); sec = tg.sections(); res, aux = tg.analyse(X, M, sec, P["t0_design"])
    d = max(float(np.abs(res[c]["X"] - np.array(BANK["design"]["cases"][c]["joints"])).max()) for c in res)
    return {"bank-is-current": {"value": d, "limit": 2e-9, "pass": bool(d <= 2e-9)}}


GATES = [g_R1, g_R2, g_design, g_R7, g_REF1, g_REF23, g_REF4, g_REF5, g_REF6, g_REF7, g_REF8, g_REF9, g_bank]
CONTROLS = {
    "twist-5deg-off": (g_R1, {"twist": math.radians(155)}), "one-cable-cut": (g_R1, {"cut": "V0"}), "kinds-swapped": (g_R1, {"swap": True}),
    "no-prestress": (g_R2, {"t0": 0.0}), "low-prestress": (g_design, {"levels": [150]}), "thin-strut": (g_design, {"levels": [600], "wall": 0.001}),
    "thin-cable": (g_design, {"levels": [600], "cable": (1.9e-6, 2200.0)}), "double-load": (g_design, {"levels": [600], "scale": 2.0}),
    "scene-joint-moved": (g_R7, {"scene": "joint"}), "scene-force-edited": (g_R7, {"scene": "force"}),
    "twist-closed-form-wrong": (g_REF1, {"closed": lambda n: math.pi / 2 - math.pi / n}), "density-ratio-wrong": (g_REF23, {"density_wrong": True}),
    "maxwell-miscount": (g_REF4, {"rigid": 3}), "prestress-term-sign": (g_REF5, {"kg": -1.0}), "relaxation-stopped-early": (g_REF6, {"relax_tol": 1.0}),
    "material-only-stiffness": (g_REF7, {"kg": 0.0}), "six-gap-0.45": (g_REF8, {"gap": 0.45 * P["six_L"]}),
}


def clean(x):
    return bd.rnd(x, 12)


def loss():
    n = lambda tag: len(re.findall(f"<{tag}[ >/]", SCENE))
    return {"schema": "loom.eng-loss/1", "from": "the study's model (joints, members, member law, supports, loads)", "to": "X3D 4.0 Immersive, scenes/prism.x3d",
            "carried": [{"what": "joints", "how": "Transform DEF J0 to J5", "measured": f'{n("Sphere")} of {len(BANK["prism"]["joints"])}'},
                        {"what": "members with identity, kind, group and end joints", "how": "Transform DEF + MetadataSet", "measured": f'{len(sc.read_scene(SCENE)[1])} of {len(BANK["prism"]["members"])}'},
                        {"what": "length, prestress, worst force, capacity, utilisation", "how": "MetadataDouble, 3 decimals", "measured": "see gate R7"},
                        {"what": "the loaded shapes", "how": "interpolator keys in scenes/prism-press.x3d, 17 load steps", "measured": "positions to 6 decimals"}],
            "lost": [{"what": "one-sidedness: a cable cannot push and a strut here is never pulled", "why": "X3D 4.0 has no node for it. RigidBodyPhysics offers BallJoint, SingleAxisHingeJoint, DoubleAxisHingeJoint, SliderJoint, UniversalJoint and MotorJoint (read from X3dUnifiedObjectModel-4.0.xml in x3d_mcp at ca0e75c): none is a spring, a rope or a distance limit. A SliderJoint with a one-sided stop between two BallJoints is the nearest construct and was not tried",
                      "consequence": "the scene shows a tensegrity and cannot behave as one in an X3D physics engine; kind survives only as a metadata string"},
                     {"what": "prestress as a state", "why": "rest lengths are not geometry; they survive only as the metadata number prestress_N", "consequence": "a reader that drops metadata has a shape with no reason to stand"},
                     {"what": "the member law (EA, engineering strain) and the supports", "why": "no X3D field", "consequence": "not in the scene at all; they are in card.json and results/bank.json"},
                     {"what": "the 14 load cases", "why": "no X3D field", "consequence": "only the worst force per member and its case name are carried"},
                     {"what": "true cable diameter", "why": "a 3 mm rope does not show at this scale, so cables are drawn at 6 mm", "consequence": "stated in the scene description; the true diameter is in card.json"}],
            "measured_in_scene": {"Transform": n("Transform"), "MetadataSet": n("MetadataSet"), "RigidBody": n("RigidBody"), "any_joint_node": len(re.findall(r"<[A-Za-z]*Joint[ >/]", SCENE))}}


def main():
    gates = {}
    for g in GATES:
        gates.update(g({}))
    controls = []
    for c in CARD["controls"]:
        fn, opt = CONTROLS[c["id"]]; got = fn(opt)
        failed = [k for k, v in got.items() if not v["pass"]]
        controls.append({"id": c["id"], "what": c["what"], "expect_fail": c["expect_fail"], "failed": failed, "caught": all(k in failed for k in c["expect_fail"]),
                         "evidence": {k: got[k]["value"] for k in c["expect_fail"] if k in got}})
    env = [{"prestress_N": e["prestress_N"], "claimed": e["claimed"], "pass": e["pass"], "failed": e["failed"]} for e in BANK["envelope"]]
    ok = all(v["pass"] for v in gates.values()) and all(c["caught"] for c in controls) and all(e["pass"] for e in env if e["claimed"])
    X, M = model({}); sec = tg.sections(); res, aux = tg.analyse(X, M, sec, P["t0_design"], ["press", "lift", "torque+", "torque-"])
    cab = np.array([m["kind"] == "cable" for m in M])
    tight = {c: bool(np.all(r["t"][cab] > aux["t_pre"][cab]) and np.all(r["t"][~cab] < aux["t_pre"][~cab])) for c, r in res.items()}
    findings = {"every_cable_tightens_and_every_strut_loads_up": {"cases": tight, "count": f"{sum(tight.values())} of {len(tight)}",
                                                                   "what": "at the design prestress, with the load on all three top joints"},
                "lift_strut_compression_N": {"at_rest": float(-aux["t_pre"][0]), "under_lift": float(-res["lift"]["t"][:3].min())}}
    verdict = {"schema": "loom.eng-verdict/1", "study": "tensegrity", "label": CARD["label"], "rig": {"python": sys.version.split()[0], "numpy": np.__version__, "node_for_REF9": PAGE["node"]},
               "pass": bool(ok), "gates_passed": f'{sum(v["pass"] for v in gates.values())} of {len(gates)}', "controls_caught": f'{sum(c["caught"] for c in controls)} of {len(controls)}',
               "gates": gates, "controls": controls, "findings": findings, "envelope": env, "window": BANK["window"],
               "not_run": ["second reader", "paired visual review", "strict host copy", "licensed engineer's review", "dynamics (no mass model, no natural frequency measured)",
                           "strut buckling as a member with end fittings, cable terminations, fatigue, creep and temperature"]}
    (HERE / "results" / "verdict.json").write_text(json.dumps(clean(verdict), indent=1) + "\n")
    (HERE / "results" / "loss.json").write_text(json.dumps(loss(), indent=1) + "\n")
    print(f'tensegrity: gates {verdict["gates_passed"]}, controls {verdict["controls_caught"]}, pass {ok}')
    for k, v in gates.items():
        if not v["pass"]: print("  GATE FAILED", k, json.dumps(clean(v["value"]))[:300])
    for c in controls:
        if not c["caught"]: print("  CONTROL SURVIVED", c["id"], c["failed"])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
