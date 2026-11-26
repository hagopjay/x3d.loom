import sys,glob,json
sys.path.insert(0,'x3d_mcp/src')
from validation.validate import validate_xml
from validation.semantic import semantic_diagnostics
R={}
glob_=None
for x in sorted(glob.glob('*.x3d')):
    t=open(x).read()
    try: v=validate_xml(t)
    except Exception as e: v={'error':repr(e)}
    try: d=[(a.level,a.check,a.message[:160]) for a in semantic_diagnostics(t)]
    except Exception as e: d=[('exc','run',repr(e))]
    R[x]=dict(xsd={k:(val if k!='hints' else val) for k,val in v.items() if k in('valid','errors','error','warnings')},semantic=d)
json.dump(R,open('results.json','w'),indent=1,default=str)
for x,r in R.items():
    print(x,'XSD',r['xsd'].get('valid'),str(r['xsd'].get('errors'))[:230])
    for d in r['semantic']: print('   ',d)
