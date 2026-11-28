#!/usr/bin/env python3
import sys, glob, os, json
from lxml import etree
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
xsd = etree.XMLSchema(etree.parse(os.path.join(here, '..', 'kit', 'xsd', 'x3d-4.0.xsd')))
out = {}
for f in sorted(glob.glob(os.path.join(here, '*.x3d'))):
    n = os.path.basename(f)
    try:
        d = etree.parse(f)
    except Exception as e:
        out[n] = {'wellformed': False, 'error': str(e)}; continue
    ok = xsd.validate(d)
    out[n] = {'wellformed': True, 'xsd_valid': ok, 'lines': sum(1 for _ in open(f)),
              'errors': [str(e.message)[:160] for e in xsd.error_log][:3] if not ok else []}
json.dump(out, open(os.path.join(here, 'xsd.json'), 'w'), indent=1)
for n, v in out.items():
    print(n, v.get('wellformed'), v.get('xsd_valid'), v.get('lines'), v.get('errors') or '')
