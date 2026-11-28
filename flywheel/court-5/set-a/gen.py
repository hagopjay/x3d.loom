#!/usr/bin/env python3
"""Generates fault-NN / twin-NN / decoy-NN / helper files for set a.
A body may contain [[fault text||twin text]] alternations; everything else is shared."""
import re, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
  <head>
%s  </head>
  <Scene>
%s
  </Scene>
</X3D>
"""

def mat(c):
    return "<Appearance><Material diffuseColor='%s'/></Appearance>" % c

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def doc(comps, prose, intents, body):
    h = ""
    for c in comps:
        h += "    <component name='%s' level='%d'/>\n" % c
    h += '    <meta name="intent:prose" content="%s"/>\n' % esc(prose)
    for i in intents:
        h += '    <meta name="intent" content="%s"/>\n' % esc(i)
    return HEAD % (h, body.strip("\n"))

def pick(body, which):
    return re.sub(r"\[\[(.*?)\|\|(.*?)\]\]", lambda m: m.group(1 if which == "fault" else 2), body, flags=re.S)

EU = ("EventUtilities", 1)
FO = ("Followers", 1)

PAIRS = {}

# 01 -------------------------------------------------------------------------
PAIRS[1] = dict(comps=[], prose="A lift platform that stands beside its shaft, five metres to the right of the origin, rides up two metres and back down again, over and over.",
 intents=["after 1.0s: Lift.translation[0] > 4.9"], body="""
    <Viewpoint description='Lift' position='5 1.5 12' centerOfRotation='5 1 0'/>
    <Transform translation='6.2 1.5 0'>
      <Shape>%s<Box size='0.4 5 1.5'/></Shape>
    </Transform>
    <Transform DEF='Lift' translation='5 0 0'>
      <Shape>%s<Box size='2 0.2 1.5'/></Shape>
    </Transform>
    <TimeSensor DEF='LiftClock' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='LiftPath' key='0 0.5 1' keyValue='[[0 0 0  0 2 0  0 0 0||5 0 0  5 2 0  5 0 0]]'/>
    <ROUTE fromNode='LiftClock' fromField='fraction_changed' toNode='LiftPath' toField='set_fraction'/>
    <ROUTE fromNode='LiftPath' fromField='value_changed' toNode='Lift' toField='translation'/>
""" % (mat('0.4 0.4 0.45'), mat('0.9 0.6 0.1')))

# 02 -------------------------------------------------------------------------
PAIRS[2] = dict(comps=[], prose="Pressing the round pad at the foot of the pole hoists the flag to the top of the pole in two seconds.",
 intents=[], body="""
    <Viewpoint description='Pole' position='0 2 10'/>
    <Transform translation='-0.6 2 0'>
      <Shape>%s<Cylinder radius='0.05' height='5'/></Shape>
    </Transform>
    <Transform DEF='Flag' translation='0 0 0'>
      <Shape>%s<Box size='1 0.6 0.02'/></Shape>
    </Transform>
    <Transform translation='0 2 2'>
      <TouchSensor DEF='Pad' description='hoist the flag'/>
      <Shape>%s<Sphere radius='0.5'/></Shape>
    </Transform>
    <TimeSensor DEF='Hoist' cycleInterval='2'/>
    <PositionInterpolator DEF='HoistPath' key='0 1' keyValue='0 0 0  0 4 0'/>
    <ROUTE fromNode='Pad' fromField='[[isActive||touchTime]]' toNode='Hoist' toField='startTime'/>
    <ROUTE fromNode='Hoist' fromField='fraction_changed' toNode='HoistPath' toField='set_fraction'/>
    <ROUTE fromNode='HoistPath' fromField='value_changed' toNode='Flag' toField='translation'/>
""" % (mat('0.7 0.7 0.7'), mat('0.8 0.1 0.1'), mat('0.1 0.6 0.2')))

# 03 -------------------------------------------------------------------------
PAIRS[3] = dict(comps=[EU], prose="Once started, the signal shows red, then amber, then green, each for an equal third of its three second run.",
 intents=["send SignalClock.startTime = now at 0.2s", "after 2.6s: Signal.whichChoice == 2"], body="""
    <Viewpoint description='Signal' position='0 0 6'/>
    <Switch DEF='Signal' whichChoice='0'>
      <Transform translation='0 1 0'><Shape>%s<Sphere radius='0.4'/></Shape></Transform>
      <Transform translation='0 0 0'><Shape>%s<Sphere radius='0.4'/></Shape></Transform>
      <Transform translation='0 -1 0'><Shape>%s<Sphere radius='0.4'/></Shape></Transform>
    </Switch>
    <Transform translation='2 0 0'>
      <TouchSensor DEF='StartButton' description='run the signal'/>
      <Shape>%s<Box size='0.6 0.6 0.6'/></Shape>
    </Transform>
    <TimeSensor DEF='SignalClock' cycleInterval='3'/>
    <IntegerSequencer DEF='Phase' key='[[0 0.5 1||0 0.3333 0.6667]]' keyValue='0 1 2'/>
    <ROUTE fromNode='StartButton' fromField='touchTime' toNode='SignalClock' toField='startTime'/>
    <ROUTE fromNode='SignalClock' fromField='fraction_changed' toNode='Phase' toField='set_fraction'/>
    <ROUTE fromNode='Phase' fromField='value_changed' toNode='Signal' toField='whichChoice'/>
