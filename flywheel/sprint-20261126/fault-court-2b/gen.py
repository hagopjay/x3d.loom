import json
H='<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">\n<head><meta name="title" content="%s"/></head>\n<Scene>\n%s\n</Scene>\n</X3D>\n'
VP='<Viewpoint position="0 0 6" description="front"/>\n'
NI='<NavigationInfo headlight="true"/>\n'
APP='<Appearance><Material diffuseColor="0.8 0.2 0.2"/></Appearance>'
BOX='<Shape>%s<Box/></Shape>'%APP
F={}  # name -> (body, fault, view, spec)
def f(k,body,fault,view,spec): F[k]=(body,fault,view,spec)
f('fault-01',VP+'<Shape><Material diffuseColor="1 0 0"/><Box/></Shape>','Material placed directly under Shape instead of inside Appearance','Box in default white/unlit-looking material; red ignored','error (invalid child, XSD)')
f('fault-02',VP+'<Shape>'+APP+'<Box/><Sphere radius="0.5"/></Shape>','Two geometry nodes in one Shape','Only one geometry rendered or parse error','error (Shape allows one geometry)')
f('fault-03',VP+'<Appearance><Material diffuseColor="0 1 0"/></Appearance><Shape><Sphere/></Shape>','Appearance outside a Shape, as direct Scene child','Sphere has default appearance; green ignored','error (Appearance is not a child node of Scene)')
f('fault-04',VP+'<Shape><Appearance containerField="geometry"><Material/></Appearance><Box/></Shape>','Appearance given wrong containerField (geometry)','Appearance not attached; box default','error/unwise (wrong containerField)')
f('fault-05',VP+'<Shape>'+APP+'<Sphere DEF="S1"/></Shape><Transform translation="2 0 0"><Shape><Appearance USE="S1"/><Box/></Shape></Transform>','USE of a Sphere DEF inside an Appearance slot (wrong type)','Box with no appearance / loader error','error (USE type mismatch)')
f('fault-06',VP+'<Shape>'+APP+'<Box/></Shape><Shape><Appearance><Material/></Appearance><Viewpoint USE="vp1"/></Shape><Viewpoint DEF="vp1" position="0 0 9"/>','USE of a Viewpoint inside a Shape, and USE before DEF','Ignored or load error','error (type mismatch/USE before DEF)')
f('fault-07',VP+'<Shape DEF="A">'+APP+'<Box/></Shape><Transform translation="3 0 0"><Shape DEF="A">'+APP+'<Sphere/></Shape></Transform>','Duplicate DEF name A on two different shapes','Both render, but later USE of A is ambiguous','error (DEF names must be unique in scope)')
f('fault-08',VP+'<Shape>'+APP+'<IndexedFaceSet coordIndex="0 1 2 0 2 3"><Coordinate point="0 0 0 1 0 0 1 1 0 0 1 0"/></IndexedFaceSet></Shape>','coordIndex lacks -1 face terminators','Nothing or one malformed face','error (indexes not terminated by -1)')
f('fault-09',VP+'<Shape>'+APP+'<IndexedFaceSet coordIndex="0 1 2 -1 0 2 4 -1"><Coordinate point="0 0 0 1 0 0 1 1 0 0 1 0"/></IndexedFaceSet></Shape>','coordIndex 4 is one past end of 4 points','Missing/garbled second triangle','error (index out of range)')
f('fault-10',VP+'<Shape><Appearance><ImageTexture url=\'"t.png"\'/></Appearance><IndexedFaceSet coordIndex="0 1 2 -1 0 2 3 -1" texCoordIndex="0 1 2 -1"><Coordinate point="0 0 0 1 0 0 1 1 0 0 1 0"/><TextureCoordinate point="0 0 1 0 1 1"/></IndexedFaceSet></Shape>','texCoordIndex shorter than coordIndex','Second triangle untextured/garbled','error/unwise')
f('fault-11',VP+'<Shape>'+APP+'<IndexedFaceSet coordIndex="0 1 2 -1 0 2 3 -1"><Coordinate point="0 0 0 1 0 0 1 1 0 0 1 0"/><Color color="1 0 0 0 1 0"/></IndexedFaceSet></Shape>','colorPerVertex default true but only 2 colours (per-face intent) for 4 vertices','Colours missing/ ignored','error (too few colours)')
f('fault-12',VP+'<Shape>'+APP+'<IndexedFaceSet ccw="false" coordIndex="0 1 2 -1"><Coordinate point="0 0 0 1 0 0 0 1 0"/><Normal vector="0 0 1 0 0 1 0 0 1"/></IndexedFaceSet></Shape>','ccw false while winding and normals (0 0 1) are counter-clockwise','Lighting inverted; face dark','unwise (valid but inconsistent)')
f('fault-13',VP+'<Shape>'+APP+'<IndexedFaceSet creaseAngle="30" coordIndex="0 1 2 -1"><Coordinate point="0 0 0 1 0 0 0 1 0"/></IndexedFaceSet></Shape>','creaseAngle 30 given in degrees (radians expected)','Smoothed fully (30 rad > pi)','unwise (valid)')
f('fault-14',VP+'<Shape>'+APP+'<ElevationGrid xDimension="3" zDimension="3" xSpacing="1" zSpacing="1" height="0 1 0 1 0 1 0 1"/></Shape>','ElevationGrid 3x3 needs 9 heights, 8 given','Not rendered or truncated','error (spec: height count must equal xDim*zDim)')
f('fault-15',VP+'<Shape>'+APP+'<Extrusion crossSection="1 1 1 -1 -1 -1 -1 1 1 1" spine="0 0 0"/></Shape>','Extrusion with a single spine point','Nothing rendered','error (needs >=2 spine points)')
f('fault-16',VP+'<Shape><Appearance><Material diffuseColor="1 0 0" transparency="1"/></Appearance><Box/></Shape>','transparency 1 on the only object','Scene looks empty','unwise (valid)')
f('fault-17','<Viewpoint position="0 0 6"/><NavigationInfo headlight="false"/><Shape><Appearance><Material diffuseColor="0 0 0" emissiveColor="0 0 0"/></Appearance><Box/></Shape>','Headlight off, no lights, diffuse-only black/lit material -> black object on black','Black/invisible box','unwise')
f('fault-18',VP+'<Shape><Appearance><Material shininess="50" diffuseColor="1 0 0"/></Appearance><Box/></Shape>','shininess 50 (range 0..1)','Implementation-defined highlights','error (out of range)')
f('fault-19',VP+'<Shape><Appearance><ImageTexture url=\'""\'/></Appearance><Box/></Shape>','ImageTexture with empty url string','Box untextured white','unwise (valid, no texture)')
f('fault-20',VP+'<Shape><Appearance><PhysicalMaterial baseColorFactor="1 0 0" roughnessFactor="2"/></Appearance><Box/></Shape>','PhysicalMaterial roughness 2 (range 0..1)','Clamped/undefined','error (out of range)')
f('fault-21',VP+'<Shape><Appearance><Material diffuseColor="255 0 0"/></Appearance><Box/></Shape>','Colour given as 255 0 0','White/saturated box','error (range 0..1)')
f('fault-22','<Viewpoint position="0 0 0" description="inside"/>'+BOX,'Viewpoint at origin inside the box','See box interior/back-face culled, nothing','unwise')
f('fault-23','<Viewpoint position="0 0 6" orientation="0 1 0 3.14159"/>'+BOX,'Viewpoint rotated 180 deg, looking away from scene','Empty view','unwise')
f('fault-24','<Viewpoint position="0 0 6" fieldOfView="45"/>'+BOX,'fieldOfView 45 in degrees (radians, max <pi)','Ultra wide-angle distortion','error (range 0..pi)')
f('fault-25','<Viewpoint position="0 0 6"/><NavigationInfo headlight="false"/><SpotLight DEF="sp" beamWidth="1.2" cutOffAngle="0.2" location="0 0 4" direction="0 0 -1"/>'+BOX,'SpotLight cutOffAngle < beamWidth','Hard cutoff, no falloff','unwise (spec says beamWidth clamped)')

