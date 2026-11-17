"""Scene -> object-centric state, sliced per question, with a trust tier on every field.

"Decide what the state is before you ask" (the Mario build) and "send only what the question needs" (jaggedness failure
mode 5). X3D is already object-centric: nodes, typed fields, DEF names, ROUTEs. This module reads an X3D XML scene with the
standard library only and answers: which compact, computed facts does THIS question need, how big are they, and which
free-text fields stay out unless the caller opts in?

Tiers: 'computed' facts are derived by code from structure and numbers (counts, buckets, flags). 'untrusted' fields are free
text from the scene; they are excluded by default and, when included, quoted, capped, linted and withheld if flagged.
"""
from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from .buckets import color_name, count_bucket, size_bucket
from .untrusted import quote_untrusted

GEOMETRY = {"Box", "Sphere", "Cone", "Cylinder", "IndexedFaceSet", "IndexedTriangleSet", "IndexedTriangleFanSet",
            "IndexedTriangleStripSet", "TriangleSet", "TriangleFanSet", "TriangleStripSet", "IndexedQuadSet", "QuadSet",
            "ElevationGrid", "Extrusion", "PointSet", "IndexedLineSet", "LineSet", "Text", "Arc2D", "ArcClose2D", "Circle2D",
            "Disk2D", "Polyline2D", "Polypoint2D", "Rectangle2D", "TriangleSet2D", "GaussianSplats",
            "NurbsPatchSurface", "NurbsTrimmedSurface", "NurbsSweptSurface", "NurbsSwungSurface", "NurbsCurve",
            "NurbsSet", "GeoElevationGrid", "IndexedFaceSet", "Humanoid"}
MATERIALS = {"Material", "TwoSidedMaterial", "PhysicalMaterial", "UnlitMaterial"}
TEXTURES = {"ImageTexture", "PixelTexture", "MovieTexture", "MultiTexture", "ComposedCubeMapTexture", "GeneratedCubeMapTexture",
            "ImageCubeMapTexture", "ImageTexture3D", "ComposedTexture3D", "PixelTexture3D", "TextureBackground"}
SHADERS = {"ComposedShader", "ShaderProgram", "ShaderPart", "PackagedShader", "ProgramShader", "Effect", "EffectPart"}
LIGHTS = {"DirectionalLight", "PointLight", "SpotLight", "EnvironmentLight"}
PHYSICS = {"RigidBody", "RigidBodyCollection", "CollisionCollection", "CollisionSensor", "CollidableShape", "CollidableOffset",
           "BallJoint", "SingleAxisHingeJoint", "UniversalJoint", "SliderJoint", "DoubleAxisHingeJoint", "MotorJoint",
           "ContactNode", "Contact", "Collision"}
URL_NODES = {"Inline", "ImageTexture", "MovieTexture", "AudioClip", "ExternalProtoDeclare", "ProtoInstance", "ShaderPart",
             "ShaderProgram", "Script", "ImageTexture3D", "ImageCubeMapTexture", "BufferAudioSource"}

_MFSTRING = re.compile(r'"((?:[^"\\]|\\.)*)"')
_FLOATS = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def mfstring(value: str | None) -> list[str]:
    """Parse an MFString attribute value: "a" "b" -> ['a', 'b']. A bare unquoted value is returned as one string."""
    if value is None:
        return []
    items = _MFSTRING.findall(value)
    if items:
        return [i.replace('\\"', '"').replace("\\\\", "\\") for i in items]
    v = value.strip()
    return [v] if v else []


def floats(value: str | None) -> list[float]:
    return [float(x) for x in _FLOATS.findall(value or "")]


@dataclass
class Scene:
    root: ET.Element
    raw_bytes: int
    sha256: str
    version: str | None
    profile: str | None


MAX_BYTES = 64 * 1024 * 1024          # refuse larger inputs; callers may pass max_bytes to lower or raise it
_ENTITY = re.compile(rb"<!ENTITY", re.I)


class SceneRefused(ValueError):
    """The input was not parsed: too large, or it declares entities. Carries a stable S1_* code."""
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"{code}: {message}")


