"""The tasks: reference behaviours that produce the demonstrations. The synthesiser never sees a reference graph,
only the stage, the stimulus script and what the watched fields did.

Eighteen families. `tasks(seeds)` builds one task per family and seed; the random choices (which object, which
values, how long) come from the seed alone. Fifteen families use only what the synthesiser may place and end in a
table or a direct ROUTE ("in vocabulary"). Three do not, on purpose: an eased motion, a damper behind a table, and
a chaser. They are there to be missed, and to show what a miss looks like.
"""
from __future__ import annotations

import math
import random

KEYSETS = [[0, 1], [0, 0.5, 1], [0, 0.4, 0.6, 1], [0, 0.2, 0.8, 1]]
CYCLES = [1.0, 1.5, 2.0, 3.0]
OBJECTS = ["Door", "Button", "Lamp", "Crate"]
PAINT = {"Door": "DoorPaint", "Button": "ButtonPaint", "Lamp": "LampGlow", "Crate": "CratePaint"}
HOME = {"Door": (0, 1.2, 0), "Button": (-2.4, 1.2, 0.4), "Lamp": (2.4, 2.6, 0.4), "Crate": (3.6, 0.4, 1.2)}


def r1(x):
    return round(x, 1)


class Make:
    def __init__(self, rng):
        self.rng, self.nodes, self.routes, self.targets = rng, [], [], {}

    def two(self):
        a, b = self.rng.sample(OBJECTS, 2)
        return a, b

    def target(self, name, kind):
        self.targets[name] = kind
        return name

    def touch(self, obj):
        self.nodes.append(("Click", "TouchSensor", obj, {}))
        return "Click"

    def timer(self, loop=False):
        self.nodes.append(("Timer", "TimeSensor", None, {"cycleInterval": self.rng.choice(CYCLES), "loop": loop}))
        return "Timer"

    def path(self, obj, closed):
        keys = self.rng.choice(KEYSETS[1:] if closed else KEYSETS)
        home = HOME[obj]
        values = [home]
        for _ in keys[1:]:
            values.append(tuple(r1(h + self.rng.choice([-2, -1, 1, 2]) * self.rng.choice([0.5, 1.0])) if i == self.rng.randrange(3)
                                else h for i, h in enumerate(home)))
        if closed:
            values[-1] = home
        if values[1] == home:
            values[1] = (home[0], r1(home[1] + 1.5), home[2])
        return keys, values

    def position(self, obj, closed=True, name="Move"):
        keys, values = self.path(obj, closed)
        self.nodes.append((name, "PositionInterpolator", None, {"key": keys, "keyValue": values}))
        return name

    def colour(self):
        keys = self.rng.choice(KEYSETS[:3])
        values = [(r1(self.rng.random()), r1(self.rng.random()), r1(self.rng.random())) for _ in keys]
        if values[0] == values[1]:
            values[1] = (1.0, 0.9, 0.1)
        self.nodes.append(("Tint", "ColorInterpolator", None, {"key": keys, "keyValue": values}))
        return "Tint"

    def turn(self):
        keys = self.rng.choice(KEYSETS[:2])
        axis = self.rng.choice([(0, 1, 0), (1, 0, 0), (0, 0, 1)])
        top = self.rng.choice([0.6, 1.2, 1.5])
        angles = [0, top] if len(keys) == 2 else [0, top, 0.0]
        self.nodes.append(("Turn", "OrientationInterpolator", None, {"key": keys, "keyValue": [axis + (a,) for a in angles]}))
        return "Turn"

    def scalar(self):
        keys = self.rng.choice(KEYSETS[:3])
        values = [0.0] + [self.rng.choice([0.3, 0.5, 0.8, 1.0]) for _ in keys[1:]]
        self.nodes.append(("Fade", "ScalarInterpolator", None, {"key": keys, "keyValue": values}))
        return "Fade"

    def link(self, *route):
        self.routes.append(route)

    def program(self):
        return {"targets": self.targets, "nodes": self.nodes, "routes": self.routes}


