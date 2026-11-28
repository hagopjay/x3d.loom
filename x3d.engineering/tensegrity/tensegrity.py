#!/usr/bin/env python3
"""Tensegrity study: the mathematics, with nothing drawn yet.

A tensegrity is a pin-jointed network of struts (compression only) and cables (tension only) that holds its shape
because it is prestressed. Everything here follows from one matrix, the equilibrium matrix A (3 rows per joint, one
column per member): A t = f, member tensions to joint loads. Its transpose maps joint displacements to member
elongations. The singular value decomposition of A gives, in one pass,
  rank r, the self-stress states s = b - r (tensions that load no joint) and the mechanisms m = 3j - 6 - r
  (joint motions that stretch no member), with Maxwell's count b - 3j + 6 = s - m (Calladine 1978).

Frame: X3D, right-handed, y up. Units: m, N, rad. Needs numpy (the SVD and the linear solves).
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------- geometry
def prism(n=3, R=0.4, H=1.0, twist=None, Rt=None):
    """n-strut tensegrity prism. Bottom polygon at y = 0, top polygon at y = H turned by `twist` about +y.
    Strut i joins bottom i to top i; side cable i joins bottom i to top i-1. twist None = the closed form."""
    twist = math.pi / 2 + math.pi / n if twist is None else twist
    Rt = R if Rt is None else Rt
    X = [(R * math.cos(2 * math.pi * i / n), 0.0, -R * math.sin(2 * math.pi * i / n)) for i in range(n)]
    X += [(Rt * math.cos(2 * math.pi * i / n + twist), H, -Rt * math.sin(2 * math.pi * i / n + twist)) for i in range(n)]
    M = [{"id": f"S{i}", "kind": "strut", "group": "strut", "i": i, "j": n + i} for i in range(n)]
    M += [{"id": f"B{i}", "kind": "cable", "group": "bottom", "i": i, "j": (i + 1) % n} for i in range(n)]
    M += [{"id": f"T{i}", "kind": "cable", "group": "top", "i": n + i, "j": n + (i + 1) % n} for i in range(n)]
    M += [{"id": f"V{i}", "kind": "cable", "group": "side", "i": i, "j": n + (i - 1) % n} for i in range(n)]
    return np.array(X, float), M


def six_strut(L=1.0, gap=None):
    """The six-strut tensegrity (expanded octahedron): three pairs of parallel struts along x, y and z, each pair
    `gap` apart. 12 joints, 6 struts, 24 cables (every joint to its 4 nearest joints on other struts).
    gap None = the closed form L / 2."""
    d = L / 2 if gap is None else gap
    X, M = [], []
    for s in (+1, -1):   # x struts, offset in z
        X += [(-L / 2, 0, s * d / 2), (L / 2, 0, s * d / 2)]
    for s in (+1, -1):   # y struts, offset in x
        X += [(s * d / 2, -L / 2, 0), (s * d / 2, L / 2, 0)]
    for s in (+1, -1):   # z struts, offset in y
        X += [(0, s * d / 2, -L / 2), (0, s * d / 2, L / 2)]
    X = np.array(X, float)
    for k in range(6):
        M.append({"id": f"S{k}", "kind": "strut", "group": "strut", "i": 2 * k, "j": 2 * k + 1})
    # cables: every pair of joints on struts of different directions at the shortest such distance
    pairs = [(i, j, float(np.linalg.norm(X[i] - X[j]))) for i in range(12) for j in range(i + 1, 12) if i // 4 != j // 4]
    dmin = min(p[2] for p in pairs)
    c = 0
    for i, j, dist in pairs:
        if dist < dmin * (1 + 1e-9):
            M.append({"id": f"C{c:02d}", "kind": "cable", "group": "cable", "i": i, "j": j}); c += 1
    return X, M


# ---------------------------------------------------------------- the one matrix
def lengths(X, M):
    return np.array([np.linalg.norm(X[m["j"]] - X[m["i"]]) for m in M])


def equilibrium_matrix(X, M):
    """A (3j x b). Column k holds the unit vector from j to i at joint i and its negative at joint j, so that
    A t = f balances member tensions t (positive = tension) against joint loads f."""
    A = np.zeros((3 * len(X), len(M)))
    for k, m in enumerate(M):
        u = (X[m["i"]] - X[m["j"]]); u = u / np.linalg.norm(u)
        A[3 * m["i"]:3 * m["i"] + 3, k] = u
        A[3 * m["j"]:3 * m["j"] + 3, k] = -u
    return A


def rigid_modes(X):
    """Orthonormal basis of the 6 rigid-body motions of the joints."""
    n = len(X); R = np.zeros((3 * n, 6))
    for a in range(3):
        e = np.zeros(3); e[a] = 1
        for i in range(n):
            R[3 * i:3 * i + 3, a] = e
            R[3 * i:3 * i + 3, 3 + a] = np.cross(e, X[i])
    return np.linalg.qr(R)[0]


def census(X, M, tol=1e-9):
    """SVD of A: rank, self-stress states, mechanisms (rigid-body motions removed), Maxwell's count."""
    A = equilibrium_matrix(X, M)
    U, S, Vt = np.linalg.svd(A)
    r = int(np.sum(S > tol * S[0]))
    b, j = len(M), len(X)
    stress = Vt[r:].T                                   # b x s
    N = U[:, r:]                                        # 3j x (3j - r): every motion that stretches no member
    Rb = rigid_modes(X)
    Nm = N - Rb @ (Rb.T @ N)
    Um, Sm, _ = np.linalg.svd(Nm, full_matrices=False)
    mech = Um[:, Sm > 1e-8]
    return {"b": b, "j": j, "rank": r, "s": b - r, "m": 3 * j - 6 - r, "m_counted": int(mech.shape[1]), "maxwell": b - 3 * j + 6,
            "sigma": S.tolist(), "sigma_min": float(S[min(b, 3 * j) - 1]), "sigma_max": float(S[0]),
            "stress": stress, "mech": mech, "A": A}


