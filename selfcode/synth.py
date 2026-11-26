"""The synthesiser: a demonstration in, an X3D behaviour graph out. No model, no person.

Given a static stage, a stimulus script and what every watched field did under it (the demonstration), find sensors,
timers, event utilities, followers, interpolator tables and ROUTEs that make the stage do the same.

How it searches (bottom-up enumeration with three prunings):
  1. Types. A ROUTE joins two fields of one X3D field type. The catalogue (generated from the X3D Unified Object
     Model) says which fields each node has, so only type-legal wirings are ever built.
  2. Dead ends. Every candidate is run in the simulator; a node that sends nothing under the script is dropped.
  3. Sameness. Two wirings that send the same events at the same times are the same to everything downstream, so
     only the first is kept (observational equivalence).
Tables are not searched, they are solved: when a 0-to-1 fraction reaches the end of a chain, the interpolator table
that turns that fraction into the demonstrated values is read off the demonstration and thinned to its corners.

A memory of solved wiring shapes (motifs) is tried before the search. The unit of cost is one simulator run.
"""
from __future__ import annotations

import heapq

import core
from core import bg, bs, NODES, DT

INTERP = {"SFFloat": "ScalarInterpolator", "SFVec3f": "PositionInterpolator", "SFColor": "ColorInterpolator",
          "SFRotation": "OrientationInterpolator"}
FOLLOW_TYPE = {"ScalarDamper": "SFFloat", "PositionDamper": "SFVec3f", "ColorDamper": "SFColor",
               "OrientationDamper": "SFRotation", "ScalarChaser": "SFFloat", "PositionChaser": "SFVec3f",
               "ColorChaser": "SFColor", "OrientationChaser": "SFRotation"}
# nodes the search may place in the middle of a chain: everything the simulator runs, except pointing sensors
# (placed at the start), nodes whose tables are solved rather than searched, sensors nothing here can drive, and
# chasers (each run costs about twenty times a damper's; left out to keep a run in milliseconds)
MIDDLE = [t for t in bs.SIMULATED if t not in bs.POINTING and "Interpolator" not in t and "Sequencer" not in t
          and t not in ("ProximitySensor", "VisibilitySensor", "KeySensor", "StringSensor", "EaseInEaseOut")
          and "2D" not in t and "Chaser" not in t]
SKIP_IN = {"metadata", "description"}
MAX_KEYS = 16


class Budget(Exception):
    pass


def lerp_of(kind):
    if kind == "SFColor":
        return bs.hsv_lerp
    if kind == "SFRotation":
        return bs.slerp
    return bs._lerp


def sig(stream):
    def r(v):
        if v is None or isinstance(v, (bool, int, str)):
            return v
        if isinstance(v, float):
            return round(v, 4)
        return tuple(round(x, 4) for x in v)
    return tuple(r(v) for v in stream)


def held(stream, initial):
    out, last = [], initial
    for v in stream:
        if v is not None:
            last = v
        out.append(last)
    return out


def windows(values, kind):
    """Lengths, in seconds, of the stretches during which a demonstrated value keeps changing."""
    runs, start = [], None
    for i in range(1, len(values)):
        moving = not core.close(values[i], values[i - 1], kind, 1e-9)
        if moving and start is None:
            start = i - 1
        if not moving and start is not None:
            runs.append(i - 1 - start)
            start = None
    if start is not None:
        runs.append(len(values) - 1 - start)
    return runs