def slide(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.position(b), "set_fraction")
    m.link("Move", "value_changed", m.target(b, "Transform"), "translation")


def glow(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.colour(), "set_fraction")
    m.link("Tint", "value_changed", m.target(PAINT[b], "PhysicalMaterial"), m.rng.choice(["emissiveColor", "baseColor"]))


def turn(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.turn(), "set_fraction")
    m.link("Turn", "value_changed", m.target(b, "Transform"), "rotation")


def fade(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.scalar(), "set_fraction")
    m.link("Fade", "value_changed", m.target(PAINT[b], "PhysicalMaterial"), "transparency")


def hover(m):
    a, b = m.two()
    m.touch(a)
    if m.rng.random() < 0.5:
        m.link("Click", "isOver", m.target(b, "Transform"), "visible")
    else:
        m.nodes.append(("Not", "BooleanFilter", None, {}))
        m.link("Click", "isOver", "Not", "set_boolean")
        m.link("Not", "inputNegate", m.target("Spot", "PointLight"), "on")


def hide_while_pressed(m):
    a, b = m.two()
    m.touch(a)
    m.nodes.append(("Not", "BooleanFilter", None, {}))
    m.link("Click", "isActive", "Not", "set_boolean")
    m.link("Not", "inputNegate", m.target(b, "Transform"), "visible")


def toggle(m):
    a, b = m.two()
    m.touch(a)
    m.nodes.append(("Flip", "BooleanToggle", None, {}))
    if m.rng.random() < 0.5:
        m.link("Click", "isActive", "Flip", "set_boolean")
    else:
        m.nodes.append(("OnlyTrue", "BooleanFilter", None, {}))
        m.link("Click", "isActive", "OnlyTrue", "set_boolean")
        m.link("OnlyTrue", "inputTrue", "Flip", "set_boolean")
    end = m.rng.choice([(b, "Transform", "visible"), ("Spot", "PointLight", "on")])
    m.link("Flip", "toggle", m.target(end[0], end[1]), end[2])


def loop(m):
    b = m.rng.choice(OBJECTS)
    m.timer(loop=True)
    kind = m.rng.choice(["move", "turn", "tint"])
    if kind == "move":
        m.link("Timer", "fraction_changed", m.position(b), "set_fraction")
        m.link("Move", "value_changed", m.target(b, "Transform"), "translation")
    elif kind == "turn":
        m.link("Timer", "fraction_changed", m.turn(), "set_fraction")
        m.link("Turn", "value_changed", m.target(b, "Transform"), "rotation")
    else:
        m.link("Timer", "fraction_changed", m.colour(), "set_fraction")
        m.link("Tint", "value_changed", m.target(PAINT[b], "PhysicalMaterial"), "emissiveColor")
    return kind != "tint"                              # glTF 2.0 core can animate translation and rotation, not a colour


def drag(m):
    a, b = m.two()
    m.nodes.append(("Pull", "PlaneSensor", a, {}))
    m.link("Pull", "translation_changed", m.target(b, "Transform"), m.rng.choice(["translation", "scale"]))


def drag_damped(m):
    a, b = m.two()
    m.nodes.append(("Pull", "PlaneSensor", a, {}))
    m.nodes.append(("Ease", "PositionDamper", None, {"tau": m.rng.choice([0.1, 0.3, 1.0]), "initialValue": HOME[b],
                                                      "initialDestination": HOME[b]}))
    m.link("Pull", "translation_changed", "Ease", "set_destination")
    m.link("Ease", "value_changed", m.target(b, "Transform"), "translation")


def light_while(m):
    a, _ = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    if m.rng.random() < 0.5:
        m.link("Timer", "isActive", m.target("Spot", "PointLight"), "on")
    else:
        m.nodes.append(("Not", "BooleanFilter", None, {}))
        m.link("Timer", "isActive", "Not", "set_boolean")
        m.link("Not", "inputNegate", m.target("Spot", "PointLight"), "on")


