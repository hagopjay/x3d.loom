"""X3D 4.0 writers for the footbridge and the reader that joins a scene back to the bank. Standard library plus numpy.

A member is one Transform (DEF = the member's id) whose translation is its midpoint and whose rotation turns +y onto the
member; inside it a Box of size (b, L, b). So a scene reads back to end points and section width with no knowledge of
the study. The truss at z = +half the deck width carries the names and the numbers; the far truss is drawn from the same
members and shares their materials. Deck, floor beams, overhead struts and abutments are drawn for context and are not
designed. No physics component is used.
"""
from __future__ import annotations
import math
import xml.etree.ElementTree as ET
import numpy as np


def _f(x, nd=6):
    s = f"{x:.{nd}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def v(p, nd=6):
    return " ".join(_f(c, nd) for c in p)


def y_to(d):
    d = np.asarray(d, float); d = d / np.linalg.norm(d)
    ax = np.cross([0, 1, 0], d); s = np.linalg.norm(ax)
    if s < 1e-12:
        return (1, 0, 0, 0.0 if d[1] > 0 else math.pi)
    return (*(ax / s), math.atan2(s, d[1]))


def rotate(axis_angle, p):
    ax = np.array(axis_angle[:3], float); a = axis_angle[3]
    n = np.linalg.norm(ax)
    if n < 1e-12:
        return np.array(p, float)
    ax /= n; p = np.array(p, float)
    return p * math.cos(a) + np.cross(ax, p) * math.sin(a) + ax * (ax @ p) * (1 - math.cos(a))


def look_at(pos, target):
    f = np.array(target, float) - np.array(pos, float); f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    R = np.column_stack([r, u, -f])
    ang = math.acos(max(-1, min(1, (np.trace(R) - 1) / 2)))
    if ang < 1e-9:
        return (0, 1, 0, 0)
    ax = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) / (2 * math.sin(ang))
    return (*ax, ang)


def ramp(u):
    """Utilisation 0..1 to colour: steel blue, teal, amber, red. The scale is fixed: 1.0 is the design strength."""
    u = max(0.0, min(1.0, u))
    stops = [(0.0, (0.25, 0.55, 0.95)), (0.5, (0.35, 0.85, 0.75)), (0.8, (0.98, 0.72, 0.20)), (1.0, (0.95, 0.20, 0.15))]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if u <= b:
            w = (u - a) / (b - a)
            return tuple(ca[i] + w * (cb[i] - ca[i]) for i in range(3))
    return stops[-1][1]


SIGN_FULL = 0.45    # a member at 0.45 of its design strength under unfactored load is drawn fully saturated


def signed(s):
    """Signed ratio force / design strength to colour: tension blue, near zero pale grey, compression red-orange."""
    t = max(-1.0, min(1.0, s / SIGN_FULL)); k = abs(t) ** 0.7
    base = (0.40, 0.42, 0.46); end = (0.10, 0.42, 1.0) if t > 0 else (1.0, 0.22, 0.08)
    return tuple(base[i] + k * (end[i] - base[i]) for i in range(3))


HEAD = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">\n'
        '<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd"><head>'
        '<meta name="title" content="{title}"/><meta name="description" content="{desc}"/><meta name="generator" content="x3d.engineering/footbridge/scenes.py"/>'
        '<meta name="warning" content="A worked study. Not a certified design and not for construction."/></head><Scene>\n')


def stage(views):
    out = ['<WorldInfo title="Footbridge study" info=\'"x3d.loom x3d.engineering/footbridge" "not for construction"\'/>',
           '<NavigationInfo type=\'"EXAMINE" "ANY"\' headlight="true"/>',
           '<Background skyColor="0.035 0.05 0.085 0.07 0.10 0.16 0.16 0.21 0.30" skyAngle="1.2 1.5708"/>',
           '<DirectionalLight direction="-0.35 -0.8 -0.5" intensity="0.55" ambientIntensity="0.3"/>',
           '<DirectionalLight direction="0.5 -0.3 0.8" intensity="0.2"/>']
    for name, pos, target, desc in views:
        o = look_at(pos, target)
        out.append(f'<Viewpoint DEF="{name}" description="{desc}" position="{v(pos, 3)}" orientation="{v(o[:3], 5)} {_f(o[3], 5)}" centerOfRotation="{v(target, 3)}" fieldOfView="0.6"/>')
    return out


def box(size, at, colour, spec="0.25 0.25 0.25", shin=0.3, transparency=0.0, deff=None):
    d = f' DEF="{deff}"' if deff else ""
    tr = f' transparency="{_f(transparency)}"' if transparency else ""
    return (f'<Transform{d} translation="{v(at)}"><Shape><Appearance><Material diffuseColor="{colour}" specularColor="{spec}" shininess="{_f(shin)}"{tr}/></Appearance>'
            f'<Box size="{v(size)}"/></Shape></Transform>')


