#!/usr/bin/env python3
"""Probe grid cells: build a wrong file and its corrected twin for a cell by machine, and ask a kernel about both.

    python3 flywheel/court-5/grid/probe.py <x3d_mcp checkout> [--classes F01,F02,...] [--dump DIR] [--summary FILE]
                                           [--grid FILE] [--dry]

For every cell of the chosen classes it writes two small X3D 4.0 scenes that differ only in the mistake, runs the
X3D 4.0 XSD and the kernel's semantic checks on both, and records one state in grid.json:

  xsd           the schema refuses the wrong file and accepts the twin
  caught        some check fires more often on the wrong file than on the twin (general notes left out)
  missed        the schema and the kernel treat both files alike
  probe-broken  the twin itself fails the schema: the generator, not the kernel, is at fault
  kernel-crash  the kernel raised an exception on one of the two files
  no-probe      the generator cannot build this cell (for example the field cannot be written in a file)

No test set is read. The probe files are rebuilt the same way on every run; --dump writes them out for reading.
The node is placed in the scene through the first legal chain of parents the object model allows.
"""
import json, sys
import xml.etree.ElementTree as ET
from collections import deque
from pathlib import Path
from xml.sax.saxutils import quoteattr

H = Path(__file__).resolve().parent
COMPANIONS = ["Coordinate", "Color", "Normal", "TextureCoordinate", "Shape", "Appearance", "Material", "ImageTexture", "Box", "Transform"]
COMMON = {"Shape", "Appearance", "IndexedFaceSet", "Text", "Transform", "Group", "Sound", "Collision"}   # parents tried first
GENERAL = {"unused-def", "naming-convention", "profile-component-fix"}
# Classes where a miss is not open work, because the file alone cannot say the scene is wrong. Each ruling was made
# by the kernel editor from a sweep of 1,685 real scenes (x3d.loom and x3d.demo, 28 November 2026), with no test set.
RULINGS = {
    ("N01-sensor-unheard", None): "a page that hosts the scene can listen to a sensor through the SAI: in the sweep a "
                                  "check for sensors with no ROUTE fired 2,300 times, 2,069 of them on TouchSensors",
    ("F10-switched-off", "visible"): "hiding a node for good is common and meant (collision proxies, parts kept for later)",
}
PROBED = ["F01-range", "F02-enumeration", "F03-child-type", "F04-route-to-non-input", "F05-route-from-non-output", "F06-route-type",
          "F07-index", "F10-switched-off", "N01-sensor-unheard", "N02-parallel-arrays", "N04-def-use", "N05-component"]
HEAD = ('<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Full" version="4.0" '
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" '
        'xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">\n'
        '  <head><meta name="title" content="grid probe"/></head>\n  <Scene>\n')
TAIL = "  </Scene>\n</X3D>\n"


