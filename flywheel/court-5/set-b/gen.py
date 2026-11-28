#!/usr/bin/env python3
"""Writes the fault/twin/decoy/helper files of set b. Sealed with the set."""
import os, struct, zlib
HERE = os.path.dirname(os.path.abspath(__file__))

def doc(profile, comps, prose, intents, body, title, version='4.0'):
    head = ''.join("    <component name='%s' level='%s'/>\n" % c for c in comps)
    head += "    <meta name='title' content='%s'/>\n" % title
    head += '    <meta name="intent:prose" content="%s"/>\n' % prose
    for i in intents:
        head += '    <meta name="intent" content="%s"/>\n' % i.replace('<', '&lt;').replace('>', '&gt;')
    return ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            "<X3D profile='%s' version='%s' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' "
            "xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>\n"
            "  <head>\n%s  </head>\n  <Scene>\n%s  </Scene>\n</X3D>\n") % (profile, version, head, body.strip('\n') + '\n')

def mat(c, extra=''):
    return "<Appearance><Material diffuseColor='%s'%s/></Appearance>" % (c, extra)

P = {}   # n -> dict(profile, comps_fault, comps_twin, prose, intents, body, fault subs, twin subs)

def pair(n, prose, body, fault, twin, intents=(), profile='Immersive', comps=(), comps_fault=None):
    P[n] = dict(prose=prose, body=body, fault=fault, twin=twin, intents=list(intents), profile=profile,
                comps=list(comps), comps_fault=list(comps if comps_fault is None else comps_fault))

# 01 ------------------------------------------------------------------
pair(1, "A bench imported from a model drawn in centimetres is scaled into metres, and a red beacon ball of 15 cm radius floats two metres above the floor, over the bench.",
"""
    <Viewpoint DEF='View' description='Bench' position='0 1 6'/>
    <!-- the bench was drawn in centimetres -->
    <Transform DEF='ImportedBench' scale='0.01 0.01 0.01'>
      <Transform translation='0 25 0'>
        <Shape>
          %s
          <Box size='200 50 60'/>
        </Shape>
      </Transform>
@A@    </Transform>
@B@""" % mat('0.6 0.4 0.2'),
{'@A@': """      <Transform DEF='Beacon' translation='0 2 0'>
        <Shape>
          %s
          <Sphere radius='0.15'/>
        </Shape>
      </Transform>
""" % mat('1 0 0'), '@B@': ''},
{'@B@': """    <Transform DEF='Beacon' translation='0 2 0'>
      <Shape>
        %s
        <Sphere radius='0.15'/>
      </Shape>
    </Transform>
""" % mat('1 0 0'), '@A@': ''})

# 02 ------------------------------------------------------------------
pair(2, "A grey partition wall stands in the gallery; visitors see it and cannot walk through it.",
"""
    <Viewpoint description='Gallery' position='0 1.6 8'/>
    <Collision DEF='Partition'>
      <Shape@A@>
        %s
        <Box size='6 3 0.2'/>
      </Shape>
    </Collision>
    <Transform translation='0 -1.55 0'>
      <Shape>
        %s
        <Box size='12 0.1 12'/>
      </Shape>
    </Transform>
""" % (mat('0.7 0.7 0.7'), mat('0.3 0.5 0.3')),
{'@A@': " containerField='proxy'"}, {'@A@': ''})

# 03 ------------------------------------------------------------------
pair(3, "Two posts share one red paint so that repainting one repaints both.",
"""
    <Viewpoint description='Posts' position='0 0 8'/>
    <Transform translation='-1.5 0 0'>
      <Shape>
        <Appearance @A@/>
        <Cylinder height='3' radius='0.3'/>
      </Shape>
    </Transform>
    <Transform translation='1.5 0 0'>
      <Shape>
        <Appearance @B@/>
        <Cylinder height='3' radius='0.3'/>
      </Shape>
    </Transform>
""",
{'@A@': "USE='RedPaint'", '@B@': "DEF='RedPaint'><Material diffuseColor='0.9 0.1 0.1'/></Appearance"},
{'@A@': "DEF='RedPaint'><Material diffuseColor='0.9 0.1 0.1'/></Appearance", '@B@': "USE='RedPaint'"})
# keep the documents tidy: the DEF variant above closes itself through the trailing '/>' trick
for k in ('fault', 'twin'):
    for m in ('@A@', '@B@'):
        v = P[3][k][m]
        if v.endswith('</Appearance'):
            P[3][k][m] = v[:-len('</Appearance')] + '</Appearance><!-- shared paint --'
