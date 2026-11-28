#!/usr/bin/env python3
"""The witness for the four-bar study. Reads card.json (requirements, limits, controls), the bank and the engines'
trajectories; judges every requirement; runs every control and requires it to FAIL the check it names.

  python3 -I check.py            exit 0 only if every gate passes and every control is caught
Writes results/verdict.json and results/loss.json. Standard library only.
"""
from __future__ import annotations
import hashlib, json, math, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fourbar as fb
import measure as ms

CARD, LIM, P = fb.CARD, fb.CARD["limits"], fb.P


def analytic(links, t=None, flip_velocity=False, newton_c=None):
    """Every check that needs no engine. Returns {check: {value, limit, pass}}."""
    a, b, c, d = links
    t = P["coupler_t"] if t is None else t
    out, rows = {}, fb.kinematics_bank(a, b, c, d)
    g = fb.grashof(a, b, c, d)
    out["R1-analytic"] = {"value": g, "pass": bool(g["grashof"] and g["crank_is_shortest"] and all(r["assembles"] for r in rows))}
    ok = [r for r in rows if r["assembles"]]
    if not ok:
        return out
    mu = [math.degrees(r["mu"]) for r in ok]
    out["R3"] = {"value": {"min_deg": min(mu), "max_deg": max(mu), "at_min_crank_deg": ok[mu.index(min(mu))]["deg"]},
                 "limit": LIM["transmission_angle_deg"], "pass": min(mu) >= LIM["transmission_angle_deg"]["min"] and max(mu) <= LIM["transmission_angle_deg"]["max"]}
    # REF2 Newton against the closed form (optionally with a wrong rocker, the control)
    worst, guess = 0.0, None
    for r in ok:
        th2 = math.radians(r["deg"])
        if guess is None:
            guess = (r["th3"] + 0.05, r["th4"] - 0.05)
        guess = fb.newton_loop(th2, guess, a, b, newton_c if newton_c else c, d)
        worst = max(worst, abs(fb.wrap(guess[0] - r["th3"])), abs(fb.wrap(guess[1] - r["th4"])))
    out["REF2"] = {"value": worst, "limit": LIM["newton_vs_closed_rad"]["max"], "pass": worst <= LIM["newton_vs_closed_rad"]["max"]}
    fr = max(abs(r["freudenstein"]) for r in ok)
    out["REF3"] = {"value": fr, "limit": LIM["freudenstein_residual"]["max"], "pass": fr <= LIM["freudenstein_residual"]["max"]}
    # REF4 power balance: crank torque by statics (coupler force times its arm about A) against T_out * |w4 / w2|
    pb = 0.0
    for r in ok:
        th2 = math.radians(r["deg"])
        F = abs(fb.coupler_force(th2, P["T_out"], a, b, c, d))
        T_in = F * a * abs(math.sin(r["th3"] - th2))
        ref = P["T_out"] * abs(r["w4_over_w2"])
        pb = max(pb, abs(T_in - ref) / max(ref, 1.0))
    out["REF4"] = {"value": pb, "limit": LIM["power_balance_relative"]["max"], "pass": pb <= LIM["power_balance_relative"]["max"]}
    # REF5 velocity ratios against a central difference of the closed form
    h, vd = 1e-5, 0.0
    for r in ok:
        th2 = math.radians(r["deg"])
        kp, km = fb.closed_form(th2 + h, a, b, c, d), fb.closed_form(th2 - h, a, b, c, d)
        if kp is None or km is None:
            continue
        num3, num4 = fb.wrap(kp["th3"] - km["th3"]) / (2 * h), fb.wrap(kp["th4"] - km["th4"]) / (2 * h)
        r4 = -r["w4_over_w2"] if flip_velocity else r["w4_over_w2"]
        vd = max(vd, abs(num3 - r["w3_over_w2"]), abs(num4 - r4))
    out["REF5"] = {"value": vd, "limit": LIM["velocity_ratio_vs_difference"]["max"], "pass": vd <= LIM["velocity_ratio_vs_difference"]["max"]}
    # R4 margins: demand is the largest coupler force over the revolution, in tension and in compression (the torque reverses)
    forces = [abs(fb.coupler_force(math.radians(r["deg"]), P["T_out"], a, b, c, d)) for r in ok]
    demand, at = max(forces), ok[forces.index(max(forces))]["deg"]
    Fy, E, FS, w, dp = P["Fy"], P["E"], P["FS"], P["coupler_w"], P["pin_d"]
    A, I = w * t, w * t ** 3 / 12
    cap = {"coupler_yield": Fy * A / FS, "coupler_buckling": math.pi ** 2 * E * I / b ** 2 / FS,
           "pin_double_shear": 2 * (math.pi * dp ** 2 / 4) * (Fy / math.sqrt(3)) / FS}
    util = {k: demand / v for k, v in cap.items()}
    gov = max(util, key=util.get)
    out["R4"] = {"value": {"demand_N": demand, "at_crank_deg": at, "capacity_N": cap, "utilisation": util, "governing": gov,
                           "margin": 1 / util[gov] - 1}, "limit": LIM["utilisation"]["max"], "pass": util[gov] <= LIM["utilisation"]["max"]}
    return out