class Model:
    def __init__(self, path, valid=None):
        self.valid = valid
        root = ET.parse(path).getroot()
        self.types = {t.get("type"): int(t.get("tupleSize") or 1) for t in root.find("FieldTypes")}
        parent = {}
        for kind in ("AbstractNodeTypes", "AbstractObjectTypes", "ConcreteNodes"):
            for n in root.find(kind):
                idef = n.find("InterfaceDefinition")
                if idef is not None:
                    parent[n.get("name")] = [e.get("baseType") for e in idef if e.tag in ("Inheritance", "AdditionalInheritance")]
        self.nodes, self.kinds, self.container, self.component = {}, {}, {}, {}
        for n in root.find("ConcreteNodes"):
            name, idef = n.get("name"), n.find("InterfaceDefinition")
            seen, todo = {name}, [name]
            while todo:
                for p in parent.get(todo.pop(), []):
                    if p and p not in seen:
                        seen.add(p)
                        todo.append(p)
            self.kinds[name] = seen
            ci = idef.find("componentInfo")
            self.component[name] = (ci.get("name"), int(ci.get("level"))) if ci is not None else None
            self.nodes[name] = {f.get("name"): f for f in idef.findall("field")}
            c = idef.find("containerField")
            self.container[name] = c.get("default") if c is not None else "children"
        scene = root.find("Statements").find("*[@name='Scene']").find(".//field[@name='children']")
        self.top = set(scene.get("acceptableNodeTypes").split("|"))
        self.chain = self._chains()
        self.sinks, self.sources = {}, {}
        for name in sorted(self.nodes):
            if len(self.chain.get(name, [0, 0])) != 1:
                continue                                    # partners sit directly under Scene
            for fn, f in sorted(self.nodes[name].items()):
                if f.get("type") in ("SFNode", "MFNode"):
                    continue
                if f.get("accessType") in ("inputOnly", "inputOutput"):
                    self.sinks.setdefault(f.get("type"), []).append((name, fn))
                if f.get("accessType") in ("outputOnly", "inputOutput"):
                    self.sources.setdefault(f.get("type"), []).append((name, fn))

    def _chains(self):
        """node -> list of (node, containerField or None) from the Scene's child down to the node.

        The object model proposes parents; the schema decides. A chain is kept only if the bare node placed through
        it passes the XSD (when a validator is given). Candidates are tried most natural first: common parents,
        the field the node names as its own containerField, a field that lists a specific type, then any field."""
        chain = {}
        ok_xsd = lambda c: self.valid is None or self.valid(HEAD + self._xml(c, "") + TAIL)
        for n in sorted(self.nodes):
            if self.kinds[n] & self.top and ok_xsd([(n, None)]):
                chain[n] = [(n, None)]
        grew = True
        while grew:
            grew = False
            parents = sorted(chain, key=lambda p: (len(chain[p]), p not in COMMON, p))
            for n in sorted(set(self.nodes) - set(chain)):
                options = []
                for p in parents:
                    for fn, f in sorted(self.nodes[p].items()):
                        ok = f.get("acceptableNodeTypes")
                        if not ok or fn in ("metadata", "IS") or not self.kinds[n] & set(ok.split("|")):
                            continue
                        rank = (fn != self.container[n], "X3DNode" in ok.split("|"), len(chain[p]), p not in COMMON, p, fn)
                        options.append((rank, chain[p] + [(n, fn if fn != self.container[n] else None)]))
                for _, c in sorted(options)[:12]:
                    if ok_xsd(c):
                        chain[n] = c
                        grew = True
                        break
        return chain

    @staticmethod
    def _xml(chain, attrs, inner="", indent="    "):
        out, close = "", []
        for i, (n, cf) in enumerate(chain):
            last = i == len(chain) - 1
            a = (f' containerField="{cf}"' if cf else "") + (attrs if last else "")
            pad = indent + "  " * i
            if last and inner:
                out += f"{pad}<{n}{a}>\n" + "".join(f"{pad}  {line}\n" for line in inner.strip().split("\n")) + f"{pad}</{n}>\n"
            else:
                out += f"{pad}<{n}{a}/>\n" if last else f"{pad}<{n}{a}>\n"
            if not last:
                close.append(f"{pad}</{n}>\n")
        return out + "".join(reversed(close))

    def place(self, node, attrs="", inner=""):
        """XML for the node inside its chain of parents; attrs and inner content go on the node itself."""
        return self._xml(self.chain[node], attrs, inner)

    def fits(self, child, parent, field):
        ok = self.nodes[parent][field].get("acceptableNodeTypes")
        return bool(ok) and bool(self.kinds[child] & set(ok.split("|")))

    def child(self, child, field, attrs=""):
        cf = f' containerField="{field}"' if field != self.container[child] else ""
        return f"<{child}{cf}{attrs}/>"


def route(a, af, b, bf):
    return f'    <ROUTE fromNode="{a}" fromField="{af}" toNode="{b}" toField="{bf}"/>\n'


def pick(options, avoid):
    for n, f in options or []:
        if n != avoid:
            return n, f
    return None


def number(x, ftype):
    return str(int(x)) if "Int32" in ftype or float(x) == int(float(x)) and "Int" in ftype else repr(float(x)).rstrip("0").rstrip(".") if float(x) != int(float(x)) else str(int(float(x)))