# simpler and cleaner: rewrite 03 without tricks
pair(3, "Two posts share one red paint so that repainting one repaints both.",
"""
    <Viewpoint description='Posts' position='0 0 8'/>
    <Transform translation='-1.5 0 0'>
      <Shape>
@A@
        <Cylinder height='3' radius='0.3'/>
      </Shape>
    </Transform>
    <Transform translation='1.5 0 0'>
      <Shape>
@B@
        <Cylinder height='3' radius='0.3'/>
      </Shape>
    </Transform>
""",
{'@A@': "        <Appearance USE='RedPaint'/>",
 '@B@': "        <Appearance DEF='RedPaint'>\n          <Material diffuseColor='0.9 0.1 0.1'/>\n        </Appearance>"},
{'@B@': "        <Appearance USE='RedPaint'/>",
 '@A@': "        <Appearance DEF='RedPaint'>\n          <Material diffuseColor='0.9 0.1 0.1'/>\n        </Appearance>"})

# 04 ------------------------------------------------------------------
pair(4, "A statue stands a hundred metres east of the origin; from the entry viewpoint eight metres in front of it the visitor sees the detailed version, and the plain block only from far away.",
"""
    <Viewpoint description='Entry' position='100 1 8'/>
    <LOD DEF='StatueLOD' range='25'@A@>
      <Transform translation='100 0 0'>
        <Shape>
          %s
          <Sphere radius='0.6'/>
        </Shape>
        <Transform translation='0 1.4 0'>
          <Shape>
            %s
            <Cone bottomRadius='0.5' height='1.6'/>
          </Shape>
        </Transform>
      </Transform>
      <Transform translation='100 0.5 0'>
        <Shape>
          %s
          <Box size='1.2 3 1.2'/>
        </Shape>
      </Transform>
    </LOD>
""" % (mat('0.8 0.7 0.3'), mat('0.8 0.7 0.3'), mat('0.5 0.5 0.5')),
{'@A@': ''}, {'@A@': " center='100 0 0'"},
intents=['after 1.0s: StatueLOD.level_changed == 0'])

# 05 ------------------------------------------------------------------
pair(5, "A reusable bollard prototype is painted with the site's standard yellow, and two bollards are placed either side of a path.",
"""
    <Viewpoint description='Path' position='0 0.5 6'/>
@A@    <ProtoDeclare name='Bollard'>
      <ProtoInterface>
        <field name='position' type='SFVec3f' accessType='initializeOnly' value='0 0 0'/>
      </ProtoInterface>
      <ProtoBody>
        <Transform>
          <IS>
            <connect nodeField='translation' protoField='position'/>
          </IS>
          <Shape>
@B@
            <Cylinder height='1' radius='0.15'/>
          </Shape>
        </Transform>
      </ProtoBody>
    </ProtoDeclare>
    <ProtoInstance name='Bollard'>
      <fieldValue name='position' value='-1 0 0'/>
    </ProtoInstance>
    <ProtoInstance name='Bollard'>
      <fieldValue name='position' value='1 0 0'/>
    </ProtoInstance>
""",
{'@A@': """    <Transform translation='0 -0.55 0'>
      <Shape>
        <Appearance DEF='SiteYellow'>
          <Material diffuseColor='1 0.8 0'/>
        </Appearance>
        <Box size='6 0.1 2'/>
      </Shape>
    </Transform>
""", '@B@': "            <Appearance USE='SiteYellow'/>"},
{'@A@': """    <Transform translation='0 -0.55 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='1 0.8 0'/>
        </Appearance>
        <Box size='6 0.1 2'/>
      </Shape>
    </Transform>
""", '@B@': "            <Appearance DEF='SiteYellow'>\n              <Material diffuseColor='1 0.8 0'/>\n            </Appearance>"})

