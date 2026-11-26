"""Checks for scenes that are wired legally and do nothing: three checks in the style of check_orientation_steps."""
from __future__ import annotations
import sys
import os
sys.path.insert(0, os.path.join(os.environ.get('X3D_MCP', 'x3d_mcp'), 'src'))
from validation.data_checks import _tag, _defs, _nums, _diag

SENSORS = {"TouchSensor", "PlaneSensor", "CylinderSensor", "SphereSensor"}
OUTSIDE = {"Script", "ProtoInstance", "ProtoDeclare", "ExternProtoDeclare", "IMPORT", "EXPORT"}
GEOMETRY = {"Shape", "Inline", "InlineLoadControl", "CADFace", "GeoLocation", "ProtoInstance",
            "Text", "Box", "Sphere", "Cone", "Cylinder", "IndexedFaceSet", "ElevationGrid", "Extrusion"}
GROUPING_SKIP = {"Scene", "X3D"}
TRIGGERS = {"BooleanToggle", "BooleanFilter", "BooleanTrigger", "IntegerTrigger", "TimeTrigger"}


def _field(f: str | None) -> str:
    f = f or ""
    if f.startswith("set_"):
        f = f[4:]
    if f.endswith("_changed"):
        f = f[:-8]
    return f


def _routes(scene):
    """(from DEF, from field, to DEF, to field) for every ROUTE, fields normalised so set_x, x and x_changed match."""
    return [(r.get("fromNode"), _field(r.get("fromField")), r.get("toNode"), _field(r.get("toField")))
            for r in scene.iter() if _tag(r) == "ROUTE"]


def _outside(scene) -> bool:
    return any(_tag(e) in OUTSIDE for e in scene.iter())


def _has_is(el) -> bool:
    return any(_tag(c) == "IS" for c in el)


def _level(scene, level="warning"):
    return "info" if _outside(scene) else level


def _into(routes, name, fields):
    return bool(name) and any(t == name and tf in fields for _, _, t, tf in routes)


def _used_elsewhere(scene, name):
    return bool(name) and any(e.get("USE") == name for e in scene.iter() if isinstance(e.tag, str))


def _holds_geometry(el, defs, seen=None) -> bool:
    seen = seen if seen is not None else set()
    if el in seen:
        return False
    seen.add(el)
    if el.get("USE"):
        el = defs.get(el.get("USE"))
        if el is None:
            return True                       # unresolved USE: do not guess
    t = _tag(el)
    if t in GEOMETRY:
        return True
    return any(_holds_geometry(c, defs, seen) for c in el if isinstance(c.tag, str))


def check_sensor_senses_nothing(scene) -> list:
    """A pointing-device sensor senses the geometry of its parent's other children and their descendants
    (19777-1 / 19775-1 20.2.1). With no geometry there, nobody can click or drag it. An enabled='false' sensor
    that nothing in the file ROUTEs an enabled value to never reacts either."""
    out, defs, routes = [], _defs(scene), _routes(scene)
    lvl = _level(scene)
    for el in scene.iter():
        if _tag(el) not in SENSORS or el.get("USE") or _has_is(el):
            continue
        parent = el.getparent()
        if parent is None or _tag(parent) in {"IS", "field", "fieldValue", "ProtoBody", "ProtoInterface"}:
            continue
        name = el.get("DEF")
        if not _used_elsewhere(scene, name):
            sibs = [c for c in parent if c is not el and isinstance(c.tag, str)]
            if not any(_holds_geometry(c, defs) for c in sibs):
                where = "directly in Scene" if _tag(parent) == "Scene" else f"in its own {_tag(parent)}"
                out.append(_diag(lvl, "sensor-senses-nothing", el,
                                 f"sits {where} with no Shape beside it or under its siblings, so there is nothing to click or drag "
                                 f"and it never fires. Put the sensor in the same group as the Shape it should react to."))
                continue
        if (el.get("enabled") or "").strip().lower() == "false" and not _into(routes, name, {"enabled"}):
            out.append(_diag(lvl, "sensor-disabled-never-enabled", el,
                             "is set enabled='false' and nothing in this file ROUTEs a value to its enabled field, so it ignores "
                             "the pointer and any ROUTEs it starts stay silent. Remove enabled='false' or ROUTE a true to set_enabled."))
    return out


