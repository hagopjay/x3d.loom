#!/usr/bin/env python3
"""Generates fault-NN / twin-NN / decoy-NN scenes. A twin is the fault text with one
literal replacement applied, so the two files differ only by the fix."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))

def look(pos, at, up=(0, 1, 0)):
    """X3D Viewpoint position+orientation attributes for a camera at pos looking at at."""
    def sub(a, b): return [a[i] - b[i] for i in range(3)]
    def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    def norm(a):
        l = math.sqrt(sum(c*c for c in a)); return [c/l for c in a]
    z = norm(sub(pos, at)); x = norm(cross(up, z)); y = cross(z, x)
    m = [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]
    tr = m[0][0] + m[1][1] + m[2][2]
    ang = math.acos(max(-1, min(1, (tr - 1) / 2)))
    if ang < 1e-6:
        ax = [0, 0, 1]
    else:
        ax = norm([m[2][1]-m[1][2], m[0][2]-m[2][0], m[1][0]-m[0][1]])
    return "position='%g %g %g' orientation='%.5f %.5f %.5f %.5f'" % (*pos, *ax, ang)

HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='%(profile)s' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
  <head>
%(components)s    <meta name='description' content='%(desc)s'/>
  </head>
  <Scene>
%(body)s
  </Scene>
</X3D>
"""

def doc(desc, body, profile='Immersive', components=''):
    assert "'" not in desc
    return HEAD % dict(profile=profile, desc=desc, body=body.strip('\n'), components=components)

F = []   # (description, fault body, old, new, kwargs)

# 01
F.append(("A single shiny red ball seen from the front.", """
    <WorldInfo title='Red ball'/>
    <Viewpoint DEF='FrontView' description='Front view' position='0 0 6'/>
    <Shape DEF='RedBall'>
      <Material DEF='RedPaint' diffuseColor='0.8 0.1 0.1' specularColor='0.3 0.3 0.3'/>
      <Sphere radius='1.2'/>
    </Shape>
""", """      <Material DEF='RedPaint' diffuseColor='0.8 0.1 0.1' specularColor='0.3 0.3 0.3'/>
""", """      <Appearance>
        <Material DEF='RedPaint' diffuseColor='0.8 0.1 0.1' specularColor='0.3 0.3 0.3'/>
      </Appearance>
""", {}))

# 02
F.append(("A fence of three identical wooden posts standing side by side at x = -2, 0 and 2, all sharing one post shape.", """
    <Viewpoint DEF='FenceView' description='Fence from the front' position='0 0.5 9'/>
    <Transform DEF='FencePost' translation='-2 0 0'>
      <Shape DEF='PostShape'>
        <Appearance>
          <Material diffuseColor='0.55 0.35 0.2'/>
        </Appearance>
        <Cylinder height='2.4' radius='0.2'/>
      </Shape>
    </Transform>
    <Transform USE='FencePost' translation='0 0 0'/>
    <Transform USE='FencePost' translation='2 0 0'/>
""", """    <Transform USE='FencePost' translation='0 0 0'/>
    <Transform USE='FencePost' translation='2 0 0'/>
""", """    <Transform translation='0 0 0'>
      <Shape USE='PostShape'/>
    </Transform>
    <Transform translation='2 0 0'>
      <Shape USE='PostShape'/>
    </Transform>
""", {}))

# 03
F.append(("Two drawer knobs, a ball and a cone, that both wear the same polished brass look.", """
    <Viewpoint DEF='KnobView' description='Both knobs' position='0 0 7'/>
    <Transform DEF='BallKnob' translation='-1.3 0 0'>
      <Shape>
        <Appearance DEF='BrassLook'>
          <Material diffuseColor='0.75 0.55 0.15' specularColor='0.9 0.8 0.4' shininess='0.5'/>
        </Appearance>
        <Sphere radius='0.8'/>
      </Shape>
    </Transform>
    <Transform DEF='ConeKnob' translation='1.3 0 0'>
      <Shape>
        <Appearance USE='brassLook'/>
        <Cone bottomRadius='0.8' height='1.6'/>
      </Shape>
    </Transform>
""", "<Appearance USE='brassLook'/>", "<Appearance USE='BrassLook'/>", {}))

