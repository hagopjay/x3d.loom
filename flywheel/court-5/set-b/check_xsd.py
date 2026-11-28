#!/usr/bin/env python3
import glob, json, os, sys
from lxml import etree
HERE = os.path.dirname(os.path.abspath(__file__))
schema = etree.XMLSchema(etree.parse(os.path.join(HERE, '..', 'kit', 'xsd', 'x3d-4.0.xsd')))
out = {}
for f in sorted(glob.glob(os.path.join(HERE, '*.x3d'))):
    name = os.path.basename(f)
    try:
        d = etree.parse(f)
    except Exception as e:
        out[name] = {'well_formed': False, 'error': str(e)}; continue
    ok = schema.validate(d)
    out[name] = {'well_formed': True, 'xsd_valid': ok, 'errors': [str(e.message) for e in schema.error_log][:3]}
json.dump(out, open(os.path.join(HERE, 'xsd.json'), 'w'), indent=1)
for k, v in out.items():
    if not v.get('xsd_valid'):
        print(k, v)
print(sum(1 for v in out.values() if v.get('xsd_valid')), 'valid of', len(out))
