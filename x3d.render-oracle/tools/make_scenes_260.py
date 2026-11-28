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

# ---- batch 3: scenes in which the node ACTS on geometry a camera can see (batch 1 left about half of the visible scenes blank in X_ITE, so AGREE there meant nothing) ----
def _m(c, **k): return '<Material diffuseColor="%s" %s/>' % (c, ' '.join('%s="%s"' % kv for kv in k.items()))
def _t(tr, geo, mat='0.85 0.3 0.2', extra=''): return '<Transform translation="%s"><Shape><Appearance>%s%s</Appearance>%s</Shape></Transform>' % (tr, _m(mat), extra, geo)
STAGE = _t('-1.3 0 0', '<Box size="1.6 1.6 1.6"/>') + _t('1.3 0 0', '<Sphere radius="1"/>', '0.2 0.7 0.3')
NOHL = '<NavigationInfo headlight="false" type=\'"NONE"\'/>'
VOXELS = '<PixelTexture3D containerField="voxels" image="1 2 2 2 0 255 255 0 255 0 0 255"/>'
def _vol(style, tag='VolumeData', extra=''): return '<%s dimensions="2 2 2" %s>%s%s</%s>' % (tag, extra, VOXELS, style, tag)
VISIBLE = {
 'DirectionalLight': NOHL + '<DirectionalLight direction="-0.5 -0.6 -0.6"/>' + STAGE,
 'PointLight': NOHL + '<PointLight location="0 2 3" radius="30"/>' + STAGE,
 'SpotLight': NOHL + '<SpotLight location="0 3 4" direction="0 -0.6 -1" beamWidth="0.5" cutOffAngle="0.9" radius="30"/>' + STAGE,
 'Fog': '<Fog color="0.7 0.75 0.85" visibilityRange="10"/>' + _t('-1 0 -2', '<Box/>') + _t('1 0 -8', '<Box/>'),
 'LocalFog': '<Group><LocalFog color="0.7 0.75 0.85" visibilityRange="6"/>' + _t('-1 0 -2', '<Box/>') + _t('1 0 -8', '<Box/>') + '</Group>',
 'Background': '<Background skyColor="0.1 0.3 0.8 0.9 0.9 1" skyAngle="1.5708" groundColor="0.3 0.2 0.1 0.1 0.3 0.1" groundAngle="1.5708"/>' + _t('0 0 0', '<Box/>'),
 'TextureBackground': '<TextureBackground transparency="0"><PixelTexture containerField="frontTexture" image="2 2 3 0xff0000 0x00ff00 0x0000ff 0xffff00"/></TextureBackground>' + _t('0 0 -3', '<Sphere/>', '0.5 0.5 0.5'),
 'ElevationGrid': '<Shape><Appearance>' + _m('0.3 0.7 0.4') + '</Appearance><ElevationGrid xDimension="3" zDimension="3" xSpacing="1" zSpacing="1" height="0 1 0 1 2 1 0 1 0"/></Shape>',
 'ClipPlane': '<Group><ClipPlane plane="1 0 0 0"/>' + _t('0 0 0', '<Sphere radius="1.5"/>') + '</Group>',
 'Switch': '<Switch whichChoice="1">' + _t('-1.3 0 0', '<Box/>') + _t('1.3 0 0', '<Sphere/>', '0.2 0.7 0.3') + '</Switch>',
 'LineProperties': '<Shape><Appearance><Material emissiveColor="1 1 0"/><LineProperties linewidthScaleFactor="4"/></Appearance><IndexedLineSet coordIndex="0 1 2 0 -1"><Coordinate point="-1 -1 0 1 -1 0 0 1 0"/></IndexedLineSet></Shape>',
 'FontStyle': '<Shape><Appearance>' + _m('1 1 1') + '</Appearance><Text string=\'"Ag"\'><FontStyle size="2" justify=\'"MIDDLE" "MIDDLE"\' style="BOLD"/></Text></Shape>',
 'Viewpoint': '<Viewpoint position="3 2 6" orientation="0.3 1 0.1 0.4" description="side"/>' + STAGE,
 'OrthoViewpoint': '<OrthoViewpoint position="0 0 6" fieldOfView="-3 -3 3 3"/>' + STAGE,
 'ViewpointGroup': '<ViewpointGroup description="g"><Viewpoint position="2 1 6" orientation="0 1 0 0.2"/></ViewpointGroup>' + STAGE,
 'NavigationInfo': NOHL + STAGE,
 'LayerSet': '<LayerSet order="1 2" activeLayer="1"><Layer containerField="layers">' + _t('-1 0 0', '<Box/>') + '</Layer><Layer containerField="layers">' + _t('1 0 0', '<Sphere/>', '0.2 0.7 0.3') + '</Layer></LayerSet>',
 'Layer': '<LayerSet order="1"><Layer containerField="layers">' + STAGE + '</Layer></LayerSet>',
 'Viewport': '<LayerSet order="1"><LayoutLayer containerField="layers"><Viewport containerField="viewport" clipBoundary="0 0.5 0 0.5"/>' + STAGE + '</LayoutLayer></LayerSet>',
 'Layout': '<LayerSet order="1"><LayoutLayer containerField="layers"><Layout containerField="layout" align=\'"LEFT" "BOTTOM"\' size="0.5 0.5" sizeUnits=\'"FRACTION" "FRACTION"\'/>' + STAGE + '</LayoutLayer></LayerSet>',
 'LayoutLayer': '<LayerSet order="1"><LayoutLayer containerField="layers">' + STAGE + '</LayoutLayer></LayerSet>',
 'HAnimHumanoid': '<HAnimHumanoid name="h" version="2.0"><HAnimJoint containerField="skeleton" name="humanoid_root" DEF="R"><HAnimSegment name="sacrum"><Shape><Appearance><Material/></Appearance><Box size="1 2 1"/></Shape></HAnimSegment></HAnimJoint></HAnimHumanoid>',
 'TextureCoordinateGenerator': '<Shape><Appearance><Material/><PixelTexture image="2 2 3 0xff0000 0x00ff00 0x0000ff 0xffff00"/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1 4 5 6 7 -1"><Coordinate point="-1 -1 0 1 -1 0 1 1 0 -1 1 0 -1 -1 -1 1 -1 -1 1 1 -1 -1 1 -1"/><TextureCoordinateGenerator containerField="texCoord" mode="SPHERE"/></IndexedFaceSet></Shape>',
 'GeneratedCubeMapTexture': _t('0 0 0', '<Sphere radius="1"/>', '1 1 1', '<GeneratedCubeMapTexture containerField="texture" update="ALWAYS" size="64"/>') .replace('</Appearance>', '</Appearance>', 1),
 'OpacityMapVolumeStyle': _vol('<OpacityMapVolumeStyle containerField="renderStyle"/>'),
 'ShadedVolumeStyle': _vol('<ShadedVolumeStyle containerField="renderStyle" lighting="true"/>'),
 'CartoonVolumeStyle': _vol('<CartoonVolumeStyle containerField="renderStyle" colorSteps="3"/>'),
 'BoundaryEnhancementVolumeStyle': _vol('<BoundaryEnhancementVolumeStyle containerField="renderStyle" boundaryOpacity="0.9"/>'),
 'EdgeEnhancementVolumeStyle': _vol('<EdgeEnhancementVolumeStyle containerField="renderStyle"/>'),
 'SilhouetteEnhancementVolumeStyle': _vol('<SilhouetteEnhancementVolumeStyle containerField="renderStyle"/>'),
 'ToneMappedVolumeStyle': _vol('<ToneMappedVolumeStyle containerField="renderStyle"/>'),
 'ProjectionVolumeStyle': _vol('<ProjectionVolumeStyle containerField="renderStyle" type="MAX"/>'),
 'ComposedVolumeStyle': _vol('<ComposedVolumeStyle containerField="renderStyle"><OpacityMapVolumeStyle containerField="renderStyle"/><ToneMappedVolumeStyle containerField="renderStyle"/></ComposedVolumeStyle>'),
 'BlendedVolumeStyle': _vol('<BlendedVolumeStyle containerField="renderStyle" weightConstant1="0.5" weightConstant2="0.5"><PixelTexture3D containerField="voxels" image="1 2 2 2 255 0 0 255 0 255 255 0"/></BlendedVolumeStyle>'),
 'IsoSurfaceVolumeData': '<IsoSurfaceVolumeData dimensions="2 2 2" surfaceValues="0.5">' + VOXELS + '<OpacityMapVolumeStyle containerField="renderStyle"/></IsoSurfaceVolumeData>',
}
# Nodes with no pixels by nature: audio graph, scripting-side Geo sensors, motions. Graded by parse/handled, never AGREE/NEAR/FAR.
AUDIBLE = {'Analyser', 'AudioClip', 'AudioDestination', 'BiquadFilter', 'BufferAudioSource', 'ChannelMerger', 'ChannelSelector', 'ChannelSplitter', 'Convolver', 'Delay', 'DynamicsCompressor', 'Gain',
           'ListenerPointSource', 'MicrophoneSource', 'OscillatorSource', 'PeriodicWave', 'Sound', 'SpatialSound', 'StreamAudioDestination', 'StreamAudioSource', 'WaveShaper',
           'GeoMetadata', 'GeoPositionInterpolator', 'GeoProximitySensor', 'GeoTouchSensor', 'HAnimMotion'}

