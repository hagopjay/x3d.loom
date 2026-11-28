#!/usr/bin/env python3
"""Writes fault-NN / twin-NN / decoy-NN / helper files from templates.
A template holds [[fault text||twin text]] alternatives; everything else is shared,
so the intent lines of a pair are byte-for-byte the same."""
import re, os, sys
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<X3D profile='%s' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
  <head>
%s  </head>
  <Scene>
%s  </Scene>
</X3D>
"""

def doc(profile, prose, intents, body, comps=''):
    h = comps
    h += "    <meta name='intent:prose' content=\"%s\"/>\n" % prose
    for i in intents:
        h += "    <meta name='intent' content=\"%s\"/>\n" % i.replace('<', '&lt;').replace('>', '&gt;')
    return HEAD % (profile, h, body.strip('\n') + '\n')

def split(t, which):
    return re.sub(r'\[\[(.*?)\|\|(.*?)\]\]', lambda m: m.group(1 if which == 'f' else 2), t, flags=re.S)

P = {}   # pairs
D = {}   # decoys

P[1] = dict(profile='Immersive', prose="A closed wedge-shaped door stop is looked at from outside and every one of its five faces is seen.", intents=[], body="""
    <Viewpoint description='Wedge' position='0 2 6' orientation='1 0 0 -0.25'/>
    <Transform rotation='0 1 0 2.6'>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.1 0.3 0.8'/>
      </Appearance>
      <IndexedFaceSet coordIndex='
          0 3 2 1 -1
          0 1 4 -1
          [[3 2 5||2 3 5]] -1
          1 2 5 4 -1
          [[0 3 5 4||3 0 4 5]] -1'>
        <Coordinate point='
            0 0 1
            2 0 1
            2 0 -1
            0 0 -1
            0 1 1
            0 1 -1'/>
      </IndexedFaceSet>
    </Shape>
    </Transform>
""")

P[2] = dict(profile='Immersive', prose="A bracket that is kept in a file of its own is shown standing next to a grey marker post.", intents=[], body="""
    <Viewpoint description='Bench' position='0 1 7'/>
    <Transform translation='-2 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.5 0.5'/>
        </Appearance>
        <Cylinder height='2' radius='0.15'/>
      </Shape>
    </Transform>
    <Transform translation='1 0 0'>
[[      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0 0.6' specularColor='0.8 0.8 0.8' shininess='0.15'/>
        </Appearance>
        <Inline url='"helper-bracket.x3d"'/>
      </Shape>||      <Inline url='"helper-bracket.x3d"'/>]]
    </Transform>
""")

P[3] = dict(profile='Immersive', prose="The L-shaped floor of a room is shown as one flat pale-yellow slab seen from above.", intents=[], body="""
    <Viewpoint description='Plan' position='3 12 3' orientation='1 0 0 -1.5708'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='1 1 0.9'/>
      </Appearance>
      <IndexedFaceSet solid='false' convex='false'[[|| coordIndex='0 1 2 3 4 5 -1']]>
        <Coordinate point='
            0 0 0
            0 0 6
            6 0 6
            6 0 3
            3 0 3
            3 0 0'/>
      </IndexedFaceSet>
    </Shape>
""")

P[4] = dict(profile='Immersive', prose="A long blue ribbon, one unit wide and three long, is outlined by eight points along its edge and shown filled.", intents=[], body="""
    <Viewpoint description='Ribbon' position='1.5 8 2.5' orientation='1 0 0 -1.5708'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0 0 1' specularColor='0.5 0.5 0.5'/>
      </Appearance>
      <IndexedFaceSet solid='false' coordIndex='[[0 1 2 3||0 1 2 3 4 5 6 7]] -1'>
        <Coordinate point='
            1 0 1
            1 0 2
            1 0 3
            1 0 4
            2 0 4
            2 0 3
            2 0 2
            2 0 1'/>
      </IndexedFaceSet>
    </Shape>
