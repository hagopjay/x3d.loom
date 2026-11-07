"""Traps witness: 'has this exact trap already cost us once?'

A portable, standard-library subset of the traps recorded in x3d.onto FACTS P/Q, the kickoff doc's
trap list and the Loomsong spec's five proposed rules. It reads the file only (cheap witness, runs
first). Each rule names the incident that paid for it and is tested on both sides in tests/test_traps.py.

Runtime-specific traps are labelled with the runtime they were observed on: a browser fact must not
become a universal X3D prohibition (Break-the-Loom TECHNICAL.md, Confluence debrief).
"""
from __future__ import annotations

import colorsys
import math
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

COLOR_FIELDS = {"diffuseColor", "emissiveColor", "specularColor", "baseColor", "color", "skyColor",
                "groundColor", "fogColor", "shadowColor"}
NODES_41_ONLY = {"GaussianSplats", "FontLibrary", "HAnimPose", "InlineGeometry", "RenderedTexture"}


@dataclass
class Hit:
    rule: str
    severity: str
    where: str
    detail: str


@dataclass
class Rule:
    id: str
    severity: str  # "error" stops the build; "warning" is listed
    runtime: str   # "any" or the runtime it was observed on
    origin: str    # the incident that paid for it
    hits: list = field(default_factory=list)


RULES = {
    "shader-raw-source": Rule("shader-raw-source", "error", "X_ITE 16.5.1",
                              "Pocket worlds drew white spheres: raw GLSL in a ShaderPart is read as a URL "
                              "(Lectures 1; FACTS P; gate rule merged 30 Oct)"),
    "route-before-def": Rule("route-before-def", "error", "X_ITE 16.5.1",
                             "A ROUTE written before its node: the fork passed it, X_ITE dropped it "
                             "(definition, Behaviour witness; fork 788041c)"),
    "route-undefined": Rule("route-undefined", "error", "any",
                            "A ROUTE naming a DEF that never exists (x3d.onto loom_gate route-undefined)"),
    "color-range": Rule("color-range", "error", "any",
                        "Colour above 1 fails the XSD with a message that blames a size limit (kickoff traps)"),
    "color-emissive-white": Rule("color-emissive-white", "warning", "X_ITE 16.5.1",
                                 "x3d-ray ring: red and blue faces drew 255 255 255 under white emissive (FACTS Q)"),
    "splat-bbox": Rule("splat-bbox", "error", "X_ITE 16.5.x",
                       "GaussianSplats without bboxSize/bboxCenter never finishes loading when culled "
                       "(definition, Video to world; Loomsong spec)"),
    "movie-not-still": Rule("movie-not-still", "error", "X_ITE 16.5.1",
                            "A still PNG in MovieTexture hangs the world (kickoff traps; Loomsong spec)"),
    "version-fits-nodes": Rule("version-fits-nodes", "error", "any",
                               "A 4.0 file rejects GaussianSplats, FontLibrary, HAnimPose, InlineGeometry, "
                               "RenderedTexture (kickoff traps)"),
    "no-script-under-host": Rule("no-script-under-host", "warning", "strict hosted-page policy",
                                 "The host policy refuses eval; drive the scene from page JS through SAI "
                                 "(kickoff traps; Lectures 3)"),
    "metadata-containerfield": Rule("metadata-containerfield", "warning", "X_ITE 16.5.1",
                                    "Valid metadata left unattached: X_ITE warned until containerField="
                                    "'metadata' was explicit (Gear-Loom TECHNICAL 8.1; Confluence debrief)"),
    "glsl-reserved-active": Rule("glsl-reserved-active", "warning", "X_ITE 16.5.1 GLSL ES 3.00",
                                 "Valid X3D, invalid GLSL: the identifier 'active' broke compilation "
                                 "(Loomsong Study 01, F01). Lexical guard only, not a GLSL validator"),
    # 7 Nov: two rebuilds of the same scenes by a second renderer (a three.js reader of the X3D) next to X_ITE.
    "color-keys-sparse": Rule("color-keys-sparse", "warning", "any (X3D specifies HSV; a reader that blends RGB disagrees)",
                              "A night sky drawn by two renderers from one file went through different colours between "
                              "keys: X_ITE blends ColorInterpolator keys in HSV as the standard says, the second reader in "
                              "RGB. Densify the keys until the two midpoints agree (7 Nov, failure mode 109)"),
    "xite-light-zero-pop": Rule("xite-light-zero-pop", "warning", "X_ITE 16.5.1",
                                "A light faded to intensity 0 kept its ambient term all the way down, then vanished at "
                                "the last key: X_ITE drops a light at intensity 0 and its ambient term ignores intensity. "
                                "Drive ambientIntensity down with it (7 Nov, failure mode 110)"),
    "xite-transparent-shadow": Rule("xite-transparent-shadow", "warning", "X_ITE 16.5.1",
                                    "A fully transparent shape still cast a shadow: X_ITE draws it into the shadow map. "
                                    "Give it castShadow='false' (7 Nov, failure mode 111)"),
    "loop-seam": Rule("loop-seam", "warning", "any",
                      "A looping clock's interpolators ended away from their first values, so the picture jumped at "
                      "every loop. Close the loop, or hide the reset (a fade to black) and say so on the card "
                      "(7 Nov, failure mode 112)"),
}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _floats(text: str) -> list[float]:
    out = []
    for tok in re.split(r"[\s,]+", text.strip()):
        if tok:
            try:
                out.append(float(tok))
            except ValueError:
                pass
    return out


