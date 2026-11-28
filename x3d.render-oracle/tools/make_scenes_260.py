#!/usr/bin/env python3
"""Writes scenes-260/<Node>.x3d: one minimal X3D 4.0 scene per concrete node of the object model, the node under test inside its shortest legal parent chain.
The chains and the per-node attribute tables are NOT copied: they are the ones the Blender node board measured with (x3d-blender-io tools/node_board_probe.py,
add-on 2.9.0), loaded from that file, so every renderer and Blender share one row key and one set of minimal files.
usage: make_scenes_260.py --probe PATH/node_board_probe.py --uom PATH/node_board_nodes.json --xsd PATH/x3d-4.0.xsd OUTDIR
Writes OUTDIR/index.json: per node {file, component, level, kind(visible|invisible), valid, reach}. Invisible nodes (nothing a camera can see: Metadata, scripting, networking,
event utilities, sensors) are graded by a parse/handled check, never AGREE/NEAR/FAR."""
import argparse, importlib.util, json, pathlib
ap = argparse.ArgumentParser(); ap.add_argument('--probe', required=True); ap.add_argument('--uom', required=True); ap.add_argument('--xsd', required=True); ap.add_argument('out')
a = ap.parse_args()
spec = importlib.util.spec_from_file_location('probe', a.probe); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
uom = json.load(open(a.uom)); reach = P.chains(uom)
from lxml import etree
xsd = etree.XMLSchema(etree.parse(a.xsd))
out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
# visible = a camera can see something that depends on the node
VISIBLE_COMPONENTS = {'Geometry3D', 'Geometry2D', 'Rendering', 'CADGeometry', 'Texturing', 'Texturing3D', 'Shape', 'Lighting', 'EnvironmentalEffects', 'Text', 'Grouping', 'Layout', 'Layering',
                      'Geospatial', 'Nurbs', 'HAnim', 'VolumeRendering', 'ParticleSystems', 'Shaders', 'CubeMapTexturing', 'Navigation', 'GaussianSplats', 'Annotation', 'Sound', 'Scripting'}
INVISIBLE_NAMES = {'Script', 'ProtoInstance', 'ProtoDeclare', 'ExternProtoDeclare', 'WorldInfo', 'Inline', 'LoadSensor', 'Anchor'}
index = {}
for name in sorted(uom['nodes']):
    info = uom['nodes'][name]
    if name in P.OVERRIDES: body = P.OVERRIDES[name][1]
    elif reach.get(name): body = P.snippet(name, reach, True, tuple(info['bases']))
    else: body = None
    if body is None:
        index[name] = {'file': None, 'component': info['component'], 'level': info['level'], 'valid': False, 'reason': 'no legal parent chain found in the object model'}
        continue
    vis = info['component'] in VISIBLE_COMPONENTS and name not in INVISIBLE_NAMES and not name.startswith('Metadata')
    head = '<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Full" version="4.0" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance"><head><meta name="title" content="%s"/><meta name="description" content="one node under test: %s (%s, level %s)"/></head><Scene>\n' % (name, name, info['component'], info['level'])
    view = '' if name in ('Viewpoint', 'OrthoViewpoint', 'GeoViewpoint') else '<Viewpoint position="0 0 6"/>\n'
    text = head + view + body + '\n</Scene></X3D>\n'
    (out / f'{name}.x3d').write_text(text)
    doc = etree.fromstring(text.encode()); ok = xsd.validate(doc)
    index[name] = {'file': f'{name}.x3d', 'component': info['component'], 'level': info['level'], 'kind': 'visible' if vis else 'invisible', 'valid': bool(ok),
                   'reason': '' if ok else str(xsd.error_log.last_error)[:200]}
json.dump(index, open(out / 'index.json', 'w'), indent=1)
v = sum(1 for r in index.values() if r['valid']); print(len(index), 'nodes;', v, 'valid against', pathlib.Path(a.xsd).name)