""")

P[5] = dict(profile='Immersive', prose="The four-colour badge painted on a wall panel is turned an eighth of a turn about the middle of the picture, so its middle stays in the middle of the panel.", intents=[], body="""
    <Viewpoint description='Panel' position='0 0 5'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.8 0.8 0.8'/>
        <PixelTexture image='2 2 3 0xFF0000 0x00FF00 0x0000FF 0xFFFF00' repeatS='false' repeatT='false'>
          <TextureProperties magnificationFilter='NEAREST_PIXEL' boundaryModeS='CLAMP_TO_EDGE' boundaryModeT='CLAMP_TO_EDGE'/>
        </PixelTexture>
        <TextureTransform [[||center='-0.5 -0.5' ]]rotation='0.7854'/>
      </Appearance>
      <IndexedFaceSet coordIndex='0 1 2 3 -1'>
        <Coordinate point='-1.5 -1.5 0  1.5 -1.5 0  1.5 1.5 0  -1.5 1.5 0'/>
        <TextureCoordinate point='0 0  1 0  1 1  0 1'/>
      </IndexedFaceSet>
    </Shape>
""")

P[6] = dict(profile='Immersive', prose="A planet turns steadily once its clock is started; a press freezes it where it is and the next press lets it carry on from that same place.",
    intents=["send Clock.startTime = now at 0.2s", "send Switcher.press = true at 1.2s", "send Switcher.press = true at 3.2s", "after 2.6s: Planet.rotation[3] < 1.0", "after 3.9s: Planet.rotation[3] > 0.8", "after 3.9s: Planet.rotation[3] < 1.6"], body="""
    <Viewpoint description='Orbit' position='0 0 8'/>
    <Transform DEF='Planet'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.5 0.9'/>
        </Appearance>
        <Box size='2 2 2'/>
      </Shape>
      <TouchSensor DEF='Finger' description='freeze or release'/>
    </Transform>
    <TimeSensor DEF='Clock' cycleInterval='10'/>
    <OrientationInterpolator DEF='Spin' key='0 0.25 0.5 0.75 1' keyValue='0 1 0 0  0 1 0 1.5708  0 1 0 3.1416  0 1 0 4.7124  0 1 0 6.2832'/>
    <BooleanFilter DEF='OnPress'/>
    <Script DEF='Switcher'>
      <field name='press' type='SFBool' accessType='inputOnly'/>
      <field name='frozen' type='SFBool' accessType='initializeOnly' value='false'/>
[[      <field name='running' type='SFBool' accessType='outputOnly'/>||      <field name='freezeAt' type='SFTime' accessType='outputOnly'/>
      <field name='releaseAt' type='SFTime' accessType='outputOnly'/>]]
      <![CDATA[ecmascript:
function press (value, time)
{
   frozen = !frozen;
[[   running = !frozen;||   if (frozen)
      freezeAt = time;
   else
      releaseAt = time;]]
}
]]>
    </Script>
    <ROUTE fromNode='Finger' fromField='isActive' toNode='OnPress' toField='set_boolean'/>
    <ROUTE fromNode='OnPress' fromField='inputTrue' toNode='Switcher' toField='press'/>
[[    <ROUTE fromNode='Switcher' fromField='running' toNode='Clock' toField='enabled'/>||    <ROUTE fromNode='Switcher' fromField='freezeAt' toNode='Clock' toField='pauseTime'/>
    <ROUTE fromNode='Switcher' fromField='releaseAt' toNode='Clock' toField='resumeTime'/>]]
    <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='Spin' toField='set_fraction'/>
    <ROUTE fromNode='Spin' fromField='value_changed' toNode='Planet' toField='rotation'/>
""")

P[7] = dict(profile='Immersive', prose="When the ball is touched it glides once from the left mark up to the right mark and then stays there.",
    intents=["send Clock.startTime = now at 0.2s", "after 3.3s: Ball.translation == 3 3 0 tol 0.05", "after 4.4s: Ball.translation == 3 3 0 tol 0.05"], body="""
    <Viewpoint description='Stage' position='0 1.5 12'/>
    <Transform DEF='Ball' translation='-3 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.1 0.1 0.1' specularColor='0.3 0.3 0.3' shininess='0.08'/>
        </Appearance>
        <Sphere radius='0.5'/>
      </Shape>
      <TouchSensor DEF='Touch' description='send the ball'/>
    </Transform>
    <TimeSensor DEF='Clock' cycleInterval='2'[[ loop='true'||]]/>
    <PositionInterpolator DEF='Glide' key='0 1' keyValue='-3 0 0  3 3 0'/>
    <ROUTE fromNode='Touch' fromField='touchTime' toNode='Clock' toField='startTime'/>
    <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='Glide' toField='set_fraction'/>
    <ROUTE fromNode='Glide' fromField='value_changed' toNode='Ball' toField='translation'/>
