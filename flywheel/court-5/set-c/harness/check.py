#!/usr/bin/env python3
"""Well-formedness, XSD validation and component-level check. Writes harness/xsd.json."""
import glob, json, os, re, sys
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
XSD = sys.argv[1]
schema = etree.XMLSchema(etree.parse(XSD))
xs = '{http://www.w3.org/2001/XMLSchema}'
levels = {}
for el in etree.parse(XSD).getroot().iter(xs + 'element'):
    nm = el.get('name')
    if not nm:
        continue
    comp = lvl = None
    for a in el.findall(xs + 'annotation/' + xs + 'appinfo/' + xs + 'attribute'):
        if a.get('name') == 'componentName':
            comp = a.get('fixed')
        if a.get('name') == 'componentLevel':
            lvl = int(a.get('fixed'))
    if comp and nm not in levels:
        levels[nm] = (comp, lvl)
IMM = dict(Core=2, Time=1, Networking=3, Grouping=2, Rendering=3, Shape=2, Geometry3D=4, Geometry2D=1, Text=1,
           Sound=1, Lighting=2, Texturing=2, Interpolation=2, PointingDeviceSensor=1, KeyDeviceSensor=2,
           EnvironmentalSensor=2, Navigation=2, EnvironmentalEffects=2, Scripting=1, EventUtilities=1)
res = {}
for f in sorted(glob.glob(os.path.join(OUT, '*.x3d'))):
    t = etree.parse(f)
    ok = schema.validate(t)
    have = dict(IMM)
    for c in t.iter('component'):
        have[c.get('name')] = max(have.get(c.get('name'), 0), int(c.get('level')))
    short = []
    for e in t.getroot().iter():
        if e.tag in levels:
            comp, lvl = levels[e.tag]
            if have.get(comp, 0) < lvl:
                short.append('%s needs %s:%d' % (e.tag, comp, lvl))
    res[os.path.basename(f)] = dict(xsd_valid=bool(ok), errors=[str(e.message) for e in schema.error_log][:3],
                                    component_short=sorted(set(short)))
    print(os.path.basename(f), 'OK ' if ok else 'BAD', res[os.path.basename(f)]['errors'][:1], short)
json.dump(res, open(os.path.join(HERE, 'xsd.json'), 'w'), indent=1)
