#!/usr/bin/env python3
"""X3D 4.0 writers and the reader that joins a scene back to the bank. Standard library plus numpy.

A member is one Transform (DEF = the member's id) whose translation is the member's midpoint and whose rotation turns
+y onto the member; inside it a second Transform scales a unit-height Cylinder to the member's length. So a scene can be
read back to end points without knowing anything about the study. Cables are drawn at twice their true diameter
(3 mm would not show at this scale); struts and joints are drawn true. No physics component is used.
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
    """Axis-angle turning +y onto the unit vector d."""
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
    """Viewpoint orientation looking from pos at target with +y up."""
    f = np.array(target, float) - np.array(pos, float); f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    R = np.column_stack([r, u, -f])
    ang = math.acos(max(-1, min(1, (np.trace(R) - 1) / 2)))
    if ang < 1e-9:
        return (0, 1, 0, 0)
    ax = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) / (2 * math.sin(ang))
    return (*ax, ang)


def ramp(u):
    """Utilisation 0..1 to colour: steel blue, amber, red."""
    u = max(0.0, min(1.0, u))
    stops = [(0.0, (0.25, 0.55, 0.95)), (0.5, (0.35, 0.85, 0.75)), (0.8, (0.98, 0.72, 0.20)), (1.0, (0.95, 0.20, 0.15))]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if u <= b:
            w = (u - a) / (b - a)
            return tuple(ca[i] + w * (cb[i] - ca[i]) for i in range(3))
    return stops[-1][1]


HEAD = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">\n'
        '<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd"><head>'
        '<meta name="title" content="{title}"/><meta name="description" content="{desc}"/><meta name="generator" content="x3d.engineering/tensegrity/scenes.py"/>'
        '<meta name="warning" content="A worked study. Not a certified design and not for manufacture."/></head><Scene>\n')
LOOKS = {"strut": ("0.86 0.42 0.30", "0.55 0.5 0.5", 0.45), "side": ("0.30 0.62 0.98", "0.4 0.4 0.4", 0.3), "top": ("0.42 0.86 0.80", "0.4 0.4 0.4", 0.3),
         "bottom": ("0.55 0.50 0.95", "0.4 0.4 0.4", 0.3), "cable": ("0.30 0.62 0.98", "0.4 0.4 0.4", 0.3)}
R_STRUT, R_CABLE_DRAWN, R_JOINT = 0.0125, 0.003, 0.02


def stage(center, radius, views):
    cx, cy, cz = center
    out = ('<Background skyColor="0.035 0.05 0.085, 0.07 0.10 0.16, 0.16 0.20 0.28, 0.09 0.11 0.15, 0.05 0.06 0.08" skyAngle="1.2, 1.5708, 1.75, 3.14159265"/>'
           '<NavigationInfo type=\'"EXAMINE" "ANY"\' headlight="true"/>\n')
    for i, (name, desc, pos) in enumerate(views):
        o = look_at(pos, center) if name != "Top" else (1, 0, 0, -math.pi / 2)
        out += f'<Viewpoint DEF="View{name}" description="{desc}" position="{v(pos, 4)}" orientation="{v(o[:3], 5)} {_f(o[3], 5)}" centerOfRotation="{v(center, 4)}"/>\n'
    out += ('<DirectionalLight direction="-0.45 -0.8 -0.4" intensity="0.9" color="1 0.97 0.92"/><DirectionalLight direction="0.6 -0.3 0.7" intensity="0.35" color="0.75 0.85 1"/>\n'
            + floor(cx, cz, radius))
    return out


def floor(cx, cz, radius, seg=96):
    """A flat disc just under y = 0, one convex polygon wound counter-clockwise seen from above (normal +y)."""
    pts = ", ".join(f"{_f(cx + radius * math.cos(2 * math.pi * k / seg), 4)} -0.022 {_f(cz - radius * math.sin(2 * math.pi * k / seg), 4)}" for k in range(seg))
    return ('<Shape><Appearance><Material diffuseColor="0.13 0.15 0.19" specularColor="0.08 0.08 0.08" shininess="0.1"/></Appearance>'
            f'<IndexedFaceSet solid="true" convex="true" coordIndex="{" ".join(str(k) for k in range(seg))} -1"><Coordinate point="{pts}"/></IndexedFaceSet></Shape>\n')


def meta_set(name, items):
    out = f'<MetadataSet containerField="metadata" name="{name}">'
    for k, val in items:
        if isinstance(val, str):
            out += f'<MetadataString containerField="value" name="{k}" value=\'"{val}"\'/>'
        else:
            out += f'<MetadataDouble containerField="value" name="{k}" value="{_f(val, 3) if abs(val) >= 1 or val == 0 else _f(val, 6)}"/>'
    return out + "</MetadataSet>"


def member_node(m, X, extra, material=None, anim=False):
    a, b = X[m["i"]], X[m["j"]]; d = b - a; l = float(np.linalg.norm(d)); rot = y_to(d)
    col, spec, shin = LOOKS[m["group"]]
    r = R_STRUT if m["kind"] == "strut" else R_CABLE_DRAWN
    mat = material or f'<Material{" DEF=" + chr(34) + m["id"] + "Mat" + chr(34) if anim else ""} diffuseColor="{col}" specularColor="{spec}" shininess="{_f(shin)}"/>'
    return (f'<Transform DEF="{m["id"]}" translation="{v((a + b) / 2)}" rotation="{v(rot[:3])} {_f(rot[3])}">'
            + meta_set("tensegrity.member", [("kind", m["kind"]), ("group", m["group"]), ("from", f'J{m["i"]}'), ("to", f'J{m["j"]}')] + extra)
            + f'<Transform{" DEF=" + chr(34) + m["id"] + "Len" + chr(34) if anim else ""} scale="1 {_f(l)} 1"><Shape><Appearance>{mat}</Appearance>'
            f'<Cylinder radius="{_f(r, 4)}" height="1"/></Shape></Transform></Transform>\n')


def joint_node(i, X, children=""):
    return (f'<Transform DEF="J{i}" translation="{v(X[i])}"><Shape><Appearance><Material diffuseColor="0.92 0.93 0.95" specularColor="0.6 0.6 0.6" shininess="0.6"/></Appearance>'
            f'<Sphere radius="{_f(R_JOINT)}"/></Shape>{children}</Transform>\n')


def static_scene(title, desc, X, M, forces, views, center, radius, extra_meta=None):
    """One shape, drawn at rest in its prestressed state. forces: {member id: {name: number}} written as metadata."""
    out = HEAD.format(title=title, desc=desc) + f'<WorldInfo title="{title}" info=\'"{desc}"\'/>\n' + stage(center, radius, views)
    for i in range(len(X)):
        out += joint_node(i, X)
    for m in M:
        out += member_node(m, X, list(forces.get(m["id"], {}).items()))
    return out + "</Scene></X3D>\n"


def press_scene(title, desc, X0, M, frames, util, views, center, radius, arrows, seconds=8.0):
    """The loaded shape played by interpolators. frames: joint positions per key (up the load ramp); the keys mirror back
    down. util: per frame, per member utilisation (0..1) for colour. arrows: joint indices that carry the load arrow."""
    seq = list(range(len(frames))) + list(range(len(frames) - 2, -1, -1))
    key = " ".join(_f(i / (len(seq) - 1)) for i in range(len(seq)))
    out = HEAD.format(title=title, desc=desc) + f'<WorldInfo title="{title}" info=\'"{desc}"\'/>\n' + stage(center, radius, views)
    out += f'<TimeSensor DEF="Clock" cycleInterval="{_f(seconds)}" loop="true"/>\n'
    # ghost of the unloaded shape
    coords = " ".join(v(p) for p in X0); idx = " ".join(f'{m["i"]} {m["j"]} -1' for m in M)
    out += (f'<Shape><Appearance><Material emissiveColor="0.75 0.8 0.9" transparency="0.72"/></Appearance>'
            f'<IndexedLineSet coordIndex="{idx}"><Coordinate point="{coords}"/></IndexedLineSet></Shape>\n')
    arrow = ('<Transform DEF="{d}" translation="0 0.03 0" scale="1 0.001 1"><Transform translation="0 0.13 0"><Shape><Appearance><Material diffuseColor="1 0.85 0.3" emissiveColor="0.5 0.4 0.1"/></Appearance>'
             '<Cylinder radius="0.006" height="0.2"/></Shape></Transform><Transform translation="0 0.015 0" rotation="1 0 0 3.14159265"><Shape><Appearance><Material diffuseColor="1 0.85 0.3" emissiveColor="0.5 0.4 0.1"/></Appearance>'
             '<Cone bottomRadius="0.016" height="0.045"/></Shape></Transform></Transform>')
    routes, interps = "", ""
    for i in range(len(X0)):
        out += joint_node(i, X0, arrow.format(d=f"Load{i}") if i in arrows else "")
        interps += f'<PositionInterpolator DEF="J{i}Pos" key="{key}" keyValue="{", ".join(v(frames[k][i]) for k in seq)}"/>\n'
        routes += f'<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="J{i}Pos" toField="set_fraction"/><ROUTE fromNode="J{i}Pos" fromField="value_changed" toNode="J{i}" toField="set_translation"/>'
    grow = ", ".join(f"1 {_f(max(0.001, k / (len(frames) - 1)))} 1" for k in seq)
    interps += f'<PositionInterpolator DEF="LoadGrow" key="{key}" keyValue="{grow}"/>\n'
    routes += '<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="LoadGrow" toField="set_fraction"/>' + "".join(
        f'<ROUTE fromNode="LoadGrow" fromField="value_changed" toNode="Load{i}" toField="set_scale"/>' for i in arrows)
    for n, m in enumerate(M):
        out += member_node(m, X0, [], anim=True)
        mids, rots, lens, cols = [], [], [], []
        for k in seq:
            a, b = frames[k][m["i"]], frames[k][m["j"]]; d = b - a; r = y_to(d)
            mids.append(v((a + b) / 2)); rots.append(f"{v(r[:3])} {_f(r[3])}"); lens.append(f"1 {_f(float(np.linalg.norm(d)))} 1")
            cols.append(v(ramp(util[k][n]), 3))
        mid = m["id"]
        interps += (f'<PositionInterpolator DEF="{mid}Pos" key="{key}" keyValue="{", ".join(mids)}"/><OrientationInterpolator DEF="{mid}Rot" key="{key}" keyValue="{", ".join(rots)}"/>'
                    f'<PositionInterpolator DEF="{mid}Scl" key="{key}" keyValue="{", ".join(lens)}"/><ColorInterpolator DEF="{mid}Col" key="{key}" keyValue="{", ".join(cols)}"/>\n')
        for src, dst, fld in ((f"{mid}Pos", mid, "set_translation"), (f"{mid}Rot", mid, "set_rotation"), (f"{mid}Scl", f"{mid}Len", "set_scale"), (f"{mid}Col", f"{mid}Mat", "set_diffuseColor")):
            routes += f'<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="{src}" toField="set_fraction"/><ROUTE fromNode="{src}" fromField="value_changed" toNode="{dst}" toField="{fld}"/>'
    return out + interps + routes + "\n</Scene></X3D>\n"


def read_scene(text):
    """Joints and members of a scene, by DEF: joint positions, member end points (from translation, rotation and the
    inner scale), and each member's metadata."""
    root = ET.fromstring(text); joints, members = {}, {}
    for t in root.iter("Transform"):
        d = t.get("DEF") or ""
        if d[:1] == "J" and d[1:].isdigit():
            joints[d] = np.array([float(x) for x in t.get("translation").split()])
        ms = t.find("MetadataSet")
        if ms is not None and ms.get("name") == "tensegrity.member":
            mid = np.array([float(x) for x in t.get("translation").split()]); rot = [float(x) for x in t.get("rotation").split()]
            l = float(t.find("Transform").get("scale").split()[1])
            half = rotate(rot, (0, l / 2, 0))
            md = {c.get("name"): (c.get("value").strip('"') if c.tag == "MetadataString" else float(c.get("value"))) for c in ms}
            members[d] = {"a": mid - half, "b": mid + half, "length": l, "meta": md}
    return joints, members