""")

P[8] = dict(profile='Immersive', prose="With the headlight off, a lamp on a turning arm sweeps round the white ball and lights it from one side after another.",
    intents=["after 1.5s: LampArm.rotation changed"], body="""
    <NavigationInfo headlight='false'/>
    <Viewpoint description='Ball' position='0 0 8'/>
    <Transform DEF='LampArm'>
      <DirectionalLight direction='-1 0 0'[[|| global='true']]/>
    </Transform>
    <Shape>
      <Appearance>
        <Material diffuseColor='1 1 1'/>
      </Appearance>
      <Sphere radius='1.5'/>
    </Shape>
    <TimeSensor DEF='Clock' cycleInterval='6' loop='true'/>
    <OrientationInterpolator DEF='Sweep' key='0 0.25 0.5 0.75 1' keyValue='0 1 0 0  0 1 0 1.5708  0 1 0 3.1416  0 1 0 4.7124  0 1 0 6.2832'/>
    <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='Sweep' toField='set_fraction'/>
    <ROUTE fromNode='Sweep' fromField='value_changed' toNode='LampArm' toField='rotation'/>
""")

P[9] = dict(profile='Immersive', prose="When told to, the script stretches the rope so that it runs from the peg at the origin to the hook at 2 1 0.",
    intents=["send Maker.go = now at 0.3s", "after 1.2s: Rope.point == 0 0 0 2 1 0"], body="""
    <Viewpoint description='Rope' position='1 0.5 6'/>
    <Shape>
      <Appearance>
        <Material emissiveColor='1 0.8 0.2'/>
      </Appearance>
      <IndexedLineSet coordIndex='0 1 -1'>
        <Coordinate DEF='Rope' point='0 0 0  0.5 0 0'/>
      </IndexedLineSet>
    </Shape>
    <Transform translation='2 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.7 0.7 0.7'/>
        </Appearance>
        <Sphere radius='0.1'/>
      </Shape>
    </Transform>
    <Script DEF='Maker'>
      <field name='go' type='SFTime' accessType='inputOnly'/>
      <field name='ends' type='MFVec3f' accessType='outputOnly'/>
      <![CDATA[ecmascript:
function go (value, time)
{
   var peg  = new SFVec3f (0, 0, 0);
   var hook = new SFVec3f (2, 1, 0);

   ends = new MFVec3f ([[[peg, hook]||peg, hook]]);
}
]]>
    </Script>
    <ROUTE fromNode='Maker' fromField='ends' toNode='Rope' toField='point'/>
""")

P[10] = dict(profile='Immersive', prose="At start-up the script puts both a crate and a ball onto the empty shelf, so two things stand on it.", intents=[], body="""
    <Viewpoint description='Shelf' position='0 0.5 7'/>
    <Transform translation='0 -0.6 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.35 0.2'/>
        </Appearance>
        <Box size='5 0.2 1.5'/>
      </Shape>
    </Transform>
    <Group DEF='Shelf'/>
    <Script DEF='Stocker' directOutput='true'>
      <field name='shelf' type='SFNode' accessType='initializeOnly'>
        <Group USE='Shelf'/>
      </field>
      <field name='crate' type='MFNode' accessType='initializeOnly'>
        <Transform translation='-1.2 0 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='1 1 0'/>
            </Appearance>
            <Box size='1 1 1'/>
          </Shape>
        </Transform>
      </field>
      <field name='ball' type='MFNode' accessType='initializeOnly'>
        <Transform translation='1.2 0 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0 1 1'/>
            </Appearance>
            <Sphere radius='0.5'/>
          </Shape>
        </Transform>
      </field>
      <![CDATA[ecmascript:
function initialize ()
{
[[   shelf .addChildren = crate;
   shelf .addChildren = ball;||   var both = new MFNode (crate [0], ball [0]);

   shelf .addChildren = both;]]
}
]]>
    </Script>
