#!/usr/bin/env python3
"""URDF to X3D 4.0: the kinematic tree as nested Transforms, each joint's limits and axis as typed Metadata, the
collision (or visual) STL meshes as IndexedTriangleSet. A pose is a set of joint values written into the joint
Transforms, so the same file can be re-posed by a ROUTE, a script or an agent.

  python3 urdf2x3d.py ROBOT.urdf OUT.x3d [--mesh-root DIR] [--pose name=value ...] [--meshes collision|visual|none]

Per joint J between parent link P and child link C:
  <Transform DEF="J__origin" translation=xyz rotation=rpy>       the joint's fixed origin (URDF rpy = Rz(y) Ry(p) Rx(r))
    <Transform DEF="J" rotation="axis q">                        the joint's motion (revolute/continuous)
      or translation="axis * q"                                  (prismatic)
      <Transform DEF="C"> ... link C's meshes, then C's child joints
Metadata on the joint Transform: MetadataSet name="urdf:joint" (type, axis, lower, upper, effort, velocity, parent,
child). Everything sits under Transform DEF="URDF_ZUP_TO_YUP" (URDF is z up, X3D y up).
Standard library only (binary and ASCII STL read here). Mimic joints ride as Metadata (mimic, multiplier, offset). Refuses: planar and floating joints, meshes
other than STL.
"""
from __future__ import annotations
import hashlib, math, struct, sys
import xml.etree.ElementTree as ET
from pathlib import Path


def vec(s, n=3, default=0.0):
    v = [float(x) for x in (s or "").split()]
    return v + [default] * (n - len(v))