def build(m, cell):
    """Return (wrong scene, twin scene, one line saying what differs) or (None, None, reason)."""
    node, cls, fn = cell["node"], cell["class"], cell.get("field")
    if node not in m.chain:
        return None, None, "no parent chain that the schema accepts was found for the node"
    f = m.nodes[node].get(fn) if fn else None
    T, acc = (f.get("type"), f.get("accessType")) if f is not None else (None, None)
    scene = lambda body: HEAD + body + TAIL
    A = lambda attrs="", inner="": m.place(node, ' DEF="A"' + attrs, inner)
    if cls in ("F01-range", "F02-enumeration"):
        if acc not in ("inputOutput", "initializeOnly"):
            return None, None, "the field cannot be written in a file"
        ts = m.types.get(T, 1)
        if cls == "F02-enumeration":
            good = f.find("enumeration").get("value")
            bad = '"NOT_LISTED"' if T == "MFString" else "NOT_LISTED" if T == "SFString" else "987654"
        else:
            lo, lox, hi, hix = (f.get(k) for k in ("minInclusive", "minExclusive", "maxInclusive", "maxExclusive"))
            try:
                if lo is not None or lox is not None:
                    b = float(lo if lo is not None else lox)
                    bad, good = b - 1 if lo is not None else b, b if lo is not None else b + 1
                    top = hi if hi is not None else hix
                    if top is not None and good >= float(top):
                        good = (b + float(top)) / 2
                else:
                    b = float(hi if hi is not None else hix)
                    bad, good = b + 1 if hi is not None else b, b if hi is not None else b - 1
            except ValueError:
                return None, None, "the stated bound is not a number"
            if T in ("SFString", "MFString", "SFBool", "MFBool", "SFNode", "MFNode"):
                return None, None, "a range on a field that holds no numbers"
            bad, good = (" ".join([number(v, T)] * ts) for v in (bad, good))
        return scene(A(f" {fn}={quoteattr(bad)}")), scene(A(f" {fn}={quoteattr(good)}")), f"{fn}={bad} against {fn}={good}"
    if cls == "F03-child-type":
        if acc not in ("inputOutput", "initializeOnly") or fn in ("IS", "field"):
            return None, None, "not a field a file can put a node in"
        good = next((n for n in COMPANIONS + sorted(m.nodes) if m.fits(n, node, fn)), None)
        if not good:
            return None, None, "no concrete node fits the field"
        elsewhere = [n for n in sorted(m.nodes) if not m.fits(n, node, fn)
                     and any(m.fits(n, node, g) for g in m.nodes[node] if g not in (fn, "metadata", "IS"))]
        bad = next(iter(elsewhere or [n for n in ("Material", "Box", "TimeSensor") if not m.fits(n, node, fn)]), None)
        if not bad:
            return None, None, "the field takes any node"
        return (scene(A(inner=m.child(bad, fn))), scene(A(inner=m.child(good, fn))),
                f"{fn} holds a {bad} against a {good}")
    if cls == "F07-index":
        pairs = {"coordIndex": "coord", "colorIndex": "color", "normalIndex": "normal", "texCoordIndex": "texCoord", "index": "coord"}
        kids = {"coord": "<Coordinate point='0 0 0 1 0 0 0 1 0'/>", "color": "<Color color='1 0 0 0 1 0 0 0 1'/>",
                "normal": "<Normal vector='0 0 1 0 0 1 0 0 1'/>", "texCoord": "<TextureCoordinate point='0 0 1 0 0 1'/>"}
        if pairs.get(fn) not in m.nodes[node]:
            return None, None, "no generator for the array this index points into"
        inner = "\n".join(kids[k] for k in ("coord", pairs[fn]) if k in m.nodes[node]) if pairs[fn] != "coord" else kids["coord"]
        base = " coordIndex='0 1 2 -1'" if "coordIndex" in m.nodes[node] and fn != "coordIndex" else ""
        end = " -1" if fn.endswith("Index") and fn != "index" or node in ("IndexedTriangleFanSet", "IndexedTriangleStripSet") else ""
        return (scene(A(f"{base} {fn}='0 1 7{end}'", inner)), scene(A(f"{base} {fn}='0 1 2{end}'", inner)),
                f"{fn} names entry 7 of a three-entry array")
    if cls == "F10-switched-off":
        ball = "    <Shape><Appearance><Material/></Appearance><Sphere/></Shape>\n"     # something to sense, light or hide
        return scene(A(f" {fn}='false'") + ball), scene(A(f" {fn}='true'") + ball), f"{fn}='false' with nothing routed to it"
    if cls == "N02-parallel-arrays":
        ts = m.types.get(m.nodes[node]["keyValue"].get("type"), 1)
        vals = lambda n: " ".join(["0"] * (ts * n)) if m.nodes[node]["keyValue"].get("type") != "MFBool" else " ".join(["true"] * n)
        if m.nodes[node]["keyValue"].get("type") in ("MFRotation",):
            vals = lambda n: " ".join(["0 0 1 0"] * n)
        return (scene(A(f" key='0 0.5 1' keyValue='{vals(2)}'")), scene(A(f" key='0 0.5 1' keyValue='{vals(3)}'")),
                "three keys with two key values against three")
    if cls == "N04-def-use":
        return (scene(A() + m.place(node, ' USE="Other"')), scene(A() + m.place(node, ' USE="A"')), "USE of a DEF that is not in the file")
    if cls == "N01-sensor-unheard":
        outs = [(g, f2.get("type")) for g, f2 in sorted(m.nodes[node].items())
                if f2.get("accessType") == "outputOnly" and f2.get("type") not in ("SFNode", "MFNode") and pick(m.sinks.get(f2.get("type")), node)]
        if not outs:
            return None, None, "no output of the sensor has a taker in another node"
        g, gt = next((o for o in outs if o[0] != "isActive"), outs[0])
        sink = pick(m.sinks.get(gt), node)
        body = A() + m.place(sink[0], ' DEF="B"')
        return scene(body), scene(body + route("A", g, "B", sink[1])), f"no ROUTE leaves the sensor against A.{g} routed on"
    if cls == "N05-component":
        own = m.component.get(node)
        if not own or (own[0] == "Core" and own[1] <= 1):
            return None, None, "the node is in every profile"
        need = lambda nodes: {c: max(l for c2, l in (m.component[n] for n in nodes if m.component.get(n)) if c2 == c)
                              for c in {m.component[n][0] for n in nodes if m.component.get(n)}}
        chain = [n for n, _ in m.chain[node]]
        full, rest = need(chain), need(chain[:-1])
        if rest.get(own[0], 0) >= own[1]:
            return None, None, "a parent in the probe scene already needs the component at that level"
        head = lambda comps: HEAD.replace('profile="Full"', 'profile="Core"').replace(
            "<head>", "<head>" + "".join(f'<component name="{c}" level="{l}"/>' for c, l in sorted(comps.items())))
        return (head(rest) + A() + TAIL, head(full) + A() + TAIL,
                f"profile Core without component {own[0]} level {own[1]} against with it")
    if cls in ("F08-address", "F09-time", "N03-bindable"):
        return None, None, "no generator for this class yet"
    if T in ("SFNode", "MFNode"):
        return None, None, "node fields are not probed by this class"
    other_sink = ("Transform", "translation") if T != "SFVec3f" else ("Transform", "rotation")
    other_src = ("TimeSensor", "fraction_changed") if T != "SFFloat" else ("TimeSensor", "isActive")
    P = lambda n, d: m.place(n, f' DEF="{d}"')
    if cls == "F06-route-type":
        if acc in ("inputOutput", "outputOnly"):
            sink = (node, fn) if acc == "inputOutput" else pick(m.sinks.get(T), node)
            if not sink:
                return None, None, f"no other node takes a {T} event"
            return (scene(A() + P(sink[0], "B") + P(other_sink[0], "C") + route("A", fn, "C", other_sink[1])),
                    scene(A() + P(sink[0], "B") + P(other_sink[0], "C") + route("A", fn, "B", sink[1])),
                    f"A.{fn} ({T}) routed to {other_sink[0]}.{other_sink[1]} against {sink[0]}.{sink[1]}")
        src = pick(m.sources.get(T), node)
        if not src:
            return None, None, f"no other node sends a {T} event"
        return (scene(A() + P(src[0], "B") + P(other_src[0], "C") + route("C", other_src[1], "A", fn)),
                scene(A() + P(src[0], "B") + P(other_src[0], "C") + route("B", src[1], "A", fn)),
                f"{other_src[0]}.{other_src[1]} routed to A.{fn} ({T}) against {src[0]}.{src[1]}")
    src, sink = pick(m.sources.get(T), node), pick(m.sinks.get(T), node)
    if not src or not sink:
        return None, None, f"no other pair of nodes sends and takes a {T} event"
    body = A() + P(src[0], "B") + P(sink[0], "C")
    twin = scene(body + route("B", src[1], "C", sink[1]))
    if cls == "F04-route-to-non-input":
        return scene(body + route("B", src[1], "A", fn)), twin, f"ROUTE into A.{fn} ({acc})"
    if cls == "F05-route-from-non-output":
        return scene(body + route("A", fn, "C", sink[1])), twin, f"ROUTE out of A.{fn} ({acc})"
    return None, None, "no generator for this class yet"


