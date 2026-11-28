"""A 30 m Pratt through-truss footbridge: statics, stiffness, influence lines, patterned crowd, sizing, deflection, frequency.

One truss in its own plane, SI units (N, m, kg). Every public function takes its inputs as arguments so that check.py
can plant a fault in one place. Nothing here reads results/.
"""
import json, math
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
CARD = json.loads((HERE / "card.json").read_text())
P = {k: v["value"] for k, v in CARD["params"].items()}
GROUPS = ("top", "bottom", "endpost", "vertical", "diagonal")


class Mechanism(Exception):
    pass


# ---------------------------------------------------------------- sections
def shs(b_mm, t_mm):
    b, t = b_mm / 1000.0, t_mm / 1000.0
    A = b * b - (b - 2 * t) ** 2
    I = (b ** 4 - (b - 2 * t) ** 4) / 12.0
    return {"name": f"SHS {b_mm:g}x{t_mm:g}", "b": b, "t": t, "A": A, "I": I, "r": math.sqrt(I / A), "wall": (b - 3 * t) / t}


CATALOGUE = sorted((shs(b, t) for b, t in CARD["catalogue"]["sizes"]), key=lambda s: s["A"])


# ---------------------------------------------------------------- geometry
def model(span=None, panels=None, depth=None, coord_scale=1.0, drop=None):
    span = P["span"] if span is None else span
    n = int(P["panels"] if panels is None else panels)
    h = P["depth"] if depth is None else depth
    a = span / n
    joints, members = {}, []
    for i in range(n + 1):
        joints[f"B{i}"] = (i * a * coord_scale, 0.0)
    for i in range(1, n):
        joints[f"T{i}"] = (i * a * coord_scale, h * coord_scale)
    add = lambda mid, ja, jb, grp: members.append({"id": mid, "a": ja, "b": jb, "group": grp})
    for i in range(1, n + 1):
        add(f"BC{i}", f"B{i-1}", f"B{i}", "bottom")
    for i in range(2, n):
        add(f"TC{i}", f"T{i-1}", f"T{i}", "top")
    add("EP1", "B0", "T1", "endpost"); add("EP2", f"B{n}", f"T{n-1}", "endpost")
    for i in range(1, n):
        add(f"V{i}", f"B{i}", f"T{i}", "vertical")
    half = n // 2
    for i in range(2, half + 1):
        add(f"D{i}", f"T{i-1}", f"B{i}", "diagonal")            # falls toward midspan: tension under a full load
    for i in range(half + 1, n):
        add(f"D{i}", f"T{i}", f"B{i-1}", "diagonal")
    if drop:
        members = [m for m in members if m["id"] != drop]
    names = list(joints)
    for m in members:
        (xa, ya), (xb, yb) = joints[m["a"]], joints[m["b"]]
        m["L"] = math.hypot(xb - xa, yb - ya)
        m["c"], m["s"] = (xb - xa) / m["L"], (yb - ya) / m["L"]
    return {"span": span * coord_scale, "n": n, "h": h * coord_scale, "a": a * coord_scale, "joints": joints, "names": names,
            "members": members, "supports": [("B0", 0), ("B0", 1), (f"B{n}", 1)], "deck": [f"B{i}" for i in range(n + 1)]}


def dof(mdl, joint, axis):
    return 2 * mdl["names"].index(joint) + axis


def free_dofs(mdl):
    fixed = {dof(mdl, j, a) for j, a in mdl["supports"]}
    return [d for d in range(2 * len(mdl["names"])) if d not in fixed]


# ---------------------------------------------------------------- statics (method of joints, as one matrix)
def equilibrium_matrix(mdl):
    """A (free dofs x members): A @ N = F for external loads F on the free dofs, tension positive."""
    A = np.zeros((2 * len(mdl["names"]), len(mdl["members"])))
    for k, m in enumerate(mdl["members"]):
        ia, ib = mdl["names"].index(m["a"]), mdl["names"].index(m["b"])
        A[2 * ia, k], A[2 * ia + 1, k] = -m["c"], -m["s"]
        A[2 * ib, k], A[2 * ib + 1, k] = m["c"], m["s"]
    return A[free_dofs(mdl)]       # a member in tension pulls joint a toward b: pulls + F = 0, so (-pulls) N = F