def check(xml_bytes: bytes, profile: dict | None = None) -> list[Hit]:
    """Return every trap hit. Raises ET.ParseError if the bytes are not XML (that is Grammar's job)."""
    profile = profile or {}
    root = ET.fromstring(xml_bytes)
    hits: list[Hit] = []
    version = root.get("version", "")
    order = list(root.iter())
    first_def: dict[str, int] = {}
    for i, el in enumerate(order):
        d = el.get("DEF")
        if d and d not in first_def:
            first_def[d] = i
    parent = {c: p for p in order for c in p}

    for i, el in enumerate(order):
        tag = _local(el.tag)
        where = f"{tag}#{el.get('DEF') or el.get('USE') or i}"
        if tag == "ShaderPart":
            src = (el.text or "").strip()
            url = el.get("url", "")
            body = src or url
            if body and ("#version" in body or "void main" in body) and not re.match(r"^['\"]?\s*data:", body):
                hits.append(Hit("shader-raw-source", "error", where, "GLSL source without a data: prefix"))
            if re.search(r"\b(?:in|out|uniform|varying|attribute|float|int|bool|vec[234])\s+active\b", body):
                hits.append(Hit("glsl-reserved-active", "warning", where, "identifier 'active' declared"))
        if tag == "ROUTE":
            for end in ("fromNode", "toNode"):
                ref = el.get(end)
                if ref is None:
                    continue
                if ref not in first_def:
                    hits.append(Hit("route-undefined", "error", where, f"{end}={ref} has no DEF"))
                elif first_def[ref] > i:
                    hits.append(Hit("route-before-def", "error", where, f"{end}={ref} defined later"))
        for attr in COLOR_FIELDS & set(el.attrib):
            vals = _floats(el.get(attr, ""))
            if any(v < 0 or v > 1 for v in vals):
                hits.append(Hit("color-range", "error", where, f"{attr} outside [0,1]"))
        if tag == "Material":
            em = _floats(el.get("emissiveColor", "0 0 0"))
            dif = _floats(el.get("diffuseColor", "0.8 0.8 0.8"))
            if len(em) == 3 and min(em) >= 0.999 and len(dif) == 3 and max(dif) - min(dif) > 0.05:
                hits.append(Hit("color-emissive-white", "warning", where, "white emissive washes out a coloured diffuse"))
        if tag == "GaussianSplats" and not (el.get("bboxSize") and el.get("bboxCenter")):
            hits.append(Hit("splat-bbox", "error", where, "missing bboxSize or bboxCenter"))
        if tag == "MovieTexture" and re.search(r"\.(png|jpe?g)\b", el.get("url", ""), re.I):
            hits.append(Hit("movie-not-still", "error", where, "MovieTexture points at a still image"))
        if tag in NODES_41_ONLY and version and version < "4.1":
            hits.append(Hit("version-fits-nodes", "error", where, f"{tag} needs X3D 4.1, file declares {version}"))
        if tag == "Script" and profile.get("host") == "strict":
            hits.append(Hit("no-script-under-host", "warning", where, "Script node under a strict host policy"))
        if tag.startswith("Metadata") and el in parent:
            ptag = _local(parent[el].tag)
            if not ptag.startswith("Metadata") and ptag not in ("head", "X3D") and "containerField" not in el.attrib:
                hits.append(Hit("metadata-containerfield", "warning", where, "Metadata node without explicit containerField"))
    hits += _route_traps(order, parent)
    return hits


LIGHTS = {"DirectionalLight", "PointLight", "SpotLight"}


def _num(el, name: str, default: float) -> float:
    vals = _floats(el.get(name, ""))
    return vals[0] if vals else default