VISIBLE.update({
 'Color': '<Shape><Appearance><Material/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1"><Coordinate point="-1 -1 0 1 -1 0 1 1 0 -1 1 0"/><Color color="1 0 0 0 1 0 0 0 1 1 1 0"/></IndexedFaceSet></Shape>',
 'HAnimJoint': VISIBLE['HAnimHumanoid'],
 'NavigationInfo': NOHL + '<Transform translation="-1.3 0 0"><Shape><Appearance><Material emissiveColor="0.2 0.8 0.3"/></Appearance><Box/></Shape></Transform>' + _t('1.3 0 0', '<Box/>'),
 'ColorRGBA': '<Shape><Appearance><Material/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1"><Coordinate point="-1 -1 0 1 -1 0 1 1 0 -1 1 0"/><ColorRGBA color="1 0 0 1 0 1 0 1 0 0 1 1 1 1 0 1"/></IndexedFaceSet></Shape>',
 'MultiTexture': '<Shape><Appearance><Material/><MultiTexture mode=\'"MODULATE"\'><PixelTexture image="2 2 3 0xff0000 0x00ff00 0x0000ff 0xffff00"/><PixelTexture image="2 2 3 0xffffff 0x808080 0x808080 0xffffff"/></MultiTexture></Appearance><Box/></Shape>',
 'GeneratedCubeMapTexture': _t('1.6 0 0', '<Box/>') + '<Shape><Appearance><Material/><GeneratedCubeMapTexture update="ALWAYS" size="64"/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1"><Coordinate point="-2 -1 0 0 -1 0 0 1 0 -2 1 0"/><TextureCoordinateGenerator containerField="texCoord" mode="CAMERASPACEREFLECTIONVECTOR"/></IndexedFaceSet></Shape>',
 'TextureCoordinate3D': '<Shape><Appearance><Material/><PixelTexture3D image="1 2 2 2 0 255 255 0 255 0 0 255"/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1"><Coordinate point="-1 -1 0 1 -1 0 1 1 0 -1 1 0"/><TextureCoordinate3D point="0 0 0 1 0 0 1 1 1 0 1 1"/></IndexedFaceSet></Shape>',
 'GeoOrigin': '<GeoLocation geoCoords="0 0 0"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/>' + _t('0 0 0', '<Box/>') + '</GeoLocation>',
 'GeoLocation': '<GeoLocation geoCoords="0 0 0"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/>' + _t('0 0 0', '<Box/>') + '</GeoLocation>',
 'GeoLOD': '<GeoLOD center="0 0 0" range="10"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/><Shape containerField="rootNode"><Appearance><Material/></Appearance><Box/></Shape></GeoLOD>',
 'GeoCoordinate': '<Viewpoint position="6 0 0" orientation="0 1 0 1.5708"/><Shape><Appearance><Material/></Appearance><IndexedFaceSet coordIndex="0 1 2 3 -1" solid="false"><GeoCoordinate containerField="coord" geoSystem=\'"GD"\' point="0 0 0 0 0.00002 0 0.00002 0.00002 0 0.00002 0 0"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/></GeoCoordinate></IndexedFaceSet></Shape>',
 'GeoElevationGrid': '<Shape><Appearance><Material/></Appearance><GeoElevationGrid xDimension="3" zDimension="3" xSpacing="0.00001" zSpacing="0.00001" height="0 1 0 1 2 1 0 1 0" solid="false"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/></GeoElevationGrid></Shape>',
 'GeoViewpoint': '<GeoViewpoint position="0 0 30" description="g"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/></GeoViewpoint><GeoLocation geoCoords="0 0 0"><GeoOrigin containerField="geoOrigin" geoCoords="0 0 0"/>' + _t('0 0 0', '<Box/>') + '</GeoLocation>',
})
# Visible by nature but needing time (particles), a shader, or layout design that batch 3 did not do: listed as 'deferred', not graded AGREE/NEAR/FAR yet.
DEFERRED = {'ParticleSystem', 'ConeEmitter', 'ExplosionEmitter', 'PointEmitter', 'PolylineEmitter', 'SurfaceEmitter', 'VolumeEmitter', 'BoundedPhysicsModel', 'ForcePhysicsModel', 'WindPhysicsModel',
            'GeoLOD', 'GeoViewpoint', 'HAnimDisplacer', 'ShaderPart', 'ScreenFontStyle', 'LayoutGroup'}
