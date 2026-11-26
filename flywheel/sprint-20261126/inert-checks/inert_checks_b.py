"""Five checks for scenes that are legal X3D and do nothing, or do the wrong thing. Same style as check_orientation_steps."""
from __future__ import annotations
import math, re, sys
import os
sys.path.insert(0, os.path.join(os.environ.get('X3D_MCP', 'x3d_mcp'), 'src'))
from validation.data_checks import _tag, _defs, _nums, _diag, _quat

_META = ("Metadata",)


def _routes(scene):
    return [r for r in scene.iter() if _tag(r) == "ROUTE"]


def _is_meta(el):
    return _tag(el).startswith(_META)


# ------------------------------------------------------------------ (1) switch index
def check_switch_index(scene) -> list:
    """Switch.whichChoice picks one child by index; an index past the last child shows nothing (19775-1 10.4.2).
    -1 is legal and shows nothing on purpose. An IntegerSequencer or IntegerTrigger that counts beyond the children
    leaves the viewer with an empty scene for part of every cycle."""
    out, defs = [], _defs(scene)
    for sw in scene.iter():
        if _tag(sw) != "Switch" or sw.get("USE"):
            continue
        n = sum(1 for c in sw if not _is_meta(c) and _tag(c) not in ("IS", "field"))
        if any("placeholder" in (c.get("DEF") or "").lower() for c in sw):
            continue                                         # a stand-in child: the page script fills the Switch at run time
        if n == 0 or any(_tag(c) == "IS" for c in sw):
            continue                                         # empty switch: empty-group's business; IS: set by a Proto
        w = sw.get("whichChoice")
        if w is not None:
            try:
                wi = int(float(w))
            except ValueError:
                wi = None
            if wi is not None and wi >= n:
                out.append(_diag("warning", "switch-index-past-children", sw,
                                 f"has whichChoice={wi} but only {n} child(ren) (indices 0 to {n - 1}), so it shows nothing. "
                                 f"Use an index below {n}, or -1 if showing nothing is the intent."))
    for r in _routes(scene):
        if (r.get("toField") or "") not in ("whichChoice", "set_whichChoice"):
            continue
        sw, src = defs.get(r.get("toNode")), defs.get(r.get("fromNode"))
        if sw is None or src is None or _tag(sw) != "Switch":
            continue
        n = sum(1 for c in sw if not _is_meta(c) and _tag(c) not in ("IS", "field"))
        if n == 0 or any("placeholder" in (c.get("DEF") or "").lower() for c in sw):
            continue                                         # a stand-in child: the page script fills the Switch at run time
        t = _tag(src)
        if t == "IntegerSequencer":
            vals = _nums(src.get("keyValue")) if False else None
            raw = src.get("keyValue")
            try:
                vals = [int(float(x)) for x in re.split(r"[\s,]+", raw.strip()) if x] if raw else None
            except ValueError:
                vals = None
        elif t == "IntegerTrigger":
            raw = src.get("integerKey")
            try:
                vals = [int(float(x)) for x in re.split(r"[\s,]+", raw.strip()) if x] if raw else None
            except ValueError:
                vals = None
            if raw is None:
                continue
        else:
            continue
        if not vals:
            continue
        top = max(vals)
        if top >= n:
            what = "key value" if t == "IntegerSequencer" else "integer key"
            out.append(_diag("warning", "switch-index-past-children", r,
                             f"routes {r.get('fromNode')!r} to Switch {r.get('toNode')!r}, whose {what}s reach {top} but the Switch has "
                             f"only {n} child(ren) (indices 0 to {n - 1}). While the value is {top} the viewer sees nothing. "
                             f"Add children or lower the values (-1 shows nothing on purpose)."))
    return out


# ------------------------------------------------------------------ (2) route cycle
_NOT_PASSTHROUGH = re.compile(r"Interpolator|Sequencer|Trigger|Filter|Toggle|Sensor|Script|Proto|Follower|Damper|Chaser|Inline")


def _base(f):
    f = f or ""
    if f.startswith("set_"):
        f = f[4:]
    if f.endswith("_changed"):
        f = f[:-8]
    return f


def check_route_cycle(scene) -> list:
    """ROUTEs that pass a value straight round in a circle (A.translation to B.translation and back). X3D stops
    a loop within one timestamp, so the scene does not hang, but the two fields just copy each other and nothing
    drives them. Probably a mistake. A deliberate two-way binding between two fields looks the same: if that is the
    intent, ignore this."""
    defs, edges, route_of = _defs(scene), {}, {}
    for r in _routes(scene):
        a, b, ff, tf = r.get("fromNode"), r.get("toNode"), r.get("fromField") or "", r.get("toField") or ""
        if a not in defs or b not in defs:
            continue
        if _NOT_PASSTHROUGH.search(_tag(defs[a])) or _NOT_PASSTHROUGH.search(_tag(defs[b])):
            continue
        if _base(ff) != _base(tf) or not _base(ff):
            continue
        if ff.startswith("set_") or tf.endswith("_changed"):
            continue                                         # an input as source or an output as target is another check's
        u, v = (a, _base(ff)), (b, _base(tf))
        edges.setdefault(u, []).append(v)
        route_of[(u, v)] = r
    out, done = [], set()
    for start in list(edges):
        if start in done:
            continue
        stack, path, onpath = [(start, iter(edges.get(start, [])))], [start], {start}
        while stack:
            node, it = stack[-1]
            nxt = next(it, None)
            if nxt is None:
                stack.pop(); path.pop(); onpath.discard(node); done.add(node)
                continue
            if nxt in onpath:
                cyc = path[path.index(nxt):]
                if not any(c in done for c in cyc) or True:
                    key = frozenset(cyc)
                    if key not in done:
                        done.add(key)
                        r = route_of[(cyc[-1], nxt)]
                        names = " -> ".join(f"{n}.{f}" for n, f in cyc + [nxt])
                        out.append(_diag("warning", "route-cycle", r,
                                         f"closes a loop of plain ROUTEs ({names}). Each field just copies the other, nothing drives "
                                         f"them, and the browser cuts the loop after one pass. If this is a deliberate two-way "
                                         f"binding, ignore it; otherwise remove one ROUTE."))
            elif nxt not in done:
                stack.append((nxt, iter(edges.get(nxt, [])))); path.append(nxt); onpath.add(nxt)
    return out


