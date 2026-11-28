#!/usr/bin/env python3
"""Assemble page/index.html from template.html, app.js, solver.js (verbatim), the trimmed X_ITE stylesheet and numbers
copied out of results/bank.json, results/verdict.json and results/page-solver.json.   python3 page/build_page.py
The page is written without <html>, <head> or <body> tags so that it can be published as a page body as it is;
a browser opens it directly all the same."""
from __future__ import annotations
import base64, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent
B = json.loads((ROOT / "results" / "bank.json").read_text()); V = json.loads((ROOT / "results" / "verdict.json").read_text())
PG = json.loads((ROOT / "results" / "page-solver.json").read_text()); CARD = json.loads((ROOT / "card.json").read_text())
P = {k: v["value"] for k, v in CARD["params"].items()}; L = CARD["limits"]; G = V["gates"]


def sci(x):
    m, e = f"{x:.1e}".split("e"); return f"{m}e{int(e)}"


stiff = {r[0]: r for r in B["stiffness"]["by_prestress"]}
press = B["design"]["cases"]["press"]; lift = B["design"]["cases"]["lift"]
data = {"params": {k: P[k] for k in ("n", "R", "H", "six_L")}, "EA_strut": B["sections"]["EA_strut"], "EA_cable": B["sections"]["EA_cable"],
        "cap": {"buckling_N": B["capacities"]["buckling_N"], "cable_allow_N": B["capacities"]["cable_allow_N"]},
        "lim": {"floor": L["cable_floor_fraction"]["min"], "drop_mm": L["press_drop_m"]["max"] * 1e3, "turn_deg": L["press_turn_deg"]["max"], "push_mm": L["push_move_m"]["max"] * 1e3},
        "window": {"floor": B["window"]["floor_N"]["first_pass"], "ceil": B["window"]["ceiling_N"]["last_pass"]},
        "k_per_N": stiff[600][1] / 600, "unit": {"strut": B["prism"]["unit_stress"][0], "poly": B["prism"]["unit_stress"][3]},
        "twist_sweep": [[d, round(s, 6)] for d, s in B["twist"]["sweep_deg_sigma_min"]], "gap_sweep": [[g, round(s, 6)] for g, s in B["six"]["gap_sweep_sigma_min"]]}
turn = abs(press["turn_deg"])
tokens = {
    "__FLOOR__": f'{B["window"]["floor_N"]["first_pass"]:,.0f}', "__CEIL__": f'{B["window"]["ceiling_N"]["last_pass"]:,.0f}',
    "__TWIST_ERR__": "1e-9",
    "__K_PER_N__": f'{stiff[600][1] / 600:.2f}', "__K600__": f'{stiff[600][1]:,.0f}', "__KNEXT__": f'{stiff[600][2]:,.0f}', "__KRATIO__": f'{stiff[600][2] / stiff[600][1]:.0f}',
    "__TURN__": f"{turn:.1f}", "__DROP__": f'{press["drop_mm"]:.1f}', "__RIM__": f'{turn * 3.141592653589793 / 180 * P["R"] * 1e3:.0f}',
    "__STRUT_PRE__": f'{-B["design"]["members"]["S0"]["prestress_N"]:,.0f}', "__STRUT_LIFT__": f'{-min(lift["forces_N"][:3]):,.0f}',
    "__U_STRUT__": f'{G["R4"]["value"]["buckling_utilisation"]:.2f}' if G["R4"]["prestress_N"] == 600 else None,
    "__GATES__": V["gates_passed"], "__CONTROLS__": V["controls_caught"], "__SOLVERS__": sci(G["REF6"]["value"]["max_position_diff_m"]), "__FD__": sci(G["REF5"]["value"]),
    "__PAGE__": sci(G["REF9"]["value"]["max_position_diff_m"]), "__PAGE_CTL__": f'{G["REF9"]["value"]["control_wrong_density_diff_m"]:.4f}',
    "__PY__": V["rig"]["python"], "__NP__": V["rig"]["numpy"], "__NODE__": PG["node"],
}
assert max(G["REF1"]["value"]["n_3_to_6_max_rad"], G["REF1"]["value"]["other_proportions_max_rad"]) < 1e-9
tokens["__TIGHT__"] = V["findings"]["every_cable_tightens_and_every_strut_loads_up"]["count"]
dg = B["design"]["gates"]                                # the design point (600 N), not the worst of the claimed envelope
tokens["__U_STRUT__"] = f'{dg["R4"]["value"]["buckling_utilisation"]:.2f}'; tokens["__U_CABLE__"] = f'{dg["R5"]["value"]["utilisation"]:.2f}'
tokens["__U_YIELD__"] = f'{dg["R4"]["value"]["yield_utilisation"]:.2f}'
poster = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "poster.webp"
html = (HERE / "template.html").read_text()
html = html.replace("/*__XITE_CSS__*/", (HERE / "xite-16.5.1.css").read_text().strip())
html = html.replace("/*__SOLVER__*/", (HERE / "solver.js").read_text())
html = html.replace("/*__DATA__*/", json.dumps(data, separators=(",", ":")))
html = html.replace("/*__APP__*/", (HERE / "app.js").read_text())
html = html.replace("__POSTER__", "data:image/webp;base64," + base64.b64encode(poster.read_bytes()).decode())
for k, val in tokens.items():
    assert val is not None, k
    html = html.replace(k, val)
import re
stray = sorted(set(re.findall(r"__[A-Z0-9_]+__", html)))
assert not stray, stray
(HERE / "index.html").write_text(html)
out = (HERE / "index.html").read_text()
assert (HERE / "solver.js").read_text() in out and (HERE / "app.js").read_text() in out, "the page must carry solver.js and app.js unchanged"
print("page written:", len(html), "bytes;", {k: tokens[k] for k in ("__FLOOR__", "__CEIL__", "__K_PER_N__", "__TURN__", "__DROP__", "__RIM__", "__STRUT_PRE__", "__STRUT_LIFT__", "__U_STRUT__", "__U_CABLE__", "__U_YIELD__", "__TWIST_ERR__", "__SOLVERS__", "__FD__", "__PAGE__", "__PAGE_CTL__", "__KRATIO__")})