def period(values, kind):
    """The shortest shift under which a demonstrated value repeats, in seconds, or None."""
    n = len(values)
    for k in range(4, n // 3):
        if all(core.close(values[i], values[i + k], kind, 1e-6) for i in range(n // 10, n - k)):
            return round(k * DT, 6)
    return None


def durations(values, kind):
    """Candidate lengths for a timer, read off the demonstration: how long the value keeps moving, and how long it
    stays between two jumps."""
    counts = {}
    for run in windows(values, kind):
        for d in (run, run + 1):
            counts[d] = counts.get(d, 0) + 1
    jumps = [i for i in range(1, len(values)) if not core.close(values[i], values[i - 1], kind, 1e-9)]
    for a, b in zip(jumps, jumps[1:]):
        if b - a > 1:
            counts[b - a] = counts.get(b - a, 0) + 1
    for quiet in (10, 30):                           # a burst: movement with pauses shorter than 0.5 s or 1.5 s
        start = last = None
        for i in jumps + [None]:
            if i is None or (last is not None and i - last > quiet):
                if start is not None and last - start > 1:
                    for d in (last - start, last - start + 1):
                        counts[d] = counts.get(d, 0) + 1
                start = i
            last = i
    best = [round(d * DT, 6) for d, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))][:6]
    p = period(values, kind)
    out = ([p] if p else []) + best + [1.0]
    return list(dict.fromkeys(x for x in out if x > DT))


def first_event(stream):
    return next((i for i, v in enumerate(stream) if v is not None), None)


def first_change(values, kind):
    return next((i for i in range(1, len(values)) if not core.close(values[i], values[0], kind, 1e-9)), None)


def variants(node_type, cands, target_kind, target_initial):
    if node_type == "TimeSensor":
        return [{"cycleInterval": c, "loop": loop} for loop in (False, True) for c in cands]
    if node_type in FOLLOW_TYPE:
        start = {}
        if FOLLOW_TYPE[node_type] == target_kind:
            start = {"initialValue": target_initial, "initialDestination": target_initial}
        if node_type.endswith("Damper"):
            return [dict(start, tau=tau) for tau in (0.3, 0.1, 1.0)]
        return [dict(start, duration=d) for d in dict.fromkeys([1.0] + cands)]
    return [{}]


def ports(node_type, direction):
    want = ("inputOnly", "inputOutput") if direction == "in" else ("outputOnly",)
    return [(r[0], r[1]) for r in NODES[node_type][1] if r[2] in want and r[0] not in SKIP_IN]


def fit_table(fraction, demo, kind, tol):
    """The interpolator table that maps this fraction stream onto the demonstrated values, or None.
    Only samples where a fraction arrived are used; the same fraction must always mean the same value."""
    pairs = {}
    for f, v in zip(fraction, demo):
        if f is None:
            continue
        key = round(f, 6)
        if key in pairs and not core.close(pairs[key], v, kind, tol):
            return None
        pairs.setdefault(key, v)
    if len(pairs) < 2:
        return None
    keys = sorted(pairs)
    mix, kept, a = lerp_of(kind), [0], 0
    while a < len(keys) - 1:                          # from each corner, reach as far as a straight run allows
        reach = a + 1
        for j in range(a + 2, len(keys)):
            span = keys[j] - keys[a]
            if all(core.close(mix(pairs[keys[a]], pairs[keys[j]], (keys[m] - keys[a]) / span), pairs[keys[m]], kind,
                              tol / 2) for m in range(a + 1, j)):
                reach = j
            else:
                break
        kept.append(reach)
        a = reach
    return [keys[i] for i in kept], [pairs[keys[i]] for i in kept]


class Synth:
    def __init__(self, stage, script, seconds, demo, memory=None, budget=6000, depth=4, tol=1e-3, share=None):
        self.stage, self.script, self.seconds, self.demo = stage, script, seconds, demo
        self.memory, self.budget, self.depth, self.tol = memory or [], budget, depth, tol
        self.sims, self.typed, self.fresh, self.late, self.memorised = 0, 0, 0, 0, 0
        self.offered = 0                           # extensions before the type check
        self.new_motifs, self.from_memory, self.used = [], 0, []
        self.cache, self.clocks = {}, {}           # one run per distinct wiring, whoever asks for it
        self.share, self.limit = share, float("inf")       # share: runs one field may spend on its first try (added after the registered run)
        self.n = 0
        self._moments = {}

    # -- one simulator run is the unit of cost
    def run(self, program):
        if self.sims >= min(self.budget, self.limit):
            raise Budget()
        self.sims += 1
        return core.run(core.build(program), self.script, self.stage, self.seconds, want_streams=True)

    def name(self, kind):
        self.n += 1
        return f"{kind}{self.n}"

    def sensors(self):
        nodes = []
        for obj in self.stage.touchable:
            nodes.append((f"Touch_{obj}", "TouchSensor", obj, {}))
            nodes.append((f"Plane_{obj}", "PlaneSensor", obj, {}))
        return nodes

    def trim(self, program):
        """Drop sensors and targets no ROUTE touches."""
        used = {r[0] for r in program["routes"]} | {r[2] for r in program["routes"]}
        return {"targets": {k: v for k, v in program["targets"].items() if k in used},
                "nodes": [n for n in program["nodes"] if n[0] in used], "routes": list(program["routes"])}

    def matches(self, stream, key):
        return not any(not core.close(a, b, self.stage.types[key], self.tol)
                       for a, b in zip(held(stream, self.stage.initial[key]), self.demo[key]))

    def moments(self, key):
        if key not in self._moments:
            demo, kind = self.demo[key], self.stage.types[key]
            self._moments[key] = [i for i in range(1, len(demo)) if not core.close(demo[i], demo[i - 1], kind, 1e-9)]
        return self._moments[key]

    def finish(self, base, chain, port, key, motif):
        """Try to end a chain at the target: directly, or through a solved interpolator table."""
        kind = self.stage.types[key]
        stream, ptype = chain["streams"][port], chain["types"][port]
        nodes, routes = base["nodes"] + chain["nodes"], base["routes"] + chain["routes"]
        targets = dict(base["targets"], **{key[0]: self.stage.targets[key[0]]})
        if ptype == kind and self.matches(stream, key):
            return {"targets": targets, "nodes": nodes, "routes": routes + [(port[0], port[1], key[0], key[1])]}, motif + ("direct",)
        if ptype == "SFFloat" and kind in INTERP and port[1] in ("fraction_changed", "value_changed", "modifiedFraction_changed") \
                and all(stream[i] is not None for i in self.moments(key)):      # a table can only act when a fraction arrives
            table = fit_table(stream, self.demo[key], kind, self.tol)
            if table and len(table[0]) > MAX_KEYS:       # a table with this many corners is a recording, not a rule
                self.memorised += 1
                table = None
            if table:
                name = self.name(INTERP[kind])
                program = {"targets": targets,
                           "nodes": nodes + [(name, INTERP[kind], None, {"key": table[0], "keyValue": table[1]})],
                           "routes": routes + [(port[0], port[1], name, "set_fraction"), (name, "value_changed", key[0], key[1])]}
                trace, _ = self.run(program)
                if not core.same(trace, self.demo, self.stage, self.tol, [key]):
                    return program, motif + ("table",)
        return None

    def sources(self, base, key):
        """Where a chain may begin: every sensor on every touchable object, a free-running clock, and any field of a
        target that an earlier chain already drives. One run gives all their event streams."""
        program = {"targets": dict(base["targets"]), "nodes": base["nodes"] + [s for s in self.sensors() if s[0] not in {n[0] for n in base["nodes"]}],
                   "routes": list(base["routes"])}
        _, streams = self.run(program)
        out = []
        ids = {n[0]: n for n in program["nodes"]}
        for (node, field), stream in streams.items():
            if node in ids and ids[node][1] in bs.POINTING:
                kind = dict(ports(ids[node][1], "out")).get(field)
                if kind:
                    out.append({"nodes": [ids[node]] if ids[node] not in base["nodes"] else [], "routes": [], "port": (node, field),
                                "streams": {(node, field): stream}, "types": {(node, field): kind},
                                "motif": (("sensor", ids[node][1], field),), "parent": ids[node][2], "trail": ((node, field),)})
            elif node in base["targets"] and (node, field) != key and (node, field) in self.stage.types:
                out.append({"nodes": [], "routes": [], "port": (node, field), "streams": {(node, field): stream},
                            "types": {(node, field): self.stage.types[(node, field)]},
                            "motif": (("target", base["targets"][node], field),), "parent": None, "trail": ((node, field),)})
        return out

    def extend(self, base, chain, node_type, in_field, variant, key):
        """Add one node after the chain's open port and run it. The same wiring is never run twice."""
        trail = chain["trail"] + ((node_type, in_field, tuple(sorted((k, repr(v)) for k, v in variant.items()))),)
        at = (len(base["nodes"]), len(base["routes"]), trail)
        if at not in self.cache:
            name = self.name(node_type)
            nodes = chain["nodes"] + [(name, node_type, None, variant)]
            routes = chain["routes"] + [(chain["port"][0], chain["port"][1], name, in_field)]
            program = {"targets": dict(base["targets"]), "nodes": base["nodes"] + nodes, "routes": base["routes"] + routes}
            _, streams = self.run(program)
            outs = {r[0]: r[1] for r in NODES[node_type][1] if r[2] in ("outputOnly", "inputOutput") and r[0] != in_field}
            new = {(name, f): s for (n, f), s in streams.items() if n == name and f in outs}     # whatever the node itself sent
            self.cache[at] = (name, nodes, routes, new, {(name, f): outs[f] for (_, f) in new})
        return self.cache[at] + (trail,)

    def clock(self, base, cands, key):
        """A free-running timer as a source."""
        at = (len(base["nodes"]), len(base["routes"]), tuple(cands))
        if at in self.clocks:
            return self.clocks[at]
        out = []
        for c in cands:
            name = self.name("TimeSensor")
            node = (name, "TimeSensor", None, {"cycleInterval": c, "loop": True})
            _, streams = self.run({"targets": dict(base["targets"]), "nodes": base["nodes"] + [node], "routes": list(base["routes"])})
            outs = dict(ports("TimeSensor", "out"))
            for (n, f), s in streams.items():
                if n == name and f in outs:
                    out.append({"nodes": [node], "routes": [], "port": (name, f), "streams": {(name, f): s},
                                "types": {(name, f): outs[f]}, "motif": (("clock", f),), "parent": None, "trail": (("clock", c, f),)})
        self.clocks[at] = out
        return out

    def bursts(self, key):
        """Stretches of change in the target, pauses under 1.5 s included."""
        bursts, start, last = [], None, None
        for i in self.moments(key) + [None]:
            if i is None or (last is not None and i - last > 30):
                bursts.append((start, last))
                start = i
            if start is None:
                start = i
            last = i
        return bursts

    def onset(self, stream, key):
        """The share of bursts of change that begin with an event of this stream."""
        bursts = self.bursts(key)
        return sum(1 for a, _ in bursts if stream[a - 1] is not None or stream[a] is not None) / len(bursts)

    def fits(self, motif, kind):
        """Can this remembered shape end at a field of this type at all? Decided from the catalogue, with no run."""
        head, steps, end = motif[0], motif[1:-1], motif[-1]
        if steps:
            last = {r[0]: r[1] for r in NODES[steps[-1][0]][1]}.get(steps[-1][2])
        elif head[0] == "sensor":
            last = {r[0]: r[1] for r in NODES[head[1]][1]}.get(head[2])
        elif head[0] == "clock":
            last = dict(ports("TimeSensor", "out")).get(head[1])
        else:
            last = next((t for (d, f), t in self.stage.types.items() if f == head[2] and self.stage.targets[d] == head[1]), None)
        return (last == kind) if end == "direct" else (last == "SFFloat" and kind in INTERP)

    def replay(self, base, chain, steps, end, key, cands):
        """Follow a remembered shape from this start, depth first, and stop at the first wiring that works."""
        if not steps:
            done = self.finish(base, chain, chain["port"], key, chain["motif"])
            return done if done and done[1][-1] == end else None
        node_type, in_field, out_field, shape = steps[0]
        if chain["types"][chain["port"]] != dict(ports(node_type, "in")).get(in_field):
            return None
        kind = self.stage.types[key]
        for variant in variants(node_type, cands, kind, self.stage.initial[key]):
            if shape_of(node_type, variant) != shape:
                continue
            name, nodes, routes, new, types, trail = self.extend(base, chain, node_type, in_field, variant, key)
            if (name, out_field) in new:
                grown = {"nodes": nodes, "routes": routes, "port": (name, out_field), "streams": new, "types": types, "trail": trail,
                         "motif": chain["motif"] + ((node_type, in_field, out_field, shape),)}
                done = self.replay(base, grown, steps[1:], end, key, cands)
                if done:
                    return done
        return None

    def recall(self, base, key, cands, sources):
        """Try remembered wiring shapes before any search. A shape is tried only where it can fit: its last port has
        the target's type, and its first event stream is there when each burst of change begins."""
        kind = self.stage.types[key]
        for motif in self.memory:
            if not self.fits(motif, kind):
                continue
            head, steps, end = motif[0], motif[1:-1], motif[-1]
            if head[0] == "clock":
                starts = [s for s in self.clock(base, cands[:2], key) if s["motif"][0] == head]
            else:
                starts = [s for s in sources if s["motif"][0] == head and self.onset(s["streams"][s["port"]], key) == 1]
            for start in starts:
                done = self.replay(base, start, steps, end, key, cands)
                if done:
                    self.from_memory += 1
                    self.used.append(motif)
                    return done
        return None

    def search(self, base, key, cands, sources):
        """Best-first: the chain whose events line up best with the moments the target changes is grown first.
        A value can only change when an event arrives, so a chain that already has an event at every such moment
        needs only instant nodes (filters, toggles, a table) to finish; one that does not needs a timer or follower."""
        kind, initial = self.stage.types[key], self.stage.initial[key]
        moments = self.moments(key)
        begins = moments[0]
        seen, heap, order = set(), [], 0

        bursts = self.bursts(key)
        inside = set()
        for a, b in bursts:
            inside.update(range(a - 1, b + 1))

        def rank(stream, depth):
            """Evidence that this stream is the cause: an event lands just before each burst of change begins, the
            events fall inside the bursts and nowhere else, and every moment of change has one."""
            events = [i for i, v in enumerate(stream) if v is not None]
            onset = sum(1 for a, _ in bursts if stream[a - 1] is not None or stream[a] is not None) / len(bursts)
            specific = sum(1 for i in events if i in inside) / max(len(events), 1)
            cover = sum(1 for i in moments if stream[i] is not None) / len(moments)
            return (-round(onset * specific, 3), depth, -round(cover, 3))

        def admit(chain, depth):
            nonlocal order
            stream = chain["streams"][chain["port"]]
            s = (chain["types"][chain["port"]], sig(stream))
            if s in seen:
                return None
            first = first_event(stream)
            if first is None or first > begins:      # a cause cannot come after its effect
                self.late += 1
                return None
            seen.add(s)
            self.fresh += 1
            done = self.finish(base, chain, chain["port"], key, chain["motif"])
            if done:
                return done
            if depth < self.depth:
                order += 1
                late = 0.5 if chain["motif"][0][0] == "target" else 0      # prefer a sensor to a chain off another target
                heapq.heappush(heap, (rank(stream, depth + late), order, depth, chain))
            return None

        for chain in sources + self.clock(base, cands[:2], key):
            done = admit(chain, 0)
            if done:
                return done
        while heap:
            _, _, depth, chain = heapq.heappop(heap)
            ptype = chain["types"][chain["port"]]
            for node_type in MIDDLE:
                for in_field, in_type in ports(node_type, "in"):
                    choices = variants(node_type, cands, kind, initial)
                    self.offered += len(choices)
                    if in_type != ptype:
                        continue
                    for variant in choices:
                        self.typed += 1
                        name, nodes, routes, new, types, trail = self.extend(base, chain, node_type, in_field, variant, key)
                        for port in new:
                            grown = {"nodes": nodes, "routes": routes, "port": port, "streams": new, "types": types, "trail": trail,
                                     "motif": chain["motif"] + ((node_type, in_field, port[1], shape_of(node_type, variant)),)}
                            done = admit(grown, depth + 1)
                            if done:
                                return done
        return None

    def solve(self):
        """Returns (program or None, fields left unsolved)."""
        todo = core.changed(self.demo, self.stage)
        base = {"targets": {}, "nodes": [], "routes": []}
        progress, first = True, True
        try:
            while todo and progress:
                progress = False
                for key in list(todo):
                    self.limit = self.sims + self.share if self.share and first else float("inf")
                    try:
                        cands = durations(self.demo[key], self.stage.types[key])
                        sources = self.sources(base, key)
                        found = self.recall(base, key, cands, sources) if self.memory else None
                        recalled = found is not None
                        if not found:
                            found = self.search(base, key, cands, sources)
                    except Budget:
                        if self.sims >= self.budget:
                            raise
                        progress = True              # out of its share, not out of budget: come back to it
                        continue
                    if found:
                        base = self.trim(found[0])
                        if not recalled:
                            self.new_motifs.append(found[1])
                        todo.remove(key)
                        progress = True
                first = False
        except Budget:
            pass
        if todo:
            return None, todo
        trace, _ = core.run(core.build(base), self.script, self.stage, self.seconds)
        wrong = core.same(trace, self.demo, self.stage, self.tol)
        return (None, wrong) if wrong else (base, [])


def shape_of(node_type, variant):
    """What of a node's settings is part of a remembered shape: whether a timer loops, a follower's speed."""
    if node_type == "TimeSensor":
        return ("loop", bool(variant.get("loop")))
    if "tau" in variant:
        return ("tau", variant["tau"])
    return ()