""" % (mat('1 0 0'), mat('1 0.7 0'), mat('0 0.8 0.2'), mat('0.5 0.5 0.5')))

# 04 -------------------------------------------------------------------------
GATE_INNER = """      <ProximitySensor DEF='Doorway' size='6 4 8'/>
"""
PAIRS[4] = dict(comps=[], prose="When the visitor arrives at the gatehouse, twenty metres east of the start, its door slides upward out of the way.",
 intents=["send AtGate.set_bind = true at 0.3s", "after 3.0s: Door.translation changed"], body="""
    <Viewpoint DEF='Start' description='Start' position='0 1.6 30'/>
    <Viewpoint DEF='AtGate' description='At the gate' position='20 1.6 3'/>
    <Transform DEF='Gatehouse' translation='20 0 0'>
      <Transform translation='-2 1.5 0'><Shape>%s<Box size='1 3 1'/></Shape></Transform>
      <Transform translation='2 1.5 0'><Shape>%s<Box size='1 3 1'/></Shape></Transform>
      <Transform DEF='Door' translation='0 1.5 0'>
        <Shape>%s<Box size='3 3 0.2'/></Shape>
      </Transform>
[[||      <ProximitySensor DEF='Doorway' size='6 4 8'/>
]]    </Transform>
[[    <ProximitySensor DEF='Doorway' size='6 4 8'/>
||]]    <TimeSensor DEF='DoorClock' cycleInterval='1.5'/>
    <PositionInterpolator DEF='DoorPath' key='0 1' keyValue='0 1.5 0  0 4.5 0'/>
    <ROUTE fromNode='Doorway' fromField='enterTime' toNode='DoorClock' toField='startTime'/>
    <ROUTE fromNode='DoorClock' fromField='fraction_changed' toNode='DoorPath' toField='set_fraction'/>
    <ROUTE fromNode='DoorPath' fromField='value_changed' toNode='Door' toField='translation'/>
""" % (mat('0.6 0.6 0.55'), mat('0.6 0.6 0.55'), mat('0.45 0.3 0.15')))

# 05 -------------------------------------------------------------------------
PAIRS[5] = dict(comps=[], prose="One second after the plunger is pressed, the rocket lifts off and climbs for two seconds.",
 intents=["send Fuse.press = true at 0.2s", "after 0.8s: Rocket.translation unchanged", "after 3.0s: Rocket.translation changed"], body="""
    <Viewpoint description='Pad' position='0 3 14'/>
    <Transform DEF='Rocket'>
      <Shape>%s<Cone bottomRadius='0.5' height='2'/></Shape>
    </Transform>
    <Transform translation='3 -0.5 0'>
      <TouchSensor DEF='Plunger' description='light the fuse'/>
      <Shape>%s<Box size='0.8 0.8 0.8'/></Shape>
    </Transform>
    <Script DEF='Fuse'>
      <field name='press' type='SFBool' accessType='inputOnly'/>
      <field name='ignition' type='SFTime' accessType='outputOnly'/>
      <![CDATA[ecmascript:
function press (value, timestamp)
{
   if (value)
      ignition = [[Date .now ()||timestamp]] + 1;
}
]]>
    </Script>
    <TimeSensor DEF='Burn' cycleInterval='2'/>
    <PositionInterpolator DEF='Climb' key='0 1' keyValue='0 0 0  0 8 0'/>
    <ROUTE fromNode='Plunger' fromField='isActive' toNode='Fuse' toField='press'/>
    <ROUTE fromNode='Fuse' fromField='ignition' toNode='Burn' toField='startTime'/>
    <ROUTE fromNode='Burn' fromField='fraction_changed' toNode='Climb' toField='set_fraction'/>
    <ROUTE fromNode='Climb' fromField='value_changed' toNode='Rocket' toField='translation'/>
""" % (mat('0.9 0.9 0.95'), mat('0.8 0.2 0.1')))

# 06 -------------------------------------------------------------------------
PAIRS[6] = dict(comps=[], prose="The beacon head turns steadily about its mast from the moment the scene is loaded.",
 intents=["after 1.5s: Head.rotation changed"], body="""
    <Viewpoint description='Beacon' position='0 1 8'/>
    <Shape>%s<Cylinder radius='0.15' height='3'/></Shape>
    <Transform DEF='Head' translation='0 1.7 0'>
      <Shape>%s<Box size='1.2 0.4 0.4'/></Shape>
    </Transform>
    <TimeSensor DEF='BeaconClock' cycleInterval='4' loop='true'[[ stopTime='20'||]]/>
    <OrientationInterpolator DEF='Sweep' key='0 0.25 0.5 0.75 1' keyValue='0 1 0 0  0 1 0 1.5708  0 1 0 3.1416  0 1 0 4.7124  0 1 0 6.2832'/>
    <ROUTE fromNode='BeaconClock' fromField='fraction_changed' toNode='Sweep' toField='set_fraction'/>
    <ROUTE fromNode='Sweep' fromField='value_changed' toNode='Head' toField='rotation'/>
