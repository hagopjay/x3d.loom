#!/usr/bin/env python3
"""A parallel-chord Pratt truss: model, three routes to its member forces, design strengths and margins.

Standard library only. SI units throughout: m, N, Pa. The truss lies in the x-z plane (IFC frame, z up).
Parameters and limits come from card.json; the span and the bearing level come from the IFC (see exchange.py).
"""
from __future__ import annotations
import json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
CARD = json.loads((HERE / "card.json").read_text())
P = {k: v["value"] for k, v in CARD["params"].items()}


class Mechanism(Exception):
    """The equations are singular: the frame is not a structure."""


def solve(A, b):
    """Gaussian elimination with partial pivoting. A singular system raises Mechanism instead of returning numbers."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    scale = max(abs(x) for row in A for x in row) or 1.0
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[p][c]) < 1e-10 * scale:
            raise Mechanism(f"zero pivot in column {c}")
        M[c], M[p] = M[p], M[c]
        for r in range(c + 1, n):
            f = M[r][c] / M[c][c]
            if f:
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (M[r][n] - sum(M[r][k] * x[k] for k in range(r + 1, n))) / M[r][r]
    return x


def shs(b, t):
    """Square hollow section with sharp corners: area, second moment, radius of gyration."""
    A = b * b - (b - 2 * t) ** 2
    I = (b ** 4 - (b - 2 * t) ** 4) / 12
    return {"b": b, "t": t, "A": A, "I": I, "r": math.sqrt(I / A), "name": f"SHS {b * 1000:g}x{b * 1000:g}x{t * 1000:g}"}


def model(span, x0, z0, n=None, depth=None, y=None, chord=None, web=None, coord_scale=1.0, drop=None):
    """Joints and members. Joint ids B0..Bn (bottom) and T0..Tn (top). coord_scale and drop exist for the controls."""
    n = int(P["panels"]) if n is None else n
    depth = P["depth"] if depth is None else depth
    y = P["truss_line_y"] if y is None else y
    chord = chord or shs(P["chord_b"], P["chord_t"]); web = web or shs(P["web_b"], P["web_t"])
    p = span / n
    J = {}
    for i in range(n + 1):
        J[f"B{i}"] = (coord_scale * (x0 + i * p), coord_scale * y, coord_scale * z0)
        J[f"T{i}"] = (coord_scale * (x0 + i * p), coord_scale * y, coord_scale * (z0 + depth))
    M = []
    for i in range(1, n + 1):
        M.append({"id": f"BC{i}", "role": "bottom chord", "a": f"B{i - 1}", "b": f"B{i}", "sec": chord})
        M.append({"id": f"TC{i}", "role": "top chord", "a": f"T{i - 1}", "b": f"T{i}", "sec": chord})
        # Pratt: diagonals fall towards midspan, so gravity puts them in tension
        a, b = (f"T{i - 1}", f"B{i}") if i <= n // 2 else (f"B{i - 1}", f"T{i}")
        M.append({"id": f"D{i}", "role": "diagonal", "a": a, "b": b, "sec": web})
    for i in range(n + 1):
        M.append({"id": f"V{i}", "role": "vertical", "a": f"B{i}", "b": f"T{i}", "sec": web})
    if drop:
        M = [m for m in M if m["id"] != drop]
    for m in M:
        m["L"] = math.dist(J[m["a"]], J[m["b"]])
    return {"joints": J, "members": M, "n": n, "panel": p * coord_scale, "depth": depth * coord_scale, "span": span * coord_scale,
            "supports": {"B0": ("x", "z"), f"B{n}": ("z",)}, "x0": x0, "z0": z0, "y": y}


def nodal_loads(mdl, factors, panel_for_area=None):
    """Downward force (N, positive down) on each joint for a set of load factors {D, Lr, Lr_west}."""
    n, J = mdl["n"], mdl["joints"]
    p = mdl["panel"] if panel_for_area is None else panel_for_area
    w = P["tributary_width"]
    F = {j: 0.0 for j in J}
    xmid = (J["B0"][0] + J[f"B{n}"][0]) / 2
    for i in range(n + 1):
        trib = p * w * (0.5 if i in (0, n) else 1.0)
        F[f"T{i}"] += factors.get("D", 0) * P["dead_roof"] * trib + factors.get("Lr", 0) * P["live_roof"] * trib
        if factors.get("Lr_west"):
            x = J[f"T{i}"][0]
            share = 1.0 if x < xmid - 1e-9 else 0.5 if abs(x - xmid) <= 1e-9 else 0.0
            if i == 0:
                share = 1.0
            F[f"T{i}"] += factors["Lr_west"] * P["live_roof"] * trib * share
    if factors.get("D"):
        for m in mdl["members"]:                       # self-weight, half to each end
            wgt = factors["D"] * m["sec"]["A"] * m["L"] * P["rho"] * P["g"]
            F[m["a"]] += wgt / 2; F[m["b"]] += wgt / 2
    return F


# ---- route 1: joint equilibrium, one linear system (the method of joints written as a matrix) ----
def forces_by_joints(mdl, F):
    J, M = mdl["joints"], mdl["members"]
    names = sorted(J)
    unknowns = [m["id"] for m in M] + [f"R:{j}:{d}" for j, dirs in mdl["supports"].items() for d in dirs]
    if len(unknowns) != 2 * len(names):
        raise Mechanism(f"{len(unknowns)} unknowns for {2 * len(names)} equations: not statically determinate")
    A = [[0.0] * len(unknowns) for _ in range(2 * len(names))]
    b = [0.0] * (2 * len(names))
    for k, m in enumerate(M):
        (xa, _, za), (xb, _, zb) = J[m["a"]], J[m["b"]]
        cx, cz = (xb - xa) / m["L"], (zb - za) / m["L"]
        ia, ib = names.index(m["a"]), names.index(m["b"])
        A[2 * ia][k] += cx; A[2 * ia + 1][k] += cz       # tension pulls joint a towards b
        A[2 * ib][k] -= cx; A[2 * ib + 1][k] -= cz
    for k, u in enumerate(unknowns[len(M):], start=len(M)):
        _, j, d = u.split(":")
        A[2 * names.index(j) + (0 if d == "x" else 1)][k] = 1.0
    for j, f in F.items():
        b[2 * names.index(j) + 1] = f                    # loads act down, so +f balances -f
    x = solve(A, b)
    return {u: x[k] for k, u in enumerate(unknowns)}


# ---- route 2: the direct stiffness method (displacements first, forces from stretch) ----
def forces_by_stiffness(mdl, F, sign=1.0):
    J, M = mdl["joints"], mdl["members"]
    names = sorted(J)
    n = 2 * len(names)
    K = [[0.0] * n for _ in range(n)]
    for m in M:
        (xa, _, za), (xb, _, zb) = J[m["a"]], J[m["b"]]
        cx, cz = (xb - xa) / m["L"], (zb - za) / m["L"]
        k = P["E"] * m["sec"]["A"] / m["L"]
        ia, ib = 2 * names.index(m["a"]), 2 * names.index(m["b"])
        v = [(ia, -cx), (ia + 1, -cz), (ib, cx), (ib + 1, cz)]
        for p_, a in v:
            for q_, c in v:
                K[p_][q_] += k * a * c
    f = [0.0] * n
    for j, load in F.items():
        f[2 * names.index(j) + 1] = -load
    fixed = {2 * names.index(j) + (0 if d == "x" else 1) for j, dirs in mdl["supports"].items() for d in dirs}
    free = [i for i in range(n) if i not in fixed]
    u_free = solve([[K[i][j] for j in free] for i in free], [f[i] for i in free])
    u = [0.0] * n
    for i, v_ in zip(free, u_free):
        u[i] = v_
    out = {}
    for m in M:
        (xa, _, za), (xb, _, zb) = J[m["a"]], J[m["b"]]
        cx, cz = (xb - xa) / m["L"], (zb - za) / m["L"]
        ia, ib = 2 * names.index(m["a"]), 2 * names.index(m["b"])
        stretch = (u[ib] - u[ia]) * cx + (u[ib + 1] - u[ia + 1]) * cz
        out[m["id"]] = sign * P["E"] * m["sec"]["A"] / m["L"] * stretch
    disp = {j: (u[2 * i], u[2 * i + 1]) for i, j in enumerate(names)}
    return out, disp


# ---- route 3: the method of sections, by hand formula, for a load that is symmetric about midspan ----
def forces_by_sections(mdl, F, depth=None):
    """Chords from the bending moment over the depth, diagonals from the panel shear. Left half only."""
    n, p, h = mdl["n"], mdl["panel"], (mdl["depth"] if depth is None else depth)
    col = [F[f"B{i}"] + F[f"T{i}"] for i in range(n + 1)]          # total load on each panel line
    R = sum(col) / 2
    out = {}
    Mx = [0.0]                                                      # bending moment at panel line i
    for i in range(1, n + 1):
        V = R - sum(col[:i])                                        # shear in panel i
        Mx.append(Mx[-1] + V * p)
        if i <= n // 2:
            out[f"D{i}"] = V * math.hypot(p, h) / h                 # tension
            out[f"BC{i}"] = Mx[i - 1] / h                           # cut panel i, moments about T(i-1)
            out[f"TC{i}"] = -Mx[i] / h                              # moments about B(i)
    return out


def e3_fcr(Fy, E, slender, limit_const=4.71):
    Fe = math.pi ** 2 * E / slender ** 2
    return (0.658 ** (Fy / Fe)) * Fy if slender <= limit_const * math.sqrt(E / Fy) else 0.877 * Fe


def e3_continuity(Fy, E, limit_const=4.71):
    s = limit_const * math.sqrt(E / Fy)
    Fe = math.pi ** 2 * E / s ** 2
    a, b = (0.658 ** (Fy / Fe)) * Fy, 0.877 * Fe
    return abs(a - b) / b


def strengths(m):
    """Design strengths in N: tension by D2(a) yielding, compression by E3 with K L / r."""
    Fy, E, K = P["Fy"], P["E"], P["K"]
    sl = K * m["L"] / m["sec"]["r"]
    return {"tension": 0.90 * Fy * m["sec"]["A"], "compression": 0.90 * e3_fcr(Fy, E, sl) * m["sec"]["A"], "slenderness": sl}


def deflection_virtual_work(mdl, forces, joint):
    """Vertical deflection (positive down) at a joint by the unit-load method: sum of F f L / (E A)."""
    unit = {j: 0.0 for j in mdl["joints"]}
    unit[joint] = 1.0
    f = forces_by_joints(mdl, unit)
    return sum(forces[m["id"]] * f[m["id"]] * m["L"] / (P["E"] * m["sec"]["A"]) for m in mdl["members"])


def design(mdl, cases=None, stiffness_sign=1.0, sections_depth=None):
    """Run every load case through every route; return forces, the envelope, margins and the cross-checks."""
    cases = CARD["load_cases"] if cases is None else cases
    n, res = mdl["n"], {"cases": {}, "members": {}}
    worst_solver = worst_sections = worst_eq = 0.0
    for lc in cases:
        F = nodal_loads(mdl, lc["factors"], panel_for_area=mdl["span"] / mdl["n"] if mdl.get("area_panel") is None else mdl["area_panel"])
        fj = forces_by_joints(mdl, F)
        fs, disp = forces_by_stiffness(mdl, F, sign=stiffness_sign)
        big = max(abs(fj[m["id"]]) for m in mdl["members"]) or 1.0
        worst_solver = max(worst_solver, max(abs(fj[m["id"]] - fs[m["id"]]) for m in mdl["members"]) / big)
        total = sum(F.values()); react = sum(v for k, v in fj.items() if k.startswith("R:") and k.endswith(":z"))
        worst_eq = max(worst_eq, abs(react - total) / total)
        sym = "Lr_west" not in lc["factors"]
        if sym:
            hand = forces_by_sections(mdl, F, depth=sections_depth)
            worst_sections = max(worst_sections, max(abs(hand[k] - fj[k]) for k in hand) / big)
        mid = f"B{n // 2}"
        res["cases"][lc["id"]] = {"total_load_N": total, "reaction_sum_N": react, "forces_N": {m["id"]: fj[m["id"]] for m in mdl["members"]},
                                  "reactions_N": {k: v for k, v in fj.items() if k.startswith("R:")},
                                  "midspan_deflection_stiffness_m": -disp[mid][1], "midspan_deflection_virtual_work_m": deflection_virtual_work(mdl, fj, mid),
                                  "serviceability": bool(lc.get("serviceability"))}
    strength_cases = [lc["id"] for lc in cases if not lc.get("serviceability")]
    for m in mdl["members"]:
        s = strengths(m)
        T = max((res["cases"][c]["forces_N"][m["id"]] for c in strength_cases), default=0.0)
        C = min((res["cases"][c]["forces_N"][m["id"]] for c in strength_cases), default=0.0)
        ut = max(T, 0) / s["tension"]; uc = max(-C, 0) / s["compression"]
        gov_force, gov_kind = (T, "tension") if ut >= uc else (C, "compression")
        gov_case = max(strength_cases, key=lambda c: (res["cases"][c]["forces_N"][m["id"]] if gov_kind == "tension" else -res["cases"][c]["forces_N"][m["id"]]))
        res["members"][m["id"]] = {"role": m["role"], "section": m["sec"]["name"], "a": m["a"], "b": m["b"], "L_m": m["L"], "max_tension_N": max(T, 0), "max_compression_N": max(-C, 0),
                                   "design_tension_N": s["tension"], "design_compression_N": s["compression"], "slenderness": s["slenderness"],
                                   "sees_compression": C < -1e-6, "utilisation": max(ut, uc), "governing": gov_kind, "governing_case": gov_case,
                                   "demand_N": abs(gov_force), "capacity_N": s[gov_kind], "margin": (1 / max(ut, uc) - 1) if max(ut, uc) > 0 else None}
    sls = [c for c in res["cases"].values() if c["serviceability"]]
    res["checks"] = {"solver_agreement_rel": worst_solver, "sections_rel": worst_sections, "equilibrium_rel": worst_eq,
                     "deflection_rel": max((abs(c["midspan_deflection_stiffness_m"] - c["midspan_deflection_virtual_work_m"]) / abs(c["midspan_deflection_stiffness_m"]) for c in res["cases"].values()), default=0.0),
                     "sls_deflection_m": sls[0]["midspan_deflection_stiffness_m"] if sls else None,
                     "deflection_ratio": (mdl["span"] / sls[0]["midspan_deflection_stiffness_m"]) if sls else None,
                     "cases_run": [lc["id"] for lc in cases], "self_weight_N": sum(m["sec"]["A"] * m["L"] * P["rho"] * P["g"] for m in mdl["members"])}
    return res