# 06 ------------------------------------------------------------------
pair(6, "A lamp-post prototype draws a grey pole with a glowing globe on top, and one lamp-post stands in the scene.",
"""
    <Viewpoint description='Street' position='0 1.5 8'/>
    <ProtoDeclare name='LampPost'>
      <ProtoInterface>
        <field name='glow' type='SFColor' accessType='initializeOnly' value='1 0.9 0.6'/>
      </ProtoInterface>
      <ProtoBody>
@A@
      </ProtoBody>
    </ProtoDeclare>
    <ProtoInstance name='LampPost' DEF='Lamp1'/>
""",
{'@A@': """        <Transform translation='0 1.5 0'>
          <Shape>
            <Appearance><Material diffuseColor='0.5 0.5 0.5'/></Appearance>
            <Cylinder height='3' radius='0.08'/>
          </Shape>
        </Transform>
        <Transform translation='0 3.2 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0 0 0'>
                <IS>
                  <connect nodeField='emissiveColor' protoField='glow'/>
                </IS>
              </Material>
            </Appearance>
            <Sphere radius='0.3'/>
          </Shape>
        </Transform>"""},
{'@A@': """        <Group>
        <Transform translation='0 1.5 0'>
          <Shape>
            <Appearance><Material diffuseColor='0.5 0.5 0.5'/></Appearance>
            <Cylinder height='3' radius='0.08'/>
          </Shape>
        </Transform>
        <Transform translation='0 3.2 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0 0 0'>
                <IS>
                  <connect nodeField='emissiveColor' protoField='glow'/>
                </IS>
              </Material>
            </Appearance>
            <Sphere radius='0.3'/>
          </Shape>
        </Transform>
        </Group>"""})

# 07 ------------------------------------------------------------------
pair(7, "A flat blue arrow-head (a chevron with a notch cut into its back edge) is drawn as one polygon facing the viewer.",
"""
    <Viewpoint description='Front' position='0 0 8'/>
    <Shape>
      <Appearance><Material diffuseColor='0 0 0' emissiveColor='0.2 0.4 1'/></Appearance>
      <IndexedFaceSet solid='false'@A@ coordIndex='0 1 2 3 -1'>
        <Coordinate point='2 0 0, -2 2 0, -1.6 0 0, -2 -2 0'/>
      </IndexedFaceSet>
    </Shape>
""".replace('2 0 0, -2 2 0, -1.6 0 0, -2 -2 0', '-2 2 0, 0 0 0, -2 -2 0, 2.5 0 0'),
{'@A@': ''}, {'@A@': " convex='false'"})
# vertices: back-top, notch point, back-bottom, tip  -> order (ccw seen from +Z): tip, back-top, notch, back-bottom
P[7]['body'] = P[7]['body'].replace('-2 2 0, 1.5 0 0, -2 -2 0, 2.5 0 0', '-2 2 0, 1.5 0 0, -2 -2 0, 2.5 0 0')
P[7]['body'] = P[7]['body'].replace("coordIndex='0 1 2 3 -1'", "coordIndex='0 1 2 3 -1'")

# 08 ------------------------------------------------------------------
pair(8, "A square green floor four metres on a side lies in the ground plane under a small crate.",
"""
    <Viewpoint description='Yard' position='0 3 8' orientation='1 0 0 -0.35'/>
    <Shape>
      %s
      <IndexedFaceSet solid='false' coordIndex='0 1 2 3 -1'>
        <Coordinate point='@A@'/>
      </IndexedFaceSet>
    </Shape>
    <Transform translation='0 0.3 0'>
      <Shape>
        %s
        <Box size='0.6 0.6 0.6'/>
      </Shape>
    </Transform>
""" % (mat('0.2 0.7 0.2'), mat('0.7 0.5 0.3')),
{'@A@': '-2 2, 2 2, 2 -2, -2 -2'}, {'@A@': '-2 0 2, 2 0 2, 2 0 -2, -2 0 -2'})