def two_targets(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.position(b), "set_fraction")
    m.link("Move", "value_changed", m.target(b, "Transform"), "translation")
    m.nodes.append(("Not", "BooleanFilter", None, {}))
    m.link("Timer", "isActive", "Not", "set_boolean")
    m.link("Not", "inputNegate", m.target("Spot", "PointLight"), "on")


def loop_after_click(m):
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(loop=True), "startTime")
    m.link("Timer", "fraction_changed", m.position(b), "set_fraction")
    m.link("Move", "value_changed", m.target(b, "Transform"), "translation")


def start_on_press(m):
    a, b = m.two()
    m.touch(a)
    m.nodes.append(("When", "TimeTrigger", None, {}))
    m.link("Click", "isActive", "When", "set_boolean")
    m.link("When", "triggerTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.position(b), "set_fraction")
    m.link("Move", "value_changed", m.target(b, "Transform"), "translation")


def follow_the_leader(m):
    a, b = m.two()
    m.timer(loop=True)
    m.link("Timer", "fraction_changed", m.position(a), "set_fraction")
    m.link("Move", "value_changed", m.target(a, "Transform"), "translation")
    m.nodes.append(("Ease", "PositionDamper", None, {"tau": m.rng.choice([0.1, 0.3, 1.0]), "initialValue": HOME[b],
                                                      "initialDestination": HOME[b]}))
    m.link(a, "translation", "Ease", "set_destination")
    m.link("Ease", "value_changed", m.target(b, "Transform"), "translation")


def eased(m):                                          # outside the vocabulary: EaseInEaseOut is not placed
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.nodes.append(("Soft", "EaseInEaseOut", None, {"key": [0, 1], "easeInEaseOut": [(0, 1), (1, 0)]}))
    m.link("Timer", "fraction_changed", "Soft", "set_fraction")
    m.link("Soft", "modifiedFraction_changed", m.position(b, closed=False), "set_fraction")
    m.link("Move", "value_changed", m.target(b, "Transform"), "translation")


def damped_fade(m):                                    # outside: a follower after the table
    a, b = m.two()
    m.link(m.touch(a), "touchTime", m.timer(), "startTime")
    m.link("Timer", "fraction_changed", m.scalar(), "set_fraction")
    m.nodes.append(("Ease", "ScalarDamper", None, {"tau": 0.3}))
    m.link("Fade", "value_changed", "Ease", "set_destination")
    m.link("Ease", "value_changed", m.target(PAINT[b], "PhysicalMaterial"), "transparency")


def chased(m):                                         # outside: chasers are not placed
    a, b = m.two()
    m.nodes.append(("Pull", "PlaneSensor", a, {}))
    m.nodes.append(("Chase", "PositionChaser", None, {"duration": 1.0, "initialValue": HOME[b], "initialDestination": HOME[b]}))
    m.link("Pull", "translation_changed", "Chase", "set_destination")
    m.link("Chase", "value_changed", m.target(b, "Transform"), "translation")


FAMILIES = [("slide", slide, True), ("glow", glow, True), ("turn", turn, True), ("fade", fade, True), ("hover", hover, True),
            ("hide-while-pressed", hide_while_pressed, True), ("toggle", toggle, True), ("loop", loop, True),
            ("drag", drag, True), ("drag-damped", drag_damped, True), ("light-while", light_while, True),
            ("two-targets", two_targets, True), ("loop-after-click", loop_after_click, True),
            ("start-on-press", start_on_press, True), ("follow-the-leader", follow_the_leader, True),
            ("eased", eased, False), ("damped-fade", damped_fade, False), ("chased", chased, False)]


def tasks(seeds):
    out = []
    for seed in seeds:
        for index, (name, make, inside) in enumerate(FAMILIES):
            m = Make(random.Random(seed * 1000 + index))
            gltf = make(m)
            out.append({"id": f"{name}-{seed}", "family": name, "seed": seed, "in_vocabulary": inside,
                        "gltf_core": bool(gltf), "reference": m.program()})
    return out
