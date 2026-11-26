"""Shared machinery: the stage, stimulus scripts, running a behaviour graph in the simulator, comparing traces.

The graph, the catalogue and the simulator are x3d-blender-io's (source/behaviour_graph.py, behaviour_sim.py):
plain Python, no Blender, no browser, no GPU. Point X3D_BLENDER_IO at a checkout.
"""
from __future__ import annotations

import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
BLENDER_IO = Path(os.environ.get("X3D_BLENDER_IO", HERE.parent.parent / "x3d-blender-io"))
sys.path.insert(0, str(BLENDER_IO / "source"))
import behaviour_graph as bg          # noqa: E402
import behaviour_sim as bs            # noqa: E402
from behaviour_catalogue import NODES, TARGETS  # noqa: E402

DT = 0.05                              # seconds between samples; also the simulator's step
WATCH = {"Transform": ("translation", "rotation", "scale", "visible"),
         "PhysicalMaterial": ("baseColor", "emissiveColor", "transparency"),
         "Material": ("diffuseColor", "emissiveColor", "transparency"),
         "PointLight": ("on", "intensity", "color"), "DirectionalLight": ("on", "intensity", "color"),
         "SpotLight": ("on", "intensity", "color")}


def local(tag):
    return tag.split("}", 1)[1] if tag.startswith("{") else tag


class Stage:
    """What the static scene offers: targets a ROUTE may end at, objects a pointer may touch, starting values."""

    def __init__(self, text: str):
        self.text = text
        root = ET.fromstring(text)
        self.targets, self.touchable, self.initial, self.types = {}, [], {}, {}
        for el in root.iter():
            tag, name = local(el.tag), el.get("DEF")
            if not name or tag not in WATCH:
                continue
            self.targets[name] = tag
            rows = {r[0]: r for r in TARGETS[tag]}
            for field in WATCH[tag]:
                row = rows[field]
                self.types[(name, field)] = row[1]
                self.initial[(name, field)] = bs.parse_value(el.get(field, row[3]), row[1])
            if tag == "Transform" and any(local(c.tag) == "Shape" for c in el):
                self.touchable.append(name)


def close(a, b, kind, tol):
    if a is None or b is None:
        return a is b
    if kind in ("SFBool", "SFInt32", "SFString"):
        return a == b
    if kind in ("SFFloat", "SFTime", "SFDouble"):
        return abs(a - b) <= tol
    if kind == "SFRotation":
        return bs._rotation_distance(a, b) <= tol * 4
    return len(a) == len(b) and max(abs(x - y) for x, y in zip(a, b)) <= tol


def build(program) -> "bg.Behaviour":
    """A Behaviour from a plain description: {'targets': {id: type}, 'nodes': [(id, type, parent, fields)],
    'routes': [(from, field, to, field)]}."""
    b = bg.Behaviour()
    for name, kind in program["targets"].items():
        b.target(kind, name)
    for name, kind, parent, fields in program["nodes"]:
        b.add(kind, name, parent=parent, **fields)
    for r in program["routes"]:
        b.route(*r)
    return b


def run(graph, script, stage: Stage, seconds: float, want_streams=False):
    """Run ``graph`` under ``script`` for ``seconds``. Returns (trace, streams).
    trace[(target, field)] is the value at every sample; streams[(node, field)] is the event (or None) at every
    sample, for every field any node sent from."""
    sim = bs.Simulation(graph, log_size=10 ** 7)
    sensors = {}
    for node in graph.nodes.values():
        if node.role == bg.BEHAVIOUR and node.node_type in bs.POINTING and node.parent:
            sensors.setdefault(node.parent, []).append(node)
    events = sorted(script, key=lambda e: e[0])
    n = int(round(seconds / DT)) + 1
    trace = {key: [None] * n for key in stage.initial}
    streams, seen, k = {}, 0, 0
    for i in range(n):
        t = round(i * DT, 6)
        while k < len(events) and events[k][0] <= t + 1e-9:
            when, action, obj, arg = events[k]
            k += 1
            for s in sensors.get(obj, ()):
                if action == "hover":
                    sim.hover(s.id, arg, when)
                elif action == "press":
                    sim.press(s.id, when, point=arg)
                elif action == "drag" and s.node_type == "PlaneSensor":
                    sim.drag(s.id, arg, when)
                elif action == "release":
                    sim.release(s.id, when)
        sim.step(t)
        if want_streams:
            log = sim.log
            for j in range(seen, len(log)):
                _, node_id, field, value = log[j]
                streams.setdefault((node_id, field), [None] * n)[i] = value
            seen = len(log)
        values = sim.values
        for key in trace:
            trace[key][i] = values.get(key, stage.initial[key])
    return trace, streams


