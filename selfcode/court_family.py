"""Browser replay of every found graph of one family (exploratory): reference against the solution of each seed, long and
short lesson. Same judge and thresholds as court.py.

    python3 selfcode/court_family.py <x_ite dist dir> <results dir> <family> <out.json>
"""
import sys, json, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import core, court, tasks as T
xite, results, family, out_path = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]
stage = (HERE / 'stage.x3d').read_text(); tmp = Path(tempfile.mkdtemp()); jobs = []
for t in T.tasks([4, 5, 6, 7, 8, 9]):
    if t['family'] != family:
        continue
    ref = t['reference']; sensor = next(n for n in ref['nodes'] if n[1] == 'TouchSensor')
    p = tmp / f"{t['id']}.reference.x3d"; p.write_text(core.build(ref).weave(stage))
    watch = sorted({(r[2], r[3]) for r in ref['routes'] if r[2] in ref['targets']})
    for arm in ('long', 'short'):
        found = results / 'solutions' / f"{t['id']}.{arm}.x3d"
        if found.exists() and f'DEF="Touch_{sensor[2]}"' in found.read_text():
            jobs.append((f"{t['id']}.{arm}", watch, p, sensor[0], found, f'Touch_{sensor[2]}'))
def work(j):
    name, watch, a, sa, b, sb = j
    v = court.judge(xite, watch, a, sa, b, sb); print(name, v, flush=True)
    return {'pair': name, 'watch': ['.'.join(w) for w in watch], **v}
with ThreadPoolExecutor(3) as pool:
    out = list(pool.map(work, jobs))
json.dump(out, open(out_path, 'w'), indent=1)
