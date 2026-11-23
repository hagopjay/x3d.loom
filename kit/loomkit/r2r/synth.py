"""A small world R2R can be tested in without anyone else's files or tools.

`scenes(n, seed)` writes n plain, valid-looking X3D 4.0 scenes: lights, viewpoints, nested Transforms, Shapes with
primitive and indexed geometry, a few animations. `mutants(...)` cuts them the way a chaos round does, one edit per
file, and keeps the clean scene as the twin.

Nothing here is evidence about any real tool. It exists so that the engine can be asked a question whose answer is
known: a HIDDEN rule plays the tool (oracles.RuleOracle), the engine is given only the receipts, and the test is whether
it finds the rule again. The same world, with a tool that fails at random, tests the other side: no rule should come out.
"""
from __future__ import annotations

import random

from . import plant
from .doc import Doc

BOOL_SPELLINGS = ["TRUE", "FALSE", "True", "False", "1", "0", "yes", "no", "on", "t"]
COLORS = ["1 0 0", "0 1 0", "0 0 1", "0.8 0.6 0.2", "0.2 0.4 0.9", "1 1 1", "0.1 0.1 0.1"]


def _b(rng) -> str:
    return rng.choice(["true", "false"])


def _f(rng, lo=0.0, hi=1.0, nd=2) -> str:
    return f"{rng.uniform(lo, hi):.{nd}f}".rstrip("0").rstrip(".") or "0"


def _vec(rng, lo=-5.0, hi=5.0) -> str:
    return " ".join(_f(rng, lo, hi) for _ in range(3))


def _geometry(rng) -> str:
    k = rng.randrange(8)
    if k == 0:
        return f'<Box size="{_vec(rng, 0.2, 3)}" solid="{_b(rng)}"/>'
    if k == 1:
        return f'<Sphere radius="{_f(rng, 0.2, 2)}" solid="{_b(rng)}"/>'
    if k == 2:
        return f'<Cylinder radius="{_f(rng, 0.2, 2)}" height="{_f(rng, 0.5, 4)}" bottom="{_b(rng)}" top="{_b(rng)}" side="{_b(rng)}"/>'
    if k == 3:
        return f'<Cone bottomRadius="{_f(rng, 0.2, 2)}" height="{_f(rng, 0.5, 4)}" bottom="{_b(rng)}"/>'
    if k in (4, 5):
        n = rng.randrange(4, 9)
        pts = " ".join(_vec(rng) for _ in range(n))
        faces = []
        for _ in range(rng.randrange(2, 6)):
            faces += [str(i) for i in rng.sample(range(n), 3)] + ["-1"]
        return (f'<IndexedFaceSet solid="{_b(rng)}" ccw="{_b(rng)}" convex="{_b(rng)}" creaseAngle="{_f(rng, 0, 3)}" '
                f'coordIndex="{" ".join(faces)}"><Coordinate point="{pts}"/></IndexedFaceSet>')
    if k == 6:
        n = rng.randrange(3, 7)
        pts = " ".join(_vec(rng) for _ in range(n))
        return (f'<IndexedLineSet colorPerVertex="{_b(rng)}" coordIndex="{" ".join(str(i) for i in range(n))} -1">'
                f'<Coordinate point="{pts}"/></IndexedLineSet>')
    n = rng.randrange(3, 7)
    return f'<PointSet><Coordinate point="{" ".join(_vec(rng) for _ in range(n))}"/></PointSet>'


def _shape(rng) -> str:
    mat = (f'<Material diffuseColor="{rng.choice(COLORS)}" transparency="{_f(rng)}" shininess="{_f(rng)}"/>')
    return f'<Shape castShadow="{_b(rng)}"><Appearance>{mat}</Appearance>{_geometry(rng)}</Shape>'


def _tree(rng, depth: int, names: list) -> str:
    if depth <= 0 or rng.random() < 0.35:
        return _shape(rng)
    kids = "".join(_tree(rng, depth - 1, names) for _ in range(rng.randrange(1, 4)))
    if rng.random() < 0.3:
        return f'<Group visible="{_b(rng)}">{kids}</Group>'
    name = f"T{len(names)}"
    names.append(name)
    return f'<Transform DEF="{name}" translation="{_vec(rng)}" scale="{_vec(rng, 0.5, 2)}">{kids}</Transform>'