def unilateral(M, t, tol=1e-9):
    """True when a self-stress puts every cable in tension and every strut in compression (or the reverse sign)."""
    sgn = np.array([1.0 if m["kind"] == "cable" else -1.0 for m in M])
    v = sgn * t
    return bool(np.all(v > tol) or np.all(v < -tol))


def orient(M, t):
    """Scale a self-stress so the first cable carries +1."""
    k = next(i for i, m in enumerate(M) if m["kind"] == "cable")
    return t / t[k]


def force_density_matrix(M, q, n):
    """D = C^T diag(q) C (Schek 1974). In equilibrium with no load D x = 0 for each coordinate, so a
    three-dimensional shape needs D to have nullity at least 4. Uses connectivity and q only, never A."""
    D = np.zeros((n, n))
    for m, qk in zip(M, q):
        i, j = m["i"], m["j"]
        D[i, i] += qk; D[j, j] += qk; D[i, j] -= qk; D[j, i] -= qk
    return D


# ---------------------------------------------------------------- stiffness and statics
def state(X, M, EA, L0, slack=True):
    """Member tensions and their tangent axial stiffness. Cables carry no compression when slack is True."""
    l = lengths(X, M)
    t = EA * (l - L0) / L0
    ka = EA / L0
    if slack:
        off = np.array([m["kind"] == "cable" for m in M]) & (t < 0)
        t = np.where(off, 0.0, t); ka = np.where(off, 0.0, ka)
    return l, t, ka


def internal(X, M, EA, L0, slack=True):
    """Joint forces from the members (3j,) and the tangent stiffness K = -d(force)/dx (3j x 3j).
    Per member: K = ka u u^T + (t / l)(I - u u^T): the first term is the material, the second is the prestress."""
    n = len(X); F = np.zeros(3 * n); K = np.zeros((3 * n, 3 * n))
    l, t, ka = state(X, M, EA, L0, slack)
    for k, m in enumerate(M):
        i, j = m["i"], m["j"]
        u = (X[j] - X[i]) / l[k]
        F[3 * i:3 * i + 3] += t[k] * u; F[3 * j:3 * j + 3] -= t[k] * u
        Km = ka[k] * np.outer(u, u) + (t[k] / l[k]) * (np.eye(3) - np.outer(u, u))
        for a, b_, s in ((i, i, 1), (j, j, 1), (i, j, -1), (j, i, -1)):
            K[3 * a:3 * a + 3, 3 * b_:3 * b_ + 3] += s * Km
    return F, K, t


def rest_lengths(X, M, EA, t):
    """Rest lengths that put tensions t into the members at shape X (engineering strain)."""
    return lengths(X, M) / (1 + t / EA)


