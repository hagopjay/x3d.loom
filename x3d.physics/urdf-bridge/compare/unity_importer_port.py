#!/usr/bin/env python3
"""Unity Robotics URDF-Importer's import rules, ported line by line to numpy at Unity's float32, held to MuJoCo; and
the frame that importer uses, held against the two frames x3d.lab's io.x3d.unity gives the same robot via X3D.

  python3 unity_importer_port.py ROBOT.urdf [--poses 100] [--seed 7] [--out receipt.json]

Ported from Unity-Technologies/URDF-Importer (Apache-2.0), package 0.5.2-preview, branch main, read 28 Nov 2026:
  Ros2Unity(v)      = (-v.y, v.z, v.x)                          Runtime/Extensions/BuiltInExtensions.cs:103
  origin            = Translate(xyz.Ros2Unity()); Rotate(Euler(+pitch, -yaw, -roll) in degrees, float)
                                                                  Runtime/UrdfComponents/UrdfOrigin.cs
  revolute          = ArticulationBody about anchor x, anchorRotation = FromToRotation(x, -axis.Ros2Unity()),
                      drive target in degrees                     UrdfJointRevolute.cs AdjustMovement
  prismatic         = anchorRotation = FromToRotation(x, +axis.Ros2Unity()), target in metres   UrdfJointPrismatic.cs
Unity's Quaternion.Euler(x, y, z) turns z first, then x, then y. Unity is NOT run here: this is the importer's
arithmetic, so it says what the importer computes, not what a Unity build shows (Likely, not Confirmed).
"""
from __future__ import annotations
import hashlib, json, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent)); sys.path.insert(0, str(HERE))
import fk_check  # noqa: E402
import mujoco  # noqa: E402
from urdf_loader_check import poses_for  # noqa: E402

F = np.float32
P = np.array([[0, -1, 0], [0, 0, 1], [1, 0, 0]], dtype=np.float64)  # Ros2Unity as a matrix (det -1: a reflection)


def rot(axis, deg):
    a = np.asarray(axis, dtype=F); a = a / np.linalg.norm(a)
    t = F(math.radians(float(F(deg))))
    c, s, k = F(math.cos(t)), F(math.sin(t)), F(1 - math.cos(t))
    x, y, z = a
    return np.array([[k * x * x + c, k * x * y - s * z, k * x * z + s * y],
                     [k * x * y + s * z, k * y * y + c, k * y * z - s * x],
                     [k * x * z - s * y, k * y * z + s * x, k * z * z + c]], dtype=F)


def euler_unity(x, y, z):  # Quaternion.Euler: z first, then x, then y
    return rot([0, 1, 0], y) @ rot([1, 0, 0], x) @ rot([0, 0, 1], z)


def from_to(a, b):
    a = np.asarray(a, dtype=np.float64); b = np.asarray(b, dtype=np.float64)
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v, c = np.cross(a, b), float(a @ b)
    if c < -1 + 1e-9:  # opposite: 180 degrees about any perpendicular axis (Unity picks one; the motion axis is the same)
        p = np.cross(a, [0, 1, 0]) if abs(a[1]) < 0.9 else np.cross(a, [0, 0, 1])
        return rot(p, 180.0)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return (np.eye(3) + vx + vx @ vx / (1 + c)).astype(F)


def vec(s, d=0.0):
    v = [float(x) for x in (s or "").split()]
    return v + [d] * (3 - len(v))


CONTROL = {"swap_roll_pitch": False}


def unity_frames(urdf_root, q):
    """World 4x4 (Unity coordinates) of every link, following the importer's rules."""
    joints = urdf_root.findall("joint")
    child_of = {j.find("child").get("link"): j for j in joints}
    links = [l.get("name") for l in urdf_root.findall("link")]
    out = {}

    def world(name):
        if name in out:
            return out[name]
        j = child_of.get(name)
        if j is None:
            out[name] = np.eye(4, dtype=F); return out[name]
        o = j.find("origin")
        xyz, rpy = vec(o.get("xyz") if o is not None else None), vec(o.get("rpy") if o is not None else None)
        L = np.eye(4, dtype=F)
        L[:3, 3] = (P @ np.array(xyz)).astype(F)
        if CONTROL["swap_roll_pitch"]:  # planted control: roll and pitch swapped in the Euler call
            L[:3, :3] = euler_unity(-math.degrees(rpy[0]), -math.degrees(rpy[2]), math.degrees(rpy[1]))
        else:
            L[:3, :3] = euler_unity(math.degrees(rpy[1]), -math.degrees(rpy[2]), -math.degrees(rpy[0]))
        M = np.eye(4, dtype=F)
        jt = j.get("type")
        if jt != "fixed":
            ax = vec(j.find("axis").get("xyz") if j.find("axis") is not None else "1 0 0")
            au = P @ np.array(ax)
            v = q.get(j.get("name"), 0.0)
            if jt == "prismatic":
                A = from_to([1, 0, 0], au)
                M[:3, 3] = A @ np.array([F(v), 0, 0], dtype=F)
            else:
                A = from_to([1, 0, 0], -au)
                M[:3, :3] = A @ rot([1, 0, 0], math.degrees(v)) @ A.T
        out[name] = (world(j.find("parent").get("link")) @ L @ M).astype(F)
        return out[name]
    for n in links:
        world(n)
    return out