# 04
F.append(("A closed ridge tent: two triangular gable ends, two sloping sides and a floor, built from six corner points.", """
    <Viewpoint DEF='TentView' description='Tent from front right' %s/>
    <Shape DEF='RidgeTent'>
      <Appearance>
        <Material diffuseColor='0.2 0.6 0.3'/>
      </Appearance>
      <IndexedFaceSet DEF='TentMesh' coordIndex='1 2 3 -1 5 4 6 -1 2 5 6 3 -1 4 1 3 6 -1 1 4 5 2 -1'>
        <Coordinate DEF='TentCorners' point='-1 0 1, 1 0 1, 0 1.5 1, -1 0 -1, 1 0 -1, 0 1.5 -1'/>
      </IndexedFaceSet>
    </Shape>
""" % look((3.5, 2.5, 5), (0, 0.6, 0)),
"coordIndex='1 2 3 -1 5 4 6 -1 2 5 6 3 -1 4 1 3 6 -1 1 4 5 2 -1'",
"coordIndex='0 1 2 -1 4 3 5 -1 1 4 5 2 -1 3 0 2 5 -1 0 3 4 1 -1'", {}))

# 05
F.append(("A closed solid crate with six square sides, seen from above so that its lid, front and right side are visible.", """
    <Viewpoint DEF='CrateView' description='Crate from above' %s/>
    <Shape DEF='Crate'>
      <Appearance>
        <Material diffuseColor='0.7 0.5 0.25'/>
      </Appearance>
      <IndexedFaceSet DEF='CrateMesh' solid='true' coordIndex='0 1 2 3 -1 5 4 7 6 -1 1 5 6 2 -1 4 0 3 7 -1 3 7 6 2 -1 4 5 1 0 -1'>
        <Coordinate DEF='CrateCorners' point='-1 -1 1, 1 -1 1, 1 1 1, -1 1 1, -1 -1 -1, 1 -1 -1, 1 1 -1, -1 1 -1'/>
      </IndexedFaceSet>
    </Shape>
""" % look((3.5, 3.5, 5), (0, 0, 0)), "4 0 3 7 -1 3 7 6 2 -1", "4 0 3 7 -1 3 2 6 7 -1", {}))

# 06
F.append(("A square pyramid whose five faces are each painted one flat colour: grey base, red front, green right, blue back, yellow left.", """
    <Viewpoint DEF='PyramidView' description='Pyramid front right' %s/>
    <Shape DEF='PaintedPyramid'>
      <Appearance>
        <Material/>
      </Appearance>
      <IndexedFaceSet DEF='PyramidMesh' coordIndex='0 3 2 1 -1 0 1 4 -1 1 2 4 -1 2 3 4 -1 3 0 4 -1'>
        <Coordinate DEF='PyramidCorners' point='-1 0 1, 1 0 1, 1 0 -1, -1 0 -1, 0 1.6 0'/>
        <Color DEF='FacePaints' color='0.5 0.5 0.5, 0.9 0.1 0.1, 0.1 0.7 0.1, 0.1 0.2 0.9, 0.95 0.85 0.1'/>
      </IndexedFaceSet>
    </Shape>
""" % look((3, 2.5, 4), (0, 0.6, 0)),
"<IndexedFaceSet DEF='PyramidMesh' coordIndex=", "<IndexedFaceSet DEF='PyramidMesh' colorPerVertex='false' coordIndex=", {}))