def scene(rng: random.Random) -> bytes:
    names: list = []
    body = [f'<WorldInfo title="synthetic scene {rng.randrange(10 ** 6)}"/>',
            f'<Viewpoint description="view" position="{_vec(rng, -10, 10)}" fieldOfView="{_f(rng, 0.3, 1.2)}"/>']
    if rng.random() < 0.6:
        body.append(f'<NavigationInfo headlight="{_b(rng)}" type=\'"EXAMINE" "ANY"\'/>')
    for _ in range(rng.randrange(0, 3)):
        if rng.random() < 0.6:
            body.append(f'<DirectionalLight on="{_b(rng)}" global="{_b(rng)}" intensity="{_f(rng)}" direction="{_vec(rng, -1, 1)}"/>')
        else:
            body.append(f'<PointLight on="{_b(rng)}" intensity="{_f(rng)}" location="{_vec(rng)}" radius="{_f(rng, 1, 50)}"/>')
    for _ in range(rng.randrange(2, 6)):
        body.append(_tree(rng, rng.randrange(1, 5), names))
    if names and rng.random() < 0.5:
        target = rng.choice(names)
        body.append(f'<TimeSensor DEF="Clock" cycleInterval="{_f(rng, 1, 10)}" loop="{_b(rng)}" enabled="{_b(rng)}"/>')
        body.append(f'<PositionInterpolator DEF="Mover" key="0 0.5 1" keyValue="{_vec(rng)} {_vec(rng)} {_vec(rng)}"/>')
        body.append('<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="Mover" toField="set_fraction"/>')
        body.append(f'<ROUTE fromNode="Mover" fromField="value_changed" toNode="{target}" toField="set_translation"/>')
    text = ('<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Interchange" version="4.0">\n<head>'
            '<meta name="generator" content="loomkit.r2r.synth"/></head>\n<Scene>\n' + "\n".join(body) + "\n</Scene>\n</X3D>\n")
    return plant.twin(text.encode("utf-8"))


def scenes(n: int, seed: int = 0) -> list[bytes]:
    rng = random.Random(seed)
    out, seen = [], set()
    while len(out) < n:
        s = scene(rng)
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


# ---------------------------------------------------------------------------------------------------------------------
# One-edit mutations, in the spirit of x3d-blender-io tools/chaos. Each returns (bytes, label, note) or None.

def _attr_places(data: bytes, want) -> list[tuple]:
    doc = Doc(data, "m")
    out = []
    for el in doc.elements:
        for a, v in el.attrib.items():
            if want(el.tag, a, v):
                out.append((el.path(), el.tag, a, v))
    return out


def m_bool(data: bytes, rng) -> tuple | None:
    places = _attr_places(data, lambda t, a, v: v in ("true", "false"))
    if not places:
        return None
    path, tag, a, _v = rng.choice(places)
    new = rng.choice(BOOL_SPELLINGS)
    return plant.set_attr(data, path, a, new), "bool-spelling", f"{tag}@{a} <- {new!r}"


def m_deep(data: bytes, rng) -> tuple | None:
    n = rng.choice([8, 20, 35, 50, 70, 90, 120, 200, 320])
    return plant.deepen(data, n), "deepen", f"{n} more levels of nesting"


def m_deep_fine(data: bytes, rng) -> tuple | None:
    """Nesting raised to an exact depth between 50 and 80: for challenge sets that must find a limit to the level."""
    have = Doc(data, "m").depth_max
    want = rng.randrange(50, 81)
    if want <= have:
        return None
    return plant.deepen(data, want - have), "deepen-fine", f"nesting raised to {want}"


def m_wide(data: bytes, rng) -> tuple | None:
    n = rng.choice([20, 60, 150, 400])
    return plant.widen(data, n), "widen", f"{n} more siblings"


def m_index(data: bytes, rng) -> tuple | None:
    places = _attr_places(data, lambda t, a, v: a == "coordIndex")
    if not places:
        return None
    path, tag, a, v = rng.choice(places)
    toks = v.split()
    k = rng.randrange(len(toks))
    new = rng.choice(["7", "12", "99", "5000", "-2", "250000"])
    toks[k] = new
    return plant.set_attr(data, path, a, " ".join(toks)), "index", f"{tag}@{a}[{k}] <- {new}"


def m_number(data: bytes, rng) -> tuple | None:
    places = _attr_places(data, lambda t, a, v: a in ("transparency", "shininess", "intensity", "radius", "height",
                                                      "creaseAngle", "fieldOfView", "cycleInterval"))
    if not places:
        return None
    path, tag, a, _v = rng.choice(places)
    new = rng.choice(["-1", "2.5", "1e40", "NaN", "abc", "", "0.5 0.5", "1,5"])
    return plant.set_attr(data, path, a, new), "number", f"{tag}@{a} <- {new!r}"


def m_drop(data: bytes, rng) -> tuple | None:
    places = _attr_places(data, lambda t, a, v: t not in ("X3D", "meta", "ROUTE") and a != "DEF")
    if not places:
        return None
    path, tag, a, _v = rng.choice(places)
    return plant.del_attr(data, path, a), "drop-attr", f"{tag}@{a} removed"


MUTATORS = {"bool": m_bool, "deep": m_deep, "deep-fine": m_deep_fine, "wide": m_wide, "index": m_index, "number": m_number, "drop": m_drop}


DEFAULT_OPS = ("bool", "deep", "wide", "index", "number", "drop")


def mutants(clean: list[bytes], per_scene: int, seed: int = 0, ops: tuple = DEFAULT_OPS) -> list[dict]:
    """per_scene one-edit mutants of each clean scene: [{data, twin (index into clean), op, note}]."""
    rng = random.Random(seed)
    out = []
    for i, data in enumerate(clean):
        made, tries = 0, 0
        while made < per_scene and tries < per_scene * 6:
            tries += 1
            op = rng.choice(ops)
            got = MUTATORS[op](data, rng)
            if not got or got[0] is None or got[0] == data:
                continue
            out.append({"data": got[0], "twin": i, "op": got[1], "note": got[2]})
            made += 1
    return out