def same(a, b, stage: Stage, tol, keys=None):
    """Keys on which two traces differ."""
    bad = []
    for key in (keys or a):
        kind = stage.types[key]
        if any(not close(x, y, kind, tol) for x, y in zip(a[key], b[key])):
            bad.append(key)
    return bad


def changed(trace, stage: Stage):
    return [key for key in trace
            if any(not close(v, stage.initial[key], stage.types[key], 1e-9) for v in trace[key])]


# ----------------------------------------------------------------------------------------------- stimulus

def poke(objects, start=1.0, gap=6.0, press=0.5, drags=((0.2, (0.4, 0.2, 0.0)), (0.4, (0.8, 0.4, 0.0))),
         up=0.6, leave=0.5):
    """Hover, press, drag, release and leave each object in turn: a standard way to find out what a world does."""
    script, t = [], start
    for obj in objects:
        script.append((round(t, 6), "hover", obj, True))
        script.append((round(t + press, 6), "press", obj, (0.0, 0.0, 0.0)))
        for d, point in drags:
            script.append((round(t + press + d, 6), "drag", obj, point))
        script.append((round(t + press + up, 6), "release", obj, None))
        script.append((round(t + press + up + leave, 6), "hover", obj, False))
        t += gap
    return script, round(t + 1.0, 6)


def train_script(stage: Stage):
    objs = list(stage.touchable)
    return poke(objs + objs)                       # every object twice, so a toggle shows both of its states


def heldout_script(stage: Stage):
    """Another order, off-grid times, other drag points, and a second click while the first is still playing."""
    objs = list(reversed(stage.touchable))
    order = [objs[0], objs[0]] + objs[1:] + [objs[1]]
    script, t = [], 0.73
    for i, obj in enumerate(order):
        part, _ = poke([obj], start=t, press=0.31, drags=((0.17, (-0.3, 0.5, 0.0)), (0.33, (0.25, -0.6, 0.0))), up=0.52,
                       leave=0.44)
        script += part
        t += 1.9 if i == 0 else 5.37
    return script, round(t + 1.0, 6)


def probe(stage: Stage, start):
    """A second lesson, built to tell look-alike rules apart: a double click, a long hold with a drag, and a hover
    with no press, on every object."""
    objs = list(stage.touchable)
    objs = objs[1:] + objs[:1]
    script, t = [], start
    for obj in objs:
        steps = [(0.0, "hover", True), (0.25, "press", (0.0, 0.0, 0.0)), (0.45, "release", None),          # a click
                 (0.95, "press", (0.0, 0.0, 0.0)), (1.1, "release", None),                                 # and again, soon
                 (4.2, "press", (0.0, 0.0, 0.0)), (4.5, "drag", (0.4, 0.3, 0.0)), (6.4, "drag", (-0.2, 0.7, 0.0)),
                 (6.9, "release", None),                                                                   # a long hold
                 (7.3, "hover", False), (7.9, "hover", True), (8.6, "hover", False)]                       # a look, no press
        script += [(round(t + d, 6), action, obj, arg) for d, action, arg in steps]
        t += 9.3
    return script, round(t + 1.0, 6)


def long_script(stage: Stage):
    """The plain lesson followed by the second lesson, as one demonstration."""
    first, seconds = train_script(stage)
    second, total = probe(stage, seconds)
    return first + second, total