def load(source: str | bytes, max_bytes: int = MAX_BYTES) -> Scene:
    """Parse X3D XML from bytes/str, or from a path if `source` is a str that does not start with '<'.

    Untrusted input: refuses anything over `max_bytes` and any document that declares an entity (the standard X3D
    DOCTYPE line is fine; it is never fetched). Raises SceneRefused with S1_TOO_LARGE or S1_ENTITY."""
    if isinstance(source, str) and not source.lstrip().startswith("<"):
        with open(source, "rb") as fh:
            data = fh.read()
    elif isinstance(source, str):
        data = source.encode("utf-8")
    else:
        data = source
    if len(data) > max_bytes:
        raise SceneRefused("S1_TOO_LARGE", f"{len(data)} bytes exceeds the {max_bytes}-byte limit")
    if _ENTITY.search(data):
        raise SceneRefused("S1_ENTITY", "the document declares an entity; refused before parsing")
    root = ET.fromstring(data)
    if root.tag != "X3D":
        raise SceneRefused("S1_NOT_X3D", f"not an X3D XML document (root is {root.tag!r})")
    return Scene(root, len(data), hashlib.sha256(data).hexdigest(), root.get("version"), root.get("profile"))


def _walk(root: ET.Element):
    """Iterative depth-first walk yielding (element, depth)."""
    stack = [(root, 0)]
    while stack:
        el, d = stack.pop()
        yield el, d
        for ch in reversed(list(el)):
            stack.append((ch, d + 1))


# ---------------------------------------------------------------- facets (computed tier)

def f_header(sc: Scene) -> dict:
    head = sc.root.find("head")
    comps = []
    meta_names = []
    if head is not None:
        for c in head.findall("component"):
            comps.append({"name": c.get("name"), "level": c.get("level")})
        meta_names = sorted({m.get("name") for m in head.findall("meta") if m.get("name")})
    return {"version": sc.version, "profile": sc.profile, "components": comps, "meta_keys": meta_names}


def f_census(sc: Scene, top_k: int = 12) -> dict:
    tags = Counter()
    maxd = 0
    defs = uses = 0
    n = 0
    for el, d in _walk(sc.root):
        if el.tag in ("X3D", "head", "Scene", "meta", "component", "unit", "field", "fieldValue", "IS", "connect"):
            continue
        n += 1
        tags[el.tag] += 1
        maxd = max(maxd, d)
        if el.get("DEF"): defs += 1
        if el.get("USE"): uses += 1
    return {"elements": n, "size": size_bucket(n), "distinct_types": len(tags), "max_depth": maxd, "defs": defs, "uses": uses,
            "top_types": dict(tags.most_common(top_k))}