""")

P[11] = dict(profile='Immersive', prose="Each instance of the prototype shows a red ball with a green ball two units to its right.", intents=[], body="""
    <ProtoDeclare name='BallPair'>
      <ProtoBody>
[[||        <Group>
]]        <Shape>
          <Appearance>
            <Material diffuseColor='1 0 0'/>
          </Appearance>
          <Sphere radius='0.6'/>
        </Shape>
        <Transform translation='2 0 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0 1 0'/>
            </Appearance>
            <Sphere radius='0.6'/>
          </Shape>
        </Transform>
[[||        </Group>
]]      </ProtoBody>
    </ProtoDeclare>
    <Viewpoint description='Pairs' position='1 0 10'/>
    <Transform translation='-2 1.5 0'>
      <ProtoInstance name='BallPair'/>
    </Transform>
    <Transform translation='-2 -1.5 0'>
      <ProtoInstance name='BallPair'/>
    </Transform>
""")

P[12] = dict(profile='Immersive', prose="A small flat building plot, about eight metres across and taken from a survey, is shown with crisp straight edges at the corners that were measured.", intents=[], body="""
    <Viewpoint description='Plot' position='[[405392 4533753 1035||0 0 25]]'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.8 0.6 0.3'/>
      </Appearance>
      <IndexedFaceSet solid='false' convex='false' coordIndex='0 1 2 3 4 5 6 7 -1'>
        <Coordinate point='
[[            405392.736 4533748.873 1010.8875
            405393.208 4533753.931 1010.8875
            405388.646 4533754.447 1010.8875
            405384.492 4533755.036 1010.8875
            405384.820 4533758.014 1010.8875
            405394.442 4533757.165 1010.8875
            405399.922 4533756.685 1010.8875
            405398.215 4533748.151 1010.8875||            0.736 -4.127 0
            1.208 0.931 0
            -3.354 1.447 0
            -7.508 2.036 0
            -7.180 5.014 0
            2.442 4.165 0
            7.922 3.685 0
            6.215 -4.849 0]]'/>
      </IndexedFaceSet>
    </Shape>
""")

P[13] = dict(profile='Immersive', prose="A hut six units tall stands upright on gently rolling ground.", intents=[], body="""
    <Viewpoint description='Site' position='10 6 34' orientation='1 0 0 -0.1'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.3 0.6 0.3'/>
      </Appearance>
      <ElevationGrid solid='false' xDimension='5' zDimension='5' xSpacing='5' zSpacing='5' creaseAngle='1.2'
          height='0 0.3 0.5 0.3 0   0.2 0.1 0 0.1 0.4   0.5 0 0 0 0.6   0.3 0.1 0 0.2 0.4   0 0.4 0.6 0.3 0'/>
    </Shape>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.9 0.9 0.9'/>
      </Appearance>
      <IndexedFaceSet solid='false' coordIndex='
          0 1 2 3 -1
          4 5 6 7 -1
          0 1 5 4 -1
          1 2 6 5 -1
          2 3 7 6 -1
          3 0 4 7 -1'>
        <Coordinate point='
[[            8 8 0
            12 8 0
            12 12 0
            8 12 0
            8 8 6
            12 8 6
            12 12 6
            8 12 6||            8 0 8
            12 0 8
            12 0 12
            8 0 12
            8 6 8
            12 6 8
            12 6 12
            8 6 12]]'/>
      </IndexedFaceSet>
    </Shape>
""")

P[14] = dict(profile='Immersive', prose="Two fence posts share one coat of green paint.", intents=[], body="""
    <Viewpoint description='Posts' position='0 0 7'/>
    <Transform translation='-1 0 0'>
      <Shape>
        <Appearance [[USE='Paint'/>||DEF='Paint'>
          <Material diffuseColor='0.1 0.6 0.2'/>
        </Appearance>]]
        <Cylinder height='2.5' radius='0.2'/>
      </Shape>
    </Transform>
    <Transform translation='1 0 0'>
      <Shape>
        <Appearance [[DEF='Paint'>
          <Material diffuseColor='0.1 0.6 0.2'/>
        </Appearance>||USE='Paint'/>]]
        <Cylinder height='2.5' radius='0.2'/>
      </Shape>
    </Transform>
