#!/usr/bin/env python3
"""Four-bar crank-rocker: closed form, an independent Newton solver, statics, margins, and the X3D scenes.

Standard library only. Every length is in metres, every angle in radians, forces in newtons, stresses in pascals.
The card (card.json) is the single source of every parameter and limit; nothing is typed twice.

  python3 -I fourbar.py build     writes bank/*.json and scenes/*.x3d
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CARD = json.loads((HERE / "card.json").read_text())
P = {k: v["value"] for k, v in CARD["params"].items()}


def wrap(x: float) -> float:
    return (x + math.pi) % (2 * math.pi) - math.pi


# ---- rung 1: closed form by circle intersection (open branch, C above the line B-D) ----
def closed_form(th2: float, a: float, b: float, c: float, d: float, branch: int = +1):
    bx, by = a * math.cos(th2), a * math.sin(th2)
    ux, uy = bx - d, by                       # from D to B
    f = math.hypot(ux, uy)
    if f > b + c or f < abs(b - c):
        return None                           # cannot be assembled at this crank angle
    ux, uy = ux / f, uy / f
    x = (f * f + c * c - b * b) / (2 * f)
    h = math.sqrt(max(0.0, c * c - x * x))
    # normal chosen so that branch +1 puts C on the +y side when the crank is at 0
    cx, cy = d + x * ux - branch * h * uy, x * uy + branch * h * ux
    return {"th3": math.atan2(cy - by, cx - bx), "th4": math.atan2(cy, cx - d), "B": (bx, by), "C": (cx, cy)}


# ---- rung 2: an independent path, Newton on the vector loop  a e^{i th2} + b e^{i th3} - c e^{i th4} - d = 0 ----
def newton_loop(th2: float, guess, a, b, c, d, tol=1e-14, itmax=60):
    t3, t4 = guess
    for _ in range(itmax):
        fx = a * math.cos(th2) + b * math.cos(t3) - c * math.cos(t4) - d
        fy = a * math.sin(th2) + b * math.sin(t3) - c * math.sin(t4)
        j11, j12 = -b * math.sin(t3), c * math.sin(t4)
        j21, j22 = b * math.cos(t3), -c * math.cos(t4)
        det = j11 * j22 - j12 * j21
        d3, d4 = (-fx * j22 + fy * j12) / det, (-j11 * fy + j21 * fx) / det
        t3, t4 = t3 + d3, t4 + d4
        if abs(d3) + abs(d4) < tol:
            break
    return wrap(t3), wrap(t4)


def freudenstein_residual(th2, th4, a, b, c, d):
    k1, k2, k3 = d / a, d / c, (a * a - b * b + c * c + d * d) / (2 * a * c)
    return k1 * math.cos(th4) - k2 * math.cos(th2) + k3 - math.cos(th2 - th4)


def transmission_angle(th2, a, b, c, d):
    """Angle between coupler and rocker at C, in [0, pi]. Its distance from pi/2 is what costs force."""
    f2 = a * a + d * d - 2 * a * d * math.cos(th2)
    return math.acos(max(-1.0, min(1.0, (b * b + c * c - f2) / (2 * b * c))))


def velocity_ratios(th2, k, a, b, c):
    """(omega3/omega2, omega4/omega2) from the loop equation differentiated once."""
    t3, t4 = k["th3"], k["th4"]
    return (a * math.sin(t4 - th2) / (b * math.sin(t3 - t4)), a * math.sin(th2 - t3) / (c * math.sin(t4 - t3)))


def grashof(a, b, c, d):
    L = sorted([a, b, c, d])
    return {"s_plus_l": L[0] + L[3], "p_plus_q": L[1] + L[2], "grashof": L[0] + L[3] <= L[1] + L[2] + 1e-12,
            "crank_is_shortest": abs(a - L[0]) < 1e-12, "margin_m": (L[1] + L[2]) - (L[0] + L[3])}


# ---- statics and margins ----
def coupler_force(th2, T_out, a, b, c, d):
    """Axial force in the coupler (a two-force member) holding a torque T_out on the rocker: F = T / (c sin mu)."""
    return T_out / (c * math.sin(transmission_angle(th2, a, b, c, d)))


def capacities():
    Fy, E, FS = P["Fy"], P["E"], P["FS"]
    w, t, dp, L = P["coupler_w"], P["coupler_t"], P["pin_d"], P["b"]
    A, Imin = w * t, w * t ** 3 / 12
    return {
        "coupler_yield_N": Fy * A / FS,
        "coupler_buckling_N": math.pi ** 2 * E * Imin / L ** 2 / FS,          # Euler, pinned-pinned, K = 1
        "pin_double_shear_N": 2 * (math.pi * dp ** 2 / 4) * (Fy / math.sqrt(3)) / FS,   # shear yield Fy / sqrt(3)
        "section": {"A_m2": A, "Imin_m4": Imin, "slenderness_L_over_r": L / math.sqrt(Imin / A)},
    }


def kinematics_bank(a, b, c, d, n=360):
    rows, guess = [], None
    for i in range(n):
        th2 = 2 * math.pi * i / n
        k = closed_form(th2, a, b, c, d)
        if k is None:
            rows.append({"deg": i, "assembles": False}); continue
        if guess is None:
            guess = (k["th3"] + 0.05, k["th4"] - 0.05)      # near, not equal: Newton must do work
        n3, n4 = newton_loop(th2, guess, a, b, c, d); guess = (n3, n4)
        r3, r4 = velocity_ratios(th2, k, a, b, c)
        rows.append({"deg": i, "assembles": True, "th3": k["th3"], "th4": k["th4"], "newton_th3": n3, "newton_th4": n4,
                     "freudenstein": freudenstein_residual(th2, k["th4"], a, b, c, d),
                     "mu": transmission_angle(th2, a, b, c, d), "w3_over_w2": r3, "w4_over_w2": r4})
    return rows


# ---- X3D scenes ----
def _f(x):
    s = f"{x:.9g}"
    return "0" if s == "-0" else s


RHO, BAR_Y, BAR_Z, DZ = 7850.0, 0.03, 0.01, 0.02          # steel bars 30 x 10 mm, one z layer per link


def physics_scene(title, a, b, c, d, omega2, th2_0=math.radians(60), pins="ball"):
    """Plain X3D 4.0 RigidBodyPhysics, no script: three bars and a fixed frame, four pins, no gravity.
    Initial velocities come from the closed form so that the loop starts consistent.

    pins="ball": the two full-turn pins (A and B) are BallJoints and the two swinging pins (C and D) are
    SingleAxisHingeJoints. X3D 4.0 clause 37.4.12 says a hinge "may not travel more than pi radians ... in either
    direction from its initial position", so a hinge cannot be a crank pin. pins="hinge": four hinges (the control)."""
    k = closed_form(th2_0, a, b, c, d)
    r3, r4 = velocity_ratios(th2_0, k, a, b, c)
    w3, w4 = r3 * omega2, r4 * omega2
    (bx, by), (cx, cy) = k["B"], k["C"]

    def body(name, x0, y0, x1, y1, z, length, w, vref):
        mx, my, ang = (x0 + x1) / 2, (y0 + y1) / 2, math.atan2(y1 - y0, x1 - x0)
        vx, vy = vref[0] - w * (my - vref[2]), vref[1] + w * (mx - vref[3])       # v = v_ref + w x r
        mass = RHO * length * BAR_Y * BAR_Z
        return (f'<RigidBody DEF="{name}" position="{_f(mx)} {_f(my)} {_f(z)}" orientation="0 0 1 {_f(ang)}" mass="{_f(mass)}" '
                f'linearVelocity="{_f(vx)} {_f(vy)} 0" angularVelocity="0 0 {_f(w)}" autoDamp="false" autoDisable="false">'
                f'<CollidableShape containerField="geometry"><Shape containerField="shape"><Appearance><Material diffuseColor="0.6 0.65 0.7"/></Appearance>'
                f'<Box size="{_f(length)} {BAR_Y} {BAR_Z}"/></Shape></CollidableShape></RigidBody>')

    vB = (-omega2 * by, omega2 * bx)
    crank = body("Crank", 0, 0, bx, by, 0.0, a, omega2, (0, 0, 0, 0))
    coupler = body("Coupler", bx, by, cx, cy, DZ, b, w3, (vB[0], vB[1], by, bx))
    rocker = body("Rocker", d, 0, cx, cy, 2 * DZ, c, w4, (0, 0, 0, d))
    frame = ('<RigidBody DEF="Frame" position="0.5 -0.6 -0.2" mass="1" fixed="true"><CollidableShape containerField="geometry">'
             '<Shape containerField="shape"><Appearance><Material diffuseColor="0.3 0.3 0.3"/></Appearance><Box size="1.2 0.05 0.05"/></Shape></CollidableShape></RigidBody>')

    def hinge(name, x, y, z, b1, b2):
        return (f'<SingleAxisHingeJoint DEF="{name}" containerField="joints" anchorPoint="{_f(x)} {_f(y)} {_f(z)}" axis="0 0 1">'
                f'<RigidBody USE="{b1}" containerField="body1"/><RigidBody USE="{b2}" containerField="body2"/></SingleAxisHingeJoint>')

    def ball(name, x, y, z, b1, b2):
        return (f'<BallJoint DEF="{name}" containerField="joints" anchorPoint="{_f(x)} {_f(y)} {_f(z)}">'
                f'<RigidBody USE="{b1}" containerField="body1"/><RigidBody USE="{b2}" containerField="body2"/></BallJoint>')

    # a ball pin sits on the crank's own axis (z = 0) at both ends, so the crank's free spin about that axis moves nothing else
    full_turn = ball if pins == "ball" else hinge
    joints = (full_turn("PinA", 0, 0, 0, "Frame", "Crank") + full_turn("PinB", bx, by, 0.0 if pins == "ball" else DZ / 2, "Crank", "Coupler")
              + hinge("PinC", cx, cy, 1.5 * DZ, "Coupler", "Rocker") + hinge("PinD", d, 0, 2 * DZ, "Rocker", "Frame"))
    meta = (f'<meta name="title" content="{title}"/><meta name="description" content="Four-bar a={a} b={b} c={c} d={d} m, crank speed {omega2} rad/s at 60 deg, pins {pins}, no gravity. Units: metres, radians, kilograms."/>'
            '<meta name="generator" content="x3d.engineering/fourbar/fourbar.py"/>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">\n'
            '<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">'
            f'<head><component name="RigidBodyPhysics" level="2"/>{meta}</head><Scene>\n'
            '<NavigationInfo type=\'"EXAMINE" "ANY"\'/><Viewpoint description="Front" position="0.5 0.2 2.6"/>\n'
            f'<RigidBodyCollection DEF="World" gravity="0 0 0" iterations="20"><CollisionCollection containerField="collider" bounce="0"/>'
            f'{frame}{crank}{coupler}{rocker}{joints}</RigidBodyCollection>\n</Scene></X3D>\n')


