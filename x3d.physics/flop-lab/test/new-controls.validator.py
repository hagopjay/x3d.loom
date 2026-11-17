#!/usr/bin/env python3
"""Healthy and fail-closed controls for the larger-level validation adapter.

Only an isolated temporary copy is corrupted. The shipped vendor is untouched.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'tools' / 'validate_levels.py'
SCENE = '<X3D profile="Immersive" version="4.0"><Scene><Viewpoint/><Shape><Sphere radius="1"/></Shape></Scene></X3D>'
LOADER = '''import importlib.util,json,sys,types
from pathlib import Path
s=importlib.util.spec_from_file_location("flop_level_validator",sys.argv[1])
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
'''


def run(tool, code):
    result = subprocess.run([sys.executable, '-c', LOADER + code, str(tool)], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


rows = []
healthy = run(TOOL, 'print(json.dumps(m.validate_bytes(' + repr(SCENE.encode()) + ')))')
if healthy['status'] != 'pass':
    raise RuntimeError('A healthy instrument is required before negative controls count')
rows.append({'id': 'healthy_repaired_scene', 'pass': True, 'status': healthy['status']})

foreign = run(TOOL, '''foreign=types.ModuleType("validation");foreign.__file__="/unrelated/validation/__init__.py"
sys.modules["validation"]=foreign
print(json.dumps(m.validate_bytes(''' + repr(SCENE.encode()) + ''')))''')
refused = foreign['status'] == 'error' and foreign.get('instrument_error', '').startswith('MCP_NAMESPACE_CONFLICT:')
if not refused:
    raise RuntimeError('Foreign validator module was not refused')
rows.append({'id': 'foreign_loaded_module_refused', 'pass': True, 'status': foreign['status'], 'diagnostic': foreign['instrument_error']})

oversize = run(TOOL, 'print(json.dumps(m.validate_bytes(b"x"*(m.MAX_XML_BYTES+1))))')
if not (oversize['status'] == 'not_run' and oversize['xsd']['status'] == 'not_run' and oversize['semantic']['status'] == 'not_run'):
    raise RuntimeError('Oversize input unexpectedly obtained a validation verdict')
rows.append({'id': 'declared_input_cap_is_not_a_pass', 'pass': True, 'status': oversize['status'], 'bytes': oversize['bytes']})

with tempfile.TemporaryDirectory(prefix='flop-validator-control-') as temp:
    fixture = Path(temp)
    (fixture / 'tools').mkdir()
    shutil.copy2(TOOL, fixture / 'tools' / TOOL.name)
    shutil.copytree(ROOT / 'vendor' / 'x3d_mcp', fixture / 'vendor' / 'x3d_mcp',
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    # Keep the manifest identical. Altering even a comment in consumed source
    # must be noticed before the pinned validator is imported or run.
    changed = fixture / 'vendor' / 'x3d_mcp' / 'src' / 'validation' / 'semantic.py'
    changed.write_bytes(changed.read_bytes() + b'\n# Deliberate isolated drift control.\n')
    drift = run(fixture / 'tools' / TOOL.name, 'print(json.dumps(m.validate_bytes(' + repr(SCENE.encode()) + ')))')
    if not (drift['status'] == 'error' and drift.get('instrument_error', '').startswith('MCP_FILE_DRIFT:')):
        raise RuntimeError('Changed pinned validator source was not refused')
    rows.append({'id': 'changed_validator_source_refused', 'pass': True, 'status': drift['status'], 'diagnostic': drift['instrument_error']})

report = {'schema': 'flop-lab.validator-adapter-controls/1', 'python': sys.version.split()[0],
          'tool_sha256': hashlib.sha256(TOOL.read_bytes()).hexdigest(), 'passed': len(rows), 'controls': rows,
          'limitations': ['One local Python runtime; no renderer, browser, MCP transport or formal Loom acceptance ran.',
                          'These controls test the named adapter boundaries; they do not prove all XML or upstream semantic behavior.']}
(ROOT / 'test' / 'new-controls.validator.json').write_text(json.dumps(report, indent=2) + '\n')
for row in rows:
    print('PASS ' + row['id'])
print(str(len(rows)) + ' adapter controls passed')