def census(mdl):
    A = equilibrium_matrix(mdl)
    sv = np.linalg.svd(A, compute_uv=False)
    rank = int((sv > 1e-9 * sv[0]).sum())
    b, j = len(mdl["members"]), len(mdl["names"])
    return {"b": b, "j": j, "count_ok": b == 2 * j - 3, "rank": rank, "full_rank": rank == A.shape[0] == A.shape[1],
            "sigma_min_over_max": float(sv[-1] / sv[0])}


def forces_by_joints(mdl, F):
    A = equilibrium_matrix(mdl)
    if A.shape[0] != A.shape[1] or np.linalg.matrix_rank(A, tol=1e-9 * np.abs(A).max()) < A.shape[0]:
        raise Mechanism("the equilibrium matrix is not square and full rank")
    return np.linalg.solve(A, F[free_dofs(mdl)])


def mueller_breslau(mdl, k, sign=1.0):
    """Lengthen member k by one unit, every other member rigid: the joints move without stress. Returns the influence
    ordinates of N_k for a unit downward load at each deck joint, = +vertical displacement there (virtual work:
    F.d = N_k e_k, F = -1 in y, e_k = 1 gives N_k = -d_y)."""
    A = equilibrium_matrix(mdl)
    e = np.zeros(len(mdl["members"])); e[k] = 1.0
    d = np.zeros(2 * len(mdl["names"]))
    d[free_dofs(mdl)] = np.linalg.solve(A.T, e)     # compatibility: member elongation = A^T d
    return np.array([-sign * d[dof(mdl, j, 1)] for j in mdl["deck"]])


# ---------------------------------------------------------------- stiffness method
def stiffness(mdl, areas, E=None):
    E = P["E"] if E is None else E
    K = np.zeros((2 * len(mdl["names"]),) * 2)
    for m in mdl["members"]:
        ia, ib = mdl["names"].index(m["a"]), mdl["names"].index(m["b"])
        g = np.array([-m["c"], -m["s"], m["c"], m["s"]])
        idx = [2 * ia, 2 * ia + 1, 2 * ib, 2 * ib + 1]
        K[np.ix_(idx, idx)] += E * areas[m["id"]] / m["L"] * np.outer(g, g)
    return K


def solve_stiffness(mdl, areas, F, sign=1.0, E=None):
    E = P["E"] if E is None else E
    K = stiffness(mdl, areas, E); fr = free_dofs(mdl)
    Kff = K[np.ix_(fr, fr)]
    if np.linalg.cond(Kff) > 1e13:
        raise Mechanism("the stiffness matrix is singular")
    u = np.zeros(K.shape[0]); u[fr] = np.linalg.solve(Kff, F[fr])
    N = []
    for m in mdl["members"]:
        ia, ib = mdl["names"].index(m["a"]), mdl["names"].index(m["b"])
        ext = (u[2 * ib] - u[2 * ia]) * m["c"] + (u[2 * ib + 1] - u[2 * ia + 1]) * m["s"]
        N.append(sign * E * areas[m["id"]] / m["L"] * ext)
    return np.array(N), u


# ---------------------------------------------------------------- loads
def load_vector(mdl, deck_point_loads=None, member_weights=None):
    """deck_point_loads: {joint: downward N}; member_weights: {member id: N}, half to each end."""
    F = np.zeros(2 * len(mdl["names"]))
    for j, w in (deck_point_loads or {}).items():
        F[dof(mdl, j, 1)] -= w
    for m in mdl["members"]:
        w = (member_weights or {}).get(m["id"], 0.0)
        F[dof(mdl, m["a"], 1)] -= w / 2; F[dof(mdl, m["b"], 1)] -= w / 2
    return F


def udl_on_deck(mdl, w):
    """A uniform line load w (N/m) on the whole deck as panel-point loads (stringers simply supported)."""
    n, a = mdl["n"], mdl["a"]
    return {f"B{i}": w * a * (0.5 if i in (0, n) else 1.0) for i in range(n + 1)}


def steel_weights(mdl, sections, allowance=None, g=None, density=None):
    allowance = P["connection_allowance"] if allowance is None else allowance
    g = P["g"] if g is None else g; density = P["density"] if density is None else density
    return {m["id"]: density * sections[m["group"]]["A"] * m["L"] * allowance * g for m in mdl["members"]}


def line_loads(tributary=None):
    trib = P["deck_width"] / 2 if tributary is None else tributary
    return {"floor": P["floor_dead"] * trib, "crowd": P["pedestrian"] * trib}