def support_basis(X, sup):
    """Free-motion basis Z for a 3-2-1 support: joint a held in x, y, z; joint b held in y and across the line a-b;
    joint c held in y. Six constraints, so the base can still breathe."""
    a, b, c = sup
    n = len(X); C = np.zeros((6, 3 * n))
    C[0, 3 * a] = C[1, 3 * a + 1] = C[2, 3 * a + 2] = 1
    C[3, 3 * b + 1] = 1
    d = X[b] - X[a]; perp = np.array([-d[2], 0, d[0]]); perp /= np.linalg.norm(perp)
    C[4, 3 * b:3 * b + 3] = perp
    C[5, 3 * c + 1] = 1
    _, S, Vt = np.linalg.svd(C)
    return Vt[6:].T


def solve_newton(X0, M, EA, L0, Fext, Z, steps=8, tol=1e-7, slack=True):
    """Static equilibrium under Fext by load-stepped Newton with a backtracking line search."""
    X = X0.copy(); it_total = 0
    for s in range(1, steps + 1):
        f = Fext * s / steps
        for it in range(200):
            F, K, _ = internal(X, M, EA, L0, slack)
            R = Z.T @ (F + f)
            nr = np.linalg.norm(R)
            if nr < tol:
                break
            Kr = Z.T @ K @ Z
            Kr += 1e-9 * np.trace(Kr) / len(Kr) * np.eye(len(Kr))
            dq = np.linalg.solve(Kr, R); a = 1.0
            while a > 1e-6:
                Xn = X + a * (Z @ dq).reshape(-1, 3)
                if np.linalg.norm(Z.T @ (internal(Xn, M, EA, L0, slack)[0] + f)) < nr:
                    break
                a /= 2
            X = Xn; it_total += 1
        else:
            raise RuntimeError("Newton did not converge")
    return X, it_total


def solve_relax(X0, M, EA, L0, Fext, Z, tol=1e-7, slack=True, max_it=400000):
    """The second solver: dynamic relaxation with kinetic damping. No stiffness matrix is assembled or solved;
    joints simply move under their out-of-balance force and all velocity is dropped at each kinetic-energy peak."""
    X = X0.copy(); nq = Z.shape[1]
    l, _, _ = state(X, M, EA, L0, False)
    kmax = np.zeros(len(X))
    for k, m in enumerate(M):
        kmax[m["i"]] += EA[k] / L0[k]; kmax[m["j"]] += EA[k] / L0[k]
    mass = np.repeat(2.0 * kmax, 3)                       # fictitious mass, time step 1 is then stable
    Mr = Z.T @ (mass[:, None] * Z)
    Minv = np.linalg.inv(Mr)
    v = np.zeros(nq); ke_prev = 0.0
    for it in range(max_it):
        F = internal_force_only(X, M, EA, L0, slack)
        R = Z.T @ (F + Fext)
        if np.linalg.norm(R) < tol:
            return X, it
        v = v + Minv @ R
        ke = float(v @ Mr @ v)
        if ke < ke_prev:
            v[:] = 0; ke = 0.0
        else:
            X = X + (Z @ v).reshape(-1, 3)
        ke_prev = ke
    raise RuntimeError("relaxation did not converge")


def internal_force_only(X, M, EA, L0, slack=True):
    F = np.zeros(3 * len(X))
    l, t, _ = state(X, M, EA, L0, slack)
    for k, m in enumerate(M):
        u = (X[m["j"]] - X[m["i"]]) / l[k]
        F[3 * m["i"]:3 * m["i"] + 3] += t[k] * u; F[3 * m["j"]:3 * m["j"] + 3] -= t[k] * u
    return F


# ================================================================ the design study
CARD = json.loads((HERE / "card.json").read_text())
P = {k: v["value"] for k, v in CARD["params"].items()}
CASES = CARD["load_cases"]


def sections(wall=None, cable=None):
    """Section properties and capacities. cable = (area m2, breaking load N) overrides the card."""
    od, w = P["strut_od"], (P["strut_wall"] if wall is None else wall)
    di = od - 2 * w
    A = math.pi / 4 * (od ** 2 - di ** 2); I = math.pi / 64 * (od ** 4 - di ** 4)
    ca, mbl = (P["cable_area"], P["cable_mbl"]) if cable is None else cable
    return {"A_strut": A, "I_strut": I, "EA_strut": P["E_strut"] * A, "EA_cable": P["E_cable"] * ca,
            "yield_N": P["Fy_strut"] * A, "cable_allow_N": mbl / P["FS_cable"]}


