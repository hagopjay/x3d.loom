#!/usr/bin/env python3
"""Forward-kinematics witness: N random joint poses, link frames read from the X3D scene against MuJoCo's own URDF
compiler, plus planted controls that must fail.

  python3 fk_check.py ROBOT.urdf SCENE.x3d [--poses 100] [--seed 7] [--out receipt.json]

The X3D side reads only the X3D file: it writes the pose into each joint Transform (from the joint's urdf:joint
Metadata), then multiplies the Transforms down the tree. The MuJoCo side compiles the URDF itself (fusestatic off so
fixed links stay bodies; meshes stripped, kinematics only) and runs mj_kinematics. Compared per link: origin
distance and rotation angle between the two frames.
"""
from __future__ import annotations
import copy, hashlib, json, math, random, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

TOL_POS, TOL_ROT = 1e-9, 1e-9  # metres, radians


def t_matrix(t):
    tr = [float(v) for v in (t.get("translation") or "0 0 0").split()]
    x, y, z, a = [float(v) for v in (t.get("rotation") or "0 0 1 0").split()]
    s = [float(v) for v in (t.get("scale") or "1 1 1").split()]
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, sn, k = math.cos(a), math.sin(a), 1 - math.cos(a)
    R = np.array([[k * x * x + c, k * x * y - sn * z, k * x * z + sn * y],
                  [k * x * y + sn * z, k * y * y + c, k * y * z - sn * x],
                  [k * x * z - sn * y, k * y * z + sn * x, k * z * z + c]])
    M = np.eye(4); M[:3, :3] = R @ np.diag(s); M[:3, 3] = tr
    return M


def joint_meta(t):
    ms = next((m for m in t if m.tag == "MetadataSet" and m.get("name") == "urdf:joint"), None)
    if ms is None:
        return None
    out = {}
    for e in ms:
        v = e.get("value")
        out[e.get("name")] = v.strip('"') if e.tag == "MetadataString" else [float(x) for x in v.split()]
    return out


def pose_x3d(root, q):
    for t in root.iter("Transform"):
        jm = joint_meta(t)
        if jm is None or jm["type"] == "fixed" or t.get("DEF") not in q:
            continue
        ax = jm["axis"]; n = math.sqrt(sum(a * a for a in ax))
        if jm["type"] == "prismatic":
            t.set("translation", " ".join(repr(a / n * q[t.get("DEF")]) for a in ax))  # unit axis, as URDF
        else:
            t.set("rotation", " ".join(repr(a / n) for a in ax) + " " + repr(q[t.get("DEF")]))


def x3d_frames(root, link_names):
    frame = next(t for t in root.iter("Transform") if t.get("DEF") == "URDF_ZUP_TO_YUP")
    out = {}

    def walk(e, M):
        for c in e:
            if c.tag != "Transform":
                continue
            Mc = M @ t_matrix(c)
            if c.get("DEF") in link_names:
                out[c.get("DEF")] = Mc
            walk(c, Mc)
    walk(frame, np.eye(4))
    return out


def mujoco_model(urdf: Path):
    r = ET.parse(urdf).getroot()
    for l in r.findall("link"):
        for g in l.findall("visual") + l.findall("collision"):
            l.remove(g)
    for g in r.findall("gazebo") + r.findall("transmission"):
        r.remove(g)
    mj = r.find("mujoco") or ET.SubElement(r, "mujoco")
    ET.SubElement(mj, "compiler", {"fusestatic": "false", "discardvisual": "true", "balanceinertia": "true"})
    with tempfile.NamedTemporaryFile("w", suffix=".urdf", delete=False) as f:
        f.write(ET.tostring(r, encoding="unicode"))
    return mujoco.MjModel.from_xml_path(f.name)


def mujoco_frames(m, d, q, link_names):
    d.qpos[:] = 0
    for jn, v in q.items():
        jid = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, jn)
        d.qpos[m.jnt_qposadr[jid]] = v
    mujoco.mj_kinematics(m, d)
    out = {}
    for ln in link_names:
        bid = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, ln)
        if bid < 0:
            continue
        M = np.eye(4); M[:3, :3] = d.xmat[bid].reshape(3, 3); M[:3, 3] = d.xpos[bid]
        out[ln] = M
    return out


def compare(fa, fb):
    worst_p = worst_r = 0.0
    missing = [k for k in fa if k not in fb]
    for k in fa:
        if k not in fb:
            continue
        worst_p = max(worst_p, float(np.linalg.norm(fa[k][:3, 3] - fb[k][:3, 3])))
        Rr = fa[k][:3, :3].T @ fb[k][:3, :3]
        # angle of the relative rotation by atan2 (acos near 1 turns 1e-16 of rounding into 1e-8 rad)
        sk = np.array([Rr[2, 1] - Rr[1, 2], Rr[0, 2] - Rr[2, 0], Rr[1, 0] - Rr[0, 1]]) / 2
        worst_r = max(worst_r, math.atan2(float(np.linalg.norm(sk)), (np.trace(Rr) - 1) / 2))
    return worst_p, worst_r, missing