""")

P[15] = dict(profile='Full', prose="Five survey marks are drawn as large dots, several pixels across, so they can be seen from the start view.", intents=[], body="""
    <Viewpoint description='Marks' position='0 0 10'/>
    <Shape>
      <Appearance>
        <Material emissiveColor='1 0.9 0.2'/>
        <PointProperties pointSizeScaleFactor='12' pointSizeMinValue='5'[[|| pointSizeMaxValue='100']]/>
      </Appearance>
      <PointSet>
        <Coordinate point='-2 -1 0  -1 1 0  0 0 0  1 1 0  2 -1 0'/>
      </PointSet>
    </Shape>
""")

P[16] = dict(profile='Immersive', prose="At night, with the headlight off and only a dim moon, the patterned water is nearly as dark as the rock beside it.", intents=[], body="""
    <NavigationInfo headlight='false'/>
    <Viewpoint description='Shore' position='0 4 10' orientation='1 0 0 -0.38'/>
    <DirectionalLight direction='0 -1 -0.3' intensity='0.08' global='true'/>
    <Transform translation='-2.5 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0.6 0.6'/>
        </Appearance>
        <Box size='4 0.4 4'/>
      </Shape>
    </Transform>
    <Transform translation='2.5 0 0'>
      <Shape>
        <Appearance>
[[||          <Material diffuseColor='1 1 1'/>
]]          <PixelTexture image='2 2 3 0x3060FF 0x80B0FF 0x80B0FF 0x3060FF'/>
        </Appearance>
        <Box size='4 0.4 4'/>
      </Shape>
    </Transform>
""")

D[1] = dict(profile='Immersive', prose="A thin grey slat hangs in space with one of its six faces painted blue.", intents=[], body="""
    <Viewpoint description='Slat' position='2.8 -3.2 9'/>
    <Group>
      <Transform translation='0 1.829 0'>
        <Transform center='0 -1.829 0' rotation='0 0 -1 1.5708' translation='1 -3.658 2'>
          <Transform center='0 -1.829 0' rotation='0 1 0 0'>
            <Shape>
              <Appearance>
                <Material/>
              </Appearance>
              <IndexedFaceSet colorPerVertex='false' solid='true' colorIndex='1 1 0 1 1 1'
                  coordIndex='0 1 2 3 -1 7 6 5 4 -1 0 4 5 1 -1 1 5 6 2 -1 2 6 7 3 -1 3 7 4 0 -1'>
                <Color color='0.86 0.86 0.86 0 0 1'/>
                <Coordinate point='-0.4 1.829 0.2 0.4 1.829 0.2 0.4 1.829 -0.2 -0.4 1.829 -0.2 -0.4 -1.829 0.2 0.4 -1.829 0.2 0.4 -1.829 -0.2 -0.4 -1.829 -0.2'/>
              </IndexedFaceSet>
            </Shape>
          </Transform>
        </Transform>
      </Transform>
    </Group>
""")

D[2] = dict(profile='Immersive', prose="Two overlapping bent sheets, each face in its own flat colour, are seen from both sides.", intents=[], body="""
    <Viewpoint description='Sheets' position='0 0.5 7'/>
    <Shape>
      <IndexedFaceSet solid='false' convex='false' colorPerVertex='false' coordIndex='0 1 2 3 -1 3 2 4 5 -1'>
        <ColorRGBA color='1 0 0 1  0 0.6 0 1'/>
        <Coordinate point='-2 -1 0  0 -1 0.8  0 1 0.8  -2 1 0  2 1 0  2 -1 0'/>
      </IndexedFaceSet>
    </Shape>
    <Shape>
      <IndexedFaceSet solid='false' convex='false' colorPerVertex='false' coordIndex='0 1 2 3 -1 3 2 4 5 -1'>
        <ColorRGBA color='0 0 1 1  1 0.8 0 1'/>
        <Coordinate point='-2 -1 0.8  0 -1 0  0 1 0  -2 1 0.8  2 1 0.8  2 -1 0.8'/>
      </IndexedFaceSet>
    </Shape>