# 09 ------------------------------------------------------------------
pair(9, "A white notice board faces the visitor and is lit by the headlight, with smooth shading from normals supplied by the modelling tool.",
"""
    <Viewpoint description='Board' position='0 0 6'/>
    <Shape>
      %s
      <IndexedFaceSet coordIndex='0 1 2 3 -1' normalPerVertex='true'>
        <Coordinate point='-2 -1.2 0, 2 -1.2 0, 2 1.2 0, -2 1.2 0'/>
        <Normal vector='@A@'/>
      </IndexedFaceSet>
    </Shape>
""" % mat('0.9 0.9 0.9'),
{'@A@': '0 0 -1, 0 0 -1, 0 0 -1, 0 0 -1'}, {'@A@': '0 0 1, 0 0 1, 0 0 1, 0 0 1'})

# 10 ------------------------------------------------------------------
pair(10, "A sign shows the words Exit this way in white letters, centred left-to-right on the doorway axis in front of the visitor.",
"""
    <Viewpoint description='Sign' position='0 0 8'/>
    <Shape>
      <Appearance><Material diffuseColor='0 0 0' emissiveColor='1 1 1'/></Appearance>
      <Text DEF='Sign' string='"Exit this way"'>
        <FontStyle justify='@A@' size='1'/>
      </Text>
    </Shape>
""",
{'@A@': '"CENTER"'}, {'@A@': '"MIDDLE"'},
intents=['after 1.5s: Sign.origin[0] < -1'])

# 11 ------------------------------------------------------------------
pair(11, "The lid of a chest stands open, tipped a quarter turn back about its rear hinge edge.",
"""
    <Viewpoint description='Chest' position='3 2 6' orientation='-0.5 0.85 0.15 0.55'/>
    <Shape>
      %s
      <Box size='2 1 1'/>
    </Shape>
    <Transform DEF='Lid' translation='0 0.5 -0.5' rotation='@A@'>
      <Transform translation='0 0.05 0.5'>
        <Shape>
          %s
          <Box size='2 0.1 1'/>
        </Shape>
      </Transform>
    </Transform>
""" % (mat('0.5 0.3 0.1'), mat('0.7 0.5 0.2')),
{'@A@': '0 0 0 -1.5708'}, {'@A@': '1 0 0 -1.5708'})

# 12 ------------------------------------------------------------------
pair(12, "A table top two metres long, ninety centimetres deep and four centimetres thick is seen from a viewpoint five metres away.",
"""
    <Viewpoint description='Table' position='0 1.2 5' orientation='1 0 0 -0.1'/>
    <Transform translation='0 0.75 0'>
      <Shape DEF='TableTop'>
        %s
        <Box size='@A@'/>
      </Shape>
    </Transform>
    <Transform translation='0 0.365 0'>
      <Shape>
        %s
        <Cylinder height='0.73' radius='0.06'/>
      </Shape>
    </Transform>
""" % (mat('0.6 0.4 0.2'), mat('0.3 0.3 0.3')),
{'@A@': '2000 40 900'}, {'@A@': '2 0.04 0.9'})

# 13 ------------------------------------------------------------------
pair(13, "A steel bracket kept in its own file next to this one is brought into the assembly beside a blue base plate.",
"""
    <Viewpoint description='Assembly' position='0 0.5 6'/>
    <Transform translation='0 -0.6 0'>
      <Shape>
        %s
        <Box size='4 0.2 2'/>
      </Shape>
    </Transform>
    <Inline DEF='Bracket' url='@A@'/>
""" % mat('0.2 0.3 0.8'),
{'@A@': '"file:///C:/Users/dana/Documents/models/helper-bracket.x3d"'}, {'@A@': '"helper-bracket.x3d"'})