""" % (mat('0.5 0.5 0.5'), mat('1 0.8 0.1')))

# 07 -------------------------------------------------------------------------
R7 = "    <ROUTE fromNode='Swell' fromField='fraction_changed' toNode='Bob' toField='set_fraction'/>\n"
PAIRS[7] = dict(comps=[], prose="A buoy bobs gently up and down on the water without stopping.",
 intents=["after 1.0s: Buoy.translation changed"], body="""
    <Viewpoint description='Harbour' position='0 1 9'/>
    <Shape>%s<Box size='12 0.05 6'/></Shape>
    <TimeSensor DEF='Swell' cycleInterval='3' loop='true'/>
[[__R7__||]]    <PositionInterpolator DEF='Bob' key='0 0.5 1' keyValue='0 0.2 0  0 0.8 0  0 0.2 0'/>
    <Transform DEF='Buoy' translation='0 0.2 0'>
      <Shape>%s<Sphere radius='0.5'/></Shape>
    </Transform>
[[||__R7__]]    <ROUTE fromNode='Bob' fromField='value_changed' toNode='Buoy' toField='translation'/>
""".replace("__R7__", R7) % (mat('0.1 0.3 0.7'), mat('0.9 0.3 0.1')))

# 08 -------------------------------------------------------------------------
PAIRS[8] = dict(comps=[FO], prose="The hall lamp burns at full strength until the wall plate is pressed, then fades smoothly down to a fifth of its strength over two seconds.",
 intents=["send Fade.set_destination = 0.2 at 0.2s", "after 0.7s: HallLamp.intensity > 0.5", "after 3.2s: HallLamp.intensity < 0.3"], body="""
    <Viewpoint description='Hall' position='0 1.5 9'/>
    <NavigationInfo headlight='false'/>
    <PointLight DEF='HallLamp' location='0 3 2' intensity='1'/>
    <Shape>%s<Box size='8 0.1 6'/></Shape>
    <Transform translation='-2 1.2 0'>
      <TouchSensor DEF='WallPlate' description='dim the lamp'/>
      <Shape>%s<Box size='0.5 0.8 0.1'/></Shape>
    </Transform>
    <Script DEF='DimLevel'>
      <field name='press' type='SFBool' accessType='inputOnly'/>
      <field name='level' type='SFFloat' accessType='outputOnly'/>
      <![CDATA[ecmascript:
function press (value)
{
   if (value)
      level = 0.2;
}
]]>
    </Script>
    <ScalarChaser DEF='Fade' duration='2'[[|| initialValue='1' initialDestination='1']]/>
    <ROUTE fromNode='WallPlate' fromField='isActive' toNode='DimLevel' toField='press'/>
    <ROUTE fromNode='DimLevel' fromField='level' toNode='Fade' toField='set_destination'/>
    <ROUTE fromNode='Fade' fromField='value_changed' toNode='HallLamp' toField='intensity'/>
""" % (mat('0.8 0.8 0.75'), mat('0.9 0.9 0.9')))

# 09 -------------------------------------------------------------------------
PAIRS[9] = dict(comps=[], prose="Holding the pointer button down anywhere on the cabinet, its drawer front included, switches the cabinet lamp on for as long as it is held; merely hovering over the drawer front makes the drawer glow.",
 intents=[], body="""
    <Viewpoint description='Cabinet' position='0 0 8'/>
    <PointLight DEF='CabinetLamp' on='false' location='0 3 3'/>
    <PointLight DEF='DrawerGlow' on='false' location='0 0 2' color='1 0.8 0.4'/>
    <Group DEF='Cabinet'>
      <TouchSensor DEF='CabinetTouch' description='cabinet lamp'/>
      <Shape>%s<Box size='3 4 1'/></Shape>
      <Transform DEF='Drawer' translation='0 0 0.6'>
        <TouchSensor DEF='DrawerHover' description='drawer'/>
        <Shape>%s<Box size='2 1 0.2'/></Shape>
      </Transform>
    </Group>
    <ROUTE fromNode='CabinetTouch' fromField='isActive' toNode='CabinetLamp' toField='on'/>
    <ROUTE fromNode='DrawerHover' fromField='isOver' toNode='DrawerGlow' toField='on'/>
[[||    <ROUTE fromNode='DrawerHover' fromField='isActive' toNode='CabinetLamp' toField='on'/>
]]""" % (mat('0.5 0.35 0.2'), mat('0.7 0.55 0.35')))

# 10 -------------------------------------------------------------------------
PAIRS[10] = dict(comps=[EU], prose="The green button switches the work lamp on and the red button switches it off.",
 intents=["send TurnOff.set_triggerTime = now at 0.3s", "after 1.0s: WorkLamp.on changed"], body="""
    <Viewpoint description='Bench' position='0 1 8'/>
    <NavigationInfo headlight='false'/>
    <PointLight DEF='WorkLamp' on='true' location='0 3 2'/>
    <Shape>%s<Box size='6 0.2 3'/></Shape>
    <Transform translation='-1 0.6 0'>
      <TouchSensor DEF='GreenButton' description='lamp on'/>
      <Shape>%s<Cylinder radius='0.3' height='0.2'/></Shape>
    </Transform>
    <Transform translation='1 0.6 0'>
      <TouchSensor DEF='RedButton' description='lamp off'/>
      <Shape>%s<Cylinder radius='0.3' height='0.2'/></Shape>
    </Transform>
    <BooleanTrigger DEF='TurnOn'/>
    <BooleanTrigger DEF='TurnOff'/>
