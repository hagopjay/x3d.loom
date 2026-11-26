#!/usr/bin/env python3
"""Fault Court: one small scene written natively in X3D 4.0, glTF 2.0 and USD; 60 planted faults in 6 format-neutral
families, 10 decoys (legal but unusual) and a clean control, each written by that format's own writer (no conversion).

    python3 court.py build OUT        writes OUT/<format>/<case>.<ext> and OUT/cases.json
A writer returns None when a format cannot state the fault (NE) and "NA" when the edit is legal in that format.
"""
from __future__ import annotations
import base64, copy, json, math, struct, sys
from pathlib import Path
from lxml import etree

PNG = base64.b64decode(  # 2x2 RGBA PNG
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDGgAQYkCQBWkwID0ZgLsQAAAABJRU5ErkJggg==")

# ---------------------------------------------------------------- the scene (shared intent)
CUBE_P = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
CUBE_T = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (2, 3, 7), (2, 7, 6), (1, 2, 6), (1, 6, 5), (0, 4, 7), (0, 7, 3)]
CUBE_N = [tuple(c / math.sqrt(3) for c in p) for p in CUBE_P]
CUBE_UV = [(0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1)]
CUBE_C = [(0.8, 0.2, 0.2)] * 8
KEYS = [0.0, 0.5, 1.0]
KEYV = [(0, 0, 0), (0, 1, 0), (0, 0, 0)]


def base():
    return {"translation": [0, 0, 0], "rotation_axis_angle": [0, 1, 0, 0], "quat": [0, 0, 0, 1], "scale": [1, 1, 1],
            "P": [list(p) for p in CUBE_P], "T": [list(t) for t in CUBE_T], "N": [list(n) for n in CUBE_N], "UV": [list(u) for u in CUBE_UV],
            "C": [list(c) for c in CUBE_C], "base_color": [0.8, 0.8, 0.8], "emissive": [0, 0, 0], "alpha": 1.0, "metallic": 0.0,
            "roughness": 0.5, "texture": "tex.png", "box": 1.0, "keys": list(KEYS), "keyv": [list(v) for v in KEYV], "cycle": 2.0,
            "fov": 0.785398, "near": 0.1, "far": 100.0, "aspect": 1.5, "units_m": 1.0, "meta_float": "0.5", "version": None}


# ---------------------------------------------------------------- X3D 4.0 writer
def x3d_tree(s):
    f = lambda v: " ".join(fmt(x) for x in v)
    X = etree.Element("X3D", profile="Full", version="4.0")
    head = etree.SubElement(X, "head")
    etree.SubElement(head, "unit", category="length", name="metre", conversionFactor=fmt(s["units_m"]))
    etree.SubElement(head, "meta", name="title", content="fault-court")
    S = etree.SubElement(X, "Scene")
    etree.SubElement(S, "WorldInfo", DEF="Info", title="fault-court").append(
        etree.Element("MetadataFloat", name="weight", value=s["meta_float"], containerField="metadata"))
    etree.SubElement(S, "Viewpoint", DEF="Cam", position="0 0 8", fieldOfView=fmt(s["fov"]), nearDistance=fmt(s["near"]), farDistance=fmt(s["far"]))
    T = etree.SubElement(S, "Transform", DEF="Body", translation=f(s["translation"]), rotation=f(s["rotation_axis_angle"]), scale=f(s["scale"]))
    sh = etree.SubElement(T, "Shape", DEF="CubeShape")
    ap = etree.SubElement(sh, "Appearance", DEF="Look")
    m = etree.SubElement(ap, "PhysicalMaterial", DEF="Mat", baseColor=f(s["base_color"]), emissiveColor=f(s["emissive"]),
                         transparency=fmt(1 - s["alpha"]), metallic=fmt(s["metallic"]), roughness=fmt(s["roughness"]))
    etree.SubElement(m, "ImageTexture", DEF="Tex", url=f'"{s["texture"]}"', containerField="baseTexture")
    ifs = etree.SubElement(sh, "IndexedFaceSet", DEF="Cube", solid="true",
                           coordIndex=" ".join(" ".join(str(i) for i in t) + " -1" for t in s["T"]))
    etree.SubElement(ifs, "Coordinate", DEF="CubeCoord", point=", ".join(f(p) for p in s["P"]))
    etree.SubElement(ifs, "Normal", vector=", ".join(f(n) for n in s["N"]))
    etree.SubElement(ifs, "TextureCoordinate", point=", ".join(f(u) for u in s["UV"]))
    etree.SubElement(ifs, "Color", color=", ".join(f(c) for c in s["C"]))
    T2 = etree.SubElement(S, "Transform", DEF="Side", translation="3 0 0")
    sh2 = etree.SubElement(T2, "Shape")
    etree.SubElement(sh2, "Box", size=f([s["box"]] * 3))
    etree.SubElement(S, "TimeSensor", DEF="Clock", cycleInterval=fmt(s["cycle"]), loop="true")
    etree.SubElement(S, "PositionInterpolator", DEF="Mover", key=f(s["keys"]), keyValue=", ".join(f(v) for v in s["keyv"]))
    etree.SubElement(S, "ROUTE", fromNode="Clock", fromField="fraction_changed", toNode="Mover", toField="set_fraction")
    etree.SubElement(S, "ROUTE", fromNode="Mover", fromField="value_changed", toNode="Body", toField="set_translation")
    return X