# 07
F.append(("A solid square beam, 2 m by 2 m in section and 3 m tall, closed on all four sides and capped at both ends.", """
    <Viewpoint DEF='BeamView' description='Beam from front right above' %s/>
    <Shape DEF='SquareBeam'>
      <Appearance>
        <Material diffuseColor='0.6 0.6 0.7'/>
      </Appearance>
      <Extrusion DEF='ClosedBeam' beginCap='true' endCap='true' solid='true' crossSection='1 1, 1 -1, -1 -1, -1 1' spine='0 0 0, 0 3 0'/>
    </Shape>
""" % look((4, 5, 6), (0, 1.5, 0)), "crossSection='1 1, 1 -1, -1 -1, -1 1'", "crossSection='1 1, 1 -1, -1 -1, -1 1, 1 1'", {}))

# 08
F.append(("A terrain patch with one straight ridge running along the X axis: 5 height samples along X (1 m apart) and 3 rows along Z (2 m apart), the middle row raised 2 m.", """
    <Viewpoint DEF='TerrainView' description='Terrain overview' %s/>
    <Transform DEF='CentredTerrain' translation='-2 0 -2'>
      <Shape DEF='RidgeTerrain'>
        <Appearance>
          <Material diffuseColor='0.45 0.6 0.3'/>
        </Appearance>
        <ElevationGrid DEF='RidgeHeights' solid='false' xDimension='3' zDimension='5' xSpacing='1' zSpacing='2'
          height='0 0 0 0 0
                  2 2 2 2 2
                  0 0 0 0 0'/>
      </Shape>
    </Transform>
""" % look((5, 6, 8), (0, 0.5, 0)), "xDimension='3' zDimension='5'", "xDimension='5' zDimension='3'", {}))

# 09
F.append(("A signpost arrow (shaft with a cone tip) laid on its side so that the tip points along the +X axis, a quarter turn from upright.", """
    <Viewpoint DEF='ArrowView' description='Arrow from the front' position='0 0 8'/>
    <Transform DEF='ArrowPointingAlongPlusX' rotation='0 0 1 -90'>
      <Shape DEF='Shaft'>
        <Appearance DEF='ArrowPaint'>
          <Material diffuseColor='0.9 0.8 0.1'/>
        </Appearance>
        <Cylinder height='2' radius='0.12'/>
      </Shape>
      <Transform DEF='TipOffset' translation='0 1.3 0'>
        <Shape DEF='Tip'>
          <Appearance USE='ArrowPaint'/>
          <Cone bottomRadius='0.35' height='0.6'/>
        </Shape>
      </Transform>
    </Transform>
""", "rotation='0 0 1 -90'", "rotation='0 0 1 -1.5708'", {}))

# 10
F.append(("A traffic-cone orange box on a dark background.", """
    <Viewpoint DEF='BoxView' description='Orange box' %s/>
    <Shape DEF='OrangeBox'>
      <Appearance>
        <Material DEF='OrangePaint' diffuseColor='255 128 0'/>
      </Appearance>
      <Box size='2 2 2'/>
    </Shape>
""" % look((3, 2.5, 5), (0, 0, 0)), "diffuseColor='255 128 0'", "diffuseColor='1 0.5 0'", {}))

# 11
F.append(("A solid, fully opaque blue ball resting on a grey floor slab.", """
    <Viewpoint DEF='BallView' description='Ball on floor' %s/>
    <Transform DEF='Floor' translation='0 -0.1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0.6 0.6'/>
        </Appearance>
        <Box size='6 0.2 6'/>
      </Shape>
    </Transform>
    <Transform DEF='Ball' translation='0 1 0'>
      <Shape>
        <Appearance>
          <Material DEF='SolidOpaqueBlue' diffuseColor='0.1 0.2 0.8' specularColor='0.4 0.4 0.4' transparency='1'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
    </Transform>
""" % look((0, 3, 8), (0, 0.8, 0)), "transparency='1'", "transparency='0'", {}))