def qualify(m):
    """One engine at one speed against the functional limits."""
    checks = {"revolutions": (m["crank_revolutions"], ">=", LIM["crank_revolutions"]["min"]),
              "rocker_error_deg": (m["max_rocker_error_deg"], "<=", LIM["rocker_error_deg"]["max"]),
              "pin_gap_mm": (m["max_pin_gap_mm"], "<=", LIM["pin_gap_mm"]["max"]),
              "out_of_plane_mm": (m["max_out_of_plane_mm"], "<=", LIM["out_of_plane_mm"]["max"])}
    res = {k: {"value": v, "limit": lim, "pass": (v >= lim) if op == ">=" else (v <= lim),
               "margin": (v / lim - 1) if op == ">=" else (1 - v / lim)} for k, (v, op, lim) in checks.items()}
    return {"qualifies": all(r["pass"] for r in res.values()), "checks": res}


def main():
    card_links = [P[k] for k in "abcd"]
    traj = json.loads((HERE / ".work" / "trajectories.json").read_text())
    cases = {c["id"]: c for c in json.loads((HERE / "bank" / "cases.json").read_text())}
    verdict = {"schema": "loom.eng-verdict/1", "study": CARD["study"], "rig": traj["rig"], "label": CARD["label"], "gates": {}, "engines": {}, "controls": [], "probes": {}}
    fails = []
    # a hash of every recorded pose (not of wall times), so a re-run can be compared with this one
    verdict["poses_sha256"] = hashlib.sha256(json.dumps([[r["case"], r["engine"], r["tr"]] for r in traj["runs"]], separators=(",", ":")).encode()).hexdigest()

    # 1. the design, on paper
    an = analytic(card_links)
    verdict["analytic"] = an
    for k in ("R1-analytic", "R3", "R4", "REF2", "REF3", "REF4", "REF5"):
        verdict["gates"][k] = an[k]["pass"]

    # 2. the engines, case by case
    table = {}
    for r in traj["runs"]:
        c = cases[r["case"]]
        m = ms.measure_run(r, c["links"], card_links)
        table.setdefault(r["case"], {})[r["engine"]] = {"measure": m, **qualify(m), "notes": r["notes"]}
    verdict["engines"] = table
    for w in CARD["envelope"]["crank_speeds_rad_s"]:
        cid = f"fourbar-w{w:g}"
        q = [e for e, v in table[cid].items() if v["qualifies"]]
        row = {"qualifying_engines": q, "count": len(q)}
        if w in CARD["envelope"]["claimed_crank_speeds_rad_s"]:
            ok = len(q) >= LIM["min_engines"]["value"]
            verdict["gates"][f"R1-R2-R5-R6@{w:g}rad/s"] = ok
            row["gated"] = True
        else:
            row["gated"] = False
        verdict["probes"][f"{w:g}"] = row

    # 3. controls: each must FAIL the check it names
    def control(cid, what, expected, failed):
        caught = all(e in failed for e in expected)
        verdict["controls"].append({"id": cid, "what": what, "expected_to_fail": expected, "failed": sorted(failed), "caught": caught})
        if not caught:
            fails.append(f"SURVIVING_CONTROL {cid}")

    for m in CARD["controls"]["scene_mutants"]:
        c = cases[m["id"]]
        failed = set()
        a2 = analytic(c["links"])
        if not a2["R1-analytic"]["pass"]:
            failed.add("R1")
        if "R3" in a2 and not a2["R3"]["pass"]:
            failed.add("R3")
        engines = table[m["id"]]
        if sum(1 for v in engines.values() if v["checks"]["rocker_error_deg"]["pass"]) < LIM["min_engines"]["value"]:
            failed.add("R2")
        if m["id"] == "control-four-hinges":
            # an engine that follows clause 37.4.12 cannot carry a hinge past pi from its start
            travel = {}
            for r in traj["runs"]:
                if r["case"] == m["id"]:
                    travel[r["engine"]] = max_travel(r)
            obey = [e for e, t in travel.items() if t <= LIM["hinge_travel_rad"]["max"]]
            ignore = [e for e, t in travel.items() if t > LIM["hinge_travel_rad"]["max"]]
            verdict["hinge_stop"] = {"clause": "X3D 4.0 (ISO/IEC 19775-1) 37.4.12", "max_travel_rad": travel, "engines_that_stop": obey, "engines_that_ignore_the_stop": ignore}
            if obey and not all(engines[e]["checks"]["revolutions"]["pass"] for e in obey):
                failed.add("R1-on-a-standard-engine")
        control(m["id"], m["what"], m["expect_fail"], failed)

    for m in CARD["controls"]["analysis_mutants"]:
        failed = set()
        if m["id"] == "crossed-branch":
            runs = [r for r in traj["runs"] if r["case"] == "fourbar-w1"]
            good = sum(1 for r in runs if ms.measure_run(r, card_links, card_links, branch=-1)["max_rocker_error_deg"] <= LIM["rocker_error_deg"]["max"])
            if good < LIM["min_engines"]["value"]:
                failed.add("R2")
        elif m["id"] == "thin-coupler":
            if not analytic(card_links, t=0.005)["R4"]["pass"]:
                failed.add("R4")
        elif m["id"] == "velocity-sign":
            if not analytic(card_links, flip_velocity=True)["REF5"]["pass"]:
                failed.add("REF5")
        elif m["id"] == "newton-wrong-link":
            if not analytic(card_links, newton_c=card_links[2] + 0.001)["REF2"]["pass"]:
                failed.add("REF2")
        control(m["id"], m["what"], m["expect_fail"], failed)

    # 4. what the exchange dropped (law 40)
    hs = verdict.get("hinge_stop", {})
    loss = {"schema": "loom.eng-loss/1", "format": CARD["exchange"]["format"], "items": [
        {"field": "SingleAxisHingeJoint minAngle / maxAngle defaults (-pi, pi)", "lost_in": hs.get("engines_that_ignore_the_stop", []),
         "kept_in": hs.get("engines_that_stop", []), "evidence": hs.get("max_travel_rad"),
         "note": "The adapters read the default range as 'no stop' and write no note. Under clause 37.4.12 the stop is the standard's behaviour."},
        {"field": "RigidBody inertia", "lost_in": ["builtin", "rapier", "cannon"], "kept_in": [],
         "note": "Inertia is derived from the collision shapes in all three (LOOM-v1 failure mode 140). The kinematic checks here do not depend on it."},
        {"field": "pin clearance, friction, bar elasticity", "lost_in": ["the model"], "kept_in": [],
         "note": "Left out on purpose: rigid bars, ideal pins. The strength checks are separate hand formulas, not an engine result."}]}
    (HERE / "results" / "loss.json").write_text(json.dumps(loss, indent=1))

    for k, v in verdict["gates"].items():
        if not v:
            fails.append(f"GATE_FAIL {k}")
    verdict["summary"] = {"gates": len(verdict["gates"]), "gates_passed": sum(verdict["gates"].values()),
                          "controls": len(verdict["controls"]), "controls_caught": sum(c["caught"] for c in verdict["controls"]), "failures": fails,
                          "grade": "C measured here; Likely until a second reader recomputes (law 44)"}
    (HERE / "results" / "verdict.json").write_text(json.dumps(verdict, indent=1))
    s = verdict["summary"]
    print(f"gates {s['gates_passed']}/{s['gates']}  controls caught {s['controls_caught']}/{s['controls']}")
    for k, v in verdict["gates"].items():
        print(f"  {'PASS' if v else 'FAIL'}  {k}")
    for c in verdict["controls"]:
        print(f"  {'caught ' if c['caught'] else 'SURVIVED'}  {c['id']}: expected {c['expected_to_fail']}, failed {c['failed']}")
    for f in fails:
        print(" ", f)
    return 1 if fails else 0


def max_travel(run):
    last, acc, mx = None, 0.0, 0.0
    for q in run["tr"]["Crank"]["q"]:
        v = ms.rot(q, (1, 0, 0)); th = math.atan2(v[1], v[0])
        if last is not None:
            acc += fb.wrap(th - last)
        last = th; mx = max(mx, abs(acc))
    return mx


if __name__ == "__main__":
    sys.exit(main())
