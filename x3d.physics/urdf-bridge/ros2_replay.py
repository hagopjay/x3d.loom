#!/usr/bin/env python3
"""ROS 2 /joint_states (an MCAP recording) -> X3D animation of a urdf2x3d scene.

  python3 ros2_replay.py RECORDING.mcap SCENE.x3d OUT.x3d [--topic /joint_states] [--mcap-reader PATH] [--no-split]

Decodes the recording with x3d_mcp's standard-library MCAP reader (ROS 2 CDR), then adds to the scene one TimeSensor
DEF="REPLAY" (cycleInterval = recording length, loop) and, per moving joint, an OrientationInterpolator (revolute,
continuous) or PositionInterpolator (prismatic) whose keys are the message times. ROUTEs carry REPLAY.fraction_changed
to each interpolator and value_changed to the joint Transform the bridge named after the joint.

The SLERP trap: OrientationInterpolator takes the shortest arc between two key rotations (X3D 4.0, 19.4.7). For one
fixed axis that equals linear joint-space interpolation only while the step between keys is under pi. A continuous
joint that turns more than pi between two messages would play backwards. So any step of pi/2 or more is split into
equal sub-steps with extra keys (counted in the output); --no-split turns that off (the control).
Mimic joints are driven from their leader (q = multiplier * q(leader) + offset), as the scene's Metadata says.
"""
from __future__ import annotations
import hashlib, importlib.util, json, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_READER = HERE.parents[2] / "x3d_mcp" / "src" / "x3d_utils" / "mcap_reader.py"
MAX_STEP = math.pi / 2


