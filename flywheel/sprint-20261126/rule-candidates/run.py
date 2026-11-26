import os,re,hashlib,json,collections,sys
sys.path.insert(0,'(sprint scratch) ')
from lxml import etree
import candidates as C
ROOT=''
seen=set(); n=0; rel=collections.Counter(); flag=collections.defaultdict(list); byrepo=collections.Counter(); res={}
for repo in sorted(os.listdir(ROOT)):
    r0=ROOT+repo
    if not os.path.isdir(r0+'/.git'): continue
    for d,ds,fs in os.walk(r0):
        ds[:]=[x for x in ds if x not in('.git','node_modules','woven-test')]
        for f in fs:
            if not f.endswith('.x3d'): continue
            p=os.path.join(d,f)
            try: b=open(p,'rb').read()
            except Exception: continue
            h=hashlib.sha1(re.sub(rb'\s+',b'',b)).hexdigest()
            if h in seen: continue
            seen.add(h)
            try: t=etree.fromstring(b,etree.XMLParser(resolve_entities=False,no_network=True,huge_tree=True))
            except Exception: n+=1; continue
            n+=1
            hasI=b'Interpolator' in b; hasT=b'TimeSensor' in b
            if hasI: rel['interp']+=1
            if hasT: rel['ts']+=1
            for name,fn in C.ALL.items():
                x=fn(t)
                if x:
                    flag[name].append(p); byrepo[(name,repo)]+=1
                    res[(name,p)]=x[:6]
print('scenes',n,dict(rel))
for k,v in flag.items(): print(k,len(v),{r:c for (nm,r),c in byrepo.items() if nm==k})
json.dump({k:v for k,v in flag.items()},open('flagged.json','w'),indent=0)
json.dump({f'{a}|{b}':repr(v) for (a,b),v in res.items()},open('details.json','w'),indent=0)