def fmt(x):
    if isinstance(x, str):
        return x
    if isinstance(x, float) and math.isnan(x):
        return "NaN"
    if isinstance(x, float) and math.isinf(x):
        return "INF" if x > 0 else "-INF"
    return repr(round(x, 6)) if isinstance(x, float) else str(x)


def x3d_text(X):
    return etree.tostring(X, xml_declaration=True, encoding="UTF-8", pretty_print=True,
                          doctype='<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">').decode()


# ---------------------------------------------------------------- glTF 2.0 writer
def gltf_doc(s):
    arrays = {  # name -> (componentType, type, flat list, target)
        "P": (5126, "VEC3", s["P"], 34962), "N": (5126, "VEC3", s["N"], 34962), "UV": (5126, "VEC2", s["UV"], 34962),
        "C": (5126, "VEC3", s["C"], 34962), "IDX": (5125, "SCALAR", [i for t in s["T"] for i in t], 34963),
        "KEYS": (5126, "SCALAR", s["keys"], None), "KEYV": (5126, "VEC3", s["keyv"], None)}
    q = s["quat"]
    g = {"asset": {"version": "2.0", "generator": "fault-court"},
         "scene": 0, "scenes": [{"nodes": [0, 1, 2]}],
         "nodes": [{"name": "Body", "mesh": 0, "translation": s["translation"], "rotation": q, "scale": s["scale"]},
                   {"name": "Side", "mesh": 1, "translation": [3, 0, 0]},
                   {"name": "Cam", "camera": 0, "translation": [0, 0, 8]}],
         "meshes": [{"name": "Cube", "primitives": [{"attributes": {"POSITION": "P", "NORMAL": "N", "TEXCOORD_0": "UV", "COLOR_0": "C"},
                                                      "indices": "IDX", "material": 0, "mode": 4}]},
                    {"name": "Box", "primitives": [{"attributes": {"POSITION": "P"}, "indices": "IDX", "material": 1}]}],
         "materials": [{"name": "Mat", "pbrMetallicRoughness": {"baseColorFactor": s["base_color"] + [s["alpha"]], "metallicFactor": s["metallic"],
                                                               "roughnessFactor": s["roughness"], "baseColorTexture": {"index": 0}},
                        "emissiveFactor": s["emissive"], "alphaMode": "BLEND" if s["alpha"] < 1 else "OPAQUE"},
                       {"name": "Plain", "pbrMetallicRoughness": {"baseColorFactor": [0.5, 0.5, 0.5, 1.0]}}],
         "textures": [{"source": 0, "sampler": 0}], "samplers": [{"wrapS": 10497, "wrapT": 10497}],
         "images": [{"uri": s["texture"]}],
         "cameras": [{"type": "perspective", "perspective": {"yfov": s["fov"], "znear": s["near"], "zfar": s["far"], "aspectRatio": s["aspect"]}}],
         "animations": [{"name": "Mover", "samplers": [{"input": "KEYS", "output": "KEYV", "interpolation": "LINEAR"}],
                         "channels": [{"sampler": 0, "target": {"node": 0, "path": "translation"}}]}],
         "extras": {"weight": s["meta_float"]}}
    return g, arrays