def f_geometry(sc: Scene) -> dict:
    kinds = Counter()
    verts = 0
    geo = 0
    for el, _ in _walk(sc.root):
        t = el.tag
        if t in GEOMETRY and t != "Humanoid":
            kinds[t] += 1
        if t.startswith("Geo") and t not in ("GeoMetadata",):
            geo += 1
        if t == "Coordinate":
            verts += len(floats(el.get("point"))) // 3
        elif t == "GaussianSplats":
            verts += len(floats(el.get("centers"))) // 3
    shapes = sum(1 for el, _ in _walk(sc.root) if el.tag == "Shape")
    return {"shapes": shapes, "geometry_types": dict(kinds), "vertices": verts, "vertices_bucket": size_bucket(verts // 4),
            "geo_nodes": geo}


def _rgb(el: ET.Element, attr: str):
    v = floats(el.get(attr))
    return v[:3] if len(v) >= 3 else None


def f_appearance(sc: Scene) -> dict:
    mats = Counter(); texs = Counter(); shaders = 0; colors = Counter(); transparent = 0
    for el, _ in _walk(sc.root):
        t = el.tag
        if t in MATERIALS:
            mats[t] += 1
            for a in ("diffuseColor", "baseColor", "emissiveColor"):
                rgb = _rgb(el, a)
                if rgb:
                    colors[color_name(*rgb)] += 1
                    break
            tr = floats(el.get("transparency"))
            if tr and tr[0] > 0: transparent += 1
        elif t in TEXTURES:
            texs[t] += 1
        elif t in SHADERS:
            shaders += 1
    model = "none"
    if mats:
        kinds = set(mats)
        model = ("mixed" if len({"PhysicalMaterial" in kinds, "Material" in kinds or "TwoSidedMaterial" in kinds}) == 2 and "PhysicalMaterial" in kinds and (kinds & {"Material", "TwoSidedMaterial"})
                 else "pbr" if kinds == {"PhysicalMaterial"} else "unlit" if kinds == {"UnlitMaterial"} else "classic")
    return {"material_model": model, "materials": dict(mats), "textures": dict(texs), "shader_nodes": shaders,
            "transparent_materials": transparent, "diffuse_color_names": dict(colors.most_common(8))}


def f_lighting(sc: Scene) -> dict:
    lights = Counter(); headlight = None
    for el, _ in _walk(sc.root):
        if el.tag in LIGHTS:
            lights[el.tag] += 1
        elif el.tag == "NavigationInfo":
            hl = el.get("headlight")
            headlight = (hl or "true").strip().lower() != "false" if headlight is None else (headlight or (hl or "true").strip().lower() != "false")
    return {"lights": dict(lights), "light_count": sum(lights.values()), "headlight": True if headlight is None else headlight,
            "has_scene_lights": bool(lights)}


def f_behavior(sc: Scene) -> dict:
    c = Counter({"timers": 0, "interpolators": 0, "sensors": 0, "physics_nodes": 0, "sequencers": 0})
    routes = 0; scripts = 0; protos = 0; langs = Counter()
    for el, _ in _walk(sc.root):
        t = el.tag
        if t == "ROUTE": routes += 1
        elif t == "Script":
            scripts += 1
            u = " ".join(mfstring(el.get("url"))) + " " + (el.text or "")[:40]
            langs["ecmascript" if ("ecmascript" in u.lower() or "javascript" in u.lower() or "function" in u) else "other"] += 1
        elif t in ("ProtoDeclare", "ExternalProtoDeclare"): protos += 1
        elif t.endswith("Interpolator"): c["interpolators"] += 1
        elif t == "TimeSensor": c["timers"] += 1; c["sensors"] += 1
        elif t.endswith("Sensor"): c["sensors"] += 1
        elif t in PHYSICS: c["physics_nodes"] += 1
        elif t.endswith("Sequencer"): c["sequencers"] += 1
    return {"routes": routes, "scripts": scripts, "script_languages": dict(langs), "protos": protos, **dict(c)}


def f_hanim(sc: Scene) -> dict:
    c = Counter(el.tag for el, _ in _walk(sc.root) if el.tag.startswith("HAnim"))
    return {"hanim_nodes": sum(c.values()), "humanoids": c.get("HAnimHumanoid", 0), "joints": c.get("HAnimJoint", 0)}


def f_refs(sc: Scene) -> dict:
    schemes = Counter(); n = 0
    for el, _ in _walk(sc.root):
        if el.tag in URL_NODES and el.get("url"):
            for u in mfstring(el.get("url")):
                n += 1
                m = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", u)
                schemes[(m.group(1).lower() if m else "relative")] += 1
    return {"url_refs": n, "url_schemes": dict(schemes), "has_remote_refs": any(s in schemes for s in ("http", "https", "ftp"))}


def f_view(sc: Scene) -> dict:
    vp = sum(1 for el, _ in _walk(sc.root) if el.tag in ("Viewpoint", "OrthoViewpoint", "GeoViewpoint"))
    nav = sorted({t for el, _ in _walk(sc.root) if el.tag == "NavigationInfo" for t in mfstring(el.get("type"))})
    return {"viewpoints": vp, "navigation_types": nav}


# ---------------------------------------------------------------- facets (untrusted tier)

_TEXT_ATTRS = {"MetadataString": ("value",), "WorldInfo": ("title", "info"), "Text": ("string",), "Viewpoint": ("description",),
               "Anchor": ("description",), "GeoViewpoint": ("description",), "OrthoViewpoint": ("description",),
               "MetadataSet": ("name",), "MetadataInteger": ("name",), "MetadataFloat": ("name",), "MetadataDouble": ("name",),
               "MetadataBoolean": ("name",)}


def f_text(sc: Scene, cap: int = 120, max_items: int = 24) -> dict:
    items = []; total = 0
    head = sc.root.find("head")
    if head is not None:
        for m in head.findall("meta"):
            for a in ("name", "content"):
                if m.get(a):
                    total += 1
                    if len(items) < max_items: items.append({"where": f"meta@{a}", **quote_untrusted(m.get(a), cap)})
    for el, _ in _walk(sc.root):
        for a in _TEXT_ATTRS.get(el.tag, ()):
            vals = mfstring(el.get(a)) if a in ("value", "info", "string") else ([el.get(a)] if el.get(a) else [])
            for v in vals:
                total += 1
                if len(items) < max_items: items.append({"where": f"{el.tag}@{a}", **quote_untrusted(v, cap)})
        if el.tag in ("Script", "ShaderPart", "ShaderProgram") and (el.text or "").strip():
            total += 1
            body = el.text
            rec = quote_untrusted(body, 0, withhold_flagged=False)  # bodies are NEVER included: hash + flags only
            rec.pop("text", None); rec["withheld"] = True; rec["kind"] = "code-body"
            if len(items) < max_items: items.append({"where": f"{el.tag}.body", **rec})
    return {"items": items, "total": total, "shown": len(items), "flagged": sum(1 for i in items if i.get("flags"))}


def f_names(sc: Scene, cap: int = 40, max_items: int = 40) -> dict:
    names = []; total = 0
    for el, _ in _walk(sc.root):
        d = el.get("DEF")
        if d:
            total += 1
            if len(names) < max_items: names.append(quote_untrusted(d, cap))
    return {"def_names": names, "total": total, "shown": len(names)}


FACETS = {
    "header": (f_header, "computed"), "census": (f_census, "computed"), "geometry": (f_geometry, "computed"),
    "appearance": (f_appearance, "computed"), "lighting": (f_lighting, "computed"), "behavior": (f_behavior, "computed"),
    "hanim": (f_hanim, "computed"), "refs": (f_refs, "computed"), "view": (f_view, "computed"),
    "text": (f_text, "untrusted"), "names": (f_names, "untrusted"),
}
# shrink order when a budget is tight: drop these first
DROP_ORDER = ["names", "text", "view", "refs", "hanim", "behavior", "lighting", "appearance", "geometry", "census", "header"]


def jsize(obj) -> int:
    return len(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def slice_state(scene: Scene | str | bytes, facets: Iterable[str] | None = None, include_untrusted: bool = False,
                budget_bytes: int | None = None) -> dict:
    """Return {'state': {...}, 'meta': {...}}. `state` holds only the requested computed facets (plus untrusted ones when
    asked). `meta` reports bytes, raw bytes, what was dropped (never silently), and the scene hash for receipts."""
    sc = scene if isinstance(scene, Scene) else load(scene)
    want = list(facets) if facets is not None else [f for f, (_, t) in FACETS.items() if t == "computed"]
    unknown = [f for f in want if f not in FACETS]
    if unknown:
        raise KeyError(f"unknown facets {unknown}; known: {sorted(FACETS)}")
    dropped_untrusted = [f for f in want if FACETS[f][1] == "untrusted"] if not include_untrusted else []
    use = [f for f in want if f not in dropped_untrusted]
    state = {f: FACETS[f][0](sc) for f in use}
    dropped = []
    if budget_bytes is not None:
        for victim in DROP_ORDER:
            if jsize(state) <= budget_bytes: break
            if victim in state and len(state) > 1:
                dropped.append(victim); del state[victim]
        if jsize(state) > budget_bytes and "census" in state:  # last resort: shrink the type histogram
            state["census"]["top_types"] = dict(list(state["census"]["top_types"].items())[:3])
    n = jsize(state)
    return {"state": state, "meta": {"facets": list(state), "bytes": n, "raw_bytes": sc.raw_bytes,
                                       "ratio": round(sc.raw_bytes / n, 2) if n else None, "scene_sha256": sc.sha256,
                                       "untrusted_included": include_untrusted and any(FACETS[f][1] == "untrusted" for f in state),
                                       "excluded_untrusted": dropped_untrusted, "dropped_for_budget": dropped,
                                       "budget_bytes": budget_bytes}}


def approx_tokens(nbytes: int) -> int:
    """Rough token estimate for budgeting only (about 4 bytes per token for JSON). Not a tokenizer; grade [S]."""
    return (nbytes + 3) // 4