# 12
F.append(("A square wall panel tiled with a two-by-two checker tile that repeats four times across and four times up, giving eight squares per side.", """
    <Viewpoint DEF='PanelView' description='Panel from the front' position='0 0 6'/>
    <Shape DEF='TiledPanel'>
      <Appearance>
        <PixelTexture DEF='CheckerTile' image='2 2 3 0xE0E0E0 0x303030 0x303030 0xE0E0E0' repeatS='true' repeatT='true'/>
        <TextureTransform DEF='RepeatFourTimes' scale='0.25 0.25'/>
      </Appearance>
      <IndexedFaceSet DEF='PanelQuad' solid='false' coordIndex='0 1 2 3 -1' texCoordIndex='0 1 2 3 -1'>
        <Coordinate point='-2 -2 0, 2 -2 0, 2 2 0, -2 2 0'/>
        <TextureCoordinate point='0 0, 1 0, 1 1, 0 1'/>
      </IndexedFaceSet>
    </Shape>
""", "scale='0.25 0.25'", "scale='4 4'", {}))

# 13
F.append(("An outdoor ground slab with a white ball on it, lit only by a noon sun standing straight overhead so the top of the ground and of the ball are bright.", """
    <NavigationInfo headlight='false'/>
    <Background skyColor='0.45 0.6 0.8'/>
    <Viewpoint DEF='HighCorner' description='From a high corner' %s/>
    <DirectionalLight DEF='NoonSunOverhead' global='true' direction='0 1 0' intensity='1' ambientIntensity='0'/>
    <Transform DEF='Ground' translation='0 -0.1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.7 0.4'/>
        </Appearance>
        <Box size='8 0.2 8'/>
      </Shape>
    </Transform>
    <Transform DEF='Ball' translation='0 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.9 0.9 0.9'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
    </Transform>
""" % look((5, 6, 8), (0, 0.5, 0)), "direction='0 1 0'", "direction='0 -1 0'", {}))

# 14
F.append(("A statue (cone on a pedestal with a blue back plate) and one camera placed 8 m behind it on the -Z side, looking back at the statue so its blue back plate fills the middle of the view.", """
    <Viewpoint DEF='BackView' description='Back view of the statue' position='0 1 -8'/>
    <Transform DEF='Pedestal' translation='0 0.25 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0.6 0.6'/>
        </Appearance>
        <Cylinder height='0.5' radius='1'/>
      </Shape>
    </Transform>
    <Transform DEF='Figure' translation='0 1.5 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.85 0.8 0.7'/>
        </Appearance>
        <Cone bottomRadius='0.7' height='2'/>
      </Shape>
    </Transform>
    <Transform DEF='BackPlate' translation='0 1.2 -0.8'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.1 0.2 0.8'/>
        </Appearance>
        <Box size='1 1.2 0.1'/>
      </Shape>
    </Transform>
""", "position='0 1 -8'/>", "position='0 1 -8' orientation='0 1 0 3.14159'/>", {}))

# 15
F.append(("A two-state signal lamp that currently shows its second state, the green GO lamp; the first state, the red STOP lamp, is hidden.", """
    <Viewpoint DEF='LampView' description='Signal lamp' position='0 0 6'/>
    <Switch DEF='SignalLamp' whichChoice='2'>
      <Shape DEF='StopLampFirstState'>
        <Appearance>
          <Material diffuseColor='0.9 0.05 0.05' emissiveColor='0.3 0 0'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
      <Shape DEF='GoLampSecondState'>
        <Appearance>
          <Material diffuseColor='0.05 0.8 0.1' emissiveColor='0 0.3 0'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
    </Switch>
""", "whichChoice='2'", "whichChoice='1'", {}))

