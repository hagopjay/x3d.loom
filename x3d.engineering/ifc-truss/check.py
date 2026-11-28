#!/usr/bin/env python3
"""The witness for study B. Judges R1 to R7 and REF1 to REF6 against card.json, then runs the thirteen controls and
requires each to FAIL the check it names.

  python3 check.py [--demo /path/to/x3d.demo]      exit 0 only if every gate passes and every control is caught
Writes results/loss-receipt.json, results/truss-roundtrip.json and results/verdict.json. Needs ifcopenshell.
"""
from __future__ import annotations
import collections, copy, json, math, os, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import truss as tr
import loss_receipt as lr
import exchange as ex

CARD, LIM, P = tr.CARD, tr.CARD["limits"], tr.P


def judge_exchange(ifc, x3d, unit_trap_scale=1.0):
    """R1 and R2 for one IFC / X3D pair."""
    rows, by_class, extra = lr.compare(ifc, x3d, unit_trap_scale)
    with_geo = sum(e["has_geometry"] for e in ifc.values())
    matched = [r for r in rows if r["matched"]]
    r1 = {"ifc_with_geometry": with_geo, "matched_by_GlobalId": len(matched), "x3d_not_in_ifc": len(extra),
          "names_equal": sum(r["name_equal"] for r in matched), "classes_equal": sum(r["class_equal"] for r in matched)}
    r1["pass"] = len(matched) == with_geo and not extra and r1["names_equal"] == with_geo and r1["classes_equal"] == with_geo
    r2 = {"elements": len(matched), "worst_bbox_diff_mm": max((r["bbox_max_diff_mm"] for r in matched), default=math.inf),
          "worst_area_rel": max((r["area_rel"] for r in matched), default=math.inf), "worst_volume_rel": max((r["volume_rel"] for r in matched), default=math.inf)}
    r2["pass"] = (r2["worst_bbox_diff_mm"] <= LIM["bbox_diff_mm"]["max"] and r2["worst_area_rel"] <= LIM["area_rel"]["max"] and r2["worst_volume_rel"] <= LIM["volume_rel"]["max"])
    return r1, r2, rows, by_class


def keys_of(ifc, info):
    """Every kind of thing the IFC says: attribute names, property keys, classes with no body, relationship and body kinds."""
    k = set()
    for e in ifc.values():
        k.update(a for a in e["attrs"])
        k.update(f"{ps}.{key}" for ps, d in e["psets"].items() for key in d if key != "id")
        if not e["has_geometry"]:
            k.add(e["class"])
        k.update(e["rep_items"])
    k.update(info["relationships"])
    return k


# A key the IFC uses under one name and the card lists under another. Written into the verdict so a reader can audit it.
ALIASES = {"ObjectType": "Pset_LoomTruss.Role",          # exchange.py writes the member's role as ObjectType and as Role
           "Elevation": "IfcBuildingStorey",             # the storey's only extra attribute; it goes when the storey goes
           "IfcTriangulatedFaceSet": "geometry"}


def judge_loss(keys, carried, lost):
    """R3: every key the IFC uses is on the carried list or the lost list. A list entry covers a key when it is the key,
    or the key followed by a note in brackets."""
    covers = lambda lst, key: any(item == key or item.startswith(key + " ") for item in lst)
    un = [k for k in sorted(keys) if not (covers(carried, ALIASES.get(k, k)) or covers(lost, ALIASES.get(k, k)))]
    both = [k for k in sorted(keys) if covers(carried, ALIASES.get(k, k)) and covers(lost, ALIASES.get(k, k))]
    return {"keys": sorted(keys), "aliases": ALIASES, "unclassified": un, "on_both_lists": both, "pass": not un and not both}


