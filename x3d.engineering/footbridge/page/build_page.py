#!/usr/bin/env python3
"""Assemble page/index.html from template.html, app.js, solver.js (verbatim), the trimmed X_ITE stylesheet and numbers
copied out of results/bank.json, results/verdict.json and results/page-solver.json.   python3 page/build_page.py
The page is written without <html>, <head> or <body> tags so that it can be published as a page body as it is."""
from __future__ import annotations
import base64, html as H, json, re
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent
B = json.loads((ROOT / "results" / "bank.json").read_text()); V = json.loads((ROOT / "results" / "verdict.json").read_text())
PG = json.loads((ROOT / "results" / "page-solver.json").read_text()); CARD = json.loads((ROOT / "card.json").read_text())
P = B["params"]; M = B["members"]; DT = V["detail"]


def sci(x):
    m, e = f"{x:.1e}".split("e"); return f"{m}e{int(e)}"


assert V["summary"]["gates_passed"] == V["summary"]["gates"] and V["summary"]["controls_caught"] == V["summary"]["controls"] and PG["pass"] and PG["control_caught"]
deck = [j for j in B["geometry"]["joints"] if j[0] == "B"]
data = {"params": {k: P[k] for k in ("E", "Fy", "density", "g", "connection_allowance", "gamma_dc_max", "gamma_dc_min", "gamma_pl", "phi_t", "phi_c", "deck_width", "frequency_min")},
        "geom": {"joints": B["geometry"]["joints"], "members": [{k: m[k] for k in ("id", "a", "b", "group")} for m in B["geometry"]["members"]],
                 "supports": [["B0", 0], ["B0", 1], [deck[-1], 1]], "deck": deck},
        "sections": {g: {k: s[k] for k in ("name", "b", "A", "r")} for g, s in B["sections"].items()}, "lines": B["line_loads"],
        "disp": B["influence"]["joint_displacement_per_N"],
        "freq": {k: B["frequency"][k] for k in ("crowd_fraction", "f1_vs_crowd", "mode1_shape")},
        "depth": [{k: d[k] for k in ("depth", "sections", "steel_kg", "deflection_pl", "span_over_deflection", "f1", "f1_crowded")} for d in B["probes"]["depth"]],
        "walk_band": [1.6, 2.4]}
pat = B["patterning"]["members"]["D5"]; g = B["governing"]; dp = B["probes"]["depth"]; v5 = B["probes"]["V5"]
thin = B["probes"]["thin_diagonal"]; cc = B["cross_checks"]; fq = B["frequency"]; ms = B["mass"]
crowd_t = ms["crowd_kg_per_m2"] * P["deck_width"] / 2 * B["geometry"]["span"] / 1000
rows = ""
for grp, lab in (("top", "Top chord"), ("bottom", "Bottom chord"), ("endpost", "End posts"), ("vertical", "Verticals"), ("diagonal", "Diagonals")):
    i, r = max(((i, r) for i, r in M.items() if r["group"] == grp), key=lambda kv: kv[1]["utilisation"])
    dem = r["N_min"] if r["governs"] == "compression" else r["N_max"]; cap = r["cap_c"] if r["governs"] == "compression" else r["cap_t"]
    rows += (f'<tr><td>{lab}</td><td class="mono">{r["section"].replace("SHS ", "").replace("x", " × ")}</td><td class="mono">{i}</td><td class="mono">{dem / 1e3:+,.0f} kN</td>'
             f'<td class="mono">{cap / 1e3:,.0f} kN in {r["governs"]}</td><td class="mono">{r["utilisation"]:.2f}</td><td class="mono">{r["slenderness"]:.0f} of {r["slender_limit"]:.0f}</td></tr>')
