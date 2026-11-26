import sys,os,json,time,signal
os.environ['X3D_BLENDER_IO']='x3d-blender-io'
SC='agents/11/selfcode'
sys.path.insert(0,SC);sys.path.insert(0,SC+'/wild')
import core,synth,wild
from pathlib import Path
tag=sys.argv[1]; names=sys.argv[2:]
T=json.load(open('agents/11/tasks.json'))
paths={x['hash']:x['path'] for x in T}; paths['542b98b59ada']='x3d.loom/x3d.platformer/levels/1-1-tinker-meadow.x3d'
for h in names:
    row={'hash':h,'tag':tag}
    try:
        text=Path(paths[h]).read_text(errors='ignore')
        ref=core.bg.Behaviour.from_x3d(text); bare=core.bg.strip(text); stage=core.Stage(bare)
        script,secs=wild.lesson(stage,ref)
        signal.signal(signal.SIGALRM,wild._alarm)
        signal.alarm(30)
        try: demo,_=core.run(ref,script,stage,secs)
        finally: signal.alarm(0)
        fields=core.changed(demo,stage)
        s=synth.Synth(stage,script,secs,demo,budget=400,share=100)
        t0=time.time(); signal.alarm(30)
        try: prog,left=s.solve(); slow=False
        except wild.TooSlow: prog,left,slow=None,fields,True
        finally: signal.alarm(0)
        row.update(solved=prog is not None,runs=s.sims,secs=round(time.time()-t0,2),left=len(left),fields=len(fields),slow=slow)
        row['ok']=bool(prog and wild.unseen(stage,ref,prog,secs))
    except Exception as e: row['err']=repr(e)[:100]
    print(json.dumps(row),flush=True)
