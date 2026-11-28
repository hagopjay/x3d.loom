"""Run one x3d_mcp checkout over the opened court-4 sets. usage: run_kernel.py <x3d_mcp dir> <sets dir> <out.json>

The same runner as court 3 (validate_xml for the X3D 4.0 XSD, semantic_diagnostics for everything else, the scene
text only, no folder), with the hash of plays_checks.py added to the record."""
import sys, json, glob, os, hashlib, subprocess
mcp, sets, out = sys.argv[1:4]
sys.path.insert(0, mcp + '/src')
from validation.validate import validate_xml
from validation.semantic import semantic_diagnostics
R = {'kernel': subprocess.run(['git', '-C', mcp, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip(),
     'dirty': bool(subprocess.run(['git', '-C', mcp, 'status', '--porcelain', '--', 'src'], capture_output=True, text=True).stdout.strip()),
     'src_sha256': {f: hashlib.sha256(open(f'{mcp}/src/validation/{f}', 'rb').read()).hexdigest()
                    for f in ('plays_checks.py', 'inert_checks.py', 'data_checks.py', 'semantic.py') if os.path.exists(f'{mcp}/src/validation/{f}')},
     'files': {}}
for s in ("a", "b"):
    folder = f'{sets}/set-{s}' if os.path.isdir(f'{sets}/set-{s}') else f'{sets}/{s}'
    for x in sorted(glob.glob(f'{folder}/*.x3d')):
        t = open(x, encoding='utf-8').read()
        try:
            v = validate_xml(t); xsd = {k: v.get(k) for k in ('valid', 'errors', 'error') if k in v}
        except Exception as e:
            xsd = {'exception': repr(e)}
        try:
            sem = [dict(level=d.level, check=d.check, message=d.message, node=d.node_tag, DEF=d.def_name) for d in semantic_diagnostics(t)]
        except Exception as e:
            sem = [dict(level='exception', check='run', message=repr(e), node='', DEF='')]
        R['files'][f'{s}/{os.path.basename(x)}'] = dict(xsd=xsd, semantic=sem)
json.dump(R, open(out, 'w'), indent=1, default=str)
print(out, R['kernel'][:7], 'dirty' if R['dirty'] else 'clean', len(R['files']), 'files')