[[||    <BooleanFilter DEF='Invert'/>
]]    <ROUTE fromNode='GreenButton' fromField='touchTime' toNode='TurnOn' toField='set_triggerTime'/>
    <ROUTE fromNode='TurnOn' fromField='triggerTrue' toNode='WorkLamp' toField='on'/>
    <ROUTE fromNode='RedButton' fromField='touchTime' toNode='TurnOff' toField='set_triggerTime'/>
[[    <ROUTE fromNode='TurnOff' fromField='triggerTrue' toNode='WorkLamp' toField='on'/>
||    <ROUTE fromNode='TurnOff' fromField='triggerTrue' toNode='Invert' toField='set_boolean'/>
    <ROUTE fromNode='Invert' fromField='inputNegate' toNode='WorkLamp' toField='on'/>
]]""" % (mat('0.6 0.5 0.4'), mat('0 0.7 0.1'), mat('0.8 0 0')))

# 11 -------------------------------------------------------------------------
PAIRS[11] = dict(comps=[], prose="The blades of the desk fan, which is loaded from its own file, spin continuously.",
 intents=[], body="""
    <Viewpoint description='Desk' position='0 1 6'/>
    <Inline DEF='Fan' url='"helper-fan.x3d"'/>
[[||    <IMPORT inlineDEF='Fan' importedDEF='Blades'/>
]]    <TimeSensor DEF='FanClock' cycleInterval='1' loop='true'/>
    <OrientationInterpolator DEF='Spin' key='0 0.25 0.5 0.75 1' keyValue='0 0 1 0  0 0 1 1.5708  0 0 1 3.1416  0 0 1 4.7124  0 0 1 6.2832'/>
    <ROUTE fromNode='FanClock' fromField='fraction_changed' toNode='Spin' toField='set_fraction'/>
    <ROUTE fromNode='Spin' fromField='value_changed' toNode='Blades' toField='rotation'/>
""")

# 12 -------------------------------------------------------------------------
PAIRS[12] = dict(comps=[], prose="A marker glides round and round the four corners of a square track in one smooth, unbroken circuit.",
 intents=[], body="""
    <Viewpoint description='Track' position='0 8 8' orientation='1 0 0 -0.7854'/>
    <Shape>%s<Box size='5 0.05 5'/></Shape>
    <Transform DEF='Marker' translation='2 0.3 2'>
      <Shape>%s<Sphere radius='0.3'/></Shape>
    </Transform>
    <TimeSensor DEF='Lap' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='Circuit' [[key='0 0.3333 0.6667 1' keyValue='2 0.3 2  2 0.3 -2  -2 0.3 -2  -2 0.3 2'||key='0 0.25 0.5 0.75 1' keyValue='2 0.3 2  2 0.3 -2  -2 0.3 -2  -2 0.3 2  2 0.3 2']]/>
    <ROUTE fromNode='Lap' fromField='fraction_changed' toNode='Circuit' toField='set_fraction'/>
    <ROUTE fromNode='Circuit' fromField='value_changed' toNode='Marker' toField='translation'/>
""" % (mat('0.3 0.3 0.3'), mat('1 0.9 0.1')))

# 13 -------------------------------------------------------------------------
PAIRS[13] = dict(comps=[], prose="A reusable sweep clock is given a period of three seconds, so that when it is started the barrier arm swings slowly up through a quarter turn, taking three seconds over it.",
 intents=["send Drive.startTime = now at 0.2s", "after 1.4s: Arm.rotation[3] < 1.0", "after 3.8s: Arm.rotation[3] > 1.5"], body="""
    <ProtoDeclare name='SweepClock'>
      <ProtoInterface>
        <field name='period' type='SFTime' accessType='initializeOnly' value='1'/>
        <field name='startTime' type='SFTime' accessType='inputOutput' value='0'/>
        <field name='fraction' type='SFFloat' accessType='outputOnly'/>
      </ProtoInterface>
      <ProtoBody>
        <TimeSensor DEF='Ticker'>
          <IS>
[[||            <connect nodeField='cycleInterval' protoField='period'/>
]]            <connect nodeField='startTime' protoField='startTime'/>
            <connect nodeField='fraction_changed' protoField='fraction'/>
          </IS>
        </TimeSensor>
      </ProtoBody>
    </ProtoDeclare>
    <Viewpoint description='Barrier' position='0 1 9'/>
    <Transform translation='-2 0.5 0'><Shape>%s<Box size='0.3 1 0.3'/></Shape></Transform>
    <Transform DEF='Arm' translation='-2 1 0' center='0 0 0'>
      <Transform translation='2 0 0'><Shape>%s<Box size='4 0.15 0.15'/></Shape></Transform>
    </Transform>
    <ProtoInstance DEF='Drive' name='SweepClock'>
      <fieldValue name='period' value='3'/>
    </ProtoInstance>
    <Transform translation='-2 0.5 1'>
      <TouchSensor DEF='Ticket' description='raise the barrier'/>
      <Shape>%s<Box size='0.4 0.4 0.4'/></Shape>
    </Transform>
    <OrientationInterpolator DEF='Swing' key='0 1' keyValue='0 0 1 0  0 0 1 1.5708'/>
    <ROUTE fromNode='Ticket' fromField='touchTime' toNode='Drive' toField='startTime'/>
    <ROUTE fromNode='Drive' fromField='fraction' toNode='Swing' toField='set_fraction'/>
    <ROUTE fromNode='Swing' fromField='value_changed' toNode='Arm' toField='rotation'/>
