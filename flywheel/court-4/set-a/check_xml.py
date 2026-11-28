#!/usr/bin/env python3
"""Well-formedness and XSD validation of every .x3d file in this folder."""
import glob, json, os, sys
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
XSD = os.path.join(HERE, '..', 'kit', 'xsd', 'x3d-4.0.xsd')
schema = etree.XMLSchema(etree.parse(XSD))
out = {}
for path in sorted(glob.glob(os.path.join(HERE, '*.x3d'))):
    name = os.path.basename(path)
    try:
        tree = etree.parse(path)
    except etree.XMLSyntaxError as e:
        out[name] = {'well_formed': False, 'xsd_valid': False, 'errors': [str(e)]}
        continue
    ok = schema.validate(tree)
    out[name] = {'well_formed': True, 'xsd_valid': bool(ok),
                 'errors': [str(e) for e in schema.error_log][:5],
                 'lines': sum(1 for _ in open(path))}
json.dump(out, open(os.path.join(HERE, 'xsd.json'), 'w'), indent=1, sort_keys=True)
for k, v in out.items():
    print(k, 'WF' if v['well_formed'] else 'NOT-WF', 'XSD-OK' if v['xsd_valid'] else 'XSD-INVALID', v.get('lines'), '; '.join(v['errors'])[:200])