def to_ros(Mu):
    M = np.eye(4)
    M[:3, :3] = P.T @ Mu[:3, :3].astype(np.float64) @ P
    M[:3, 3] = P.T @ Mu[:3, 3].astype(np.float64)
    return M


def yaw_between(A, B):
    """Angle about Unity +y that takes frame map A (ROS->Unity, 3x3) to B: B = Ry(theta) A."""
    R = B @ A.T
    assert np.allclose(R[1], [0, 1, 0]) and abs(np.linalg.det(R) - 1) < 1e-9, R
    return math.degrees(math.atan2(R[0, 2], R[0, 0]))


def main():
    a = sys.argv
    urdf = Path(a[1])
    n = int(a[a.index("--poses") + 1]) if "--poses" in a else 100
    seed = int(a[a.index("--seed") + 1]) if "--seed" in a else 7
    root = ET.parse(urdf).getroot()
    poses, movable = poses_for(urdf, n, seed)
    mimic = sorted(j for j, e in movable.items() if e.find("mimic") is not None)
    m = fk_check.mujoco_model(urdf); d = mujoco.MjData(m)
    links = [l.get("name") for l in root.findall("link")]
    worst_p = worst_r = 0.0
    worst_p_nomimic = worst_r_nomimic = 0.0
    for q in poses:
        fm = fk_check.mujoco_frames(m, d, q, links)
        fu = {k: to_ros(v) for k, v in unity_frames(root, q).items()}
        p_, r_, _ = fk_check.compare(fm, fu)
        worst_p, worst_r = max(worst_p, p_), max(worst_r, r_)
        if mimic:  # the importer has no <mimic>: the follower stays where the joint-state stream (or 0) puts it
            q0 = {k: (0.0 if k in mimic else v) for k, v in q.items()}
            fu0 = {k: to_ros(v) for k, v in unity_frames(root, q0).items()}
            c0 = fk_check.compare(fm, fu0)
            worst_p_nomimic, worst_r_nomimic = max(worst_p_nomimic, c0[0]), max(worst_r_nomimic, c0[1])
    CONTROL["swap_roll_pitch"] = True
    cw = 0.0
    for q in poses[:20]:
        fm = fk_check.mujoco_frames(m, d, q, links)
        cw = max(cw, fk_check.compare(fm, {k: to_ros(v) for k, v in unity_frames(root, q).items()})[1])
    CONTROL["swap_roll_pitch"] = False
    # frames: the importer's ROS->Unity map vs our URDF bridge (X3D = Rx(-90) ROS) then io.x3d.unity (mirror Z or X)
    z_up_to_y_up = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)  # URDF_ZUP_TO_YUP, rotation 1 0 0 -pi/2
    mirror = {"Z (io.x3d.unity native)": np.diag([1, 1, -1]), "X (io.x3d.unity glTFast)": np.diag([-1, 1, 1])}
    yaw = {k: round(yaw_between(Mz @ z_up_to_y_up, P), 9) for k, Mz in mirror.items()}
    receipt = {"schema": "x3d.loom/unity-urdf-importer-port/1", "urdf": urdf.name, "urdf_sha256": hashlib.sha256(urdf.read_bytes()).hexdigest(),
               "ported_from": "Unity-Technologies/URDF-Importer main, package 0.5.2-preview (Apache-2.0)", "unity_run": False,
               "precision": "float32, as Unity Transform and ArticulationBody", "mujoco": mujoco.__version__, "poses": n, "seed": seed,
               "worst_position_m": worst_p, "worst_rotation_rad": worst_r,
               "mimic_joints": mimic, "worst_if_mimic_follower_not_driven": {"position_m": worst_p_nomimic, "rotation_rad": worst_r_nomimic} if mimic else None,
               "control_roll_pitch_swapped": {"worst_rotation_rad": cw, "caught": cw > 1e-4},
               "yaw_from_x3d_route_to_importer_deg": yaw}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