""" % (mat('0.4 0.4 0.4'), mat('0.9 0.1 0.1'), mat('0.2 0.5 0.9')))

# 14 -------------------------------------------------------------------------
PAIRS[14] = dict(comps=[EU], prose="The shuttle runs back and forth; the red button freezes it where it is and lights the warning lamp, and the green button lets it carry on from that spot and puts the lamp out.",
 intents=["send FreezeNow.set_boolean = true at 0.3s", "send CarryOn.set_boolean = true at 0.9s", "after 1.6s: WarningLamp.on unchanged"], body="""
    <Viewpoint description='Shuttle' position='0 0 10'/>
    <PointLight DEF='WarningLamp' on='false' color='1 0.2 0.2' location='0 2 2'/>
    <Transform DEF='Shuttle' translation='-3 0 0'>
      <Shape>%s<Box size='1 0.6 0.6'/></Shape>
    </Transform>
    <Transform translation='-1 -2 0'>
      <TouchSensor DEF='RedButton' description='freeze'/>
      <Shape>%s<Sphere radius='0.35'/></Shape>
    </Transform>
    <Transform translation='1 -2 0'>
      <TouchSensor DEF='GreenButton' description='carry on'/>
      <Shape>%s<Sphere radius='0.35'/></Shape>
    </Transform>
    <TimeSensor DEF='Run' cycleInterval='6' loop='true'/>
    <PositionInterpolator DEF='Track' key='0 0.5 1' keyValue='-3 0 0  3 0 0  -3 0 0'/>
    <BooleanFilter DEF='RedPressed'/>
    <TimeTrigger DEF='FreezeNow'/>
    <BooleanFilter DEF='GreenPressed'/>
    <TimeTrigger DEF='CarryOn'/>
    <ROUTE fromNode='Run' fromField='fraction_changed' toNode='Track' toField='set_fraction'/>
    <ROUTE fromNode='Track' fromField='value_changed' toNode='Shuttle' toField='translation'/>
    <ROUTE fromNode='RedButton' fromField='isActive' toNode='RedPressed' toField='set_boolean'/>
    <ROUTE fromNode='RedPressed' fromField='inputTrue' toNode='FreezeNow' toField='set_boolean'/>
    <ROUTE fromNode='FreezeNow' fromField='triggerTime' toNode='Run' toField='pauseTime'/>
    <ROUTE fromNode='GreenButton' fromField='isActive' toNode='GreenPressed' toField='set_boolean'/>
    <ROUTE fromNode='GreenPressed' fromField='inputTrue' toNode='CarryOn' toField='set_boolean'/>
    <ROUTE fromNode='CarryOn' fromField='triggerTime' toNode='Run' toField='[[startTime||resumeTime]]'/>
    <ROUTE fromNode='Run' fromField='isPaused' toNode='WarningLamp' toField='on'/>
""" % (mat('0.2 0.4 0.9'), mat('0.9 0.1 0.1'), mat('0.1 0.8 0.2')))

# 15 -------------------------------------------------------------------------
PAIRS[15] = dict(comps=[], prose="The wheel turns only while the lever is held down with the pointer, and stands still otherwise.",
 intents=[], body="""
    <Viewpoint description='Workshop' position='0 0 8'/>
    <Transform DEF='Wheel' translation='-2.5 0 0'>
      <Shape>%s<Box size='1.6 1.6 0.2'/></Shape>
    </Transform>
    <Transform translation='0 0 0'>
      <TouchSensor DEF='Lever' description='hold to turn the wheel'/>
      <Shape>%s<Box size='0.6 1.4 0.4'/></Shape>
    </Transform>
    <TimeSensor DEF='Motor' cycleInterval='2' loop='true' enabled='false'/>
    <OrientationInterpolator DEF='Turn' key='0 0.25 0.5 0.75 1' keyValue='0 0 1 0  0 0 1 1.5708  0 0 1 3.1416  0 0 1 4.7124  0 0 1 6.2832'/>
    <ROUTE fromNode='Lever' fromField='isActive' toNode='Motor' toField='[[isActive||enabled]]'/>
    <ROUTE fromNode='Motor' fromField='fraction_changed' toNode='Turn' toField='set_fraction'/>
    <ROUTE fromNode='Turn' fromField='value_changed' toNode='Wheel' toField='rotation'/>
""" % (mat('0.3 0.6 0.8'), mat('0.8 0.6 0.1')))

# 16 -------------------------------------------------------------------------
PAIRS[16] = dict(comps=[EU], prose="Clicking the plaque carries the visitor from the far overview to the close-up position in front of the plaque, where the reading zone switches the reading light on.",
 intents=["send GoClose.set_triggerTime = now at 0.3s", "after 3.0s: ReadingLight.on changed"], body="""
    <Viewpoint DEF='Overview' description='Overview' position='0 2 20'/>
    <Viewpoint DEF='CloseUp' description='Close-up' position='0 1.5 2.5'[[ jump='false'||]]/>
    <SpotLight DEF='ReadingLight' on='false' location='0 3 2' direction='0 -0.6 -1' cutOffAngle='0.6' beamWidth='0.4'/>
    <Transform translation='0 1.5 0'>
      <TouchSensor DEF='PlaqueTouch' description='read the plaque'/>
      <Shape>%s<Box size='1.2 0.8 0.05'/></Shape>
    </Transform>
    <Transform translation='0 0.5 -0.3'>
      <Shape>%s<Box size='1.6 1 0.4'/></Shape>
    </Transform>
    <ProximitySensor DEF='ReadingZone' center='0 1.5 2' size='4 3 4'/>
    <BooleanTrigger DEF='GoClose'/>
    <ROUTE fromNode='PlaqueTouch' fromField='touchTime' toNode='GoClose' toField='set_triggerTime'/>
    <ROUTE fromNode='GoClose' fromField='triggerTrue' toNode='CloseUp' toField='set_bind'/>
    <ROUTE fromNode='ReadingZone' fromField='isActive' toNode='ReadingLight' toField='on'/>