def main():
    args = sys.argv[1:]
    mcp = Path(args[0])
    opt = lambda k: args[args.index(k) + 1] if k in args else None
    classes = set((opt("--classes") or ",".join(PROBED)).split(","))
    dump = Path(opt("--dump")) if opt("--dump") else None
    valid = None
    if "--dry" not in args:
        sys.path.insert(0, str(mcp / "src"))
        from validation.validate import validate_xml
        from validation.semantic import semantic_diagnostics
        valid = lambda text: validate_xml(text).get("valid") is not False
    m = Model(mcp / "src/validation/schemas/X3dUnifiedObjectModel-4.0.xml", valid)
    grid_file = Path(opt("--grid")) if opt("--grid") else H / "grid.json"     # --grid: probe a copy, leave grid.json alone
    grid = json.loads(grid_file.read_text())
    print(len(m.chain), "of", len(m.nodes), "nodes placed in a scene the schema accepts; not placed:", sorted(set(m.nodes) - set(m.chain)))
    tally = {}
    for cell in grid["cells"]:
        if cell["class"] not in classes:
            continue
        wrong, twin, what = build(m, cell)
        cell.pop("check", None)
        cell.pop("note", None)
        cell["probe"] = what
        if wrong is None:
            state = "no-probe"
        elif "--dry" in args:
            state = cell["state"]
        else:
            if dump:
                stem = cell["cell"].replace(":", "__")
                dump.mkdir(parents=True, exist_ok=True)
                (dump / f"{stem}.wrong.x3d").write_text(wrong)
                (dump / f"{stem}.twin.x3d").write_text(twin)
            if validate_xml(twin).get("valid") is False:
                state = "probe-broken"
            elif validate_xml(wrong).get("valid") is False:
                state = "xsd"
            else:
                count = lambda text: {c: n for c, n in _count(semantic_diagnostics(text)).items() if c not in GENERAL}
                try:
                    w, t = count(wrong), count(twin)
                    more = sorted(c for c in w if w[c] > t.get(c, 0))
                    state = "caught" if more else "missed"
                    if more:
                        cell["check"] = more
                except Exception as e:                      # the kernel itself fell over on a probe file
                    state = "kernel-crash"
                    cell["note"] = f"{type(e).__name__}: {e}"[:160]
        ruling = RULINGS.get((cell["class"], cell.get("field"))) or RULINGS.get((cell["class"], None))
        if state == "missed" and ruling:
            state, cell["note"] = "needs-intent", ruling
        cell["state"] = state
        tally.setdefault(cell["class"], {}).setdefault(state, 0)
        tally[cell["class"]][state] += 1
    if "--dry" in args:
        print(json.dumps(tally, indent=1))
        return
    states = {}
    for c in grid["cells"]:
        states[c["state"]] = states.get(c["state"], 0) + 1
    grid["cells_by_state"] = dict(sorted(states.items()))
    grid_file.write_text(json.dumps(grid, indent=0, ensure_ascii=False) + "\n")
    import subprocess
    git = lambda *a: subprocess.run(["git", "-C", str(mcp), *a], capture_output=True, text=True).stdout.strip()
    summary = {"kernel": git("rev-parse", "--short", "HEAD"), "kernel_has_uncommitted_changes": bool(git("status", "--porcelain", "--", "src")),
               "model_sha256": grid["model_sha256"], "nodes_placed": len(m.chain), "nodes_not_placed": sorted(set(m.nodes) - set(m.chain)),
               "classes_probed_in_this_run": sorted(tally), "by_class": dict(sorted(tally.items())), "all_cells": grid["cells_by_state"]}
    if opt("--summary"):
        Path(opt("--summary")).write_text(json.dumps(summary, indent=1) + "\n")
    print(json.dumps(summary, indent=1))


def _count(diags):
    out = {}
    for d in diags:
        out[d.check] = out.get(d.check, 0) + 1
    return out


if __name__ == "__main__":
    main()