# ---------------------------------------------------------------- influence lines and patterning
def influence_lines(mdl):
    """eta[k, i]: force in member k for a unit downward load at deck joint i (0 at the supports), by joint equilibrium."""
    eta = np.zeros((len(mdl["members"]), len(mdl["deck"])))
    for i, j in enumerate(mdl["deck"]):
        if (j, 1) in mdl["supports"]:
            continue
        eta[:, i] = forces_by_joints(mdl, load_vector(mdl, {j: 1.0}))
    return eta


def signed_areas(xs, eta_row, whole_panels=False):
    """Areas of the positive and of the negative part of a piecewise-linear influence line, and the loaded lengths.
    whole_panels=True is the planted fault: a panel counts whole on each side whenever it touches that sign."""
    plus = minus = 0.0; seg_p, seg_m = [], []
    for x0, x1, y0, y1 in zip(xs[:-1], xs[1:], eta_row[:-1], eta_row[1:]):
        full = 0.5 * (y0 + y1) * (x1 - x0)
        if whole_panels:
            if max(y0, y1) > 1e-12: plus += full; seg_p.append((x0, x1))
            if min(y0, y1) < -1e-12: minus += full; seg_m.append((x0, x1))
            continue
        if y0 >= -1e-12 and y1 >= -1e-12:
            if max(y0, y1) > 1e-12: plus += full; seg_p.append((x0, x1))
        elif y0 <= 1e-12 and y1 <= 1e-12:
            minus += full; seg_m.append((x0, x1))
        else:
            xz = x0 + (x1 - x0) * y0 / (y0 - y1)
            a0, a1 = 0.5 * y0 * (xz - x0), 0.5 * y1 * (x1 - xz)
            if y0 > 0: plus += a0; minus += a1; seg_p.append((x0, xz)); seg_m.append((xz, x1))
            else: minus += a0; plus += a1; seg_m.append((x0, xz)); seg_p.append((xz, x1))
    def merge(segs):
        out = []
        for s in segs:
            if out and abs(out[-1][1] - s[0]) < 1e-9: out[-1] = (out[-1][0], s[1])
            else: out.append(s)
        return [[float(a), float(b)] for a, b in out]
    return plus, minus, merge(seg_p), merge(seg_m)


def area_to_front(xs, eta_row, front):
    """Integral of the influence line from the left end to x = front: a crowd that has walked that far."""
    t = 0.0
    for x0, x1, y0, y1 in zip(xs[:-1], xs[1:], eta_row[:-1], eta_row[1:]):
        if front <= x0: break
        xe = min(front, x1); ye = y0 + (y1 - y0) * (xe - x0) / (x1 - x0)
        t += 0.5 * (y0 + ye) * (xe - x0)
    return t


def brute_areas(xs, eta_row, n=3000):
    """The same two areas by loading n short lengths of deck one at a time and keeping each on its own sign."""
    span = xs[-1] - xs[0]; dx = span / n
    mid = xs[0] + (np.arange(n) + 0.5) * dx
    y = np.interp(mid, xs, eta_row) * dx
    return float(y[y > 0].sum()), float(y[y < 0].sum())


# ---------------------------------------------------------------- strength
def e3_fcr(Fy, E, slender, limit_const=4.71):
    Fe = math.pi ** 2 * E / slender ** 2
    return 0.658 ** (Fy / Fe) * Fy if slender <= limit_const * math.sqrt(E / Fy) else 0.877 * Fe


def e3_continuity(Fy, E, limit_const=4.71):
    s = limit_const * math.sqrt(E / Fy); Fe = math.pi ** 2 * E / s ** 2
    return abs(0.658 ** (Fy / Fe) * Fy - 0.877 * Fe) / Fy


def capacities(sec, L, limit_const=4.71):
    sl = L / sec["r"]
    return {"tension": P["phi_t"] * P["Fy"] * sec["A"], "compression": P["phi_c"] * e3_fcr(P["Fy"], P["E"], sl, limit_const) * sec["A"], "slenderness": sl}