def gltf_pack(g, arrays):
    g = copy.deepcopy(g)
    blob, views, accs, idx = b"", [], [], {}
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
    for name, (ct, ty, data, target) in arrays.items():
        flat = [x for v in data for x in (v if isinstance(v, (list, tuple)) else [v])]
        b = struct.pack(f"<{len(flat)}{'I' if ct == 5125 else 'f'}", *flat)
        while len(blob) % 4:
            blob += b"\0"
        view = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(b)}
        if target:
            view["target"] = target
        views.append(view); blob += b
        n = len(flat) // ncomp[ty]
        acc = {"bufferView": len(views) - 1, "componentType": ct, "count": n, "type": ty}
        if name in ("P", "KEYS"):
            k = ncomp[ty]
            cols = [flat[i::k] for i in range(k)]
            finite = [[c for c in col if math.isfinite(c)] or [0] for col in cols]
            acc["min"] = [min(c) for c in finite]; acc["max"] = [max(c) for c in finite]
        idx[name] = len(accs); accs.append(acc)
    for m in g["meshes"]:
        for p in m["primitives"]:
            p["attributes"] = {k: idx[v] if isinstance(v, str) else v for k, v in p["attributes"].items()}
            if isinstance(p.get("indices"), str):
                p["indices"] = idx[p["indices"]]
    for a in g.get("animations", []):
        for sm in a["samplers"]:
            for k in ("input", "output"):
                if isinstance(sm[k], str):
                    sm[k] = idx[sm[k]]
    for k, v in g.pop("_acc_patch", {}).items():  # fault hooks on accessors by array name
        accs[idx[k]].update(v)
    g["accessors"], g["bufferViews"] = accs, views
    g["buffers"] = [{"byteLength": len(blob), "uri": "data:application/octet-stream;base64," + base64.b64encode(blob).decode()}]
    return json.dumps(g, indent=1, allow_nan=True)


