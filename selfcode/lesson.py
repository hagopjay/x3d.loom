"""A lesson from a recording: let the search learn from what somebody did in the Blender node editor.

    python3 selfcode/lesson.py <world.x3d> <world.activity.json> [--out result.json]

The recording is an ``x3d.activity/1`` file (x3d-blender-io ``tools/behaviour_record.py`` or the editor's own Record
button): the calls a person or a script made (``stimulus``) and every delivery that followed (``trace``). The search is
given less than the file holds. It sees

  * the calls, as "this object was pressed at this time" (the sensor's name is replaced by the object it sat on), and
  * the deliveries that land on a field of the bare scene (a door's translation, a lamp's colour).

It does not see the nodes, the ROUTEs or any delivery between behaviour nodes: those are the answer. The world file is
read for the bare scene and, afterwards, to mark the result. (Recordings older than x3d-blender-io 2.7.7 name only the
sensor; for those the object it sat on is read from the world as well.)

The recording is made at 60 frames a second and the search samples every 0.05 s, which is every third frame, so no
value is interpolated: a sample is the last delivery at or before its time.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core            # noqa: E402
import synth           # noqa: E402
from run import heldout                                         # noqa: E402

SCHEMA = "x3d.activity/1"
ACTIONS = {"press": "press", "release": "release", "drag": "drag", "hover": "hover"}


def plain(field):
    """A field name without the set_ / _changed dress, as the stage names it."""
    if field.startswith("set_"):
        field = field[4:]
    return field[:-8] if field.endswith("_changed") else field


def from_activity(report, stage, sits_on=None):
    """(script, seconds, demonstration, notes) for the search. A pointer call names the object that was hit
    ("object", recordings since x3d-blender-io 2.7.7); ``sits_on`` (sensor name to object) is only for older files."""
    if report.get("schema") != SCHEMA:
        raise ValueError(f"not an {SCHEMA} file: {report.get('schema')!r}")
    if report.get("trace_truncated"):
        raise ValueError("the recording was cut short (trace_truncated); record it again with a larger log")
    notes, script, steps = [], [], []
    sits_on = sits_on or {}

    def where(call):                                        # recordings since x3d-blender-io 2.7.7 name the object hit
        return call.get("object") or sits_on[call["node"]]

    for call in report["stimulus"]:
        when, name = float(call["time"]), call["call"]
        if name == "step":
            steps.append(when)
        elif name == "click":                               # a click is a press and a release at one time
            script += [(when, "press", where(call), (0.0, 0.0, 0.0)), (when, "release", where(call), None)]
        elif name in ACTIONS:
            args = call.get("args") or {}
            arg = {"press": tuple(args.get("point", (0.0, 0.0, 0.0))), "release": None,
                   "drag": tuple(args.get("point", args.get("offset", (0.0, 0.0, 0.0)))),
                   "hover": bool(args.get("over", args.get("is_over", True)))}[name]
            script.append((when, name, where(call), arg))
        elif name != "start":
            notes.append(f"call '{name}' at {when} is not part of a pointer lesson and was left out")
    seconds = round(max(steps), 6)
    n = int(round(seconds / core.DT)) + 1
    off = [t for t, *_ in script if abs(t / core.DT - round(t / core.DT)) > 1e-6]
    if off:
        notes.append(f"{len(off)} calls fall between samples; the search replays them at their own times")
    demo = {key: [stage.initial[key]] * n for key in stage.initial}
    last = {}
    for when, _src, _out, to, field, _kind, value in report["trace"]:
        key = (to, plain(field))
        if key in stage.initial:
            last.setdefault(key, []).append((float(when), tuple(value) if isinstance(value, list) else value))
    for key, rows in last.items():
        j, now = 0, stage.initial[key]
        for i in range(n):
            t = i * core.DT + 1e-9
            while j < len(rows) and rows[j][0] <= t:
                now = rows[j][1]
                j += 1
            demo[key][i] = now
    return sorted(script, key=lambda e: e[0]), seconds, demo, notes


def learn(world_text, report, budget=1000, share=None):
    reference = core.bg.Behaviour.from_x3d(world_text)
    bare = core.bg.strip(world_text)
    stage = core.Stage(bare)
    named = all(c.get("object") for c in report["stimulus"] if c["call"] in ACTIONS or c["call"] == "click")
    sits_on = None if named else {k: n.parent for k, n in reference.nodes.items()
                                  if n.role == core.bg.BEHAVIOUR and n.node_type in core.bs.POINTING}
    script, seconds, demo, notes = from_activity(report, stage, sits_on)
    # the recording and this simulator must tell the same story about the original, or the lesson is not a fair one
    again, _ = core.run(reference, script, stage, seconds)
    drift = core.same(again, demo, stage, 1e-3)
    fields = core.changed(demo, stage)
    s = synth.Synth(stage, script, seconds, demo, budget=budget, share=share, whole=True)
    program, left = s.solve()
    out = {"schema": "x3d.selfcode.lesson/1", "recording": {"schema": report["schema"], "calls": len(script), "seconds": seconds,
                                                           "deliveries": len(report["trace"])},
           "shown_to_the_search": {"fields": [f"{a}.{b}" for a, b in fields], "pointer_calls": len(script)},
           "object_named_by_the_recording": named, "recording_matches_resimulation": not drift, "fields_that_drift": [f"{a}.{b}" for a, b in drift],
           "solved": program is not None, "runs": s.sims, "left": [f"{a}.{b}" for a, b in left], "notes": notes}
    if program:
        out["nodes"] = [[i, t, p] for i, t, p, _ in program["nodes"]]
        out["routes"] = [list(r) for r in program["routes"]]
        out["reference_nodes"] = sum(1 for n in reference.nodes.values() if n.role == core.bg.BEHAVIOUR)
        out["agrees_on_unseen_stimulus"] = bool(heldout(stage, reference, program)) if stage.touchable else None
        out["x3d"] = core.build(program).weave(bare)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("world", type=Path)
    ap.add_argument("activity", type=Path)
    ap.add_argument("--budget", type=int, default=1000)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--x3d-out", type=Path, help="where to write the scene the search wrote")
    a = ap.parse_args()
    result = learn(a.world.read_text(), json.loads(a.activity.read_text()), a.budget)
    x3d = result.pop("x3d", None)
    if x3d and a.x3d_out:
        a.x3d_out.write_text(x3d)
    text = json.dumps(result, indent=1)
    if a.out:
        a.out.write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