def main(argv):
    demo = Path(argv[argv.index("--demo") + 1]) if "--demo" in argv else Path(os.environ.get("X3D_DEMO", HERE.parents[2] / "x3d.demo"))
    b_ifc_p, b_x3d_p = demo / lr.REL / "model.ifc", demo / lr.REL / "scene-0.x3d"
    t_ifc_p, t_x3d_p = HERE / "model" / "truss.ifc", HERE / "scenes" / "truss.x3d"
    V = {"schema": "loom.eng-verdict/1", "study": CARD["study"], "label": CARD["label"], "gates": {}, "controls": [], "values": {}}
    fails = []
    import ifcopenshell
    V["instruments"] = {"ifc_reader": f"IfcOpenShell {ifcopenshell.version}", "python": sys.version.split()[0]}

    # ---------- the building ----------
    b_ifc, b_info = lr.read_ifc(b_ifc_p)
    b_x3d, b_xinfo = lr.read_x3d(b_x3d_p)
    r1, r2, rows, by_class = judge_exchange(b_ifc, b_x3d)
    V["values"]["building"] = {"R1": r1, "R2": r2, "total_ifc_volume_m3": sum(r["ifc_volume_m3"] for r in rows if r["matched"]),
                               "ifc_source_hash_in_x3d_matches": b_xinfo["head_meta"].get("ifc:sourceSha256") == lr.sha256(b_ifc_p)}
    V["gates"]["R1-building"], V["gates"]["R2-building"] = r1["pass"], r2["pass"]
    frame_ok = lambda xi: xi["frame_rotation"].split()[:3] == ["1", "0", "0"] and abs(float(xi["frame_rotation"].split()[3]) + math.pi / 2) < 1e-12
    V["gates"]["frame-building"] = frame_ok(b_xinfo)
    # what crossed, measured: status and surface values, and the parametric bodies that became triangles
    carried_measured = {"Pset_Bridge.Status": sum(e["psets"]["Pset_Bridge"]["Status"] == b_x3d[g]["meta"].get("status") for g, e in b_ifc.items() if g in b_x3d),
                        "Pset_Bridge.Surface": sum("Appearance_" + e["psets"]["Pset_Bridge"]["Surface"] == b_x3d[g]["appearance"] for g, e in b_ifc.items() if g in b_x3d),
                        "Pset_Bridge.EditablePlacement": sum("EditablePlacement" in x["meta"] for x in b_x3d.values()),
                        "Pset_Bridge.Role": sum("Role" in x["meta"] or "role" in x["meta"] for x in b_x3d.values())}
    per_class = {}
    for cls, c in sorted(by_class.items()):
        rs = [r for r in rows if r["matched"] and r["class"] == cls]
        per_class[cls] = {"ifc": c["ifc"], "in_x3d_by_GlobalId": c["x3d"], "no_body_in_ifc": c["no_geometry_in_ifc"],
                          "parametric_bodies_meshed": sum(1 for g, e in b_ifc.items() if e["class"] == cls and "IfcExtrudedAreaSolid" in e["rep_items"]),
                          "worst_bbox_diff_mm": max((r["bbox_max_diff_mm"] for r in rs), default=None), "worst_volume_rel": max((r["volume_rel"] for r in rs), default=None),
                          "ifc_volume_m3": sum(r["ifc_volume_m3"] for r in rs), "properties_lost_per_element": ["Pset_Bridge.EditablePlacement", "Pset_Bridge.Role"] if rs else []}
    b_keys = keys_of(b_ifc, b_info)
    receipt = {"schema": "loom.eng-loss-receipt/1",
               "inputs": {"ifc": {"path": f"x3d.demo/{lr.REL}/model.ifc", "sha256": lr.sha256(b_ifc_p), "bytes": b_ifc_p.stat().st_size},
                          "x3d": {"path": f"x3d.demo/{lr.REL}/scene-0.x3d", "sha256": lr.sha256(b_x3d_p), "bytes": b_x3d_p.stat().st_size}},
               "instruments": V["instruments"], "ifc": b_info, "x3d_frame_rotation": b_xinfo["frame_rotation"],
               "identity": r1, "quantities": r2, "carried_values_out_of_111": carried_measured, "per_class": per_class,
               "lost": [k for k in CARD["exchange"]["lost"] if not k.startswith("IfcRectangleHollow")], "elements": rows}
    (HERE / "results" / "loss-receipt.json").write_text(json.dumps(receipt, indent=1))

    # ---------- the truss as files ----------
    t_ifc, t_info = lr.read_ifc(t_ifc_p)
    t_x3d, t_xinfo = lr.read_x3d(t_x3d_p)
    t1, t2, trows, _ = judge_exchange(t_ifc, t_x3d)
    V["gates"]["R1-truss"], V["gates"]["R2-truss"], V["gates"]["frame-truss"] = t1["pass"], t2["pass"], frame_ok(t_xinfo)
    keys = b_keys | keys_of(t_ifc, t_info)
    r3 = judge_loss(keys, CARD["exchange"]["carried"], CARD["exchange"]["lost"])
    # R3 is a claim about values, not only about lists: what the card calls carried arrived equal on every element,
    # and what it calls lost is absent on every element
    n = r1["ifc_with_geometry"]
    r3["carried_measured"] = carried_measured
    r3["carried_arrived_equal"] = carried_measured["Pset_Bridge.Status"] == n and carried_measured["Pset_Bridge.Surface"] == n
    r3["lost_is_absent"] = carried_measured["Pset_Bridge.EditablePlacement"] == 0 and carried_measured["Pset_Bridge.Role"] == 0
    V["gates"]["R3"] = r3["pass"]; V["gates"]["R3-carried-arrived-equal"] = r3["carried_arrived_equal"]; V["gates"]["R3-lost-is-absent"] = r3["lost_is_absent"]
    V["values"]["R3"] = r3

    # ---------- the truss as a structure ----------
    sp = ex.span_from_ifc(b_ifc_p)
    mdl = tr.model(sp["span_m"], sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"])
    d = tr.design(mdl)

    def structural_gates(d, mdl, span_used):
        g = {}
        worst = max(d["members"].values(), key=lambda m: m["utilisation"])
        g["R4"] = worst["utilisation"] <= LIM["utilisation"]["max"]
        g["R4-coverage"] = set(d["checks"]["cases_run"]) == {lc["id"] for lc in CARD["load_cases"]}
        sl = max((m["slenderness"] for m in d["members"].values() if m["sees_compression"]), default=0.0)
        g["R5"] = sl <= LIM["slenderness"]["max"]
        g["R6"] = d["checks"]["deflection_ratio"] is not None and d["checks"]["deflection_ratio"] >= LIM["deflection_ratio"]["min"]
        g["R7"] = abs(span_used - sp["span_m"]) * 1000 <= LIM["span_from_ifc_mm"]["max"]
        g["REF1"] = d["checks"]["solver_agreement_rel"] <= LIM["solver_agreement_rel"]["max"]
        g["REF2"] = d["checks"]["sections_rel"] <= LIM["solver_agreement_rel"]["max"]
        g["REF3"] = d["checks"]["equilibrium_rel"] <= LIM["equilibrium_rel"]["max"]
        g["REF4"] = d["checks"]["deflection_rel"] <= LIM["solver_agreement_rel"]["max"]
        return g, worst, sl

    sg, worst, sl = structural_gates(d, mdl, mdl["span"])
    cont = tr.e3_continuity(P["Fy"], P["E"])
    sg["REF5"] = cont <= LIM["e3_continuity_rel"]["max"]
    V["gates"].update(sg)
    # the numbers in the two files are the bank's numbers (never typed): IFC property set and X3D metadata against design
    num_ok = ifc_ok = 0
    by_name = {e["name"]: (g, e) for g, e in t_ifc.items() if e["class"] == "IfcMember"}
    for mid, m in d["members"].items():
        g, e = by_name[mid]
        ps, xm = e["psets"]["Pset_LoomTruss"], t_x3d[g]["meta"]
        rel = lambda a, b: abs(float(a) - float(b)) <= 1e-8 * max(abs(float(b)), 1.0)
        ifc_ok += rel(ps["DemandN"], m["demand_N"]) and rel(ps["CapacityN"], m["capacity_N"]) and rel(ps["Utilisation"], m["utilisation"]) and ps["GoverningCase"] == m["governing_case"] and ps["Role"] == m["role"] and ps["Section"] == m["section"]
        num_ok += rel(xm["DemandN"], m["demand_N"]) and rel(xm["CapacityN"], m["capacity_N"]) and rel(xm["Utilisation"], m["utilisation"]) and xm["GoverningCase"] == m["governing_case"] and xm["Role"] == m["role"] and xm["Section"] == m["section"]
    V["gates"]["numbers-in-IFC-equal-the-bank"] = ifc_ok == len(d["members"])
    V["gates"]["numbers-in-X3D-equal-the-bank"] = num_ok == len(d["members"])
    saved = json.loads((HERE / "results" / "design.json").read_text())
    V["gates"]["design.json-reproduces"] = all(abs(saved["members"][k]["utilisation"] - v["utilisation"]) < 1e-12 for k, v in d["members"].items())
    reversing = sorted(k for k, m in d["members"].items() if m["max_tension_N"] > 1.0 and m["max_compression_N"] > 1.0)
    V["values"]["truss"] = {"span_from_ifc": sp, "members": len(d["members"]), "R1": t1, "R2": t2, "checks": d["checks"], "e3_continuity_rel": cont,
                            "governing_member": {"id": next(k for k, m in d["members"].items() if m is worst), **worst}, "max_compression_slenderness": sl,
                            "members_that_reverse": reversing, "numbers_equal_bank": {"ifc": ifc_ok, "x3d": num_ok},
                            "cases": {k: {"total_load_N": c["total_load_N"], "midspan_deflection_mm": c["midspan_deflection_stiffness_m"] * 1000} for k, c in d["cases"].items()},
                            "by_role": {role: {"count": sum(1 for m in d["members"].values() if m["role"] == role),
                                               "max_utilisation": max(m["utilisation"] for m in d["members"].values() if m["role"] == role),
                                               "min_margin": min(m["margin"] for m in d["members"].values() if m["role"] == role and m["margin"] is not None)}
                                        for role in ("top chord", "bottom chord", "diagonal", "vertical")}}
    (HERE / "results" / "truss-roundtrip.json").write_text(json.dumps({"schema": "loom.eng-roundtrip/1", "ifc": {"path": "model/truss.ifc", "sha256": lr.sha256(t_ifc_p)},
                                                                         "x3d": {"path": "scenes/truss.x3d", "sha256": lr.sha256(t_x3d_p)}, "identity": t1, "quantities": t2, "elements": trows}, indent=1))

    # ---------- controls: each must fail the check it names ----------
    def control(cid, failed):
        c = next(c for c in CARD["controls"] if c["id"] == cid)
        caught = all(e in failed for e in c["expect_fail"])
        V["controls"].append({"id": cid, "what": c["what"], "expected_to_fail": c["expect_fail"], "failed": sorted(failed), "caught": caught})
        if not caught:
            fails.append(f"SURVIVING_CONTROL {cid}")

    def ex_fail(ifc, x3d, scale=1.0):
        a, b, _, _ = judge_exchange(ifc, x3d, scale)
        return ({"R1"} if not a["pass"] else set()) | ({"R2"} if not b["pass"] else set())

    gs = sorted(b_x3d)
    swapped = dict(b_x3d); i, j = gs[0], next(g for g in gs if b_x3d[g]["meta"]["class"] != b_x3d[gs[0]]["meta"]["class"])
    # two elements exchange GlobalIds (and the name and class that travel with the id): counts, names and classes still match
    swapped[i], swapped[j] = {**b_x3d[j], "meta": b_x3d[i]["meta"]}, {**b_x3d[i], "meta": b_x3d[j]["meta"]}
    control("swap-two-guids", ex_fail(b_ifc, swapped))
    control("drop-one-element", ex_fail(b_ifc, {g: v for g, v in b_x3d.items() if g != gs[5]}))
    control("millimetres-read-as-metres", ex_fail(b_ifc, b_x3d, scale=1000.0))
    control("skip-the-frame", ex_fail(b_ifc, lr.read_x3d(b_x3d_p, undo_frame=False)[0]))
    control("unlisted-key", set() if judge_loss(keys, CARD["exchange"]["carried"], [k for k in CARD["exchange"]["lost"] if k != "Pset_Bridge.Role"])["pass"] else {"R3"})
    try:
        tr.design(tr.model(sp["span_m"], sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"], drop="D3"))
        control("remove-a-diagonal", set())
    except tr.Mechanism as e:
        V["values"]["mechanism_message"] = str(e)
        control("remove-a-diagonal", {"REF1"})
    g2, _, _ = structural_gates(tr.design(mdl, stiffness_sign=-1.0), mdl, mdl["span"])
    control("stiffness-sign", {k for k, v in g2.items() if not v})
    g3, _, _ = structural_gates(tr.design(mdl, sections_depth=0.9), mdl, mdl["span"])
    control("sections-wrong-depth", {k for k, v in g3.items() if not v})
    thin = tr.model(sp["span_m"], sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"], web=tr.shs(0.025, 0.002))
    g4, w4, _ = structural_gates(tr.design(thin), thin, thin["span"])
    control("thin-web", {k for k, v in g4.items() if not v}); V["values"]["thin_web_worst_utilisation"] = w4["utilisation"]
    g5, _, _ = structural_gates(tr.design(mdl, cases=[lc for lc in CARD["load_cases"] if lc["id"] != "LC3"]), mdl, mdl["span"])
    control("drop-pattern-case", {k for k, v in g5.items() if not v})
    big = tr.model(sp["span_m"], sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"], coord_scale=1000.0); big["area_panel"] = sp["span_m"] / mdl["n"]
    d6 = tr.design(big); g6, w6, _ = structural_gates(d6, big, mdl["span"])
    V["values"]["millimetre_truss"] = {"worst_utilisation": w6["utilisation"], "deflection_ratio": d6["checks"]["deflection_ratio"],
                                       "note": "coordinates in millimetres read as metres: every length, weight and slenderness is 1000 times too large"}
    control("truss-in-millimetres", {k for k, v in g6.items() if not v})
    control("transposed-471", set() if tr.e3_continuity(P["Fy"], P["E"], limit_const=4.17) <= LIM["e3_continuity_rel"]["max"] else {"REF5"})
    typed = tr.model(8.4, sp["x0_m"], sp["bearing_z_m"], y=sp["line_y_m"])
    g7, _, _ = structural_gates(tr.design(typed), typed, typed["span"])
    control("typed-span", {k for k, v in g7.items() if not v})

    for k, v in V["gates"].items():
        if not v:
            fails.append(f"GATE_FAIL {k}")
    V["summary"] = {"gates": len(V["gates"]), "gates_passed": sum(bool(v) for v in V["gates"].values()), "controls": len(V["controls"]),
                    "controls_caught": sum(c["caught"] for c in V["controls"]), "failures": fails, "grade": "C measured here; Likely until a second reader recomputes (law 44)"}
    (HERE / "results" / "verdict.json").write_text(json.dumps(V, indent=1))
    s = V["summary"]
    print(f"gates {s['gates_passed']}/{s['gates']}  controls caught {s['controls_caught']}/{s['controls']}")
    for k, v in V["gates"].items():
        print(f"  {'PASS' if v else 'FAIL'}  {k}")
    for c in V["controls"]:
        print(f"  {'caught ' if c['caught'] else 'SURVIVED'}  {c['id']}: expected {c['expected_to_fail']}, failed {c['failed']}")
    for f in fails:
        print(" ", f)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