# 14 ------------------------------------------------------------------
pair(14, "A square tile carries a two-by-two checker of red, green, blue and white texels drawn without smoothing.",
"""
    <Viewpoint description='Tile' position='0 0 5'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='1 1 1'/>
        <PixelTexture image='@A@'>
          <TextureProperties magnificationFilter='NEAREST_PIXEL' minificationFilter='NEAREST_PIXEL'/>
        </PixelTexture>
      </Appearance>
      <IndexedFaceSet coordIndex='0 1 2 3 -1' texCoordIndex='0 1 2 3 -1'>
        <Coordinate point='-1.5 -1.5 0, 1.5 -1.5 0, 1.5 1.5 0, -1.5 1.5 0'/>
        <TextureCoordinate point='0 0, 1 0, 1 1, 0 1'/>
      </IndexedFaceSet>
    </Shape>
""",
{'@A@': '2 2 3 0xFF0000 0x00FF00 0x0000FF'}, {'@A@': '2 2 3 0xFF0000 0x00FF00 0x0000FF 0xFFFFFF'})

# 15 ------------------------------------------------------------------
pair(15, "A machined bracket carries two facts as metadata for the parts list: the alloy it is made of and its mass in kilograms.",
"""
    <Viewpoint description='Part' position='0 0 5'/>
    <Shape DEF='BracketShape'>
@A@
      %s
      <Box size='2 1 0.3'/>
    </Shape>
""" % mat('0.7 0.7 0.75'),
{'@A@': """      <MetadataString containerField='metadata' name='alloy' value='"6061-T6"'/>
      <MetadataFloat containerField='metadata' name='massKg' value='0.42'/>"""},
{'@A@': """      <MetadataSet containerField='metadata' name='partsList'>
        <MetadataString containerField='value' name='alloy' value='"6061-T6"'/>
        <MetadataFloat containerField='value' name='massKg' value='0.42'/>
      </MetadataSet>"""})

# 16 ------------------------------------------------------------------
pair(16, "A flat orange pie wedge covering a quarter of a circle is drawn facing the viewer.",
"""
    <Viewpoint description='Wedge' position='0 0 6'/>
    <Shape>
      <Appearance><Material diffuseColor='0 0 0' emissiveColor='1 0.5 0'/></Appearance>
      <ArcClose2D closureType='PIE' radius='2' startAngle='0' endAngle='1.5708' solid='false'/>
    </Shape>
""",
{}, {}, comps=[('Geometry2D', '2')], comps_fault=[('Geometry2d', '2')])

# 17 ------------------------------------------------------------------
pair(17, "A flat blue floor mat, three metres by two, lies on the ground and is seen from a camera looking straight down on it.",
"""
    <Viewpoint description='From above' position='0 8 0' orientation='1 0 0 -1.5708'/>
@A@
        <Shape>
          <Appearance><Material diffuseColor='0 0 0' emissiveColor='0.2 0.4 0.9'/></Appearance>
          <Rectangle2D size='3 2' solid='false'/>
        </Shape>
@B@
""",
{'@A@': "    <Transform DEF='Mat' translation='0 0.01 0'>", '@B@': "    </Transform>"},
{'@A@': "    <Transform DEF='Mat' translation='0 0.01 0' rotation='1 0 0 -1.5708'>", '@B@': "    </Transform>"})

# 18 ------------------------------------------------------------------
pair(18, "A smooth yellow arch is drawn as a single curve bent by three control points.",
"""
    <Viewpoint description='Arch' position='0 1 7'/>
    <Shape>
      <Appearance>
        <Material emissiveColor='1 1 0'/>
        <LineProperties linewidthScaleFactor='3'/>
      </Appearance>
      <NurbsCurve DEF='Arch' order='@A@' tessellation='24'>
        <Coordinate containerField='controlPoint' point='-2 0 0, 0 3 0, 2 0 0'/>
      </NurbsCurve>
    </Shape>
""",
{'@A@': '4'}, {'@A@': '3'}, comps=[('NURBS', '1')])

