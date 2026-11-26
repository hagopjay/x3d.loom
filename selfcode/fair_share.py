"""After the registered run (exploratory): the follow-the-leader family with and without a first share of runs per field.

    python3 selfcode/fair_share.py selfcode/results/fair-share.json
"""
import sys,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import core, synth, tasks
text=(HERE/'stage.x3d').read_text(); st=core.Stage(text); scr,sec=core.long_script(st); hs,ht=core.heldout_script(st)
out=[]
for t in tasks.tasks([4,5,6,7,8,9]):
    if t['family']!='follow-the-leader': continue
    ref=core.build(t['reference']); demo,_=core.run(ref,scr,st,sec)
    row={'id':t['id']}
    for name,share in (('registered',None),('fair share',100)):
        s=synth.Synth(st,scr,sec,demo,budget=1000,share=share); prog,left=s.solve()
        ok=None
        if prog:
            want,_=core.run(ref,hs,st,ht); got,_=core.run(core.build(prog),hs,st,ht); ok=not core.same(want,got,st,0.02)
        row[name]={'solved':bool(prog),'heldout':ok,'sims':s.sims}
    print(row,flush=True); out.append(row)
json.dump(out,open(sys.argv[1],'w'),indent=1)