def _rgb_hsv_gap(a: list[float], b: list[float]) -> float:
    """Largest channel gap between the RGB midpoint and the HSV midpoint (shortest hue path) of two colours."""
    ha, hb = colorsys.rgb_to_hsv(*a), colorsys.rgb_to_hsv(*b)
    dh = (hb[0] - ha[0] + 0.5) % 1.0 - 0.5
    hsv = colorsys.hsv_to_rgb((ha[0] + dh / 2) % 1.0, (ha[1] + hb[1]) / 2, (ha[2] + hb[2]) / 2)
    return max(abs((x + y) / 2 - z) for x, y, z in zip(a, b, hsv))


def _same_value(tag: str, first: list[float], last: list[float]) -> bool:
    if tag == "OrientationInterpolator" and len(first) == 4 and len(last) == 4:
        def quat(v):
            n = math.sqrt(sum(c * c for c in v[:3])) or 1.0
            h = v[3] / 2
            return [math.cos(h)] + [c / n * math.sin(h) for c in v[:3]]
        return abs(sum(x * y for x, y in zip(quat(first), quat(last)))) > 1 - 1e-6
    return len(first) == len(last) and all(abs(x - y) <= 1e-6 for x, y in zip(first, last))


def _route_traps(order: list, parent: dict) -> list[Hit]:
    """Rules that need the ROUTE table: what drives what."""
    hits: list[Hit] = []
    defs = {}
    for el in order:
        if el.get("DEF") and el.get("DEF") not in defs:
            defs[el.get("DEF")] = el
    routes = [(r.get("fromNode"), r.get("fromField"), r.get("toNode"), r.get("toField"))
              for r in order if _local(r.tag) == "ROUTE"]
    drives = lambda node, *fields: [(f, defs.get(f)) for f, _, t, tf in routes
                                    if t == node and tf in fields]

    def where(el):
        return f"{_local(el.tag)}#{el.get('DEF') or order.index(el)}"

    # colour keys whose HSV and RGB midpoints disagree
    for el in order:
        if _local(el.tag) == "ColorInterpolator":
            v = _floats(el.get("keyValue", ""))
            cols = [v[i:i + 3] for i in range(0, len(v) - 2, 3)]
            worst = max((_rgb_hsv_gap(a, b) for a, b in zip(cols, cols[1:])), default=0.0)
            if worst > 0.1:
                hits.append(Hit("color-keys-sparse", "warning", where(el),
                                f"HSV and RGB midpoints differ by {worst:.2f} between adjacent keys"))
    # a light faded to 0 while its ambient term stays
    for name, light in defs.items():
        if _local(light.tag) not in LIGHTS or _num(light, "ambientIntensity", 0.0) <= 0:
            continue
        fades = [src for _, src in drives(name, "intensity", "set_intensity")
                 if src is not None and min(_floats(src.get("keyValue", "")) or [1.0]) <= 0]
        if fades and not drives(name, "ambientIntensity", "set_ambientIntensity"):
            hits.append(Hit("xite-light-zero-pop", "warning", where(light),
                            "intensity is driven to 0 but ambientIntensity is not driven"))
    # fully transparent shapes in a shadowed scene
    if any(_local(el.tag) in LIGHTS and el.get("shadows") == "true" for el in order):
        for el in order:
            if _local(el.tag) not in ("Material", "PhysicalMaterial", "UnlitMaterial"):
                continue
            clear = _num(el, "transparency", 0.0) >= 0.999
            if el.get("DEF"):
                clear = clear or any(src is not None and max(_floats(src.get("keyValue", "")) or [0.0]) >= 0.999
                                     for _, src in drives(el.get("DEF"), "transparency", "set_transparency"))
            shape = parent.get(parent.get(el))
            if clear and shape is not None and _local(shape.tag) == "Shape" and shape.get("castShadow") != "false":
                hits.append(Hit("xite-transparent-shadow", "warning", where(el),
                                "reaches transparency 1 in a scene with shadows; its Shape still casts"))
    # a looping clock whose interpolators do not come back
    for name, clock in defs.items():
        if _local(clock.tag) != "TimeSensor" or clock.get("loop") != "true":
            continue
        for f, ff, t, tf in routes:
            interp = defs.get(t)
            if f != name or ff != "fraction_changed" or interp is None or not _local(interp.tag).endswith("Interpolator"):
                continue
            k, v = _floats(interp.get("key", "")), _floats(interp.get("keyValue", ""))
            if len(k) < 2 or not v or len(v) % len(k) or k[0] > 1e-6 or k[-1] < 1 - 1e-6:
                continue
            n = len(v) // len(k)
            if not _same_value(_local(interp.tag), v[:n], v[-n:]):
                hits.append(Hit("loop-seam", "warning", where(interp),
                                f"loops on {name} but its last value differs from its first"))
    return hits
