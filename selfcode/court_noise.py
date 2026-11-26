"""The browser court's own repeatability (exploratory): each disputed reference against itself, and a second replay of
each disputed solution.

    python3 selfcode/court_noise.py <x_ite dist dir> selfcode/results/court-noise.json [results dir [task,task,...]]
"""
import sys, json, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import core, court, tasks as T
xite=Path(sys.argv[1]); results=Path(sys.argv[3]) if len(sys.argv)>3 else HERE/'results'      # optional: another results folder
names=sys.argv[4].split(',') if len(sys.argv)>4 else ('start-on-press-4','two-targets-4','two-targets-5')    # optional: which tasks
stage=(HERE/'stage.x3d').read_text(); tmp=Path(tempfile.mkdtemp())
jobs=[]
for name in names:
    t=[t for t in T.tasks([int(name[-1])]) if t['id']==name][0]; ref=t['reference']
    sensor=next(n for n in ref['nodes'] if n[1]=='TouchSensor')
    p=tmp/f'{name}.reference.x3d'; p.write_text(core.build(ref).weave(stage))
    watch=sorted({(r[2],r[3]) for r in ref['routes'] if r[2] in ref['targets']})
    found=results/'solutions'/f'{name}.long.x3d'
    jobs.append(('reference against itself',name,watch,p,sensor[0],p,sensor[0]))
    jobs.append(('solution, second replay',name,watch,p,sensor[0],found,f'Touch_{sensor[2]}'))
def work(j):
    kind,name,watch,a,sa,b,sb=j
    v=court.judge(xite,watch,a,sa,b,sb); print(kind,name,v,flush=True); return {'kind':kind,'pair':name,'watch':['.'.join(w) for w in watch],**v}
with ThreadPoolExecutor(3) as pool: out=list(pool.map(work,jobs))
json.dump(out,open(sys.argv[2],'w'),indent=1)