def check_clock_never_starts(scene) -> list:
    """A TimeSensor with loop false and startTime 0 never runs unless something sets startTime, enabled or loop.
    Its outputs then never fire, so the animation it feeds stays still."""
    out, routes = [], _routes(scene)
    lvl = _level(scene)
    for el in scene.iter():
        if _tag(el) != "TimeSensor" or el.get("USE") or _has_is(el):
            continue
        name = el.get("DEF")
        loop = (el.get("loop") or "false").strip().lower() == "true"
        enabled = (el.get("enabled") or "true").strip().lower() != "false"
        st = _nums(el.get("startTime"))
        sp = _nums(el.get("stopTime"))
        st = st[0] if st else 0.0
        sp = sp[0] if sp else 0.0
        fed = _into(routes, name, {"startTime", "enabled", "loop"})
        used = any(f == name and ff in {"fraction", "time"} for f, ff, _, _ in routes)
        if used and not fed:
            if not enabled:
                out.append(_diag("info", "timesensor-never-starts", el,       # a deliberate switch-off, usually flipped by page script
                                 "is set enabled='false' and nothing in this file ROUTEs to its enabled field, so it never runs "
                                 "and what it drives stays still. Remove enabled='false' or ROUTE a true to set_enabled."))
            elif not loop and st <= 0:
                out.append(_diag(lvl, "timesensor-never-starts", el,
                                 "has loop false and startTime 0, and nothing in this file ROUTEs to its startTime, enabled or loop, "
                                 "so it never starts and what it drives stays still. Set loop='true', or ROUTE a time such as a "
                                 "TouchSensor touchTime to set_startTime."))
        if sp > 0 and sp <= st and not _into(routes, name, {"stopTime", "startTime"}):
            out.append(_diag("info", "timesensor-stop-ignored", el,
                             f"has stopTime {sp:g} not later than startTime {st:g}; a stopTime at or before startTime is ignored, "
                             f"so the clock is not stopped when you may expect. Set stopTime later than startTime, or 0."))
    return out


def _is_flow(tag: str) -> bool:
    return tag.endswith("Interpolator") or tag.endswith("Sequencer") or tag in TRIGGERS


def check_output_goes_nowhere(scene) -> list:
    """An interpolator, sequencer or trigger node that is fed by a ROUTE but whose output is routed nowhere does
    its sum and the viewer sees nothing; one that sends output but is fed by nothing never changes."""
    out, defs, routes = [], _defs(scene), _routes(scene)
    lvl = _level(scene)
    for el in scene.iter():
        t = _tag(el)
        if not _is_flow(t) or el.get("USE") or _has_is(el) or not el.get("DEF"):
            continue
        name = el.get("DEF")
        ins = [r for r in routes if r[2] == name]
        outs = [r for r in routes if r[0] == name]
        if ins and not outs:
            out.append(_diag(lvl, "output-goes-nowhere", el,
                             "receives a ROUTE but nothing in this file ROUTEs its output anywhere, so it changes nothing the "
                             "viewer can see. ROUTE its output (value_changed, or the trigger output) to a node field."))
        elif outs and not ins:
            out.append(_diag(lvl, "input-from-nowhere", el,
                             "sends events but nothing in this file ROUTEs anything into it, so it never produces a value. "
                             "ROUTE a TimeSensor fraction_changed (or another event) to its input."))
    return out


ALL = [check_sensor_senses_nothing, check_clock_never_starts, check_output_goes_nowhere]
