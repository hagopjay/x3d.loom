#!/usr/bin/env python3
"""Replay witness: play an animated urdf2x3d scene (ros2_replay.py output) the way X3D 4.0 says interpolators run,
and compare every link frame with MuJoCo posed from the recording itself.

  python3 replay_check.py ROBOT.urdf RECORDING.mcap ANIMATED.x3d --base SCENE.x3d [--out receipt.json] [--mcap-reader PATH]

(SCENE.x3d is the un-animated urdf2x3d scene the animation was built from; the --no-split control is rebuilt from it.)

The X3D side reads only the X3D file: the TimeSensor's cycleInterval, the ROUTEs, each interpolator's key and
keyValue. OrientationInterpolator is SLERP along the shortest arc between neighbouring key rotations (19.4.7);
PositionInterpolator is linear. The reference is the recording: at each message time the message's joint values; at
each midpoint between two messages the joint-space linear mix of the two (what a joint trajectory means between its
samples). Both go through MuJoCo 4.0.1's own URDF compile, and link frames are compared as in fk_check.py.
Controls (planted edits to the animated file that must fail): keys not split for SLERP (a --no-split twin built
here), one ROUTE sent to the wrong joint, the keys shifted by one message.
"""
from __future__ import annotations
import copy, hashlib, json, math, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fk_check, ros2_replay  # noqa: E402

TOL_POS, TOL_ROT = 1e-9, 1e-9


def quat(ax, a):
    n = math.sqrt(sum(c * c for c in ax)) or 1.0
    s = math.sin(a / 2)
    return np.array([math.cos(a / 2), ax[0] / n * s, ax[1] / n * s, ax[2] / n * s])


def slerp(q0, q1, f):
    d = float(np.dot(q0, q1))
    if d < 0:                       # shortest arc
        q1, d = -q1, -d
    if d > 1 - 1e-15:
        q = q0 + f * (q1 - q0)
        return q / np.linalg.norm(q)
    th = math.acos(d)
    return (math.sin((1 - f) * th) * q0 + math.sin(f * th) * q1) / math.sin(th)


def to_axis_angle(q):
    w = max(-1.0, min(1.0, q[0]))
    a = 2 * math.atan2(float(np.linalg.norm(q[1:])), w)
    v = q[1:] / (np.linalg.norm(q[1:]) or 1.0)
    return v, a


def interp_value(node, f):
    keys = [float(k) for k in node.get("key").split()]
    vals = [[float(x) for x in kv.split()] for kv in node.get("keyValue").split(",")]
    if f <= keys[0]:
        return vals[0]
    if f >= keys[-1]:
        return vals[-1]
    i = max(k for k in range(len(keys) - 1) if keys[k] <= f)
    u = (f - keys[i]) / (keys[i + 1] - keys[i]) if keys[i + 1] > keys[i] else 0.0
    a, b = vals[i], vals[i + 1]
    if node.tag == "PositionInterpolator":
        return [x + u * (y - x) for x, y in zip(a, b)]
    v, ang = to_axis_angle(slerp(quat(a[:3], a[3]), quat(b[:3], b[3]), u))
    return list(v) + [ang]


def play(root, t):
    """Set every ROUTEd joint Transform to its interpolator's value at time t (one TimeSensor, loop)."""
    sc = root.find("Scene")
    ts = next(e for e in sc if e.tag == "TimeSensor" and e.get("DEF") == "REPLAY")
    T = float(ts.get("cycleInterval"))
    f = min(max(t / T, 0.0), 1.0)
    nodes = {e.get("DEF"): e for e in root.iter() if e.get("DEF")}
    for r in sc.findall("ROUTE"):
        if r.get("fromField") != "value_changed":
            continue
        val = interp_value(nodes[r.get("fromNode")], f)
        tgt = nodes[r.get("toNode")]
        if r.get("toField") == "set_rotation":
            tgt.set("rotation", " ".join(repr(float(x)) for x in val))
        else:
            tgt.set("translation", " ".join(repr(float(x)) for x in val))