# ------------------------------------------------------------------ (3) sensor zero size
def check_sensor_zero_size(scene) -> list:
    out, defs = [], _defs(scene)
    routed = {}
    for r in _routes(scene):
        routed.setdefault(r.get("fromNode"), []).append(r)
    into = {(r.get("toNode"), _base(r.get("toField"))) for r in _routes(scene)}
    for el in scene.iter():
        if _tag(el) not in ("ProximitySensor", "VisibilitySensor", "TransformSensor") or el.get("USE"):
            continue
        if el.get("enabled", "true").lower() == "false":
            continue
        if any(_tag(c) == "IS" for c in el):
            continue
        s = _nums(el.get("size")) if el.get("size") is not None else [0.0, 0.0, 0.0]
        if s is None or len(s) != 3 or any(x != 0 for x in s):
            continue
        name = el.get("DEF")
        if not name or not routed.get(name) or (name, "size") in into:
            continue
        outs = sorted({r.get("fromField") for r in routed[name]})
        out.append(_diag("warning", "sensor-zero-size", el,
                         f"has size 0 0 0 (the default), so it never senses anything and never sends {', '.join(outs)}. "
                         f"Set size to the region to watch, for example size=\"10 10 10\"."))
    return out


# ------------------------------------------------------------------ (4) empty script
def check_script_empty(scene) -> list:
    out, defs = [], _defs(scene)
    routed = {}
    for r in _routes(scene):
        routed.setdefault(r.get("fromNode"), []).append(r)
    for el in scene.iter():
        if _tag(el) != "Script" or el.get("USE"):
            continue
        if any(_tag(c) == "IS" for c in el):
            continue
        url = (el.get("url") or "").replace('"', "").replace("'", "").strip()
        body = (el.text or "") + "".join((c.tail or "") for c in el)
        if url or body.strip() or any(_tag(c) == "url" for c in el):
            continue
        name = el.get("DEF")
        rs = routed.get(name) if name else None
        if not rs:
            continue
        outs = sorted({r.get("fromField") for r in rs})
        out.append(_diag("warning", "script-empty", el,
                         f"has no url and no script text, so it never produces anything, yet {', '.join(outs)} "
                         f"{'is' if len(outs) == 1 else 'are'} routed onward and stay at their default value. "
                         f"Add the script as text between the tags or point url at a file."))
    return out


# ------------------------------------------------------------------ (5) loop does not close
def check_loop_does_not_close(scene) -> list:
    out, defs = [], _defs(scene)
    has_dyn = any(_tag(e) in ("Script", "ProtoInstance", "ProtoDeclare") for e in scene.iter())
    for r in _routes(scene):
        if r.get("fromField") != "fraction_changed" or r.get("toField") not in ("set_fraction", "fraction"):
            continue
        ts, oi = defs.get(r.get("fromNode")), defs.get(r.get("toNode"))
        if ts is None or oi is None or _tag(ts) != "TimeSensor" or _tag(oi) != "OrientationInterpolator":
            continue
        if (ts.get("loop") or "false").lower() != "true" or (ts.get("enabled") or "true").lower() == "false":
            continue
        v = _nums(oi.get("keyValue"))
        if not v or len(v) < 8 or len(v) % 4:
            continue
        rots = [v[i:i + 4] for i in range(0, len(v), 4)]
        if len(rots) > 12:
            continue                                          # a sampled timeline (baked physics, Blender, GSAP): a snap back is the replay
        axes = []
        for q in rots:
            ln = math.sqrt(sum(x * x for x in q[:3]))
            if ln < 1e-9 or abs(q[3]) < 1e-9:
                continue                                      # identity or zero axis: no axis of its own
            axes.append(tuple(x / ln for x in q[:3]))
        if not axes or any(abs(sum(a * b for a, b in zip(axes[0], ax))) < 1 - 1e-4 for ax in axes[1:]):
            continue                                          # several axes: not a simple spin
        qa, qb = _quat(rots[0]), _quat(rots[-1])
        if qa is None or qb is None:
            continue
        d = max(-1.0, min(1.0, abs(sum(x * y for x, y in zip(qa, qb)))))
        gap = 2.0 * math.acos(d)
        if gap <= 0.5:
            continue
        if any(_tag(rr_dst) == "HAnimJoint" for rr_dst in
               (defs.get(x.get("toNode")) for x in _routes(scene) if x.get("fromNode") == oi.get("DEF") and oi.get("DEF")) if rr_dst is not None):
            continue
        out.append(_diag("info" if has_dyn else "warning", "loop-does-not-close", oi,
                         f"is driven by looping TimeSensor {r.get('fromNode')!r} but its last orientation is {gap:.3g} rad away from "
                         f"its first, so the object snaps back every cycle. End on the first orientation (for a full spin, "
                         f"angles 0 to 6.28319 in steps below pi), or set loop to false."))
    return out


INERT_B_CHECKS = [check_switch_index, check_route_cycle, check_sensor_zero_size, check_script_empty, check_loop_does_not_close]
