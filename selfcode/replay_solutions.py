"""Replay stored solutions through the simulator that X3D_BLENDER_IO points at (exploratory).

    X3D_BLENDER_IO=<checkout> python3 selfcode/replay_solutions.py <results dir with solutions/> <out.json>

Each woven solution of the test seeds is read back as a behaviour graph and compared with its task's reference on the
lesson it was found from and on the unseen stimulus, at the registered tolerance 0.02. Used to ask: does a fixed
simulator still call a solution found under the old one equal to its reference?
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import core            # noqa: E402
import tasks as T      # noqa: E402

sol, out = Path(sys.argv[1]) / "solutions", sys.argv[2]
stage = core.Stage((HERE / "stage.x3d").read_text())
res = {}
for t in T.tasks([4, 5, 6, 7, 8, 9]):
    ref = core.build(t["reference"])
    for arm in ("short", "long", "warm"):
        p = sol / f"{t['id']}.{arm}.x3d"
        if not p.exists():
            continue
        found = core.bg.Behaviour.from_x3d(p.read_text())
        r = {}
        for name, fn in (("lesson", core.train_script if arm == "short" else core.long_script), ("heldout", core.heldout_script)):
            script, seconds = fn(stage)
            want, _ = core.run(ref, script, stage, seconds)
            got, _ = core.run(found, script, stage, seconds)
            r[name] = not core.same(want, got, stage, 0.02)
        res[f"{t['id']}.{arm}"] = r
json.dump({"simulator": os.environ["X3D_BLENDER_IO"], "equal_to_reference": res}, open(out, "w"), indent=1)
bad = [k for k, v in res.items() if not (v["lesson"] and v["heldout"])]
print(len(res), "replayed; differ from reference:", len(bad), bad)