# 16
F.append(("A grey base plate with a red angle bracket standing on it; the bracket is brought in from the neighbouring file support-bracket.x3d.", """
    <Viewpoint DEF='AssemblyView' description='Plate and bracket' %s/>
    <Transform DEF='BasePlate' translation='0 -0.1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.55 0.55 0.6'/>
        </Appearance>
        <Box size='4 0.2 3'/>
      </Shape>
    </Transform>
    <Transform DEF='BracketPlacement' translation='0 0 0'>
      <Inline DEF='BracketInline' load='true' url='"support_bracket.x3d"'/>
    </Transform>
""" % look((3, 3, 6), (0, 0.6, 0)), "url='\"support_bracket.x3d\"'", "url='\"support-bracket.x3d\"'", {}))

# 17
F.append(("A smooth green hill: one curved surface patch with a 4 by 4 control net whose four middle points are lifted.", """
    <Viewpoint DEF='HillView' description='Hill from the front' %s/>
    <Shape DEF='SmoothHill'>
      <Appearance>
        <Material diffuseColor='0.2 0.7 0.3'/>
      </Appearance>
      <NurbsPatchSurface DEF='HillPatch' solid='false' uDimension='4' vDimension='4' uOrder='3' vOrder='3' uTessellation='16' vTessellation='16'>
        <Coordinate DEF='HillControlNet' containerField='controlPoint' point='-1.5 0 1.5, -0.5 0 1.5, 0.5 0 1.5, 1.5 0 1.5, -1.5 0 0.5, -0.5 2 0.5, 0.5 2 0.5, 1.5 0 0.5, -1.5 0 -0.5, -0.5 2 -0.5, 0.5 2 -0.5, 1.5 0 -0.5, -1.5 0 -1.5, -0.5 0 -1.5, 0.5 0 -1.5, 1.5 0 -1.5'/>
      </NurbsPatchSurface>
    </Shape>
""" % look((0, 4, 6), (0, 0.4, 0)), "__COMPONENT__", "", {}))

# 18
F.append(("Two pillars made from one Pillar prototype: a red pillar on the left and a blue pillar on the right.", """
    <ProtoDeclare name='Pillar'>
      <ProtoInterface>
        <field name='pillarColor' type='SFColor' accessType='initializeOnly' value='0.6 0.6 0.6'/>
        <field name='position' type='SFVec3f' accessType='initializeOnly' value='0 0 0'/>
      </ProtoInterface>
      <ProtoBody>
        <Transform>
          <IS>
            <connect nodeField='translation' protoField='position'/>
          </IS>
          <Shape>
            <Appearance>
              <Material>
                <IS>
                  <connect nodeField='diffuseColor' protoField='pillarColor'/>
                </IS>
              </Material>
            </Appearance>
            <Cylinder height='3' radius='0.45'/>
          </Shape>
        </Transform>
      </ProtoBody>
    </ProtoDeclare>
    <Viewpoint DEF='PillarView' description='Both pillars' position='0 0 9'/>
    <ProtoInstance DEF='RedPillarLeft' name='Pillar'>
      <fieldValue name='color' value='0.9 0.1 0.1'/>
      <fieldValue name='position' value='-1.5 0 0'/>
    </ProtoInstance>
    <ProtoInstance DEF='BluePillarRight' name='Pillar'>
      <fieldValue name='pillarColor' value='0.1 0.2 0.9'/>
      <fieldValue name='position' value='1.5 0 0'/>
    </ProtoInstance>
""", "<fieldValue name='color' value='0.9 0.1 0.1'/>", "<fieldValue name='pillarColor' value='0.9 0.1 0.1'/>", {}))