def unit_stress(X, M):
    """The self-stress scaled so each side cable carries 1 (None when the shape has none or more than one)."""
    c = census(X, M)
    if c["s"] != 1:
        return None
    t = c["stress"][:, 0]
    k = next(i for i, m in enumerate(M) if m["group"] in ("side", "cable"))
    return t / t[k]


def load_case(X, name, scale=1.0):
    n = P["n"]; F = np.zeros(3 * len(X)); top = range(n, 2 * n)
    rad = lambda i: np.array([X[i][0], 0, X[i][2]]) / math.hypot(X[i][0], X[i][2])
    tan = lambda i: np.cross([0, 1, 0], rad(i))
    if name == "press":
        for i in top: F[3 * i + 1] = -P["P_press"] / n
    elif name.startswith("press-on-J"):
        F[3 * int(name[-1]) + 1] = -P["P_press"]
    elif name.startswith("push-out-J"):
        i = int(name[-1]); F[3 * i:3 * i + 3] = P["P_side"] * rad(i)
    elif name.startswith("push-in-J"):
        i = int(name[-1]); F[3 * i:3 * i + 3] = -P["P_side"] * rad(i)
    elif name.startswith("slide"):
        i = int(name[-1]); F[3 * i:3 * i + 3] = (1 if name[5] == "+" else -1) * P["P_side"] * tan(i)
    elif name == "lift":
        for i in top: F[3 * i + 1] = P["P_lift"] / n
    elif name.startswith("torque"):
        for i in top: F[3 * i:3 * i + 3] = (1 if name[-1] == "+" else -1) * P["P_torque_each"] * tan(i)
    elif name != "none":
        raise ValueError(name)
    return F * scale


def analyse(X, M, sec, t0, cases=None, solver="newton", scale=1.0, relax_tol=1e-7, kg_sign=1.0):
    """Solve every load case at prestress t0. Returns {case: {X, t, drop, turn_deg, move}} plus the rest lengths."""
    n = P["n"]
    EA = np.array([sec["EA_strut"] if m["kind"] == "strut" else sec["EA_cable"] for m in M])
    tu = unit_stress(X, M)
    L0 = rest_lengths(X, M, EA, t0 * tu)
    Z = support_basis(X, (0, 1, 2))
    out = {}
    for name in (cases or CASES):
        F = load_case(X, name, scale)
        found = True
        try:
            if solver == "newton":
                try:
                    Xn, _ = solve_newton(X, M, EA, L0, F, Z, steps=16)
                except RuntimeError:
                    Xn, _ = solve_relax(X, M, EA, L0, F, Z, tol=relax_tol, max_it=60000)
            else:
                Xn, _ = solve_relax(X, M, EA, L0, F, Z, tol=relax_tol)
        except RuntimeError:
            Xn, found = X.copy(), False                  # neither solver found a resting shape: reported as a collapse
        _, t, _ = state(Xn, M, EA, L0)
        if not found:
            t = np.where(np.array([m["kind"] == "cable" for m in M]), 0.0, t)
        turn = np.mean([math.atan2(-Xn[i][2], Xn[i][0]) - math.atan2(-X[i][2], X[i][0]) for i in range(n, 2 * n)])
        out[name] = {"X": Xn, "t": t, "drop": float(-(Xn[n:, 1] - X[n:, 1]).mean()), "turn_deg": math.degrees(turn),
                     "move": float(np.linalg.norm(Xn - X, axis=1).max()) if found else float("inf"), "found": found}
    return out, {"EA": EA, "L0": L0, "Z": Z, "t_pre": t0 * tu}


def capacities(X, M, sec):
    Ls = lengths(X, M)[0]
    return {"strut_length_m": float(Ls), "buckling_N": math.pi ** 2 * P["E_strut"] * sec["I_strut"] / Ls ** 2 / P["FS_buckling"],
            "euler_N": math.pi ** 2 * P["E_strut"] * sec["I_strut"] / Ls ** 2, "yield_N": sec["yield_N"], "cable_allow_N": sec["cable_allow_N"]}