def rpy_matrix(r, p, y):
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    return [[cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
            [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
            [-sp, cp * sr, cp * cr]]


def axis_angle(m):
    tr = (m[0][0] + m[1][1] + m[2][2] - 1) / 2
    ang = math.acos(max(-1.0, min(1.0, tr)))
    if ang < 1e-15:
        return None
    if abs(ang - math.pi) < 1e-7:
        xx, yy, zz = [math.sqrt(max((m[i][i] + 1) / 2, 0)) for i in range(3)]
        if xx > 1e-6:
            yy, zz = math.copysign(yy, m[0][1]), math.copysign(zz, m[0][2])
        elif yy > 1e-6:
            zz = math.copysign(zz, m[1][2])
        return (xx, yy, zz, ang)
    s = 2 * math.sin(ang)
    return ((m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, ang)


def read_stl(path: Path):
    data = path.read_bytes()
    if data[:5].lower() == b"solid" and b"facet" in data[:400]:
        pts = [vec(l.split(None, 1)[1]) for l in data.decode("ascii", "replace").splitlines() if l.strip().startswith("vertex")]
    else:
        n = struct.unpack_from("<I", data, 80)[0]
        if 84 + 50 * n > len(data):
            raise SystemExit(f"{path.name}: truncated STL: refused")
        pts = []
        for i in range(n):
            vals = struct.unpack_from("<12f", data, 84 + 50 * i)
            pts += [list(vals[3:6]), list(vals[6:9]), list(vals[9:12])]
    # weld identical vertices so the mesh is indexed
    index, verts, idx = {}, [], []
    for p in pts:
        k = tuple(p)
        if k not in index:
            index[k] = len(verts); verts.append(p)
        idx.append(index[k])
    return verts, idx, hashlib.sha256(data).hexdigest()


def num(x):
    return repr(float(x)) if x != int(x) else str(int(x))


def resolve(fn, mesh_root: Path | None, urdf_dir: Path):
    if fn.startswith("package://"):
        rest = fn[len("package://"):]
        if mesh_root is None:
            raise SystemExit(f"{fn}: needs --mesh-root")
        # package://<package>/<path>: try the root with and without the package name
        for cand in (mesh_root / rest, mesh_root / rest.split("/", 1)[1]):
            if cand.exists():
                return cand
        raise SystemExit(f"{fn}: not found under {mesh_root}")
    p = (urdf_dir / fn) if not Path(fn).is_absolute() else Path(fn)
    if not p.exists():
        raise SystemExit(f"{fn}: not found")
    return p


def meta(parent, tag, name, value):
    text = '"' + str(value).replace('"', '\\"') + '"' if tag == "MetadataString" else repr(float(value))
    ET.SubElement(parent, tag, {"containerField": "value", "name": name, "value": text})


def convert(urdf: Path, out: Path, mesh_root: Path | None = None, pose: dict | None = None, meshes="collision"):
    robot = ET.parse(urdf).getroot()
    pose = pose or {}
    links = {l.get("name"): l for l in robot.findall("link")}
    joints = robot.findall("joint")
    children = {}
    for j in joints:
        if j.get("type") not in ("revolute", "continuous", "prismatic", "fixed"):
            raise SystemExit(f"joint {j.get('name')}: type {j.get('type')} not handled: refused")
        children.setdefault(j.find("parent").get("link"), []).append(j)
    child_links = {j.find("child").get("link") for j in joints}
    roots = [n for n in links if n not in child_links]
    if len(roots) != 1:
        raise SystemExit(f"{len(roots)} root links: refused")
    x3d = ET.Element("X3D", {"profile": "Immersive", "version": "4.0",
                             "xmlns:xsd": "http://www.w3.org/2001/XMLSchema-instance",
                             "xsd:noNamespaceSchemaLocation": "https://www.web3d.org/specifications/x3d-4.0.xsd"})
    head = ET.SubElement(x3d, "head")
    for k, v in [("title", out.name), ("generator", "x3d.loom x3d.physics/urdf-bridge/urdf2x3d.py"),
                 ("urdf:robot", robot.get("name", "")), ("urdf:sourceSha256", hashlib.sha256(urdf.read_bytes()).hexdigest()),
                 ("urdf:meshes", meshes), ("urdf:frame", "URDF z-up under Transform URDF_ZUP_TO_YUP")]:
        ET.SubElement(head, "meta", {"name": k, "content": v})
    scene = ET.SubElement(x3d, "Scene")
    ET.SubElement(scene, "WorldInfo", {"title": f"URDF {robot.get('name', '')}"})
    ET.SubElement(scene, "Viewpoint", {"position": "1.2 0.9 1.6", "orientation": "-0.45 0.86 0.23 0.72",
                                        "description": "three-quarter view"})
    frame = ET.SubElement(scene, "Transform", {"DEF": "URDF_ZUP_TO_YUP", "rotation": "1 0 0 " + repr(-math.pi / 2)})
    stats = {"links": 0, "joints": 0, "meshes": 0, "triangles": 0, "mesh_sha256": {}}
    shared = {}

    def link(name, parent):
        t = ET.SubElement(parent, "Transform", {"DEF": name})
        stats["links"] += 1
        L = links[name]
        for g in (L.findall(meshes) if meshes != "none" else []):
            m = g.find("geometry/mesh")
            if m is None:
                continue  # primitives: not drawn here, counted below
            fn = resolve(m.get("filename"), mesh_root, urdf.parent)
            if fn.suffix.lower() != ".stl":
                raise SystemExit(f"{fn.name}: only STL meshes: refused")
            o = g.find("origin")
            xyz, rpy = vec(o.get("xyz") if o is not None else None), vec(o.get("rpy") if o is not None else None)
            sc = vec(m.get("scale"), 3, 1.0) if m.get("scale") else None
            go = ET.SubElement(t, "Transform")
            if any(xyz):
                go.set("translation", " ".join(num(c) for c in xyz))
            aa = axis_angle(rpy_matrix(*rpy))
            if aa:
                go.set("rotation", " ".join(repr(c) for c in aa))
            if sc:
                go.set("scale", " ".join(num(c) for c in sc))
            shape = ET.SubElement(go, "Shape")
            app = ET.SubElement(shape, "Appearance")
            ET.SubElement(app, "Material", {"diffuseColor": "0.62 0.66 0.72", "specularColor": "0.3 0.3 0.3"})
            key = str(fn)
            if key in shared:
                shape.append(ET.Element("IndexedTriangleSet", {"USE": shared[key]}))
            else:
                verts, idx, sha = read_stl(fn)
                d = f"mesh_{len(shared)}"
                shared[key] = d
                its = ET.SubElement(shape, "IndexedTriangleSet", {"DEF": d, "solid": "true", "index": " ".join(map(str, idx))})
                ET.SubElement(its, "Coordinate", {"point": " ".join(repr(float(c)) for v in verts for c in v)})
                stats["mesh_sha256"][fn.name] = sha
                stats["triangles"] += len(idx) // 3
            stats["meshes"] += 1
        for j in sorted(children.get(name, []), key=lambda j: j.get("name")):
            joint(j, t)

    def joint(j, parent):
        jn, jt = j.get("name"), j.get("type")
        o = j.find("origin")
        xyz, rpy = vec(o.get("xyz") if o is not None else None), vec(o.get("rpy") if o is not None else None)
        to = ET.SubElement(parent, "Transform", {"DEF": jn + "__origin"})
        if any(xyz):
            to.set("translation", " ".join(num(c) for c in xyz))
        aa = axis_angle(rpy_matrix(*rpy))
        if aa:
            to.set("rotation", " ".join(repr(c) for c in aa))
        tj = ET.SubElement(to, "Transform", {"DEF": jn})
        ms = ET.SubElement(tj, "MetadataSet", {"containerField": "metadata", "name": "urdf:joint", "reference": "URDF"})
        meta(ms, "MetadataString", "type", jt)
        meta(ms, "MetadataString", "parent", j.find("parent").get("link"))
        meta(ms, "MetadataString", "child", j.find("child").get("link"))
        ax = vec(j.find("axis").get("xyz") if j.find("axis") is not None else "1 0 0")
        if jt != "fixed":
            ET.SubElement(ms, "MetadataDouble", {"containerField": "value", "name": "axis", "value": " ".join(repr(c) for c in ax)})
            lim = j.find("limit")
            for k in ("lower", "upper", "effort", "velocity"):
                if lim is not None and lim.get(k) is not None:
                    meta(ms, "MetadataDouble", k, lim.get(k))
            mim = j.find("mimic")
            if mim is not None:  # URDF mimic: q = multiplier * q(joint) + offset; X3D has no ROUTE that scales, so
                # it rides as Metadata and whoever poses the scene applies it (fk_check does)
                meta(ms, "MetadataString", "mimic", mim.get("joint"))
                meta(ms, "MetadataDouble", "multiplier", mim.get("multiplier", "1"))
                meta(ms, "MetadataDouble", "offset", mim.get("offset", "0"))
            q = float(pose.get(jn, 0.0))
            meta(ms, "MetadataDouble", "position", q)
            if jt == "prismatic":
                tj.set("translation", " ".join(repr(a * q) for a in ax))
            else:
                n = math.sqrt(sum(a * a for a in ax))
                tj.set("rotation", " ".join(repr(a / n) for a in ax) + " " + repr(q))
        stats["joints"] += 1
        link(j.find("child").get("link"), tj)

    link(roots[0], frame)
    ET.indent(x3d)
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" '
                   '"https://www.web3d.org/specifications/x3d-4.0.dtd">\n' + ET.tostring(x3d, encoding="unicode") + "\n")
    return stats


if __name__ == "__main__":
    a = sys.argv
    pose = dict((kv.split("=")[0], float(kv.split("=")[1])) for kv in a[a.index("--pose") + 1:] if "=" in kv) if "--pose" in a else {}
    mr = Path(a[a.index("--mesh-root") + 1]) if "--mesh-root" in a else None
    mm = a[a.index("--meshes") + 1] if "--meshes" in a else "collision"
    print(convert(Path(a[1]), Path(a[2]), mr, pose, mm))
