"""Export the search itself: every wiring tried, in order, and the one that won. For pictures of a graph wiring itself.

    python3 selfcode/trace.py <out folder>

Writes one JSON per world: the node editor's door and counter worlds and one start-on-press task. Shape:
{"schema": "x3d.selfcode.trace/1", "task", "simulator", "fields": [...], "candidates": [{"step", "field", "nodes":
[{"id", "type", "parent"}], "routes": [[from, from_field, to, to_field]], "verdict", "runs_so_far"}], "winner": {...}}.
Verdicts: "ran" (a wiring was simulated and did not finish the field), "match" (this wiring reproduces the field).
Sensors placed on every touchable object as possible starting points are not listed unless a wiring uses one.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import core            # noqa: E402
import synth           # noqa: E402
import tasks as T      # noqa: E402


class Traced(synth.Synth):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.steps, self.field = [], None

    def note(self, nodes, routes, verdict):
        used = {r[0] for r in routes} | {r[2] for r in routes}
        self.steps.append({"step": len(self.steps) + 1, "field": ".".join(self.field) if self.field else None,
                           "nodes": [{"id": n[0], "type": n[1], "parent": n[2]} for n in nodes if n[0] in used],
                           "routes": [list(r) for r in routes], "verdict": verdict, "runs_so_far": self.sims})

    def extend(self, base, chain, node_type, in_field, variant, key):
        before = self.sims
        self.field = key
        out = super().extend(base, chain, node_type, in_field, variant, key)
        if self.sims > before:                                   # a new wiring was simulated
            sensors = [s for s in self.sensors() if s[0] not in {n[0] for n in base["nodes"]}]
            self.note(base["nodes"] + sensors + out[1], base["routes"] + out[2], "ran")
        return out

    def finish(self, base, chain, port, key, motif):
        self.field = key
        done = super().finish(base, chain, port, key, motif)
        if done:
            self.note(done[0]["nodes"] + self.sensors(), done[0]["routes"], "match")
        return done


def export(name, stage_text, reference, out):
    stage = core.Stage(stage_text)
    script, seconds = core.long_script(stage)
    demo, _ = core.run(reference, script, stage, seconds)
    s = Traced(stage, script, seconds, demo, budget=1000, share=100)
    program, left = s.solve()
    git = subprocess.run(["git", "-C", str(core.BLENDER_IO), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    doc = {"schema": "x3d.selfcode.trace/1", "task": name, "simulator": f"x3d-blender-io@{git}",
           "fields": [".".join(k) for k in core.changed(demo, stage)], "solved": program is not None, "runs": s.sims,
           "candidates": s.steps,
           "winner": None if not program else {"nodes": [{"id": n[0], "type": n[1], "parent": n[2]} for n in program["nodes"]],
                                               "routes": [list(r) for r in program["routes"]]}}
    (out / f"{name}.trace.json").write_text(json.dumps(doc, indent=1))
    print(name, "solved" if program else "missed", s.sims, "runs,", len(s.steps), "steps")


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for world in ("door", "counter"):
        text = (Path(core.BLENDER_IO) / "tests" / "behaviour" / f"{world}.x3d").read_text()
        export(world, core.bg.strip(text), core.bg.Behaviour.from_x3d(text), out)
    task = next(t for t in T.tasks([4]) if t["id"] == "start-on-press-4")
    export(task["id"], (HERE / "stage.x3d").read_text(), core.build(task["reference"]), out)


if __name__ == "__main__":
    main()