# 19
F.append(("A chair whose Transform carries one catalog record, a metadata set named catalog that holds exactly three entries: sku, finish and priceEUR.", """
    <Viewpoint DEF='ChairView' description='Chair' %s/>
    <Transform DEF='Chair'>
      <MetadataSet DEF='CatalogRecord' containerField='metadata' name='catalog'>
        <MetadataString containerField='value' name='sku' value='"CH-204"'/>
        <MetadataString containerField='value' name='finish' value='"oak"'/>
        <MetadataFloat containerField='metadata' name='priceEUR' value='129.5'/>
      </MetadataSet>
      <Transform DEF='Seat' translation='0 0.5 0'>
        <Shape>
          <Appearance DEF='Oak'>
            <Material diffuseColor='0.65 0.45 0.25'/>
          </Appearance>
          <Box size='1 0.1 1'/>
        </Shape>
      </Transform>
      <Transform DEF='Backrest' translation='0 1.05 -0.45'>
        <Shape>
          <Appearance USE='Oak'/>
          <Box size='1 1 0.1'/>
        </Shape>
      </Transform>
    </Transform>
""" % look((2.5, 2, 4), (0, 0.7, 0)),
"<MetadataFloat containerField='metadata' name='priceEUR'", "<MetadataFloat containerField='value' name='priceEUR'", {}))

# 20
F.append(("A doorway with posts at x = 0 and x = 1 and a door leaf, hinged along its left edge at the x = 0 post, swung open a quarter turn towards the viewer about that hinge.", """
    <Viewpoint DEF='DoorView' description='Doorway from front above' %s/>
    <Transform DEF='HingePost' translation='-0.05 1 0'>
      <Shape DEF='PostShape'>
        <Appearance>
          <Material diffuseColor='0.35 0.35 0.4'/>
        </Appearance>
        <Box size='0.1 2 0.1'/>
      </Shape>
    </Transform>
    <Transform DEF='LatchPost' translation='1.05 1 0'>
      <Shape USE='PostShape'/>
    </Transform>
    <Transform DEF='DoorLeafOpenQuarterTurn' translation='0.5 1 0' rotation='0 1 0 -1.5708'>
      <Shape DEF='DoorLeaf'>
        <Appearance>
          <Material diffuseColor='0.7 0.3 0.15'/>
        </Appearance>
        <Box size='1 2 0.06'/>
      </Shape>
    </Transform>
""" % look((1.5, 3.5, 5), (0.5, 1, 0)),
"translation='0.5 1 0' rotation='0 1 0 -1.5708'>", "translation='0.5 1 0' center='-0.5 0 0' rotation='0 1 0 -1.5708'>", {}))