def envelope(mdl, sections, tributary=None, patterned=True, dead_relief=True, whole_panels=False, crowd_factor=1.0, eta=None):
    """Per member: dead force, patterned areas, factored max and min, strengths, utilisation, governing arrangement."""
    ll = line_loads(tributary); w = ll["crowd"] * crowd_factor
    F = load_vector(mdl, udl_on_deck(mdl, ll["floor"]), steel_weights(mdl, sections))
    Ndc = forces_by_joints(mdl, F)
    eta = influence_lines(mdl) if eta is None else eta
    xs = np.array([mdl["joints"][j][0] for j in mdl["deck"]])
    rows = {}
    for k, m in enumerate(mdl["members"]):
        ap, am, sp, sm = signed_areas(xs, eta[k], whole_panels)
        full = ap + am
        if not patterned:
            ap, am = max(full, 0.0), min(full, 0.0); sp = sm = [[float(xs[0]), float(xs[-1])]]
        gmax = P["gamma_dc_max"]; gmin = P["gamma_dc_min"] if dead_relief else P["gamma_dc_max"]
        nd = float(Ndc[k])
        nmax = (gmax if nd > 0 else gmin) * nd + P["gamma_pl"] * w * ap
        nmin = (gmax if nd < 0 else gmin) * nd + P["gamma_pl"] * w * am
        sec = sections[m["group"]]; cap = capacities(sec, m["L"])
        ut, uc = max(nmax, 0.0) / cap["tension"], max(-nmin, 0.0) / cap["compression"]
        can_compress = nmin < -1e-6
        rows[m["id"]] = {"group": m["group"], "L": m["L"], "section": sec["name"], "N_dc": nd, "area_plus": ap, "area_minus": am, "area_full": full,
                         "N_max": nmax, "N_min": nmin, "cap_t": cap["tension"], "cap_c": cap["compression"], "slenderness": cap["slenderness"],
                         "slender_limit": P["slender_compression"] if can_compress else P["slender_tension"], "can_compress": can_compress,
                         "util_t": ut, "util_c": uc, "utilisation": max(ut, uc), "governs": "compression" if uc > ut else "tension",
                         "load_for_tension": sp, "load_for_compression": sm, "reverses": nmax > 1e-6 and nmin < -1e-6,
                         "N_service_full": nd + w * full}
    return rows


def wall_ok(sec):
    return sec["wall"] <= P["wall_limit_const"] * math.sqrt(P["E"] / P["Fy"])


def size(mdl, force=None, **kw):
    """Lightest catalogue section per group that passes strength and slenderness; repeat until the self-weight settles."""
    eta = influence_lines(mdl)
    sections = {g: CATALOGUE[0] for g in GROUPS}
    sections.update(force or {})
    history = []
    for it in range(12):
        new = dict(sections)
        for g in GROUPS:
            if force and g in force: continue
            for cand in CATALOGUE:
                if not wall_ok(cand): continue
                trial = dict(sections); trial[g] = cand
                rows = envelope(mdl, trial, eta=eta, **kw)
                if all(r["utilisation"] <= 1.0 and r["slenderness"] <= r["slender_limit"] for r in rows.values() if r["group"] == g):
                    new[g] = cand; break
            else:
                new[g] = CATALOGUE[-1]
        history.append({g: new[g]["name"] for g in GROUPS})
        if all(new[g]["name"] == sections[g]["name"] for g in GROUPS):
            break
        sections = new
    return sections, history


def areas_of(mdl, sections):
    return {m["id"]: sections[m["group"]]["A"] for m in mdl["members"]}


# ---------------------------------------------------------------- deflection
def midspan_joint(mdl):
    return f"B{mdl['n'] // 2}"


def deflection_stiffness(mdl, sections, F, joint=None):
    _, u = solve_stiffness(mdl, areas_of(mdl, sections), F)
    return -u[dof(mdl, joint or midspan_joint(mdl), 1)], u


def deflection_virtual_work(mdl, sections, F, joint=None):
    N = forces_by_joints(mdl, F); n = forces_by_joints(mdl, load_vector(mdl, {joint or midspan_joint(mdl): 1.0}))
    A = areas_of(mdl, sections)
    return float(sum(N[k] * n[k] * m["L"] / (P["E"] * A[m["id"]]) for k, m in enumerate(mdl["members"])))


# ---------------------------------------------------------------- mass and frequency
def nodal_masses(mdl, sections, crowd=0.0, g=None, weight_as_mass=False, tributary=None):
    """kg at each joint: steel with its allowance, the floor, and a fraction `crowd` of the pedestrian load as people."""
    g = P["g"] if g is None else g
    div = 1.0 if weight_as_mass else g
    ll = line_loads(tributary)
    F = load_vector(mdl, udl_on_deck(mdl, ll["floor"] + crowd * ll["crowd"]), steel_weights(mdl, sections))
    return {j: -F[dof(mdl, j, 1)] / div for j in mdl["names"]}


