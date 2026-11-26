"""Run x3d_mcp check_orientation_steps on every distinct .x3d under a folder of repositories.

    python3 survey.py <x3d_mcp checkout> <folder of repositories> [files.json]

Prints counts per check and level, and per repository. Scenes are distinct by SHA-1 of the text without white space."""
import sys, os, re, hashlib, json, collections
MCP, ROOT = sys.argv[1], sys.argv[2].rstrip('/') + '/'
sys.path.insert(0, MCP + '/src')
from lxml import etree
from validation.data_checks import check_orientation_steps
seen=set(); n=0; with_oi=0; per=collections.Counter(); files=collections.defaultdict(list); byrepo=collections.Counter(); oirepo=collections.Counter()
for repo in sorted(os.listdir(ROOT)):
    root=ROOT+repo
    if not os.path.isdir(root+'/.git'): continue
    for d,ds,fs in os.walk(root):
        ds[:]=[x for x in ds if x not in('.git','node_modules','woven-test')]
        for f in fs:
            if not f.endswith('.x3d'): continue
            p=os.path.join(d,f)
            try: b=open(p,'rb').read()
            except Exception: continue
            h=hashlib.sha1(re.sub(rb'\s+',b'',b)).hexdigest()
            if h in seen: continue
            seen.add(h)
            if b'OrientationInterpolator' not in b: n+=1; continue
            try: t=etree.fromstring(b, etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=True))
            except Exception: n+=1; continue
            n+=1; with_oi+=1; oirepo[repo]+=1
            ds_=check_orientation_steps(t)
            for c in {x.check+":"+x.level for x in ds_}:
                per[c]+=1; files[c].append(p[len(ROOT):]); byrepo[(repo,c)]+=1
            if ds_: per["any"]+=1
            if any(x.level=="warning" for x in ds_): per["any-warning"]+=1; byrepo[(repo,"any-warning")]+=1
print(json.dumps({"scenes":n,"with_OrientationInterpolator":with_oi,"flagged":per,"oi_by_repo":oirepo,"by_repo":{f"{a}|{b}":c for (a,b),c in byrepo.items()}},indent=1))
if len(sys.argv) > 3:
    json.dump(files, open(sys.argv[3], 'w'), indent=1)