D = []
D.append(("Two steel bolts, one upright and one lying on its side, both reusing a single bolt shape that is defined once inside a switched-off library group.", """
    <Viewpoint DEF='BoltView' description='Both bolts' position='0 0 7'/>
    <Switch DEF='HiddenDefinitionLibrary' whichChoice='-1'>
      <Shape DEF='BoltShape'>
        <Appearance>
          <Material diffuseColor='0.6 0.62 0.65' specularColor='0.8 0.8 0.8' shininess='0.6'/>
        </Appearance>
        <Cylinder height='1.8' radius='0.3'/>
      </Shape>
    </Switch>
    <Transform DEF='UprightBolt' translation='-1.3 0 0'>
      <Shape USE='BoltShape'/>
    </Transform>
    <Transform DEF='LyingBolt' translation='1.3 0 0' rotation='0 0 1 1.5708'>
      <Shape USE='BoltShape'/>
    </Transform>
"""))
D.append(("A right-hand L bracket at x = +1.5 and its exact mirror image, a left-hand bracket, at x = -1.5, made by reflecting the same group across the YZ plane.", """
    <Viewpoint DEF='PairView' description='Mirrored pair' position='0 0 9'/>
    <Transform DEF='RightHandPlacement' translation='1.5 0 0'>
      <Group DEF='RightHandBracket'>
        <Shape>
          <Appearance DEF='BracketPaint'>
            <Material diffuseColor='0.2 0.5 0.8'/>
          </Appearance>
          <Box size='0.4 2 0.4'/>
        </Shape>
        <Transform translation='0.8 -0.8 0'>
          <Shape>
            <Appearance USE='BracketPaint'/>
            <Box size='1.2 0.4 0.4'/>
          </Shape>
        </Transform>
      </Group>
    </Transform>
    <Transform DEF='MirroredLeftHandPlacement' translation='-1.5 0 0' scale='-1 1 1'>
      <Group USE='RightHandBracket'/>
    </Transform>
"""))
D.append(("A closed solid crate with six square sides whose corners are listed clockwise on every face, seen from above so that its lid, front and right side are visible.", """
    <Viewpoint DEF='CrateView' description='Crate from above' %s/>
    <Shape DEF='ClockwiseCrate'>
      <Appearance>
        <Material diffuseColor='0.7 0.5 0.25'/>
      </Appearance>
      <IndexedFaceSet DEF='ClockwiseMesh' ccw='false' solid='true' coordIndex='3 2 1 0 -1 6 7 4 5 -1 2 6 5 1 -1 7 3 0 4 -1 7 6 2 3 -1 0 1 5 4'>
        <Coordinate DEF='CrateCorners' point='-1 -1 1, 1 -1 1, 1 1 1, -1 1 1, -1 -1 -1, 1 -1 -1, 1 1 -1, -1 1 -1'/>
      </IndexedFaceSet>
    </Shape>
""" % look((3.5, 3.5, 5), (0, 0, 0))))
D.append(("A long-lens survey shot: a red marker box 4 m wide filmed from 400 m away through a very narrow field of view, so it still spans over a third of the frame width.", """
    <NavigationInfo type='"EXAMINE" "ANY"' visibilityLimit='0'/>
    <Viewpoint DEF='LongLens' description='Telephoto from 400 m' position='0 0 400' fieldOfView='0.02' centerOfRotation='0 0 0'/>
    <Shape DEF='MarkerBox'>
      <Appearance>
        <Material diffuseColor='0.85 0.15 0.1'/>
      </Appearance>
      <Box size='4 2 2'/>
    </Shape>
"""))
D.append(("A self-lit orange warning disc that glows evenly with every light switched off: no headlight and no light nodes, the colour comes from emission alone.", """
    <NavigationInfo headlight='false'/>
    <Viewpoint DEF='DiscView' description='Warning disc' position='0 0 6'/>
    <Transform DEF='DiscFacingViewer' rotation='1 0 0 1.5708'>
      <Shape DEF='GlowingDisc'>
        <Appearance>
          <Material DEF='EmissionOnly' diffuseColor='0 0 0' specularColor='0 0 0' emissiveColor='1 0.55 0'/>
        </Appearance>
        <Cylinder height='0.1' radius='1.5'/>
      </Shape>
    </Transform>
"""))

SUPPORT = doc("Support file for pair 16: a red angle bracket (upright leg and foot) standing on the plane y = 0.", """
    <Group DEF='AngleBracket'>
      <Transform DEF='UprightLeg' translation='0 0.75 0'>
        <Shape>
          <Appearance DEF='RedPaint'>
            <Material diffuseColor='0.85 0.1 0.1'/>
          </Appearance>
          <Box size='0.2 1.5 1'/>
        </Shape>
      </Transform>
      <Transform DEF='Foot' translation='0.5 0.1 0'>
        <Shape>
          <Appearance USE='RedPaint'/>
          <Box size='1 0.2 1'/>
        </Shape>
      </Transform>
    </Group>
""")

def w(name, text):
    with open(os.path.join(HERE, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

for i, (desc, body, old, new, kw) in enumerate(F, 1):
    if old == "__COMPONENT__":
        w('fault-%02d.x3d' % i, doc(desc, body))
        w('twin-%02d.x3d' % i, doc(desc, body, components="    <component name='NURBS' level='1'/>\n"))
        continue
    assert body.count(old) == 1, (i, body.count(old))
    w('fault-%02d.x3d' % i, doc(desc, body))
    w('twin-%02d.x3d' % i, doc(desc, body.replace(old, new)))
for i, (desc, body) in enumerate(D, 1):
    w('decoy-%02d.x3d' % i, doc(desc, body))
w('support-bracket.x3d', SUPPORT)
print('written', len(F), len(D))