def context(mdl, half):
    """Deck, floor beams, overhead struts, abutments: drawn, not designed."""
    L, h, n, a = mdl["span"], mdl["h"], mdl["n"], mdl["a"]
    out = ['<Group DEF="Context">', box((L, 0.10, 2 * half - 0.25), (L / 2, 0.16, 0), "0.42 0.36 0.30", "0.1 0.1 0.1", 0.1)]
    for i in range(n + 1):
        out.append(box((0.10, 0.16, 2 * half), (i * a, 0.02, 0), "0.36 0.38 0.42"))
    for i in range(1, n):
        out.append(box((0.07, 0.07, 2 * half), (i * a, h, 0), "0.36 0.38 0.42"))
    for x in (-0.9, L + 0.9):
        out.append(box((1.8, 1.6, 2 * half + 1.6), (x, -0.95, 0), "0.30 0.31 0.33", "0.05 0.05 0.05", 0.05))
    out.append("</Group>")
    return out


def meta(m_id, row):
    ms = lambda n, val: f'<MetadataString containerField="value" name="{n}" value=\'"{val}"\'/>'
    md = lambda n, val: f'<MetadataDouble containerField="value" name="{n}" value="{val!r}"/>'
    return (f'<MetadataSet containerField="metadata" name="LoomFootbridge">{ms("Member", m_id)}{ms("Group", row["group"])}{ms("Section", row["section"])}'
            f'{md("LengthM", row["L"])}{md("DeadN", row["N_dc"])}{md("DemandMaxN", row["N_max"])}{md("DemandMinN", row["N_min"])}'
            f'{md("TensionStrengthN", row["cap_t"])}{md("CompressionStrengthN", row["cap_c"])}{md("Slenderness", row["slenderness"])}'
            f'{md("Utilisation", row["utilisation"])}{ms("Governs", row["governs"])}{ms("Reverses", "yes" if row["reverses"] else "no")}</MetadataSet>')


def members(mdl, rows, widths, half, colour_of, animated=False):
    out = ['<Group DEF="Truss">']
    for m in mdl["members"]:
        pa, pb = np.array(mdl["joints"][m["a"]]), np.array(mdl["joints"][m["b"]])
        mid = (pa + pb) / 2; d = np.array([pb[0] - pa[0], pb[1] - pa[1], 0.0]); rot = y_to(d)
        b = widths[m["group"]]; c = colour_of(m["id"])
        for z, far in ((half, False), (-half, True)):
            deff = m["id"] + ("_far" if far else "")
            mat = (f'<Material USE="mat_{m["id"]}"/>' if far else
                   f'<Material DEF="mat_{m["id"]}" diffuseColor="{v(c, 4)}" specularColor="0.12 0.12 0.12" shininess="0.2"/>')
            md = "" if far else meta(m["id"], rows[m["id"]])
            out.append(f'<Transform DEF="{deff}" translation="{v((mid[0], mid[1], z))}" rotation="{v(rot[:3])} {_f(rot[3])}">{md}'
                       f'<Shape><Appearance>{mat}</Appearance><Box size="{v((b, m["L"], b))}"/></Shape></Transform>')
    out.append("</Group>")
    return out


VIEWS = lambda L, h: [("Side", (L / 2, 1.6, 30), (L / 2, 0.9, 0), "Side elevation"),
                      ("Quarter", (-7, 6.5, 17), (L / 2 - 2.5, 0.6, 0), "From the left bank"),
                      ("Deck", (-5.5, 1.9, 0.4), (L / 2, 1.3, 0), "Walking on"),
                      ("Above", (L / 2, 40, 0.01), (L / 2, 0, 0), "Plan")]


def design_scene(mdl, bank):
    L, h = mdl["span"], mdl["h"]; half = bank["params"]["deck_width"] / 2
    rows = bank["members"]; widths = {g: s["b"] for g, s in bank["sections"].items()}
    out = [HEAD.format(title="Footbridge, 30 m Pratt truss: utilisation under the patterned crowd",
                       desc="Each member coloured by utilisation (factored demand over design strength, fixed scale, red = 1.0). Member numbers are metadata on the near truss. Deck, floor beams, overhead struts and abutments are drawn for context and not designed.")]
    out += stage(VIEWS(L, h)) + context(mdl, half) + members(mdl, rows, widths, half, lambda i: ramp(rows[i]["utilisation"]))
    out.append("</Scene></X3D>\n")
    return "\n".join(out)