f('n1',VP+'<Transform rotation="0 1 0 90">'+BOX+'</Transform>','rotation angle 90 written in degrees (radians expected)','Box rotated by 90 rad (~ -0.9 rad ... odd angle)','unwise (valid)')
f('n2',VP+'<Transform scale="1 0 1">'+BOX+'</Transform>','scale 0 on one axis, degenerate flat box','Box vanishes or flat line','error/unwise (spec: scale components should be nonzero positive-ish; 0 is degenerate)')
f('n3',VP+'<Transform translation="10000000 0 0">'+BOX+'</Transform>','Object 10000 km from origin','Not visible; precision loss','unwise')
f('n4',VP+'<LOD range="50 20 5" center="0 0 0">'+BOX+'<Shape>'+APP+'<Sphere/></Shape></LOD>','LOD range not ascending','Wrong level selected','error (range must be increasing)')
f('n5',VP+'<Background skyColor="0 0 1 0 0.5 1" skyAngle="0.8 1.2 1.5"/>'+BOX,'Background skyAngle has 3 values but 2 skyColors (needs n+1=4 colours for 3 angles)','Sky gradient wrong/ignored','error (count mismatch)')
f('n6','<Viewpoint position="0 0 6"/><NavigationInfo headlight="false"/><DirectionalLight direction="0 0 0"/><Shape><Appearance><Material diffuseColor="1 0 0"/></Appearance><Box/></Shape>','DirectionalLight direction 0 0 0','Unlit black box','error/unwise (zero vector)')
order=['01','03','05','07','08','09','13','14','15','16','20','21','24','25','n1','n2','n3','n4','n5','n6']
cat={'01':'structure','03':'structure','05':'DEF/USE','07':'DEF/USE','08':'geometry','09':'geometry','13':'geometry','14':'geometry','15':'geometry','16':'appearance','20':'appearance','21':'appearance','24':'viewing','25':'lights','n1':'units','n2':'units','n3':'units','n4':'misc','n5':'misc','n6':'lights'}
man={}
for i,k in enumerate(order,1):
    key=k if k.startswith('n') else 'fault-'+k
    b,fa,vw,sp=F[key]
    nm='fault-%02d'%i
    open(nm+'.x3d','w').write(H%(nm,b))
    man[nm+'.x3d']=dict(category=cat[k],fault=fa,viewer_sees=vw,spec=sp)
D=[
('whichChoice -1 on Switch (shows nothing, intentional)',VP+'<Switch whichChoice="-1">'+BOX+'</Switch>'+BOX),
('Mirrored scale -1 1 1',VP+'<Transform scale="-1 1 1" translation="1 0 0">'+BOX+'</Transform>'),
('Shape with geometry but no Appearance',VP+'<Shape><Sphere/></Shape>'),
('Zero rotation written 0 0 1 0',VP+'<Transform rotation="0 0 1 0">'+BOX+'</Transform>'),
('solid false on open surface',VP+'<Shape>'+APP+'<IndexedFaceSet solid="false" coordIndex="0 1 2 -1"><Coordinate point="0 0 0 1 0 0 0 1 0"/></IndexedFaceSet></Shape>')]
for i,(d,b) in enumerate(D,1):
    nm='decoy-%02d'%i
    open(nm+'.x3d','w').write(H%(nm,b))
    man[nm+'.x3d']=dict(category='decoy',fault='none: '+d,viewer_sees='as intended',spec='legal')
json.dump(man,open('MANIFEST.json','w'),indent=1)