# ---------------------------------------------------------------- USD writer (usda text, so faults can be planted as written)
def usd_doc(s):
    f3 = lambda v: "(" + ", ".join(fmtu(x) for x in v) + ")"
    return {
        "layer": {"defaultPrim": '"World"', "metersPerUnit": fmtu(s["units_m"]), "upAxis": '"Y"', "startTimeCode": "0", "endTimeCode": "48",
                  "timeCodesPerSecond": "24"},
        "prims": [
            ["/World", "Xform", {}, {}],
            ["/World/Body", "Xform", {"double3 xformOp:translate": f3(s["translation"]), "quatf xformOp:orient": "(" + ", ".join(fmtu(x) for x in [s["quat"][3]] + s["quat"][:3]) + ")",
                                      "float3 xformOp:scale": f3(s["scale"]), "uniform token[] xformOpOrder": '["xformOp:translate", "xformOp:orient", "xformOp:scale"]',
                                      "double3 xformOp:translate.timeSamples": "{" + ", ".join(f"{fmtu(k * 48)}: {f3(v)}" for k, v in zip(s["keys"], s["keyv"])) + "}"}, {}],
            ["/World/Body/Cube", "Mesh", {"point3f[] points": "[" + ", ".join(f3(p) for p in s["P"]) + "]",
                                          "int[] faceVertexCounts": "[" + ", ".join(str(len(t)) for t in s["T"]) + "]",
                                          "int[] faceVertexIndices": "[" + ", ".join(str(i) for t in s["T"] for i in t) + "]",
                                          "normal3f[] normals": "[" + ", ".join(f3(n) for n in s["N"]) + "]", "normals:interpolation": '"vertex"',
                                          "texCoord2f[] primvars:st": "[" + ", ".join(f3(u) for u in s["UV"]) + "]", "primvars:st:interpolation": '"vertex"',
                                          "color3f[] primvars:displayColor": "[" + ", ".join(f3(c) for c in s["C"]) + "]", "primvars:displayColor:interpolation": '"vertex"',
                                          "float3[] extent": "[(-1, -1, -1), (1, 1, 1)]", "uniform token subdivisionScheme": '"none"'},
             {"material:binding": "</World/Looks/Mat>"}],
            ["/World/Side", "Xform", {"double3 xformOp:translate": "(3, 0, 0)", "uniform token[] xformOpOrder": '["xformOp:translate"]'}, {}],
            ["/World/Side/Box", "Cube", {"double size": fmtu(s["box"]), "float3[] extent": f"[({-s['box'] / 2}, {-s['box'] / 2}, {-s['box'] / 2}), ({s['box'] / 2}, {s['box'] / 2}, {s['box'] / 2})]"}, {}],
            ["/World/Cam", "Camera", {"float focalLength": fmtu(18 / math.tan(s["fov"] / 2) if s["fov"] not in (0,) and math.isfinite(s["fov"]) else 0),
                                      "float verticalAperture": "36", "float horizontalAperture": fmtu(36 * s["aspect"]),
                                      "float2 clippingRange": f"({fmtu(s['near'])}, {fmtu(s['far'])})", "token projection": '"perspective"',
                                      "double3 xformOp:translate": "(0, 0, 8)", "uniform token[] xformOpOrder": '["xformOp:translate"]'}, {}],
            ["/World/Looks", "Scope", {}, {}],
            ["/World/Looks/Mat", "Material", {"token outputs:surface.connect": "</World/Looks/Mat/Surf.outputs:surface>"}, {}],
            ["/World/Looks/Mat/Surf", "Shader", {"uniform token info:id": '"UsdPreviewSurface"', "color3f inputs:diffuseColor.connect": "</World/Looks/Mat/Tex.outputs:rgb>",
                                                 "color3f inputs:emissiveColor": f3(s["emissive"]), "float inputs:opacity": fmtu(s["alpha"]),
                                                 "float inputs:metallic": fmtu(s["metallic"]), "float inputs:roughness": fmtu(s["roughness"]),
                                                 "token outputs:surface": ""}, {}],
            ["/World/Looks/Mat/Tex", "Shader", {"uniform token info:id": '"UsdUVTexture"', "asset inputs:file": f"@{s['texture']}@",
                                                "token inputs:wrapS": '"repeat"', "float4 inputs:fallback": "(" + ", ".join(fmtu(x) for x in s["base_color"] + [1.0]) + ")", "float3 outputs:rgb": ""}, {}],
        ],
        "customData": {"weight": s["meta_float"]}}


def fmtu(x):
    if isinstance(x, str):
        return x
    if isinstance(x, float) and math.isnan(x):
        return "nan"
    if isinstance(x, float) and math.isinf(x):
        return "inf" if x > 0 else "-inf"
    return repr(round(x, 6)) if isinstance(x, float) else str(x)


def usd_text(d):
    L = [d.get("header", "#usda 1.0"), "("] + [f"    {k} = {v}" for k, v in d["layer"].items()] + [f'    customLayerData = {{ string weight = "{d["customData"]["weight"]}" }}', ")", ""]
    def emit(path, depth):
        kids = [p for p in d["prims"] if p[0].rsplit("/", 1)[0] == path and p[0] != path]
        me = next(p for p in d["prims"] if p[0] == path)
        ind = "    " * depth
        out = [f'{ind}def {me[1]} "{path.rsplit("/", 1)[1]}"' + (" (\n" + ind + "    prepend apiSchemas = [\"MaterialBindingAPI\"]\n" + ind + ")" if me[3].get("material:binding") else ""), ind + "{"]
        for k, v in me[2].items():
            if k.endswith(":interpolation"):
                continue
            meta = ""
            interp = me[2].get(k.split(" ", 1)[1] + ":interpolation") if " " in k else None
            if interp:
                meta = f" (\n{ind}        interpolation = {interp}\n{ind}    )"
            out.append(f"{ind}    {k}" + (f" = {v}" if v != "" else "") + meta)
        for k, v in me[3].items():
            out.append(f"{ind}    rel {k} = {v}")
        for kid in kids:
            out += [""] + emit(kid[0], depth + 1)
        out.append(ind + "}")
        return out
    return "\n".join(L + emit("/World", 0)) + "\n"