def frequencies(mdl, sections, masses, count=3):
    K = stiffness(mdl, areas_of(mdl, sections)); fr = free_dofs(mdl)
    mvec = np.array([masses[mdl["names"][d // 2]] for d in fr])
    S = K[np.ix_(fr, fr)] / np.sqrt(np.outer(mvec, mvec))
    w2, vec = np.linalg.eigh(S)
    out = []
    for i in range(count):
        phi = vec[:, i] / np.sqrt(mvec)
        vy = sum(mvec[q] * phi[q] ** 2 for q, d in enumerate(fr) if d % 2 == 1) / sum(mvec * phi ** 2)
        shape = np.zeros(K.shape[0]); shape[fr] = phi / np.abs(phi).max()
        out.append({"hz": float(math.sqrt(w2[i]) / (2 * math.pi)), "vertical_share": float(vy), "shape": shape})
    return out


def beam_frequency(mdl, sections, mass_per_m):
    At, Ab = sections["top"]["A"], sections["bottom"]["A"]
    I = At * Ab / (At + Ab) * mdl["h"] ** 2
    return math.pi / (2 * mdl["span"] ** 2) * math.sqrt(P["E"] * I / mass_per_m), I


# ---------------------------------------------------------------- the independent code
def opensees(mdl, sections, F, masses, area_override=None):
    import openseespy.opensees as ops
    ops.wipe(); ops.model("basic", "-ndm", 2, "-ndf", 2)
    tag = {j: i + 1 for i, j in enumerate(mdl["names"])}
    for j, (x, y) in mdl["joints"].items():
        ops.node(tag[j], x, y); ops.mass(tag[j], masses[j], masses[j])
    fix = {j: [0, 0] for j in mdl["names"]}
    for j, a in mdl["supports"]: fix[j][a] = 1
    for j, f in fix.items():
        if any(f): ops.fix(tag[j], *f)
    ops.uniaxialMaterial("Elastic", 1, P["E"])
    A = areas_of(mdl, sections); A.update(area_override or {})
    for k, m in enumerate(mdl["members"]):
        ops.element("Truss", k + 1, tag[m["a"]], tag[m["b"]], A[m["id"]], 1)
    lam = ops.eigen(3)
    ops.timeSeries("Linear", 1); ops.pattern("Plain", 1, 1)
    for j in mdl["names"]:
        fx, fy = F[dof(mdl, j, 0)], F[dof(mdl, j, 1)]
        if fx or fy: ops.load(tag[j], float(fx), float(fy))
    ops.system("BandSPD"); ops.numberer("RCM"); ops.constraints("Plain"); ops.integrator("LoadControl", 1.0)
    ops.algorithm("Linear"); ops.analysis("Static"); ops.analyze(1)
    N = np.array([ops.basicForce(k + 1)[0] for k in range(len(mdl["members"]))])
    mid = -ops.nodeDisp(tag[midspan_joint(mdl)], 2)
    ver = ops.version(); ops.wipe()
    return {"forces": N, "midspan": float(mid), "hz": [float(math.sqrt(l) / (2 * math.pi)) for l in lam], "version": ver}


# ---------------------------------------------------------------- judging
def judge(mdl, sections, rows, defl_pl, f1):
    r1 = max(rows.values(), key=lambda r: r["utilisation"])
    worst_sl = max(rows.values(), key=lambda r: r["slenderness"] / r["slender_limit"])
    return {"R1": {"pass": bool(r1["utilisation"] <= 1.0), "worst": r1["utilisation"]},
            "R2": {"pass": bool(all(r["slenderness"] <= r["slender_limit"] for r in rows.values()) and all(wall_ok(s) for s in sections.values())),
                   "worst_ratio": worst_sl["slenderness"] / worst_sl["slender_limit"]},
            "R3": {"pass": bool(defl_pl <= mdl["span"] / P["deflection_ratio"]), "deflection": defl_pl, "limit": mdl["span"] / P["deflection_ratio"]},
            "R4": {"pass": bool(f1 >= P["frequency_min"]), "hz": f1}}
