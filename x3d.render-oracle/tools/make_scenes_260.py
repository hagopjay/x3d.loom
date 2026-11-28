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

# NOTE: x3d-4.0.xsd types ParticleSystem's physics children as a fixed sequence Bounded, Force, Wind: a lone ForcePhysicsModel is XSD-invalid, so the three physics scenes carry all three (Suspected schema defect, held for the send hold).
# Hand-written bodies for the nodes whose shortest chain from the Blender probe is not schema-legal (batch 2). Each is validated by the same XSD check below.
BOX = '<Shape><Appearance><Material diffuseColor="0.8 0.3 0.2"/></Appearance><Box/></Shape>'
CSHAPE = '<Shape containerField="shape"><Box/></Shape>'
PS = '<ParticleSystem particleSize="0.1 0.1" maxParticles="10"><PointEmitter containerField="emitter"/>%s</ParticleSystem>'
# Scenes the spec allows but x3d-4.0.xsd (lxml 6.1.3) rejects. Written as the spec reads, listed as xsd_blocked, never graded on validity (Suspected schema defects, held for the send hold).
XSD_BLOCKED = {
 'BoundedPhysicsModel': 'x3d-4.0.xsd: ParticleSystem physics children are a fixed sequence (Bounded, Force, Wind, ProtoInstance), so a single physics node is rejected',
 'ForcePhysicsModel': 'same ParticleSystem physics sequence defect', 'WindPhysicsModel': 'same ParticleSystem physics sequence defect',
 'LayoutGroup': 'x3d-4.0.xsd: neither Scene nor LayoutLayer (the two parents tried) accepts a LayoutGroup',
 'Contact': 'x3d-4.0.xsd: Contact is referenced by no parent (it is only reachable as the outputOnly contacts field)',
}
CAD = '<CADLayer><CADAssembly><CADPart name="p"><CADFace name="f"><Shape containerField="shape"><Box/></Shape></CADFace></CADPart></CADAssembly></CADLayer>'
HAND = {
 'BoundedPhysicsModel': PS % '<BoundedPhysicsModel containerField="physics"><Box containerField="geometry"/></BoundedPhysicsModel>',
 'ForcePhysicsModel': PS % '<ForcePhysicsModel containerField="physics" force="0 -1 0"/>',
 'WindPhysicsModel': PS % '<WindPhysicsModel containerField="physics" direction="1 0 0" speed="2"/>',
 'CADPart': CAD, 'CADFace': CAD,
 'CollidableOffset': '<RigidBodyCollection><CollisionCollection containerField="collider"><CollidableOffset containerField="collidables" translation="1 0 0"><CollidableShape containerField="collidable">' + CSHAPE + '</CollidableShape></CollidableOffset></CollisionCollection></RigidBodyCollection>',
 'CollisionCollection': '<RigidBodyCollection><CollisionCollection containerField="collider"><CollidableShape containerField="collidables">' + CSHAPE + '</CollidableShape></CollisionCollection></RigidBodyCollection>',
 'CollisionSpace': '<RigidBodyCollection><CollisionCollection containerField="collider"><CollisionSpace containerField="collidables"/></CollisionCollection></RigidBodyCollection>',
 'RigidBody': '<RigidBodyCollection><RigidBody containerField="bodies" position="0 1 0"><CollidableShape containerField="geometry">' + CSHAPE + '</CollidableShape></RigidBody></RigidBodyCollection>',
 'Contact': '<RigidBodyCollection><CollisionCollection containerField="collider"><CollidableShape containerField="collidables">' + CSHAPE + '</CollidableShape></CollisionCollection><Contact containerField="contacts"/></RigidBodyCollection>',
 'DISEntityTypeMapping': '<DISEntityManager><DISEntityTypeMapping containerField="mapping" url=\'"x.x3d"\'/></DISEntityManager>',
 'GeoLOD': '<GeoLOD center="0 0 0" range="10"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/>' + BOX.replace('<Shape>', '<Shape containerField="rootNode">') + '</GeoLOD>',
 'HAnimJoint': '<HAnimHumanoid name="h"><HAnimJoint containerField="skeleton" name="humanoid_root" DEF="R"/><HAnimJoint containerField="joints" USE="R"/></HAnimHumanoid>',
 'LayerSet': '<LayerSet order="0 1" activeLayer="1"><Layer containerField="layers">' + BOX + '</Layer></LayerSet>',
 'Layout': '<LayerSet order="0 1"><LayoutLayer containerField="layers"><Layout containerField="layout" align=\'"LEFT" "BOTTOM"\'/>' + BOX + '</LayoutLayer></LayerSet>',
 'Viewport': '<LayerSet order="0 1"><LayoutLayer containerField="layers"><Viewport containerField="viewport" clipBoundary="0 1 0 1"/>' + BOX + '</LayoutLayer></LayerSet>',
 'LayoutGroup': '<LayerSet order="0 1"><LayoutLayer containerField="layers"><LayoutGroup><Layout containerField="layout"/><Viewport containerField="viewport"/>' + BOX + '</LayoutGroup></LayoutLayer></LayerSet>',
 'PeriodicWave': '<OscillatorSource><PeriodicWave containerField="periodicWave" type="CUSTOM" optionsReal="0 1" optionsImag="0 0"/></OscillatorSource>',
 'ProtoInstance': '<ProtoDeclare name="P"><ProtoBody>' + BOX + '</ProtoBody></ProtoDeclare><ProtoInstance name="P"/>',
 'TextureProperties': '<Shape><Appearance><Material/><ImageTexture url=\'"x.png"\'><TextureProperties containerField="textureProperties" magnificationFilter="NEAREST_PIXEL"/></ImageTexture></Appearance><Box/></Shape>',
 'ViewpointGroup': '<ViewpointGroup description="g"><Viewpoint position="0 0 6"/></ViewpointGroup>' + BOX,
}
index = {}
for name in sorted(uom['nodes']):
    info = uom['nodes'][name]
    if name in HAND: body = HAND[name]
    elif name in P.OVERRIDES: body = P.OVERRIDES[name][1]
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
                   'xsd_blocked': (not ok) and name in XSD_BLOCKED, 'reason': '' if ok else XSD_BLOCKED.get(name) or str(xsd.error_log.last_error)[:200]}
json.dump(index, open(out / 'index.json', 'w'), indent=1)
v = sum(1 for r in index.values() if r['valid']); print(len(index), 'nodes;', v, 'valid against', pathlib.Path(a.xsd).name)