""")

D[3] = dict(profile='Immersive', prose="A narrow spotlight shines along a row of three framed squares in an otherwise unlit gallery.", intents=[], body="""
    <NavigationInfo headlight='false'/>
    <Viewpoint description='Gallery' position='0 0 9'/>
    <SpotLight location='-5 0 1.5' direction='1 0 -0.3' beamWidth='0.2' cutOffAngle='0.4' radius='30' global='true'/>
    <Transform translation='-2.5 0 0'>
      <Shape DEF='Frame'>
        <Appearance>
          <Material diffuseColor='0.9 0.9 0.8'/>
        </Appearance>
        <Box size='1.6 1.6 0.05'/>
      </Shape>
    </Transform>
    <Transform translation='0 0 0'>
      <Shape USE='Frame'/>
    </Transform>
    <Transform translation='2.5 0 0'>
      <Shape USE='Frame'/>
    </Transform>
""")

D[4] = dict(profile='Immersive', prose="A visitor walking through the hall is stopped by one plain invisible wall instead of by every pillar of the ornate screen.", intents=[], body="""
    <NavigationInfo type='"WALK" "ANY"' avatarSize='0.25 1.6 0.75'/>
    <Viewpoint description='Hall' position='0 1.6 10'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.4 0.35 0.3'/>
      </Appearance>
      <Box size='30 0.1 30'/>
    </Shape>
    <Collision enabled='true'>
      <Transform DEF='Pillar' translation='-2 1.5 0'>
        <Shape>
          <Appearance DEF='Stone'>
            <Material diffuseColor='0.7 0.7 0.65'/>
          </Appearance>
          <Cylinder height='3' radius='0.2'/>
        </Shape>
      </Transform>
      <Transform translation='-1 1.5 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Cone height='3' bottomRadius='0.3'/>
        </Shape>
      </Transform>
      <Transform translation='0 1.5 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Cylinder height='3' radius='0.2'/>
        </Shape>
      </Transform>
      <Transform translation='1 1.5 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Cone height='3' bottomRadius='0.3'/>
        </Shape>
      </Transform>
      <Transform translation='2 1.5 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Cylinder height='3' radius='0.2'/>
        </Shape>
      </Transform>
      <Shape containerField='proxy'>
        <Box size='5 3 0.4'/>
      </Shape>
    </Collision>
""")

D[5] = dict(profile='Immersive', prose="A crate carries a tiny two-by-two red and yellow chequer pattern on every side.", intents=[], body="""
    <Viewpoint description='Crate' position='2 1.5 5' orientation='-0.57 0.81 0.15 0.5'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='1 1 1'/>
        <PixelTexture image='2 2 3 0xFF0000 0xFFFF00 0xFFFF00 0xFF0000'/>
      </Appearance>
      <Box size='2 2 2'/>
    </Shape>
""")

HELPER = doc('Immersive', "An L-shaped purple bracket, used as a part by another scene.", [], """
    <Shape>
      <Appearance DEF='BracketLook'>
        <Material diffuseColor='0.6 0 0.6' specularColor='0.8 0.8 0.8' shininess='0.15'/>
      </Appearance>
      <Box size='1.5 0.3 0.6'/>
    </Shape>
    <Transform translation='-0.6 0.75 0'>
      <Shape>
        <Appearance USE='BracketLook'/>
        <Box size='0.3 1.2 0.6'/>
      </Shape>
    </Transform>
""")

def main():
    for n, p in P.items():
        for w, name in (('f', 'fault'), ('t', 'twin')):
            open(os.path.join(OUT, '%s-%02d.x3d' % (name, n)), 'w').write(
                doc(p['profile'], p['prose'], p['intents'], split(p['body'], w)))
    for n, p in D.items():
        open(os.path.join(OUT, 'decoy-%02d.x3d' % n), 'w').write(doc(p['profile'], p['prose'], p['intents'], p['body']))
    open(os.path.join(OUT, 'helper-bracket.x3d'), 'w').write(HELPER)

if __name__ == '__main__':
    main()