def load_reader(path: Path):
    spec = importlib.util.spec_from_file_location("mcap_reader", path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def joints_of(root):
    """{joint DEF: metadata dict} for every moving joint Transform in a urdf2x3d scene."""
    out = {}
    for t in root.iter("Transform"):
        ms = next((m for m in t if m.tag == "MetadataSet" and m.get("name") == "urdf:joint"), None)
        if ms is None:
            continue
        d = {}
        for e in ms:
            v = e.get("value")
            d[e.get("name")] = v.strip('"') if e.tag == "MetadataString" else [float(x) for x in v.split()]
        if d["type"] != "fixed":
            out[t.get("DEF")] = d
    return out


def read_joint_states(mcap_path: Path, topic: str, reader):
    m = reader.read_mcap(mcap_path)
    if m["skipped_chunks"]:
        raise SystemExit(f"{m['skipped_chunks']} compressed chunks could not be read (install zstandard or lz4): refused")
    cids = [c["id"] for c in m["channels"].values() if c["topic"] == topic]
    if not cids:
        raise SystemExit(f"no channel {topic} in {mcap_path.name}")
    rows = []
    for msg in m["messages"]:
        if msg["channel"] in cids:
            v = reader.decode_message(m, msg)
            st = v["header"]["stamp"]
            rows.append((st["sec"] * 10**9 + st["nanosec"], dict(zip(v["name"], v["position"]))))
    rows.sort(key=lambda r: r[0])
    # stamps are integer nanoseconds since 1970: subtract the first one before going to float seconds, because a
    # double holds 1.7e9 s only to about 2e-7 s
    rows = [((ns - rows[0][0]) * 1e-9, q) for ns, q in rows] if rows else rows
    return rows, {"messages": len(rows), "problems": m["problems"], "chunks": [c["compression"] for c in m["chunks"]],
                  "profile": (m["header"] or {}).get("profile"), "library": (m["header"] or {}).get("library")}


def tracks(rows, joints):
    """{joint: [(t, q)]} with mimic followers filled in; a joint missing from a message holds its last value."""
    names = set().union(*(set(q) for _, q in rows))
    unknown = sorted(n for n in names if n not in joints)
    leaders = [j for j, d in joints.items() if "mimic" not in d]
    missing = sorted(j for j in leaders if j not in names)
    last = {j: 0.0 for j in joints}
    out = {j: [] for j in joints}
    for t, q in rows:
        for j in leaders:
            if j in q:
                last[j] = q[j]
        for j, d in joints.items():
            if "mimic" in d:
                last[j] = d["multiplier"][0] * last[d["mimic"]] + d["offset"][0]
            out[j].append((t, last[j]))
    return out, unknown, missing


def split(track, max_step=MAX_STEP):
    """Insert keys so that no step between keys reaches max_step (linear in time and in q)."""
    out, added = [track[0]], 0
    for (t0, q0), (t1, q1) in zip(track, track[1:]):
        n = max(1, math.ceil(abs(q1 - q0) / max_step - 1e-12))
        if abs(q1 - q0) >= max_step:
            n = max(n, 2)
        for k in range(1, n + 1):
            out.append((t0 + (t1 - t0) * k / n, q0 + (q1 - q0) * k / n))
        added += n - 1
    return out, added


def num(x):
    return repr(round(float(x), 12))


def build(scene: Path, rows, out: Path, split_keys=True, info=None):
    tree = ET.parse(scene)
    root = tree.getroot()
    joints = joints_of(root)
    tr, unknown, missing = tracks(rows, joints)
    if unknown:
        raise SystemExit(f"joint names in the recording that the scene does not have: {unknown}: refused")
    t0, t1 = rows[0][0], rows[-1][0]
    T = t1 - t0
    if T <= 0:
        raise SystemExit("recording shorter than two distinct stamps: refused")
    sc = root.find("Scene")
    ET.SubElement(sc, "TimeSensor", {"DEF": "REPLAY", "cycleInterval": num(T), "loop": "true"})
    stats = {"joints": 0, "keys": 0, "keys_added_for_slerp": 0, "joints_not_in_recording": missing}
    for j, d in sorted(joints.items()):
        track = tr[j]
        if split_keys and d["type"] != "prismatic":
            track, added = split(track)
            stats["keys_added_for_slerp"] += added
        keys = " ".join(num((t - t0) / T) for t, _ in track)
        ax = d["axis"]
        if d["type"] == "prismatic":
            kv = ", ".join(" ".join(num(a * q) for a in ax) for _, q in track)
            ET.SubElement(sc, "PositionInterpolator", {"DEF": f"{j}__replay", "key": keys, "keyValue": kv})
            field = "set_translation"
        else:
            n = math.sqrt(sum(a * a for a in ax))
            kv = ", ".join(" ".join(num(a / n) for a in ax) + " " + num(q) for _, q in track)
            ET.SubElement(sc, "OrientationInterpolator", {"DEF": f"{j}__replay", "key": keys, "keyValue": kv})
            field = "set_rotation"
        ET.SubElement(sc, "ROUTE", {"fromNode": "REPLAY", "fromField": "fraction_changed", "toNode": f"{j}__replay", "toField": "set_fraction"})
        ET.SubElement(sc, "ROUTE", {"fromNode": f"{j}__replay", "fromField": "value_changed", "toNode": j, "toField": field})
        stats["joints"] += 1
        stats["keys"] += len(track)
    head = root.find("head")
    for k, v in [("ros2:recording", (info or {}).get("name", "")), ("ros2:recordingSha256", (info or {}).get("sha256", "")),
                 ("ros2:topic", (info or {}).get("topic", "/joint_states")), ("ros2:messages", str(len(rows))),
                 ("ros2:slerpSplit", "pi/2" if split_keys else "off")]:
        ET.SubElement(head, "meta", {"name": k, "content": v})
    ET.indent(root)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" '
                   '"https://www.web3d.org/specifications/x3d-4.0.dtd">\n' + ET.tostring(root, encoding="unicode") + "\n")
    stats["duration_s"] = T
    return stats


def main():
    a = sys.argv
    rec, scene, out = Path(a[1]), Path(a[2]), Path(a[3])
    topic = a[a.index("--topic") + 1] if "--topic" in a else "/joint_states"
    reader = load_reader(Path(a[a.index("--mcap-reader") + 1]) if "--mcap-reader" in a else DEFAULT_READER)
    rows, rinfo = read_joint_states(rec, topic, reader)
    info = {"name": rec.name, "sha256": hashlib.sha256(rec.read_bytes()).hexdigest(), "topic": topic}
    stats = build(scene, rows, out, "--no-split" not in a, info)
    print(json.dumps({"recording": rinfo, **stats}))


if __name__ == "__main__":
    main()