def walk_scene(mdl, bank, period=12.0):
    """The crowd fills the deck from the left; every member's colour follows its unfactored force over its design strength."""
    L, h = mdl["span"], mdl["h"]; half = bank["params"]["deck_width"] / 2
    rows = bank["members"]; widths = {g: s["b"] for g, s in bank["sections"].items()}
    walk = bank["walk"]; fronts = walk["fronts"]; n = len(fronts)
    move, hold = 0.75, 0.92                     # fraction of the cycle spent advancing, then holding full, then empty again
    keys = [move * i / (n - 1) for i in range(n)] + [hold, hold + 0.02, 1.0]
    ratio = lambda i, q: (walk["force"][i][q] / rows[i]["cap_t"]) if walk["force"][i][q] >= 0 else (walk["force"][i][q] / rows[i]["cap_c"])
    out = [HEAD.format(title="Footbridge: a crowd walks on from the left",
                       desc=f"A {period:g} s loop: the crowd advances from 0 to 30 m, holds, clears. Colour is unfactored force over design strength: blue tension, red compression, saturated at {SIGN_FULL}. Colours are keyed from {n} static solutions; nothing is simulated in the scene.")]
    out += stage(VIEWS(L, h)) + context(mdl, half)
    out += members(mdl, rows, widths, half, lambda i: signed(ratio(i, 0)))
    out.append(f'<TimeSensor DEF="Clock" cycleInterval="{_f(period)}" loop="true"/>')
    w = 2 * half - 0.3
    out.append(f'<Transform DEF="Crowd" translation="0 0.95 0" scale="0.0001 1 1"><Shape><Appearance><Material diffuseColor="0.98 0.80 0.30" emissiveColor="0.25 0.18 0.03" transparency="0.62"/></Appearance><Box size="1 1.5 {_f(w)}"/></Shape></Transform>')
    xs = [max(f, 1e-4) for f in fronts]
    pos = [(x / 2, 0.95, 0) for x in xs] + [(L / 2, 0.95, 0), (0, 0.95, 0), (0, 0.95, 0)]
    scl = [(x, 1, 1) for x in xs] + [(L, 1, 1), (1e-4, 1, 1), (1e-4, 1, 1)]
    ks = " ".join(_f(k) for k in keys)
    out.append(f'<PositionInterpolator DEF="CrowdAt" key="{ks}" keyValue="{", ".join(v(p) for p in pos)}"/>')
    out.append(f'<PositionInterpolator DEF="CrowdSize" key="{ks}" keyValue="{", ".join(v(p) for p in scl)}"/>')
    out.append('<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="CrowdAt" toField="set_fraction"/><ROUTE fromNode="CrowdAt" fromField="value_changed" toNode="Crowd" toField="set_translation"/>')
    out.append('<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="CrowdSize" toField="set_fraction"/><ROUTE fromNode="CrowdSize" fromField="value_changed" toNode="Crowd" toField="set_scale"/>')
    for m in mdl["members"]:
        i = m["id"]
        cols = [signed(ratio(i, q)) for q in range(n)]; cols += [cols[-1], cols[0], cols[0]]
        out.append(f'<ColorInterpolator DEF="col_{i}" key="{ks}" keyValue="{", ".join(v(c, 4) for c in cols)}"/>')
        out.append(f'<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="col_{i}" toField="set_fraction"/><ROUTE fromNode="col_{i}" fromField="value_changed" toNode="mat_{i}" toField="set_diffuseColor"/>')
    out.append("</Scene></X3D>\n")
    return "\n".join(out)


def read_scene(path, edit=None):
    """Member id -> end points (near truss), box width, and the metadata numbers. edit: {(id, name): value} planted."""
    root = ET.parse(path).getroot(); out = {}
    for t in root.iter("Transform"):
        ms = t.find("MetadataSet")
        if ms is None or ms.get("name") != "LoomFootbridge":
            continue
        i = t.get("DEF")
        tr = np.array(t.get("translation").split(), float); r = [float(x) for x in t.get("rotation").split()]
        size = [float(x) for x in t.find("Shape/Box").get("size").split()]
        half = rotate(r, (0, size[1] / 2, 0))
        vals = {}
        for c in ms:
            val = c.get("value")
            vals[c.get("name")] = float(val) if c.tag == "MetadataDouble" else val.strip('"')
        for (mi, name), val in (edit or {}).items():
            if mi == i: vals[name] = val
        out[i] = {"a": (tr - half)[:2], "b": (tr + half)[:2], "z": tr[2], "width": size[0], "meta": vals}
    return out