""" % (mat('0.8 0.7 0.3'), mat('0.5 0.5 0.5')))

# 17 -------------------------------------------------------------------------
PAIRS[17] = dict(comps=[EU], prose="When started, the gate first rises for a second and a half; only once the gate has finished rising does the cart roll through, taking one second.",
 intents=["send Raise.startTime = now at 0.2s", "after 1.0s: Cart.translation unchanged", "after 3.4s: Cart.translation[0] > 3.9"], body="""
    <Viewpoint description='Crossing' position='0 1 12'/>
    <Transform DEF='Gate' translation='0 0 0'>
      <Shape>%s<Box size='0.2 2 2'/></Shape>
    </Transform>
    <Transform DEF='Cart' translation='-4 0 0'>
      <Shape>%s<Box size='1 0.6 0.8'/></Shape>
    </Transform>
    <Transform translation='0 -2 2'>
      <TouchSensor DEF='GoButton' description='start'/>
      <Shape>%s<Sphere radius='0.3'/></Shape>
    </Transform>
    <TimeSensor DEF='Raise' cycleInterval='1.5'/>
    <PositionInterpolator DEF='GatePath' key='0 1' keyValue='0 0 0  0 2.5 0'/>
    <TimeSensor DEF='Roll' cycleInterval='1'/>
    <PositionInterpolator DEF='CartPath' key='0 1' keyValue='-4 0 0  4 0 0'/>
[[||    <BooleanFilter DEF='Risen'/>
]]    <TimeTrigger DEF='Next'/>
    <ROUTE fromNode='GoButton' fromField='touchTime' toNode='Raise' toField='startTime'/>
    <ROUTE fromNode='Raise' fromField='fraction_changed' toNode='GatePath' toField='set_fraction'/>
    <ROUTE fromNode='GatePath' fromField='value_changed' toNode='Gate' toField='translation'/>
[[    <ROUTE fromNode='Raise' fromField='isActive' toNode='Next' toField='set_boolean'/>
||    <ROUTE fromNode='Raise' fromField='isActive' toNode='Risen' toField='set_boolean'/>
    <ROUTE fromNode='Risen' fromField='inputNegate' toNode='Next' toField='set_boolean'/>
]]    <ROUTE fromNode='Next' fromField='triggerTime' toNode='Roll' toField='startTime'/>
    <ROUTE fromNode='Roll' fromField='fraction_changed' toNode='CartPath' toField='set_fraction'/>
    <ROUTE fromNode='CartPath' fromField='value_changed' toNode='Cart' toField='translation'/>
""" % (mat('0.7 0.7 0.2'), mat('0.2 0.5 0.8'), mat('0.1 0.7 0.2')))

# 18 -------------------------------------------------------------------------
PAIRS[18] = dict(comps=[], prose="Each press of the button nudges the crate one metre further to the right.",
 intents=["send Mover.nudge = true at 0.3s", "after 1.0s: Crate.translation changed"], body="""
    <Viewpoint description='Floor' position='0 1 10'/>
    <Transform DEF='Crate' translation='-3 0 0'>
      <Shape>%s<Box size='1 1 1'/></Shape>
    </Transform>
    <Transform translation='0 -2 0'>
      <TouchSensor DEF='Button' description='nudge the crate'/>
      <Shape>%s<Sphere radius='0.4'/></Shape>
    </Transform>
    <Script DEF='Mover' directOutput='true'>
      <field name='nudge' type='SFBool' accessType='inputOnly'/>
[[      <field name='target' type='SFNode' accessType='initializeOnly' value='Crate'/>
||      <field name='target' type='SFNode' accessType='initializeOnly'>
        <Transform USE='Crate'/>
      </field>
]]      <![CDATA[ecmascript:
function nudge (value)
{
   if (value)
      target .translation = new SFVec3f (target .translation .x + 1, 0, 0);
}
]]>
    </Script>
    <ROUTE fromNode='Button' fromField='isActive' toNode='Mover' toField='nudge'/>
""" % (mat('0.6 0.4 0.2'), mat('0.2 0.6 0.9')))

# 19 -------------------------------------------------------------------------
PAIRS[19] = dict(comps=[], prose="The magnet can be dragged about the board, and every new drag carries on from wherever the magnet was left by the drag before.",
 intents=[], body="""
    <Viewpoint description='Board' position='0 0 10'/>
    <Transform translation='0 0 -0.2'>
      <Shape>%s<Box size='8 5 0.1'/></Shape>
    </Transform>
    <Group>
      <PlaneSensor DEF='Drag' description='drag the magnet'[[ autoOffset='false'||]] minPosition='-3.5 -2' maxPosition='3.5 2'/>
      <Transform DEF='Magnet'>
        <Shape>%s<Box size='1 1 0.2'/></Shape>
      </Transform>
    </Group>
    <ROUTE fromNode='Drag' fromField='translation_changed' toNode='Magnet' toField='translation'/>