index = {}
for name in sorted(uom['nodes']):
    info = uom['nodes'][name]
    if name in VISIBLE: body = VISIBLE[name]
    elif name in HAND: body = HAND[name]
    elif name in P.OVERRIDES: body = P.OVERRIDES[name][1]
    elif reach.get(name): body = P.snippet(name, reach, True, tuple(info['bases']))
    else: body = None
    if body is None:
        index[name] = {'file': None, 'component': info['component'], 'level': info['level'], 'valid': False, 'reason': 'no legal parent chain found in the object model'}
        continue
    vis = info['component'] in VISIBLE_COMPONENTS and name not in INVISIBLE_NAMES and name not in AUDIBLE and not name.startswith('Metadata')
    head = '<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Full" version="4.0" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance"><head><meta name="title" content="%s"/><meta name="description" content="one node under test: %s (%s, level %s)"/></head><Scene>\n' % (name, name, info['component'], info['level'])
    view = '' if name in ('Viewpoint', 'OrthoViewpoint', 'GeoViewpoint', 'ViewpointGroup', 'GeoCoordinate') else '<Viewpoint position="0 0 6"/>\n'
    text = head + view + body + '\n</Scene></X3D>\n'
    (out / f'{name}.x3d').write_text(text)
    doc = etree.fromstring(text.encode()); ok = xsd.validate(doc)
    index[name] = {'file': f'{name}.x3d', 'component': info['component'], 'level': info['level'], 'kind': 'deferred' if name in DEFERRED else 'visible' if vis else 'invisible', 'valid': bool(ok),
                   'xsd_blocked': (not ok) and name in XSD_BLOCKED, 'reason': '' if ok else XSD_BLOCKED.get(name) or str(xsd.error_log.last_error)[:200]}
json.dump(index, open(out / 'index.json', 'w'), indent=1)
v = sum(1 for r in index.values() if r['valid']); print(len(index), 'nodes;', v, 'valid against', pathlib.Path(a.xsd).name)