grade = lambda g: f'<span class="grade {"l" if g == "Likely" else "s"}">{H.escape(g)}</span>'
tokens = {
    "__N_REV__": str(len(B["patterning"]["reversing"])), "__D5_MAX__": f'{pat["N_max"] / 1e3:.1f}', "__D5_MIN__": f'{-pat["N_min"] / 1e3:.1f}', "__D5_MIN_ABS__": f'{thin["worst_diagonal_compression"] / 1e3:.1f}',
    "__D5_FULL__": f'{pat["N_max_full_only"] / 1e3:.1f}', "__D5_RATIO__": f'{pat["N_max"] / pat["N_max_full_only"]:.1f}',
    "__MB__": sci(max(B["influence"]["mueller_breslau_max_difference"], 1e-16)), "__GOV__": g["member"], "__GOV_U__": f'{g["utilisation"]:.3f}',
    "__RESERVE__": f'{(B["probes"]["first_failure_factor"] - 1) * 100:.1f}',
    "__DEFL_RATIO__": f'{B["deflection"]["span_over"]:.0f}', "__DEFL__": f'{B["deflection"]["pedestrian_full"] * 1e3:.1f}', "__DEFL_LIMIT__": f'{B["deflection"]["limit"] * 1e3:.1f}',
    "__CAMBER__": f'{B["deflection"]["dead_camber"] * 1e3:.1f}', "__F1__": f'{fq["empty"][0]["hz"]:.2f}', "__F1C__": f'{fq["crowded"][0]:.2f}',
    "__CROWD_KG__": f'{ms["crowd_kg_per_m2"]:.0f}', "__PEOPLE__": f'{ms["people_per_m2_at_80kg"]:.1f}', "__CROWD_T__": f"{crowd_t:.1f}", "__DEAD_T__": f'{ms["total_per_truss_kg"] / 1000:.1f}',
    "__V5_SL__": f'{v5["with_V5_slenderness"]:.0f}', "__V5_SL2__": f'{v5["without_V5_slenderness"]:.0f}', "__V5_CAP__": f'{v5["strength_with"] / 1e3:.0f}', "__V5_CAP2__": f'{v5["strength_without"] / 1e3:.0f}',
    "__TC_DEMAND__": f'{-M["TC5"]["N_min"] / 1e3:.0f}',
    "__DEPTH_KG_LO__": f'{min(d["steel_kg"] for d in dp):,.0f}', "__DEPTH_KG_HI__": f'{max(d["steel_kg"] for d in dp):,.0f}',
    "__DEPTH_D_LO__": f'{dp[0]["deflection_pl"] * 1e3:.0f}', "__DEPTH_D_HI__": f'{dp[-1]["deflection_pl"] * 1e3:.0f}', "__DEPTH_F_LO__": f'{dp[0]["f1"]:.2f}', "__DEPTH_F_HI__": f'{dp[-1]["f1"]:.2f}',
    "__THIN_CAP__": f'{thin["compression_strength"] / 1e3:.1f}', "__DESIGN_ROWS__": rows, "__STEEL__": f'{ms["steel_kg"]:,.0f}',
    "__GATES__": str(V["summary"]["gates"]), "__CONTROLS__": str(V["summary"]["controls"]), "__JS__": sci(cc["joints_vs_stiffness_N"]),
    "__OPS__": B["rig"]["openseespy"], "__OPS_F__": sci(DT["REF2"]["force_N"]), "__OPS_D__": sci(max(DT["REF2"]["deflection_m"], 1e-16)), "__OPS_HZ__": sci(max(DT["REF2"]["f1_hz"], 1e-16)),
    "__SCAN__": sci(DT["REF6"]["largest_difference_m"]), "__PAGE_CTL__": f'{PG["control_whole_panels_largest_miss_N"] / 1e3:.1f}',
    "__LIMITS__": "".join(f"<li>{H.escape(x[0].upper() + x[1:])}</li>" for x in CARD["limits"]),
    "__CODES__": "".join(f'<li>{H.escape(c["clause"])} {grade(c["grade"])}</li>' for c in CARD["codes"]),
    "__PY__": B["rig"]["python"], "__NP__": B["rig"]["numpy"], "__NODE__": PG["node"],
}
assert thin["slenderness"] > thin["limit"] and thin["compression_strength"] > thin["worst_diagonal_compression"], "the wrong-guess finding no longer holds"
assert B["patterning"]["reversing_full_only"] == [] and max(PG["largest_difference"][k] for k in ("N_dc", "N_max", "N_min", "walk")) < 1e-3
html = (HERE / "template.html").read_text()
html = html.replace("/*__XITE_CSS__*/", (HERE / "xite-16.5.1.css").read_text().strip())
html = html.replace("/*__SOLVER__*/", (HERE / "solver.js").read_text())
html = html.replace("/*__DATA__*/", json.dumps(data, separators=(",", ":")))
html = html.replace("/*__APP__*/", (HERE / "app.js").read_text())
html = html.replace("__POSTER__", "data:image/webp;base64," + base64.b64encode((HERE / "poster.webp").read_bytes()).decode())
for k, val in tokens.items():
    html = html.replace(k, val)
stray = sorted(set(re.findall(r"__[A-Z0-9_]+__", html)))
assert not stray, stray
(HERE / "index.html").write_text(html)
out = (HERE / "index.html").read_text()
assert (HERE / "solver.js").read_text() in out and (HERE / "app.js").read_text() in out, "the page must carry solver.js and app.js unchanged"
print("page written:", len(html), "bytes;", {k: v for k, v in tokens.items() if len(v) < 12})