""" % (mat('0.9 0.9 0.9'), mat('0.8 0.1 0.1')))

# 20 -------------------------------------------------------------------------
PAIRS[20] = dict(comps=[], prose="As soon as the part file has finished loading, the turntable under it makes one slow full turn.",
 intents=["after 2.5s: Turntable.rotation changed"], body="""
    <Viewpoint description='Turntable' position='0 2 8'/>
    <Transform DEF='Turntable'>
      <Shape>%s<Cylinder radius='2' height='0.2'/></Shape>
      <Inline DEF='Part' url='"helper-part.x3d"'/>
    </Transform>
[[    <LoadSensor DEF='PartReady'/>
||    <LoadSensor DEF='PartReady'>
      <Inline USE='Part'/>
    </LoadSensor>
]]    <TimeSensor DEF='TableClock' cycleInterval='8'/>
    <OrientationInterpolator DEF='Revolve' key='0 0.25 0.5 0.75 1' keyValue='0 1 0 0  0 1 0 1.5708  0 1 0 3.1416  0 1 0 4.7124  0 1 0 6.2832'/>
    <ROUTE fromNode='PartReady' fromField='loadTime' toNode='TableClock' toField='startTime'/>
    <ROUTE fromNode='TableClock' fromField='fraction_changed' toNode='Revolve' toField='set_fraction'/>
    <ROUTE fromNode='Revolve' fromField='value_changed' toNode='Turntable' toField='rotation'/>
""" % (mat('0.5 0.5 0.55'),))

# decoys ---------------------------------------------------------------------
DECOYS = {}
DECOYS[1] = dict(comps=[], prose="A lead ball slides from side to side while changing colour, and a second ball below copies every move the lead ball makes.",
 intents=["after 1.2s: Follower.translation changed"], body="""
    <Viewpoint description='Pair' position='0 0 10'/>
    <TimeSensor DEF='Clock' cycleInterval='3' loop='true'/>
    <PositionInterpolator DEF='Slide' key='0 0.5 1' keyValue='-3 0 0  3 0 0  -3 0 0'/>
    <ColorInterpolator DEF='Tint' key='0 0.5 1' keyValue='1 0 0  0 0 1  1 0 0'/>
    <Transform translation='0 1 0'>
      <Transform DEF='Leader'>
        <Shape><Appearance><Material DEF='LeadPaint' diffuseColor='1 0 0'/></Appearance><Sphere radius='0.5'/></Shape>
        <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='Slide' toField='set_fraction'/>
        <ROUTE fromNode='Clock' fromField='fraction_changed' toNode='Tint' toField='set_fraction'/>
      </Transform>
    </Transform>
    <Transform translation='0 -1 0'>
      <Transform DEF='Follower'>
        <Shape>%s<Sphere radius='0.5'/></Shape>
      </Transform>
    </Transform>
    <ROUTE fromNode='Slide' fromField='value_changed' toNode='Leader' toField='set_translation'/>
    <ROUTE fromNode='Tint' fromField='value_changed' toNode='LeadPaint' toField='set_diffuseColor'/>
    <ROUTE fromNode='Leader' fromField='translation_changed' toNode='Follower' toField='set_translation'/>
""" % (mat('0.6 0.6 0.6'),))

DECOYS[2] = dict(comps=[], prose="A rotor spins quickly and without pause about its vertical axle, two full turns every second.",
 intents=["after 0.8s: Rotor.rotation changed"], body="""
    <Viewpoint description='Rotor' position='0 1 6'/>
    <Transform DEF='Rotor'>
      <Shape>%s<Box size='3 0.1 0.4'/></Shape>
      <TimeSensor DEF='RotorClock' cycleInterval='0.5' loop='true' startTime='-1' stopTime='-1'/>
      <OrientationInterpolator DEF='RotorSpin' key='0 0.3333 0.6667 1' keyValue='0 1 0 0  0 1 0 2.0944  0 1 0 4.1888  0 1 0 6.2832'/>
      <ROUTE fromNode='RotorClock' fromField='fraction_changed' toNode='RotorSpin' toField='set_fraction'/>
      <ROUTE fromNode='RotorSpin' fromField='value_changed' toNode='Rotor' toField='rotation'/>
    </Transform>
""" % (mat('0.2 0.7 0.7'),))

DECOYS[3] = dict(comps=[EU], prose="Each press of the pull cord flips the ceiling lamp: on if it was off, off if it was on; letting go of the cord does nothing.",
 intents=["send Flip.set_boolean = true at 0.2s", "send Flip.set_boolean = false at 0.5s", "after 1.0s: CeilingLamp.on changed"], body="""
    <Viewpoint description='Room' position='0 1 8'/>
    <NavigationInfo headlight='false'/>
    <PointLight DEF='CeilingLamp' on='false' location='0 3 1'/>
    <DirectionalLight intensity='0.2' direction='0 -1 -1'/>
    <Shape>%s<Box size='6 0.1 4'/></Shape>
    <Transform translation='1 1.5 0'>
      <TouchSensor DEF='Cord' description='pull the cord'/>
      <Shape>%s<Cylinder radius='0.05' height='3'/></Shape>
    </Transform>
    <BooleanToggle DEF='Flip'/>
    <ROUTE fromNode='Cord' fromField='isActive' toNode='Flip' toField='set_boolean'/>
    <ROUTE fromNode='Flip' fromField='toggle' toNode='CeilingLamp' toField='on'/>
