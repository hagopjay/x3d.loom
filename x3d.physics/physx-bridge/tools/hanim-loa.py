"""Extract H-Anim joint and segment tables (index, parent, LOA, default centre) from the X3D 4.0 XSD in the x3d_mcp server, for the
ragdoll's humanoid. usage: python3 tools/hanim-loa.py 4 > src/ragdoll/hanim-all.json (the ragdoll filters by LOA)"""
import json, re, sys, os
XSD = os.path.expanduser('~/Projects/x3d/x3d_mcp/src/validation/schemas/x3d-4.0.xsd')
s = open(XSD).read()
maxloa = int(sys.argv[1]) if len(sys.argv) > 1 else 1
def table(typename):
    m = re.search(r'<xs:simpleType name="%s">(.*?)</xs:simpleType>' % typename, s, re.S)
    out = []
    for e in re.finditer(r'<xs:enumeration value="([^"]+)">(.*?)</xs:enumeration>', m.group(1), re.S):
        name, body = e.group(1), e.group(2)
        attrs = {}
        for a in re.finditer(r'<xs:attribute name="(\w+)" type="[^"]*" fixed="([^"]*)"', body):
            attrs.setdefault(a.group(1), []).append(a.group(2))
        out.append({'name': name, **{k: (v if len(v) > 1 else v[0]) for k, v in attrs.items()}})
    return out
def loa(x):
    v = x.get('loa', '99')
    return min(int(a) for a in (v if isinstance(v, list) else [v]))
joints = [j for j in table('hanimJointNameValues') if loa(j) <= maxloa]
segs = [g for g in table('hanimSegmentNameValues') if loa(g) <= maxloa]
json.dump({'source': 'X3D 4.0 XSD (x3d_mcp) hanimJointNameValues/hanimSegmentNameValues appinfo', 'maxLoa': maxloa, 'joints': joints, 'segments': segs}, sys.stdout, indent=1)