# 19 ------------------------------------------------------------------
pair(19, "An angle bracket is described as a CAD part whose single face is built from two quadrilateral plates, one lying flat and one standing up, meeting along an edge.",
"""
    <Viewpoint description='Bracket' position='3 3 6' orientation='-0.63 0.76 0.17 0.6'/>
    <CADAssembly DEF='BracketAssembly' name='BracketAssembly'>
      <CADPart DEF='Angle' name='Angle'>
        <CADFace name='Plates'>
          <Shape containerField='shape'>
            %s
            <IndexedQuadSet solid='false' index='@A@'>
              <Coordinate point='-1 0 1, 1 0 1, 1 0 -1, -1 0 -1, -1 0 -1, 1 0 -1, 1 2 -1, -1 2 -1'/>
            </IndexedQuadSet>
          </Shape>
        </CADFace>
      </CADPart>
    </CADAssembly>
""" % mat('0.6 0.6 0.7'),
{'@A@': '0 1 2 3 -1 4 5 6 7 -1'}, {'@A@': '0 1 2 3 4 5 6 7'},
comps=[('CADGeometry', '2')])

# 20 ------------------------------------------------------------------
pair(20, "A sixty-metre red marker block sits on the ground at latitude 48.8584 north, longitude 2.2945 east, and the camera hovers four hundred metres straight above it looking down.",
"""
    <GeoViewpoint description='Above the marker' geoSystem='"GD" "WE"' position='48.8584 2.2945 400' orientation='1 0 0 -1.5708'/>
    <GeoLocation DEF='Marker' geoSystem='"GD" "WE"' geoCoords='@A@'>
      <Shape>
        <Appearance><Material diffuseColor='0 0 0' emissiveColor='1 0 0'/></Appearance>
        <Box size='60 60 60'/>
      </Shape>
    </GeoLocation>
""",
{'@A@': '2.2945 48.8584 0'}, {'@A@': '48.8584 2.2945 0'}, comps=[('Geospatial', '1')])

# ---------------------------------------------------------------------- decoys
D = {}
D[1] = doc('Immersive', [], "A hatch cover stands open a quarter turn about its hinge; the author works in degrees and says so in the head.",
           ['after 0.5s: Hatch.rotation[3] < -1.5', 'after 0.5s: Hatch.rotation[3] > -1.6'], """
    <Viewpoint description='Hatch' position='3 2 6' orientation='-0.5 0.85 0.15 0.55'/>
    <Shape>
      %s
      <Box size='2 0.2 2'/>
    </Shape>
    <Transform DEF='Hatch' translation='0 0.1 -1' rotation='1 0 0 -90'>
      <Transform translation='0 0.05 1'>
        <Shape>
          %s
          <Box size='1.6 0.1 1.6'/>
        </Shape>
      </Transform>
    </Transform>
""" % (mat('0.4 0.4 0.4'), mat('0.8 0.6 0.1')), 'Hatch in degrees')
D[1] = D[1].replace("    <meta name='title'", "    <unit category='angle' name='degree' conversionFactor='0.017453292519943295'/>\n    <meta name='title'", 1)

D[2] = doc('Immersive', [], "A detailed railing is drawn once and a second, purely invisible use of a plain slab stands in for it when the visitor bumps into it.",
           [], """
    <Viewpoint description='Balcony' position='0 1.6 8'/>
    <Switch whichChoice='-1'>
      <Shape DEF='PlainSlab'>
        <Box size='6 1.1 0.1'/>
      </Shape>
    </Switch>
    <Collision DEF='Railing'>
      <Shape USE='PlainSlab' containerField='proxy'/>
      <Transform translation='0 0.5 0'>
        <Shape>
          %s
          <Box size='6 0.08 0.08'/>
        </Shape>
      </Transform>
      <Transform translation='-2.9 0 0'>
        <Shape DEF='Baluster'>
          %s
          <Cylinder height='1.1' radius='0.04'/>
        </Shape>
      </Transform>
      <Transform translation='2.9 0 0'>
        <Shape USE='Baluster'/>
      </Transform>
    </Collision>
""" % (mat('0.6 0.6 0.6'), mat('0.6 0.6 0.6')), 'Railing with proxy')

