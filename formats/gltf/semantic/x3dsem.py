"""X3D semantics -> glTF 2.0 (KHR_xmp_json_ld) -> X3D, with the Loom's semantic rules.

    python -I semantic/x3dsem.py roundtrip IN.x3d OUTDIR      writes OUTDIR/<stem>.gltf, OUTDIR/<stem>.back.x3d, OUTDIR/semantic.json

What travels (the MEANING layer, lossless by rule S1):
  * every X3D Metadata node (MetadataSet / String / Double / Float / Integer / Boolean), with name, reference, typed values,
    nesting, and metadata-on-metadata, when its host becomes a glTF node (the grouping nodes listed below, and Shape).
    Metadata on any other host (Material, Appearance, WorldInfo, sensors, ...) is NOT carried; S1 and S2 then fail, so
    the loss is reported, never silent (fixtures/metadata-host-probe.x3d);
  * the <head> <meta> list, as the asset-level packet;
  * domain URIs (CIDOC-CRM, IFC, PROV-O, Pleiades, ...) kept verbatim in `reference` / string values and ALSO lifted into JSON-LD
    (@type IRIs, loom:ifcGlobalId) so a JSON-LD tool can query them without knowing X3D.
What travels approximately (geometry, enough to render and to prove each IFC element kept a body):
  Transform / Group / HAnim* / Collision / Anchor / Billboard / LOD / Switch / GeoLocation (as a plain group) -> glTF nodes;
  Shape with IndexedFaceSet / IndexedTriangleSet / Box -> mesh (positions only, fan-triangulated); Material / PhysicalMaterial -> PBR factors.
  Everything else (other geometry, ROUTEs, interpolators, sensors, lights, viewpoints, Inline) is COUNTED in the report, not converted.

Stdlib only. glTF output is one .gltf with the buffer embedded as a data URI.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

CONVERTER = "loom-gltf x3dsem 0.1.0"
CONTEXT = {
    "x3d": "https://www.web3d.org/specifications/X3dOntology4.0#",
    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
    "ifc": "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL#",
    "prov": "http://www.w3.org/ns/prov#",
    "dc": "http://purl.org/dc/elements/1.1/",
    "loom": "https://hagopjay.github.io/x3d.loom/ns#",
}
META_TYPES = {"MetadataSet", "MetadataString", "MetadataDouble", "MetadataFloat", "MetadataInteger", "MetadataBoolean"}
GROUPS = {"Transform", "Group", "HAnimHumanoid", "HAnimJoint", "HAnimSegment", "HAnimSite", "Collision", "Anchor", "Billboard",
          "LOD", "Switch", "GeoLocation", "GeoTransform", "StaticGroup", "CADAssembly", "CADPart", "CADLayer", "CADFace"}
# HAnimHumanoid lists its joints/segments/sites again by USE in these fields; they are indexes, not more scene children
NON_CHILD_FIELDS = {"joints", "segments", "sites", "viewpoints", "skinCoord", "skinNormal", "skinBindingCoords", "skinBindingNormals", "motions"}
TRANSFORMISH = {"Transform", "HAnimHumanoid", "HAnimJoint", "HAnimSite", "CADPart", "GeoTransform"}


# ------------------------------------------------------------------------------------------------------ X3D field parsing
def parse_mfstring(s: str | None) -> list[str]:
    if s is None:
        return []
    out, i, n = [], 0, len(s)
    while i < n:
        if s[i] == '"':
            i += 1
            buf = []
            while i < n and s[i] != '"':
                if s[i] == "\\" and i + 1 < n:
                    i += 1
                buf.append(s[i])
                i += 1
            out.append("".join(buf))
        i += 1
    if not out and s.strip():  # unquoted single value (tolerated by many tools)
        out = [s]
    return out


def fmt_mfstring(v: list[str]) -> str:
    return " ".join('"' + x.replace("\\", "\\\\").replace('"', '\\"') + '"' for x in v)


def floats(s: str | None) -> list[float]:
    return [float(x) for x in (s or "").replace(",", " ").split()]


def ints(s: str | None) -> list[int]:
    return [int(x) for x in (s or "").replace(",", " ").split()]


def bools(s: str | None) -> list[bool]:
    return [x.lower() == "true" for x in (s or "").replace(",", " ").split()]


# ------------------------------------------------------------------------------------------------------ Metadata <-> JSON
def meta_to_json(e: ET.Element) -> dict:
    t = e.tag
    d: dict = {"type": t}
    for k in ("name", "reference", "DEF", "USE"):
        if e.get(k) is not None:
            d[k] = e.get(k)
    if t == "MetadataSet":
        d["value"] = [meta_to_json(c) for c in e if c.tag in META_TYPES and c.get("containerField", "value") == "value"]
    elif t == "MetadataString":
        d["value"] = parse_mfstring(e.get("value"))
    elif t in ("MetadataDouble", "MetadataFloat"):
        d["value"] = floats(e.get("value"))
    elif t == "MetadataInteger":
        d["value"] = ints(e.get("value"))
    elif t == "MetadataBoolean":
        d["value"] = bools(e.get("value"))
    mm = [c for c in e if c.tag in META_TYPES and c.get("containerField") == "metadata"]
    if mm:
        d["metadata"] = meta_to_json(mm[0])
    return d


def json_to_meta(d: dict, container: str) -> ET.Element:
    e = ET.Element(d["type"])
    for k in ("DEF", "USE", "name", "reference"):
        if k in d:
            e.set(k, d[k])
    e.set("containerField", container)
    t = d["type"]
    if t == "MetadataSet":
        for c in d.get("value", []):
            e.append(json_to_meta(c, "value"))
    elif t == "MetadataString":
        e.set("value", fmt_mfstring(d["value"]))
    elif t in ("MetadataDouble", "MetadataFloat"):
        e.set("value", " ".join(repr(float(x)) for x in d["value"]))
    elif t == "MetadataInteger":
        e.set("value", " ".join(str(int(x)) for x in d["value"]))
    elif t == "MetadataBoolean":
        e.set("value", " ".join("true" if x else "false" for x in d["value"]))
    if "metadata" in d:
        e.append(json_to_meta(d["metadata"], "metadata"))
    return e


def unlift(n: dict) -> dict:
    """Inverse of lift(): reads only the X3D-exact terms; the lifts (crm:/ifc: types, loom:ifcGlobalId) are ignored."""
    types = n["@type"] if isinstance(n["@type"], list) else [n["@type"]]
    t = next(x for x in types if x.startswith("x3d:"))[4:]
    d: dict = {"type": t}
    for k in ("DEF", "USE"):
        if "x3d:" + k in n:
            d[k] = n["x3d:" + k]
    if n.get("x3d:name") is not None:
        d["name"] = n["x3d:name"]
    if "x3d:reference" in n:
        d["reference"] = n["x3d:reference"]
    vals = n.get("x3d:value", {}).get("@list", [])
    d["value"] = [unlift(c) for c in vals] if t == "MetadataSet" else list(vals)
    if "x3d:metadata" in n:
        d["metadata"] = unlift(n["x3d:metadata"])
    return d


def host_metadata(e: ET.Element) -> dict | None:
    for c in e:
        if c.tag in META_TYPES and c.get("containerField", "metadata") == "metadata":
            return meta_to_json(c)
    return None


def walk_meta(d: dict, path=()):
    yield d, path
    if d["type"] == "MetadataSet":
        for c in d.get("value", []):
            yield from walk_meta(c, path + (d.get("name"),))
    if "metadata" in d:
        yield from walk_meta(d["metadata"], path + ("@metadata",))


def lift(d: dict) -> dict:
    """JSON-LD view of one metadata tree: X3D-exact core + queryable lifts (never read back)."""
    node = {"@type": "x3d:" + d["type"]}
    if d.get("name") is not None:
        node["x3d:name"] = d["name"]
    if "reference" in d:
        node["x3d:reference"] = d["reference"]
        if d["reference"].startswith("http://www.cidoc-crm.org/cidoc-crm/"):
            node["@type"] = [node["@type"], "crm:" + d["reference"].rsplit("/", 1)[-1]]
    if d["type"] == "MetadataSet":
        node["x3d:value"] = {"@list": [lift(c) for c in d.get("value", [])]}
        kids = {c.get("name"): c for c in d.get("value", [])}
        if (d.get("name") or "").upper() == "IFC" and "GlobalId" in kids:
            node["loom:ifcGlobalId"] = kids["GlobalId"]["value"][0] if kids["GlobalId"]["value"] else None
            if "IfcClass" in kids and kids["IfcClass"]["value"]:
                node["@type"] = [node["@type"], "ifc:" + kids["IfcClass"]["value"][0]]
    else:
        node["x3d:value"] = {"@list": d["value"]}
    if "metadata" in d:
        node["x3d:metadata"] = lift(d["metadata"])
    for k in ("DEF", "USE"):
        if k in d:
            node["x3d:" + k] = d[k]
    return node


# ------------------------------------------------------------------------------------------------------ maths
def axis_angle_quat(r):
    x, y, z, a = (r + [0, 0, 1, 0])[:4] if len(r) < 4 else r[:4]
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    s = math.sin(a / 2)
    return [x / n * s, y / n * s, z / n * s, math.cos(a / 2)]


def quat_mat(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def m4(R=None, t=(0, 0, 0), s=(1, 1, 1)):
    R = R or [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    M = [[R[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)]
    return M + [[0, 0, 0, 1]]


def mul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def transform_of(e: ET.Element) -> dict:
    T = floats(e.get("translation")) or [0, 0, 0]
    R = floats(e.get("rotation")) or [0, 0, 1, 0]
    S = floats(e.get("scale")) or [1, 1, 1]
    C = floats(e.get("center")) or [0, 0, 0]
    SO = floats(e.get("scaleOrientation")) or [0, 0, 1, 0]
    q = axis_angle_quat(R)
    if any(abs(c) > 0 for c in C) and abs(SO[3]) <= 1e-12:
        # T * C * R * S * -C  ==  translate(T + C - R*S*C) * R * S
        Rm = quat_mat(q)
        RSC = [sum(Rm[i][j] * S[j] * C[j] for j in range(3)) for i in range(3)]
        T = [T[i] + C[i] - RSC[i] for i in range(3)]
    if abs(SO[3]) > 1e-12:
        sq = axis_angle_quat(SO)
        sqi = [-sq[0], -sq[1], -sq[2], sq[3]]
        M = mul(m4(t=T), m4(t=C))
        M = mul(M, m4(quat_mat(q)))
        M = mul(M, m4(quat_mat(sq)))
        M = mul(M, m4(s=S))
        M = mul(M, m4(quat_mat(sqi)))
        M = mul(M, m4(t=[-c for c in C]))
        return {"matrix": [M[r][c] for c in range(4) for r in range(4)]}
    out = {}
    if any(abs(x) > 1e-12 for x in T):
        out["translation"] = T
    if abs(R[3]) > 1e-12:
        out["rotation"] = q
    if S != [1, 1, 1]:
        out["scale"] = S
    return out


# ------------------------------------------------------------------------------------------------------ X3D -> glTF
class Builder:
    def __init__(self):
        self.g = {"asset": {"version": "2.0", "generator": CONVERTER}, "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [],
                  "materials": [], "accessors": [], "bufferViews": [], "buffers": [], "extensionsUsed": ["KHR_xmp_json_ld"],
                  "extensions": {"KHR_xmp_json_ld": {"packets": []}}}
        self.bin = bytearray()
        self.defs: dict[str, ET.Element] = {}
        self.report = {"converted": {}, "skipped": {}, "use_copies": 0}

    def count(self, kind, tag):
        self.report[kind][tag] = self.report[kind].get(tag, 0) + 1

    def packet(self, obj) -> int:
        p = self.g["extensions"]["KHR_xmp_json_ld"]["packets"]
        p.append({"@context": CONTEXT, **obj})
        return len(p) - 1

    def view(self, data: bytes, target=None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        bv = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            bv["target"] = target
        self.bin.extend(data)
        self.g["bufferViews"].append(bv)
        return len(self.g["bufferViews"]) - 1

    def mesh_from_shape(self, shape: ET.Element) -> tuple[int | None, int]:
        geo = next((c for c in shape if c.tag not in ("Appearance",) and c.tag not in META_TYPES), None)
        geo = self.resolve(geo)
        if geo is None:
            return None, 0
        pts, tris = [], []
        if geo.tag in ("IndexedFaceSet", "IndexedTriangleSet"):
            coord = self.resolve(next((c for c in geo if c.tag in ("Coordinate", "CoordinateDouble")), None))
            p = floats(coord.get("point")) if coord is not None else []
            pts = [p[i:i + 3] for i in range(0, len(p) - len(p) % 3, 3)]
            if geo.tag == "IndexedFaceSet":
                face = []
                for i in ints(geo.get("coordIndex")) + [-1]:
                    if i < 0:
                        tris += [(face[0], face[k], face[k + 1]) for k in range(1, len(face) - 1)]
                        face = []
                    else:
                        face.append(i)
                if geo.get("ccw", "true") == "false":
                    tris = [(a, c, b) for a, b, c in tris]
            else:
                ix = ints(geo.get("index"))
                tris = [tuple(ix[i:i + 3]) for i in range(0, len(ix) - 2, 3)]
        elif geo.tag == "Box":
            sx, sy, sz = [v / 2 for v in (floats(geo.get("size")) or [2, 2, 2])]
            pts = [[x * sx, y * sy, z * sz] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
            quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
            tris = [t for a, b, c, d in quads for t in ((a, b, c), (a, c, d))]
        else:
            self.count("skipped", geo.tag)
            return None, 0
        self.count("converted", geo.tag)
        if not pts or not tris:
            return None, 0
        pos = b"".join(struct.pack("<3f", *pt) for pt in pts)
        idx = b"".join(struct.pack("<3I", *t) for t in tris)
        mn = [min(p[i] for p in pts) for i in range(3)]
        mx = [max(p[i] for p in pts) for i in range(3)]
        a_pos = len(self.g["accessors"])
        self.g["accessors"].append({"bufferView": self.view(pos, 34962), "componentType": 5126, "count": len(pts), "type": "VEC3", "min": mn, "max": mx})
        self.g["accessors"].append({"bufferView": self.view(idx, 34963), "componentType": 5125, "count": 3 * len(tris), "type": "SCALAR"})
        prim = {"attributes": {"POSITION": a_pos}, "indices": a_pos + 1}
        mat = self.material(shape)
        if mat is not None:
            prim["material"] = mat
        self.g["meshes"].append({"primitives": [prim]})
        return len(self.g["meshes"]) - 1, len(tris)

    def material(self, shape) -> int | None:
        app = self.resolve(next((c for c in shape if c.tag == "Appearance"), None))
        if app is None:
            return None
        m = self.resolve(next((c for c in app if c.tag in ("Material", "PhysicalMaterial", "UnlitMaterial")), None))
        if m is None:
            return None
        pbr = {}
        if m.tag == "PhysicalMaterial":
            pbr = {"baseColorFactor": (floats(m.get("baseColor")) or [1, 1, 1]) + [1 - (floats(m.get("transparency")) or [0])[0]],
                   "metallicFactor": (floats(m.get("metallic")) or [1])[0], "roughnessFactor": (floats(m.get("roughness")) or [1])[0]}
        else:
            c = floats(m.get("diffuseColor") if m.tag == "Material" else m.get("emissiveColor")) or [0.8, 0.8, 0.8]
            pbr = {"baseColorFactor": c + [1 - (floats(m.get("transparency")) or [0])[0]], "metallicFactor": 0.0, "roughnessFactor": 1.0}
        mat = {"pbrMetallicRoughness": pbr, "doubleSided": True}
        if pbr["baseColorFactor"][3] < 1:
            mat["alphaMode"] = "BLEND"
        e = floats(m.get("emissiveColor")) if m.tag != "UnlitMaterial" else []
        if e and any(e):
            mat["emissiveFactor"] = e
        self.g["materials"].append(mat)
        return len(self.g["materials"]) - 1

    def resolve(self, e):
        if e is not None and e.get("USE"):
            return self.defs.get(e.get("USE"), e)
        return e

    def host_packet(self, e: ET.Element, host_index: int, path: str) -> int | None:
        md = host_metadata(e)
        if md is None:
            return None
        pk = {"@id": f"loom:host/{host_index}", "x3d:hostType": e.tag, "loom:x3dPath": path, "x3d:metadata": lift(md)}
        if e.get("DEF"):
            pk["x3d:hostDEF"] = e.get("DEF")
        return self.packet(pk)

    def node(self, e: ET.Element, path: str, counter: list) -> int | None:
        if e.get("DEF"):
            self.defs[e.get("DEF")] = e
        if e.get("USE"):
            self.report["use_copies"] += 1
            e = self.defs.get(e.get("USE"), e)
        if e.tag in GROUPS:
            n = {"name": e.get("DEF") or e.get("name") or e.tag}
            if e.tag in TRANSFORMISH:
                n.update(transform_of(e))
            self.count("converted", e.tag)
        elif e.tag == "Shape":
            n = {"name": e.get("DEF") or f"Shape@{path}"}
            mi, _ = self.mesh_from_shape(e)
            if mi is not None:
                n["mesh"] = mi
            self.count("converted", "Shape")
        else:
            if e.tag not in META_TYPES:
                self.count("skipped", e.tag)
            return None
        idx = len(self.g["nodes"])
        self.g["nodes"].append(n)
        counter[0] += 1
        pk = self.host_packet(e, counter[0], path)
        if pk is not None:
            n["extensions"] = {"KHR_xmp_json_ld": {"packet": pk}}
            n.setdefault("extras", {})["x3d_node_type"] = e.tag
        n.setdefault("extras", {})["x3d_node_type"] = e.tag
        kids = []
        seen = {}
        for c in ([] if e.tag == "Shape" else e):
            if c.tag in META_TYPES or c.get("containerField") in NON_CHILD_FIELDS:
                continue
            seen[c.tag] = seen.get(c.tag, 0) + 1
            k = self.node(c, f"{path}/{c.get('DEF') or c.tag + '[' + str(seen[c.tag]) + ']'}", counter)
            if k is not None:
                kids.append(k)
        if kids:
            self.g["nodes"][idx]["children"] = kids
        return idx


def x3d_to_gltf(src: Path, out: Path) -> dict:
    raw = src.read_bytes()
    root = ET.fromstring(raw)
    b = Builder()
    head = root.find("head")
    meta = [{"name": m.get("name"), "content": m.get("content")} for m in (head.findall("meta") if head is not None else [])]
    components = [{"name": c.get("name"), "level": c.get("level")} for c in (head.findall("component") if head is not None else [])]
    asset_pk = b.packet({"@id": "loom:asset", "dc:format": "model/gltf+json", "prov:wasDerivedFrom": {"@id": "urn:sha256:" + hashlib.sha256(raw).hexdigest(),
                         "dc:title": src.name, "x3d:profile": root.get("profile"), "x3d:version": root.get("version")},
                         "prov:wasGeneratedBy": {"@type": "prov:Activity", "prov:used": CONVERTER}, "x3d:head": {"meta": meta, "component": components}})
    b.g["asset"]["extensions"] = {"KHR_xmp_json_ld": {"packet": asset_pk}}
    scene = root.find("Scene")
    counter = [0]
    seen = {}
    for c in scene:
        seen[c.tag] = seen.get(c.tag, 0) + 1
        k = b.node(c, f"/{c.get('DEF') or c.tag + '[' + str(seen[c.tag]) + ']'}", counter)
        if k is not None:
            b.g["scenes"][0]["nodes"].append(k)
    if b.bin:
        b.g["buffers"].append({"byteLength": len(b.bin), "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(b.bin)).decode()})
    for k in ("meshes", "materials", "accessors", "bufferViews", "buffers"):
        if not b.g[k]:
            del b.g[k]
    out.write_text(json.dumps(b.g, indent=1))
    return b.report


# ------------------------------------------------------------------------------------------------------ glTF -> X3D
def gltf_to_x3d(src: Path, out: Path) -> None:
    g = json.loads(src.read_text())
    packets = g.get("extensions", {}).get("KHR_xmp_json_ld", {}).get("packets", [])
    asset = packets[g["asset"]["extensions"]["KHR_xmp_json_ld"]["packet"]] if g.get("asset", {}).get("extensions") else {}
    der = asset.get("prov:wasDerivedFrom", {})
    x3d = ET.Element("X3D", {"profile": der.get("x3d:profile") or "Immersive", "version": der.get("x3d:version") or "4.0"})
    head = ET.SubElement(x3d, "head")
    for c in asset.get("x3d:head", {}).get("component", []):
        ET.SubElement(head, "component", {k: v for k, v in c.items() if v is not None})
    for m in asset.get("x3d:head", {}).get("meta", []):
        ET.SubElement(head, "meta", {k: v for k, v in m.items() if v is not None})
    scene = ET.SubElement(x3d, "Scene")
    buf = b""
    if g.get("buffers"):
        buf = base64.b64decode(g["buffers"][0]["uri"].split(",", 1)[1])

    def acc(i):
        a = g["accessors"][i]
        bv = g["bufferViews"][a["bufferView"]]
        o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = {"VEC3": 3, "SCALAR": 1}[a["type"]] * a["count"]
        fmt = {5126: "f", 5125: "I"}[a["componentType"]]
        return list(struct.unpack_from(f"<{n}{fmt}", buf, o))

    def emit(ni, parent):
        n = g["nodes"][ni]
        typ = n.get("extras", {}).get("x3d_node_type", "Transform")
        pk = packets[n["extensions"]["KHR_xmp_json_ld"]["packet"]] if "KHR_xmp_json_ld" in n.get("extensions", {}) else None
        if typ == "Shape":
            host = ET.SubElement(parent, "Shape")
            if not n["name"].startswith("Shape@"):
                host.set("DEF", n["name"])
            if "mesh" in n:
                prim = g["meshes"][n["mesh"]]["primitives"][0]
                if "material" in prim:
                    pbr = g["materials"][prim["material"]]["pbrMetallicRoughness"]
                    app = ET.SubElement(host, "Appearance")
                    c = pbr["baseColorFactor"]
                    ET.SubElement(app, "PhysicalMaterial", {"baseColor": " ".join(repr(x) for x in c[:3]), "metallic": repr(pbr["metallicFactor"]),
                                                             "roughness": repr(pbr["roughnessFactor"]), "transparency": repr(1 - c[3])})
                its = ET.SubElement(host, "IndexedTriangleSet", {"solid": "false", "index": " ".join(map(str, acc(prim["indices"])))})
                ET.SubElement(its, "Coordinate", {"point": " ".join(repr(x) for x in acc(prim["attributes"]["POSITION"]))})
        else:
            tag = typ if typ in GROUPS and typ not in ("GeoLocation", "GeoTransform") else ("Transform" if any(k in n for k in ("matrix", "translation", "rotation", "scale")) else "Group")
            if tag in TRANSFORMISH and tag != "Transform" and "matrix" in n:
                tag = "Transform"
            host = ET.SubElement(parent, tag)
            if n.get("name") and n["name"] != typ:
                host.set("DEF", n["name"])
            if "translation" in n:
                host.set("translation", " ".join(repr(x) for x in n["translation"]))
            if "rotation" in n:
                x, y, z, w = n["rotation"]
                a = 2 * math.acos(max(-1, min(1, w)))
                s = math.sqrt(max(0.0, 1 - w * w)) or 1.0
                host.set("rotation", f"{x / s!r} {y / s!r} {z / s!r} {a!r}")
            if "scale" in n:
                host.set("scale", " ".join(repr(x) for x in n["scale"]))
            if "matrix" in n:  # decompose (no shear) into T R S
                M = n["matrix"]
                cols = [M[0:3], M[4:7], M[8:11]]
                S = [math.sqrt(sum(v * v for v in c)) for c in cols]
                host.set("translation", " ".join(repr(x) for x in M[12:15]))
                host.set("scale", " ".join(repr(x) for x in S))
                R = [[cols[j][i] / (S[j] or 1) for j in range(3)] for i in range(3)]
                w = math.sqrt(max(0, 1 + R[0][0] + R[1][1] + R[2][2])) / 2 or 1e-12
                q = [(R[2][1] - R[1][2]) / (4 * w), (R[0][2] - R[2][0]) / (4 * w), (R[1][0] - R[0][1]) / (4 * w), w]
                a = 2 * math.acos(max(-1, min(1, w)))
                s = math.sqrt(max(0.0, 1 - w * w)) or 1.0
                host.set("rotation", f"{q[0] / s!r} {q[1] / s!r} {q[2] / s!r} {a!r}")
        if pk is not None:
            host.insert(0, json_to_meta(unlift(pk["x3d:metadata"]), "metadata"))
        for c in n.get("children", []):
            emit(c, host)

    for ni in g["scenes"][g.get("scene", 0)]["nodes"]:
        emit(ni, scene)
    ET.indent(x3d, " ")
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(x3d, encoding="unicode") + "\n")


# ------------------------------------------------------------------------------------------------------ the semantic witness
def semantics(x3d_path: Path) -> dict:
    root = ET.fromstring(x3d_path.read_bytes())
    par = {c: p for p in root.iter() for c in p}
    hosts = []
    for e in root.iter():
        if e.tag in META_TYPES and e.get("containerField", "metadata") == "metadata" and par.get(e) is not None and par[e].tag not in META_TYPES:
            h = par[e]
            hosts.append({"hostType": h.tag, "DEF": h.get("DEF"), "metadata": meta_to_json(e), "tris": shape_tris(h) if h.tag == "Shape" else None})
    head = root.find("head")
    meta = [(m.get("name"), m.get("content")) for m in (head.findall("meta") if head is not None else [])]
    return {"hosts": hosts, "head_meta": meta}


def shape_tris(shape) -> int:
    geo = next((c for c in shape if c.tag not in ("Appearance",) and c.tag not in META_TYPES), None)
    if geo is None:
        return 0
    if geo.tag == "IndexedFaceSet":
        n, f = 0, 0
        for i in ints(geo.get("coordIndex")) + [-1]:
            if i < 0:
                n += max(0, f - 2)
                f = 0
            else:
                f += 1
        return n
    if geo.tag == "IndexedTriangleSet":
        return len(ints(geo.get("index"))) // 3
    if geo.tag == "Box":
        return 12
    return 0


def canon(x) -> str:
    return json.dumps(x, sort_keys=True, separators=(",", ":"))


def rules(a: dict, b: dict, gltf: dict) -> list[dict]:
    """S1..S6. Each rule names what it checks, the counts, and pass/fail."""
    out = []
    packets0 = gltf.get("extensions", {}).get("KHR_xmp_json_ld", {}).get("packets", [])
    refs = [o["extensions"]["KHR_xmp_json_ld"]["packet"] for coll in ("nodes", "meshes", "materials", "scenes") for o in gltf.get(coll, [])
            if "KHR_xmp_json_ld" in o.get("extensions", {})] + ([gltf["asset"]["extensions"]["KHR_xmp_json_ld"]["packet"]] if "extensions" in gltf.get("asset", {}) else [])
    bad = [r for r in refs if not (isinstance(r, int) and 0 <= r < len(packets0))] + [i for i, p in enumerate(packets0) if "@context" not in p]
    out.append({"id": "S0", "rule": "KHR_xmp_json_ld structure: declared in extensionsUsed, every packet has @context, every reference is in range (the Khronos validator 2.0.0-dev.3.10 does not check this extension)",
                "packets": len(packets0), "references": len(refs), "bad": len(bad), "pass": "KHR_xmp_json_ld" in gltf.get("extensionsUsed", []) and not bad})
    A = [canon((h["hostType"], h["DEF"], h["metadata"])) for h in a["hosts"]]
    B = [canon((h["hostType"], h["DEF"], h["metadata"])) for h in b["hosts"]]
    out.append({"id": "S1", "rule": "every Metadata tree returns X3D -> glTF -> X3D on the same host type and DEF, in document order, value for value",
                "expected": len(A), "got": len(B), "missing": len([x for x in A if x not in B]), "pass": A == B})
    nodes_a = sum(1 for h in a["hosts"] for _ in walk_meta(h["metadata"]))
    nodes_b = sum(1 for h in b["hosts"] for _ in walk_meta(h["metadata"]))
    out.append({"id": "S2", "rule": "Metadata node count is unchanged (no node dropped, none invented)", "expected": nodes_a, "got": nodes_b, "pass": nodes_a == nodes_b})

    def ifc(hs):
        r = {}
        for h in hs:
            for d, _ in walk_meta(h["metadata"]):
                if d["type"] == "MetadataSet" and (d.get("name") or "").upper() == "IFC":
                    gid = next((c["value"][0] for c in d.get("value", []) if c.get("name") == "GlobalId" and c.get("value")), None)
                    if gid:
                        r.setdefault(gid, []).append(h.get("tris"))
        return r
    ia, ib = ifc(a["hosts"]), ifc(b["hosts"])
    packets = gltf.get("extensions", {}).get("KHR_xmp_json_ld", {}).get("packets", [])
    lifted = canon(packets)
    in_gltf = sum(1 for k in ia if f'"loom:ifcGlobalId":"{k}"' in lifted)
    body_ok = all(ib.get(k) == v and all(t and t > 0 for t in v if t is not None) for k, v in ia.items())
    out.append({"id": "S3", "rule": "every IFC GlobalId survives once per element, is queryable in the glTF JSON-LD (loom:ifcGlobalId), and its host Shape keeps the same triangle count",
                "expected": len(ia), "got": len(ib), "queryable_in_gltf": in_gltf, "pass": set(ia) == set(ib) and in_gltf == len(ia) and body_ok})
    crm_a = sorted(d["reference"] for h in a["hosts"] for d, _ in walk_meta(h["metadata"]) if "cidoc-crm" in (d.get("reference") or ""))
    crm_b = sorted(d["reference"] for h in b["hosts"] for d, _ in walk_meta(h["metadata"]) if "cidoc-crm" in (d.get("reference") or ""))
    crm_typed = lifted.count('"crm:E')
    out.append({"id": "S4", "rule": "every CIDOC-CRM class reference survives and is typed in JSON-LD (@type crm:E..)", "expected": len(crm_a), "got": len(crm_b),
                "typed_in_gltf": crm_typed, "pass": crm_a == crm_b and crm_typed >= len(crm_a)})
    out.append({"id": "S5", "rule": "<head> meta list survives in order", "expected": len(a["head_meta"]), "got": len(b["head_meta"]), "pass": a["head_meta"] == b["head_meta"]})
    asset = packets[gltf["asset"]["extensions"]["KHR_xmp_json_ld"]["packet"]] if packets else {}
    out.append({"id": "S6", "rule": "glTF asset packet carries PROV-O: prov:wasDerivedFrom = sha256 of the source X3D, prov:wasGeneratedBy = the converter",
                "pass": bool(asset.get("prov:wasDerivedFrom", {}).get("@id", "").startswith("urn:sha256:")) and bool(asset.get("prov:wasGeneratedBy"))})
    return out


def roundtrip(src: Path, outdir: Path) -> dict:
    outdir.mkdir(parents=True, exist_ok=True)
    stem = src.stem
    gl, back = outdir / f"{stem}.gltf", outdir / f"{stem}.back.x3d"
    report = x3d_to_gltf(src, gl)
    gltf_to_x3d(gl, back)
    a, b = semantics(src), semantics(back)
    g = json.loads(gl.read_text())
    rs = rules(a, b, g)
    res = {"schema": "loom.semantic/1", "converter": CONVERTER, "source": {"file": src.name, "sha256": hashlib.sha256(src.read_bytes()).hexdigest()},
           "gltf": {"file": gl.name, "sha256": hashlib.sha256(gl.read_bytes()).hexdigest(), "packets": len(g["extensions"]["KHR_xmp_json_ld"]["packets"]),
                    "nodes": len(g["nodes"]), "meshes": len(g.get("meshes", []))},
           "back": {"file": back.name, "sha256": hashlib.sha256(back.read_bytes()).hexdigest()},
           "hosts": len(a["hosts"]), "metadata_nodes": sum(1 for h in a["hosts"] for _ in walk_meta(h["metadata"])),
           "conversion": report, "rules": rs, "verdict": "pass" if all(r["pass"] for r in rs) else "fail"}
    (outdir / "semantic.json").write_text(json.dumps(res, indent=2) + "\n")
    return res


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] != "roundtrip":
        print(__doc__)
        sys.exit(2)
    r = roundtrip(Path(sys.argv[2]), Path(sys.argv[3]))
    print(json.dumps({k: r[k] for k in ("hosts", "metadata_nodes", "verdict")}), " ".join(f"{x['id']}:{'pass' if x['pass'] else 'FAIL'}" for x in r["rules"]))
    sys.exit(0 if r["verdict"] == "pass" else 1)