def run(urdf, rows, root, joints):
    m = fk_check.mujoco_model(urdf)
    d = mujoco.MjData(m)
    link_names = [l.get("name") for l in ET.parse(urdf).getroot().findall("link")]
    tr, _, _ = ros2_replay.tracks(rows, joints)
    samples = []
    for k, (t, _) in enumerate(rows):
        samples.append(("key", t, {j: tr[j][k][1] for j in joints}))
        if k + 1 < len(rows):
            t1 = rows[k + 1][0]
            samples.append(("mid", (t + t1) / 2, {j: (tr[j][k][1] + tr[j][k + 1][1]) / 2 for j in joints}))
    worst = {"key": [0.0, 0.0], "mid": [0.0, 0.0]}
    for kind, t, q in samples:
        r = copy.deepcopy(root)
        play(r, t)
        fx = fk_check.x3d_frames(r, set(link_names))
        fm = fk_check.mujoco_frames(m, d, q, link_names)
        p, rr, missing = fk_check.compare(fm, fx)
        worst[kind] = [max(worst[kind][0], p), max(worst[kind][1], rr)]
    ok = all(w[0] <= TOL_POS and w[1] <= TOL_ROT for w in worst.values())
    return {"samples": len(samples), "messages": len(rows), "links": len(link_names),
            "worst_at_messages": {"position_m": worst["key"][0], "rotation_rad": worst["key"][1]},
            "worst_at_midpoints": {"position_m": worst["mid"][0], "rotation_rad": worst["mid"][1]}, "pass": ok}


def wrong_route(root):
    rs = [r for r in root.find("Scene").findall("ROUTE") if r.get("fromField") == "value_changed"]
    rs[0].set("toNode", rs[1].get("toNode"))


def shift_keys(root):
    for e in root.find("Scene"):
        if e.tag in ("OrientationInterpolator", "PositionInterpolator"):
            vals = e.get("keyValue").split(",")
            e.set("keyValue", ",".join(vals[1:] + vals[-1:]))


def main():
    a = sys.argv
    urdf, rec, anim = Path(a[1]), Path(a[2]), Path(a[3])
    reader = ros2_replay.load_reader(Path(a[a.index("--mcap-reader") + 1]) if "--mcap-reader" in a else ros2_replay.DEFAULT_READER)
    rows, rinfo = ros2_replay.read_joint_states(rec, "/joint_states", reader)
    root = ET.parse(anim).getroot()
    joints = ros2_replay.joints_of(root)
    res = run(urdf, rows, root, joints)
    controls = []
    with tempfile.TemporaryDirectory() as td:
        # the --no-split twin is built from the same un-animated scene the bridge wrote
        base = Path(a[a.index("--base") + 1])
        twin = Path(td) / "nosplit.x3d"
        ros2_replay.build(base, rows, twin, split_keys=False)
        r = run(urdf, rows, ET.parse(twin).getroot(), joints)
        controls.append({"control": "keys not split for SLERP (--no-split)", "caught": not r["pass"],
                         "worst_at_midpoints_m": r["worst_at_midpoints"]["position_m"],
                         "worst_at_midpoints_rad": r["worst_at_midpoints"]["rotation_rad"],
                         "note": None if not r["pass"] else "no step between messages reaches pi in this recording, so splitting changes nothing"})
    for label, fn in [("one ROUTE sent to the wrong joint", wrong_route), ("keys shifted by one message", shift_keys)]:
        rr = copy.deepcopy(root)
        fn(rr)
        r = run(urdf, rows, rr, joints)
        controls.append({"control": label, "caught": not r["pass"], "worst_at_messages_m": r["worst_at_messages"]["position_m"],
                         "worst_at_messages_rad": r["worst_at_messages"]["rotation_rad"]})
    receipt = {"schema": "x3d.loom/ros2-replay-receipt/1", "urdf": urdf.name, "recording": rec.name,
               "recording_sha256": hashlib.sha256(rec.read_bytes()).hexdigest(), "recording_info": rinfo,
               "x3d": anim.name, "x3d_sha256": hashlib.sha256(anim.read_bytes()).hexdigest(),
               "mujoco": mujoco.__version__, "tolerance": {"position_m": TOL_POS, "rotation_rad": TOL_ROT},
               "result": res, "controls": controls}
    if "--out" in a:
        Path(a[a.index("--out") + 1]).write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