""" % (mat('0.7 0.7 0.7'), mat('0.9 0.9 0.8')))

DECOYS[4] = dict(comps=[EU], prose="Nothing is shown until the flip-book is started; it then steps through frames one, two, three, two, one, a fifth of its four second run each, ending on frame one.",
 intents=["send FlipClock.startTime = now at 0.2s", "after 2.2s: Frames.whichChoice == 2", "after 3.4s: Frames.whichChoice == 1"], body="""
    <Viewpoint description='Flip-book' position='0 0 6'/>
    <Switch DEF='Frames' whichChoice='-1'>
      <Shape>%s<Box size='1 1 1'/></Shape>
      <Shape>%s<Cone bottomRadius='0.7' height='1.4'/></Shape>
      <Shape>%s<Sphere radius='0.7'/></Shape>
    </Switch>
    <Transform translation='0 -2 0'>
      <TouchSensor DEF='Play' description='play'/>
      <Shape>%s<Box size='1 0.3 0.3'/></Shape>
    </Transform>
    <TimeSensor DEF='FlipClock' cycleInterval='4'/>
    <IntegerSequencer DEF='Page' key='0 0.2 0.4 0.6 0.8 1' keyValue='0 1 2 1 0 0'/>
    <ROUTE fromNode='Play' fromField='touchTime' toNode='FlipClock' toField='set_startTime'/>
    <ROUTE fromNode='FlipClock' fromField='fraction_changed' toNode='Page' toField='set_fraction'/>
    <ROUTE fromNode='Page' fromField='value_changed' toNode='Frames' toField='set_whichChoice'/>
""" % (mat('0.9 0.3 0.3'), mat('0.3 0.9 0.3'), mat('0.3 0.3 0.9'), mat('0.5 0.5 0.5')))

DECOYS[5] = dict(comps=[], prose="A level controller stretches the gauge bar to the height it is told, working directly on the bar it was handed.",
 intents=["send Controller.set_level = 2 at 0.2s", "after 1.0s: Bar.scale[1] > 1.9"], body="""
    <Viewpoint description='Gauge' position='0 1 8'/>
    <Transform DEF='Bar' center='0 -0.5 0'>
      <Shape>%s<Box size='0.5 1 0.5'/></Shape>
    </Transform>
    <Script DEF='Controller' directOutput='true'>
      <field name='set_level' type='SFFloat' accessType='inputOnly'/>
      <field name='level_changed' type='SFFloat' accessType='outputOnly'/>
      <field name='bar' type='SFNode' accessType='initializeOnly'>
        <Transform USE='Bar'/>
      </field>
      <![CDATA[ecmascript:
function set_level (value)
{
   if (value < 0.1) value = 0.1;
   bar .scale = new SFVec3f (1, value, 1);
   level_changed = value;
}
]]>
    </Script>
    <Transform DEF='Needle' translation='1.5 0 0'>
      <Shape>%s<Sphere radius='0.2'/></Shape>
    </Transform>
    <ScalarInterpolator DEF='Ramp' key='0 1' keyValue='0.5 3'/>
    <TimeSensor DEF='Sweep' cycleInterval='5'/>
    <ROUTE fromNode='Sweep' fromField='fraction_changed' toNode='Ramp' toField='set_fraction'/>
    <ROUTE fromNode='Ramp' fromField='value_changed' toNode='Controller' toField='set_level'/>
""" % (mat('0.2 0.8 0.3'), mat('0.9 0.9 0.2')))

HELPERS = {
"helper-fan.x3d": doc([], "Helper: a desk fan whose blade assembly is offered to the scene that loads it.", [], """
    <Transform translation='0 0.2 0'>
      <Shape>%s<Cylinder radius='0.1' height='1.6'/></Shape>
    </Transform>
    <Transform DEF='Blades' translation='0 1.2 0.2'>
      <Shape>%s<Box size='1.8 0.2 0.05'/></Shape>
      <Shape>%s<Box size='0.2 1.8 0.05'/></Shape>
    </Transform>
    <EXPORT localDEF='Blades'/>
""" % (mat('0.4 0.4 0.4'), mat('0.8 0.8 0.9'), mat('0.8 0.8 0.9'))),
"helper-part.x3d": doc([], "Helper: a machined part shown on a turntable.", [], """
    <Transform translation='0 0.8 0'>
      <Shape>%s<Cone bottomRadius='0.8' height='1.4'/></Shape>
    </Transform>
""" % (mat('0.8 0.5 0.2'),)),
}

def w(name, text):
    with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
        f.write(text)

for n, p in PAIRS.items():
    w("fault-%02d.x3d" % n, doc(p["comps"], p["prose"], p["intents"], pick(p["body"], "fault")))
    w("twin-%02d.x3d" % n, doc(p["comps"], p["prose"], p["intents"], pick(p["body"], "twin")))
for n, p in DECOYS.items():
    w("decoy-%02d.x3d" % n, doc(p["comps"], p["prose"], p["intents"], p["body"]))
for name, text in HELPERS.items():
    w(name, text)
print("wrote", 2 * len(PAIRS), "pair files,", len(DECOYS), "decoys,", len(HELPERS), "helpers")