D[3] = doc('Immersive', [], "A hidden parts library holds one bolt that is never shown where it is defined and is placed three times on a flange.",
           ['after 0.5s: Library.whichChoice == -1'], """
    <Viewpoint description='Flange' position='0 0 7'/>
    <Switch DEF='Library' whichChoice='-1'>
      <Transform DEF='Bolt' rotation='1 0 0 1.5708'>
        <Shape>
          %s
          <Cylinder height='0.6' radius='0.15'/>
        </Shape>
      </Transform>
    </Switch>
    <Shape>
      %s
      <Box size='4 4 0.2'/>
    </Shape>
    <Transform translation='-1.5 1.5 0.2'>
      <Transform USE='Bolt'/>
    </Transform>
    <Transform translation='1.5 1.5 0.2'>
      <Transform USE='Bolt'/>
    </Transform>
    <Transform translation='0 -1.5 0.2'>
      <Transform USE='Bolt'/>
    </Transform>
""" % (mat('0.8 0.8 0.2'), mat('0.3 0.3 0.4')), 'Bolt library')

D[4] = doc('Immersive', [], "A paper pinwheel of two triangles, one red and one blue, is visible from both sides.",
           [], """
    <Viewpoint description='Pinwheel' position='0 0 6'/>
    <Shape>
      <Appearance><Material/></Appearance>
      <IndexedFaceSet solid='false' colorPerVertex='false' coordIndex='0 1 2 -1 0 3 4'>
        <Coordinate point='0 0 0, 2 0 0, 2 1.5 0, -2 0 0, -2 -1.5 0'/>
        <Color color='1 0 0, 0 0 1'/>
      </IndexedFaceSet>
    </Shape>
""", 'Pinwheel')

D[5] = doc('Immersive', [], "A small terrain patch of three by four posts, exported by a survey tool that writes commas and exponents, rises to a ridge along its middle.",
           ['after 0.5s: Terrain.xSpacing == 1.5'], """
    <Viewpoint description='Terrain' position='1.5 3 9' orientation='1 0 0 -0.3'/>
    <Shape>
      %s
      <ElevationGrid DEF='Terrain' xDimension='3' zDimension='4' xSpacing='1.5E0' zSpacing='1e+0' solid='false' creaseAngle='.5'
                     height='0, 5.0e-1, 0,
                             0, 1.2E0, 0,
                             0, 1.2e0, 0,
                             0, +5e-1, 0'/>
    </Shape>
""" % mat('0.4 0.6 0.3'), 'Survey terrain')

HELPER = doc('Immersive', [], "A steel bracket part, loaded by an assembly scene.", [], """
    <Transform DEF='BracketPart' translation='0 0.25 0'>
      <Shape>
        %s
        <Box size='1 1.5 0.2'/>
      </Shape>
    </Transform>
""" % mat('0.75 0.75 0.8'), 'Bracket part')

def sub(body, subs):
    for k, v in subs.items():
        body = body.replace(k, v)
    # drop lines that became empty through an empty substitution
    return '\n'.join(l for l in body.split('\n') if l.strip() != '' ) + '\n'

for n, p in P.items():
    for kind, subs, comps in (('fault', p['fault'], p['comps_fault']), ('twin', p['twin'], p['comps'])):
        text = doc(p['profile'], comps, p['prose'], p['intents'], sub(p['body'], subs), 'Set b scene %02d' % n)
        assert '@' not in text, (n, kind)
        open(os.path.join(HERE, '%s-%02d.x3d' % (kind, n)), 'w').write(text)
for n, t in D.items():
    open(os.path.join(HERE, 'decoy-%02d.x3d' % n), 'w').write(t)
open(os.path.join(HERE, 'helper-bracket.x3d'), 'w').write(HELPER)
print('written', len(P), 'pairs', len(D), 'decoys')