def run(urdf, scene_root, poses, seed, mutate=None):
    m = mujoco_model(urdf); d = mujoco.MjData(m)
    r = ET.parse(urdf).getroot()
    link_names = [l.get("name") for l in r.findall("link")]
    movable = {j.get("name"): j for j in r.findall("joint") if j.get("type") != "fixed"}
    rng = random.Random(seed)
    worst_p = worst_r = 0.0
    per_pose = []
    for i in range(poses):
        q = {}
        for jn, j in movable.items():
            lim = j.find("limit")
            lo, hi = (float(lim.get("lower")), float(lim.get("upper"))) if lim is not None and lim.get("lower") else (-math.pi, math.pi)
            q[jn] = 0.0 if i == 0 else rng.uniform(lo, hi)
        for jn, j in movable.items():  # URDF mimic: the follower is set from its leader on both sides
            mim = j.find("mimic")
            if mim is not None:
                q[jn] = float(mim.get("multiplier", "1")) * q[mim.get("joint")] + float(mim.get("offset", "0"))
        root = copy.deepcopy(scene_root)
        if mutate:
            mutate(root)
        pose_x3d(root, q)
        fx = x3d_frames(root, set(link_names))
        fm = mujoco_frames(m, d, q, link_names)
        p, rr, missing = compare(fm, fx)
        worst_p, worst_r = max(worst_p, p), max(worst_r, rr)
        per_pose.append([p, rr])
    return {"poses": poses, "links_compared": len(fm), "links_in_urdf": len(link_names), "missing_in_x3d": missing,
            "worst_position_m": worst_p, "worst_rotation_rad": worst_r,
            "pass": worst_p <= TOL_POS and worst_r <= TOL_ROT and not missing,
            "mujoco": mujoco.__version__, "bodies_in_mujoco": m.nbody - 1}


def flip_axis(root):  # one joint's axis sign reversed in its Metadata
    for t in root.iter("Transform"):
        jm = joint_meta(t)
        if jm and jm["type"] == "revolute":
            ms = next(m for m in t if m.tag == "MetadataSet")
            ax = next(e for e in ms if e.get("name") == "axis")
            ax.set("value", " ".join(repr(-float(v)) for v in ax.get("value").split()))
            return


def rpy_as_xyz_moving(root):  # one joint origin rotation composed in the wrong order (a classic rpy slip)
    for t in root.iter("Transform"):
        if t.get("DEF", "").endswith("__origin") and t.get("rotation"):
            x, y, z, a = [float(v) for v in t.get("rotation").split()]
            if abs(y - z) < 1e-6:  # swapping y and z would change nothing (an axis like 1 0 0): pick another joint
                continue
            t.set("rotation", f"{x} {z} {y} {a}")
            return
    raise StopIteration


def drop_fixed_offset(root):  # a fixed joint's origin lost
    for t in root.iter("Transform"):
        if t.get("DEF", "").endswith("__origin") and t.get("translation"):
            inner = next(c for c in t if c.tag == "Transform")
            jm = joint_meta(inner)
            if jm and jm["type"] == "fixed":
                del t.attrib["translation"]
                return
    raise StopIteration


def main():
    a = sys.argv
    urdf, scene = Path(a[1]), Path(a[2])
    poses = int(a[a.index("--poses") + 1]) if "--poses" in a else 100
    seed = int(a[a.index("--seed") + 1]) if "--seed" in a else 7
    root = ET.parse(scene).getroot()
    res = run(urdf, root, poses, seed)
    controls = []
    for label, fn in [("one joint axis reversed", flip_axis), ("one origin rotation axis permuted", rpy_as_xyz_moving),
                      ("one fixed joint offset dropped", drop_fixed_offset)]:
        try:
            r = run(urdf, root, min(poses, 20), seed, fn)
            controls.append({"control": label, "caught": not r["pass"], "worst_position_m": r["worst_position_m"]})
        except StopIteration:
            controls.append({"control": label, "caught": None, "note": "not applicable to this robot"})
    receipt = {"schema": "x3d.loom/urdf-fk-receipt/1", "urdf": urdf.name, "urdf_sha256": hashlib.sha256(urdf.read_bytes()).hexdigest(),
               "x3d": scene.name, "x3d_sha256": hashlib.sha256(scene.read_bytes()).hexdigest(), "seed": seed,
               "tolerance": {"position_m": TOL_POS, "rotation_rad": TOL_ROT}, "result": res, "controls": controls,
               "controls_caught": sum(1 for c in controls if c["caught"]), "controls_total": sum(1 for c in controls if c["caught"] is not None)}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