def build():
    a, b, c, d = P["a"], P["b"], P["c"], P["d"]
    (HERE / "bank").mkdir(exist_ok=True); (HERE / "scenes").mkdir(exist_ok=True)
    rows = kinematics_bank(a, b, c, d)
    cap = capacities()
    T = P["T_out"]
    forces = [abs(coupler_force(math.radians(r["deg"]), T, a, b, c, d)) for r in rows]
    worst = max(range(len(rows)), key=lambda i: forces[i])
    bank = {"schema": "loom.eng-bank/1", "params": P, "grashof": grashof(a, b, c, d), "rows": rows, "capacities": cap,
            "coupler_force_N": forces, "worst_case": {"deg": rows[worst]["deg"], "force_N": forces[worst], "mu_deg": math.degrees(rows[worst]["mu"])}}
    (HERE / "bank" / "kinematics.json").write_text(json.dumps(bank, indent=1))
    cases = []
    for w in CARD["envelope"]["crank_speeds_rad_s"]:
        name = f"fourbar-w{w:g}"
        (HERE / "scenes" / f"{name}.x3d").write_text(physics_scene(name, a, b, c, d, w))
        cases.append({"id": name, "kind": "design", "omega2": w, "links": [a, b, c, d]})
    for m in CARD["controls"]["scene_mutants"]:
        la, lb, lc, ld = [m["links"].get(k, P[k]) for k in "abcd"]
        (HERE / "scenes" / f"{m['id']}.x3d").write_text(physics_scene(m["id"], la, lb, lc, ld, m["omega2"], pins=m.get("pins", "ball")))
        cases.append({"id": m["id"], "kind": "mutant", "omega2": m["omega2"], "links": [la, lb, lc, ld], "expect_fail": m["expect_fail"], "pins": m.get("pins", "ball")})
    (HERE / "bank" / "cases.json").write_text(json.dumps(cases, indent=1))
    print(f"bank: {len(rows)} crank angles; scenes: {len(cases)}; worst case {bank['worst_case']}")


if __name__ == "__main__":
    if sys.argv[1:] == ["build"]:
        build()
    else:
        print(__doc__)