def judge(X, M, sec, res, aux, lim=None):
    """R3 to R6 from a solved set of load cases."""
    lim = lim or CARD["limits"]; cap = capacities(X, M, sec)
    cab = np.array([m["kind"] == "cable" for m in M]); st = ~cab
    floor = min(((r["t"][cab] / aux["t_pre"][cab]).min(), name) for name, r in res.items())
    strut = max(((-r["t"][st]).max(), name) for name, r in res.items())
    cable = max((r["t"][cab].max(), name) for name, r in res.items())
    k = lambda v: float(v)
    g = {"R3": {"value": {"least_fraction_of_prestress": k(floor[0]), "case": floor[1]}, "limit": lim["cable_floor_fraction"]["min"],
                "pass": bool(floor[0] >= lim["cable_floor_fraction"]["min"])},
         "R4": {"value": {"worst_strut_N": k(strut[0]), "case": strut[1], "buckling_utilisation": k(strut[0] / cap["buckling_N"]),
                          "yield_utilisation": k(strut[0] / cap["yield_N"])}, "limit": 1.0,
                "pass": bool(strut[0] <= cap["buckling_N"] and strut[0] <= cap["yield_N"])},
         "R5": {"value": {"worst_cable_N": k(cable[0]), "case": cable[1], "utilisation": k(cable[0] / cap["cable_allow_N"])}, "limit": 1.0,
                "pass": bool(cable[0] <= cap["cable_allow_N"])}}
    if "press" in res:
        push = max((res[c]["move"], c) for c in res if c.startswith("push"))
        pr = res["press"]
        g["R6"] = {"value": {"press_drop_mm": pr["drop"] * 1e3, "press_turn_deg": abs(pr["turn_deg"]), "push_move_mm": push[0] * 1e3, "push_case": push[1]},
                   "limit": {"drop_mm": lim["press_drop_m"]["max"] * 1e3, "turn_deg": lim["press_turn_deg"]["max"], "push_mm": lim["push_move_m"]["max"] * 1e3},
                   "pass": bool(pr["drop"] <= lim["press_drop_m"]["max"] and abs(pr["turn_deg"]) <= lim["press_turn_deg"]["max"] and push[0] <= lim["push_move_m"]["max"])}
    return g


def golden(f, a, b, tol=1e-10):
    """Golden-section search for the minimum of a V-shaped function on [a, b]."""
    g = (math.sqrt(5) - 1) / 2
    c, d = b - g * (b - a), a + g * (b - a); fc, fd = f(c), f(d)
    while b - a > tol:
        if fc < fd:
            b, d, fd = d, c, fc; c = b - g * (b - a); fc = f(c)
        else:
            a, c, fc = c, d, fd; d = a + g * (b - a); fd = f(d)
    return (a + b) / 2


def soft_stiffness(X, M, sec, t0, kg=1.0, material=1.0):
    """Smallest stiffness of the supported prism at prestress t0 (cables not allowed to slacken: this is the tangent)."""
    EA = np.array([sec["EA_strut"] if m["kind"] == "strut" else sec["EA_cable"] for m in M])
    tu = unit_stress(X, M); L0 = rest_lengths(X, M, EA, t0 * tu); Z = support_basis(X, (0, 1, 2))
    K = stiffness_parts(X, M, EA, L0, kg, material)
    ev = np.linalg.eigvalsh(Z.T @ K @ Z)
    return float(ev[0]), float(ev[1])


def stiffness_parts(X, M, EA, L0, kg=1.0, material=1.0):
    """Tangent stiffness with the prestress term scaled by kg and the material term by `material` (controls use these)."""
    n = len(X); K = np.zeros((3 * n, 3 * n)); l, t, ka = state(X, M, EA, L0, False)
    for k, m in enumerate(M):
        i, j = m["i"], m["j"]; u = (X[j] - X[i]) / l[k]
        Km = material * ka[k] * np.outer(u, u) + kg * (t[k] / l[k]) * (np.eye(3) - np.outer(u, u))
        for a, b_, s in ((i, i, 1), (j, j, 1), (i, j, -1), (j, i, -1)):
            K[3 * a:3 * a + 3, 3 * b_:3 * b_ + 3] += s * Km
    return K


def stiffness_vs_difference(X, M, EA, L0, kg=1.0, h=1e-6):
    """Largest relative gap between the stiffness matrix and a central difference of the joint forces."""
    K = stiffness_parts(X, M, EA, L0, kg); n = 3 * len(X); Kd = np.zeros((n, n))
    for a in range(n):
        Xp = X.copy().reshape(-1); Xm = Xp.copy(); Xp[a] += h; Xm[a] -= h
        Kd[:, a] = -(internal_force_only(Xp.reshape(-1, 3), M, EA, L0, False) - internal_force_only(Xm.reshape(-1, 3), M, EA, L0, False)) / (2 * h)
    return float(np.abs(K - Kd).max() / np.abs(Kd).max())
