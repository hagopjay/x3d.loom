import math, re
def tag(e):
    t=e.tag
    return t.split('}')[-1] if isinstance(t,str) else ''
def nums(s):
    if s is None: return []
    try: return [float(x) for x in re.split(r'[\s,]+',s.strip()) if x]
    except ValueError: return []
def ctx(root):
    defs={}; routes=[]; dyn=False
    for e in root.iter():
        t=tag(e)
        if e.get('DEF'): defs[e.get('DEF')]=e
        if t=='ROUTE': routes.append(e)
        if t in('Script','ProtoDeclare','ProtoInstance','ExternProtoDeclare','IMPORT','EXPORT') or t.endswith('Trigger') and False: dyn=True
    return defs,routes,dyn
def tsrc(defs,routes,field='fraction_changed'):
    """map interpolator DEF -> TimeSensor element driving it"""
    m={}
    for r in routes:
        if r.get('fromField')==field and r.get('toField')=='set_fraction':
            s=defs.get(r.get('fromNode'))
            if s is not None and tag(s)=='TimeSensor': m.setdefault(r.get('toNode'),[]).append(s)
    return m
def rot_equal(a,b,tol=1e-3):
    # same rotation modulo 2pi
    def q(r):
        x,y,z,t=r; n=math.sqrt(x*x+y*y+z*z)
        if n<1e-9 or abs(t)<1e-9: return (0,0,0,1)
        x,y,z=x/n,y/n,z/n; s=math.sin(t/2); return (x*s,y*s,z*s,math.cos(t/2))
    qa,qb=q(a),q(b); d=abs(sum(i*j for i,j in zip(qa,qb)))
    return abs(d-1)<tol
W={'ScalarInterpolator':1,'PositionInterpolator':3,'ColorInterpolator':3,'OrientationInterpolator':4,'PositionInterpolator2D':2}
def c_loop_jump(root):
    defs,routes,dyn=ctx(root); m=tsrc(defs,routes); out=[]
    for d,tss in m.items():
        e=defs.get(d)
        if e is None or tag(e) not in W: continue
        if not any(t.get('loop')=='true' for t in tss): continue
        k=nums(e.get('key')); v=nums(e.get('keyValue')); w=W[tag(e)]
        if len(k)<2 or len(v)!=len(k)*w: continue
        a,b=v[:w],v[-w:]
        if tag(e)=='OrientationInterpolator': same=rot_equal(a,b)
        else: same=all(abs(x-y)<=1e-4*max(1,abs(x)) for x,y in zip(a,b))
        if not same: out.append(('loop-jump',d,tag(e),a,b))
    return out
def c_ts_never(root):
    defs,routes,dyn=ctx(root); out=[]
    if dyn: return out
    into={}
    for r in routes: into.setdefault(r.get('toNode'),set()).add(r.get('toField'))
    for e in root.iter():
        if tag(e)!='TimeSensor' or e.get('USE'): continue
        d=e.get('DEF'); en=e.get('enabled','true')
        st=nums(e.get('startTime','0')) or [0]
        if en=='false' and not (d and any(f in('set_enabled','enabled') for f in into.get(d,()))):
            out.append(('ts-disabled',d)); continue
        if e.get('loop','false')=='false' and st[0]<=0 and not (d and into.get(d)):
            out.append(('ts-never-starts',d))
    return out
def c_dangling(root):
    defs,routes,dyn=ctx(root); out=[]
    if dyn: return out
    frm={(r.get('fromNode'),r.get('fromField')) for r in routes}
    to={(r.get('toNode'),r.get('toField')) for r in routes}
    for e in root.iter():
        t=tag(e)
        if t not in W or e.get('USE'): continue
        d=e.get('DEF')
        if not d: out.append(('anon-interp',None,t)); continue
        if (d,'value_changed') not in frm: out.append(('out-unrouted',d,t))
        elif (d,'set_fraction') not in to: out.append(('in-unrouted',d,t))
    return out
RANGE={'transparency','ambientIntensity','shininess'}
COLF={'diffuseColor','emissiveColor','specularColor','color','skyColor','groundColor'}
def c_range(root):
    defs,routes,dyn=ctx(root); out=[]
    for r in routes:
        s=defs.get(r.get('fromNode'))
        if s is None or r.get('fromField')!='value_changed': continue
        t=tag(s); v=nums(s.get('keyValue')); f=r.get('toField').replace('set_','')
        if t=='ScalarInterpolator' and f in RANGE and v and (min(v)<0 or max(v)>1): out.append(('scalar-range',r.get('fromNode'),f,min(v),max(v)))
        if t=='ColorInterpolator' and f in COLF and v and (min(v)<0 or max(v)>1): out.append(('color-range',r.get('fromNode'),f,min(v),max(v)))
    return out
def c_dead_ends(root):
    defs,routes,dyn=ctx(root); m=tsrc(defs,routes); out=[]
    for d,tss in m.items():
        e=defs.get(d)
        if e is None or tag(e) not in W: continue
        k=nums(e.get('key'))
        if len(k)<2: continue
        if 0<=k[0]<=1 and 0<=k[-1]<=1 and (k[0]>0.001 or k[-1]<0.999):
            out.append(('dead-time',d,tag(e),k[0],k[-1],any(t.get('loop')=='true' for t in tss)))
    return out
def c_equal_key_jump(root):  # control: should NOT be reported; counts for info only
    out=[]
    for e in root.iter():
        if tag(e) in W:
            k=nums(e.get('key'))
            if any(k[i]==k[i+1] for i in range(len(k)-1)): out.append(('equal-key-jump',e.get('DEF')))
    return out
ALL={'loop_jump':c_loop_jump,'ts_never':c_ts_never,'dangling':c_dangling,'range':c_range,'dead_ends':c_dead_ends,'equal_key':c_equal_key_jump}
def c_spin_jump(root):
    """loop=true OrientationInterpolator, every key on one axis, last angle != first mod 2pi (a spin meant to be continuous)"""
    defs,routes,dyn=ctx(root); m=tsrc(defs,routes); out=[]
    for d,tss in m.items():
        e=defs.get(d)
        if e is None or tag(e)!='OrientationInterpolator' or not any(t.get('loop')=='true' for t in tss): continue
        v=nums(e.get('keyValue')); k=nums(e.get('key'))
        if len(v)<8 or len(v)!=4*len(k): continue
        ks=[v[i:i+4] for i in range(0,len(v),4)]
        ax=None; ok=True
        for r in ks:
            if abs(r[3])<1e-9: continue
            n=math.sqrt(sum(c*c for c in r[:3]))
            if n<1e-9: ok=False;break
            u=tuple(c/n for c in r[:3])
            if ax is None: ax=u
            elif sum(a*b for a,b in zip(ax,u))<0.999: ok=False;break
        if not ok or ax is None: continue
        if rot_equal(ks[0],ks[-1]): continue
        span=abs(ks[-1][3]-ks[0][3])
        if span>=0.5: out.append(('spin-jump',d,ks[0][3],ks[-1][3]))
    return out
ALL['spin_jump']=c_spin_jump
