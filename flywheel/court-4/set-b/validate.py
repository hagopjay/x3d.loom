#!/usr/bin/env python3
"""Well-formedness + XSD validation of every .x3d in this folder; writes xsd.json."""
import glob, json, os
from lxml import etree
HERE = os.path.dirname(os.path.abspath(__file__))
schema = etree.XMLSchema(etree.parse(os.path.join(HERE, '..', 'kit', 'xsd', 'x3d-4.0.xsd')))
out = {}
for p in sorted(glob.glob(os.path.join(HERE, '*.x3d'))):
    n = os.path.basename(p)
    try:
        t = etree.parse(p)
    except etree.XMLSyntaxError as e:
        out[n] = {'well_formed': False, 'error': str(e)}; continue
    ok = schema.validate(t)
    out[n] = {'well_formed': True, 'xsd_valid': ok, 'errors': [str(e.message)[:300] for e in schema.error_log][:4]}
json.dump(out, open(os.path.join(HERE, 'xsd.json'), 'w'), indent=1, sort_keys=True)
for n, v in out.items():
    print(n, v.get('well_formed'), v.get('xsd_valid'), v.get('errors') or '')
