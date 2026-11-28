#!/usr/bin/env python3
"""Generator for the sealed set. Each pair is one template; the fault and the twin
differ only in the @n@ slots, so the twin is the fault with only the mistake fixed."""
import os, sys

OUT = os.path.dirname(os.path.abspath(__file__))

def doc(desc, body, profile='Immersive', components=()):
    comp = ''.join("    <component name='%s' level='%s'/>\n" % c for c in components)
    return ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            "<X3D profile='%s' version='4.0'>\n"
            "  <head>\n%s"
            "    <meta name='description' content=\"%s\"/>\n"
            "  </head>\n"
            "  <Scene>\n%s"
            "  </Scene>\n"
            "</X3D>\n") % (profile, comp, desc, body)

PAIRS = {}

def pair(n, desc, body, fault, twin, profile='Immersive', components=(), fault_components=None):
    PAIRS[n] = (desc, body, fault, twin, profile, components, fault_components)

def fill(body, slots):
    for k, v in slots.items():
        body = body.replace('@%s@' % k, v)
    assert '@' not in body.replace('@@', ''), body
    return body

# ---------------------------------------------------------------- 01
pair(1, "A ball that pulses: it swells to one and a half times its size and shrinks back, once every two seconds, forever.",
"""    <Viewpoint description='Front' position='0 0 8'/>
    <Transform DEF='PulsingBall'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.9 0.3 0.2'/>
        </Appearance>
        <Sphere/>
      </Shape>
    </Transform>
    <TimeSensor DEF='PulseClock' cycleInterval='2' loop='true'/>
    @1@
    <ROUTE fromNode='PulseClock' fromField='fraction_changed' toNode='PulseSize' toField='set_fraction'/>
    <ROUTE fromNode='PulseSize' fromField='value_changed' toNode='PulsingBall' toField='set_scale'/>
""",
{'1': "<ScalarInterpolator DEF='PulseSize' key='0 0.5 1' keyValue='1 1.5 1'/>"},
{'1': "<PositionInterpolator DEF='PulseSize' key='0 0.5 1' keyValue='1 1 1 1.5 1.5 1.5 1 1 1'/>"})

# ---------------------------------------------------------------- 02
pair(2, "A crate that grows from a small cube into a pillar four times as tall over four seconds, then starts again.",
"""    <Viewpoint description='Front' position='0 1.5 12'/>
    <Transform DEF='Crate'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0.4 0.2'/>
        </Appearance>
        <Box DEF='CrateBox' size='1 1 1'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='GrowClock' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='GrowSize' key='0 1' keyValue='1 1 1 1 4 1'/>
    <ROUTE fromNode='GrowClock' fromField='fraction_changed' toNode='GrowSize' toField='set_fraction'/>
    <ROUTE fromNode='GrowSize' fromField='value_changed' @1@/>
""",
{'1': "toNode='CrateBox' toField='size'"},
{'1': "toNode='Crate' toField='scale'"})

# ---------------------------------------------------------------- 03
pair(3, "A windmill whose blades keep turning, one turn every six seconds, for as long as the scene is open.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='Tower' translation='0 -2 -0.3'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.8 0.7'/>
        </Appearance>
        <Cylinder height='4' radius='0.3'/>
      </Shape>
    </Transform>
    <Transform DEF='Blades'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.3 0.1'/>
        </Appearance>
        <Box size='4 0.3 0.1'/>
      </Shape>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.3 0.1'/>
        </Appearance>
        <Box size='0.3 4 0.1'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='BladeClock' cycleInterval='6'@1@/>
    <OrientationInterpolator DEF='BladeTurn' key='0 0.25 0.5 0.75 1' keyValue='0 0 1 0 0 0 1 1.5708 0 0 1 3.1416 0 0 1 4.7124 0 0 1 6.2832'/>
    <ROUTE fromNode='BladeClock' fromField='fraction_changed' toNode='BladeTurn' toField='set_fraction'/>
    <ROUTE fromNode='BladeTurn' fromField='value_changed' toNode='Blades' toField='set_rotation'/>
""",
{'1': ""},
{'1': " loop='true'"})

# ---------------------------------------------------------------- 04
pair(4, "A warning beacon that flashes: it goes from dark to bright red and back once every half second.",
"""    <Viewpoint description='Front' position='0 0 6'/>
    <Shape>
      <Appearance>
        <Material DEF='BeaconMaterial' diffuseColor='0.2 0.2 0.2' emissiveColor='0 0 0'/>
      </Appearance>
      <Sphere radius='0.8'/>
    </Shape>
    <TimeSensor DEF='FlashClock' cycleInterval='@1@' loop='true'/>
    <ColorInterpolator DEF='FlashColour' key='0 0.5 1' keyValue='0 0 0 1 0 0 0 0 0'/>
    <ROUTE fromNode='FlashClock' fromField='fraction_changed' toNode='FlashColour' toField='set_fraction'/>
    <ROUTE fromNode='FlashColour' fromField='value_changed' toNode='BeaconMaterial' toField='set_emissiveColor'/>
""",
{'1': "500"},
{'1': "0.5"})

# ---------------------------------------------------------------- 05
pair(5, "A lift platform on a four-second loop: it rises three metres, waits at the top, then comes back down.",
"""    <Viewpoint description='Front' position='0 1.5 12'/>
    <Transform DEF='Platform'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.3 0.5 0.8'/>
        </Appearance>
        <Box size='2 0.2 2'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='LiftClock' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='LiftPath' key='0 0.4 0.6 1' keyValue='@1@'/>
    <ROUTE fromNode='LiftClock' fromField='fraction_changed' toNode='LiftPath' toField='set_fraction'/>
    <ROUTE fromNode='LiftPath' fromField='value_changed' toNode='Platform' toField='set_translation'/>
""",
{'1': "0 0 0 0 3 0 0 0 0"},
{'1': "0 0 0 0 3 0 0 3 0 0 0 0"})

# ---------------------------------------------------------------- 06
pair(6, "A globe that spins steadily about its vertical axis, one full turn every four seconds.",
"""    <Viewpoint description='Front' position='0 0 8'/>
    <Transform DEF='Globe'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.4 0.9'/>
        </Appearance>
        <Sphere radius='1.5'/>
      </Shape>
      <Transform DEF='Marker' translation='1.5 0 0'>
        <Shape>
          <Appearance>
            <Material diffuseColor='1 0.8 0'/>
          </Appearance>
          <Box size='0.3 0.3 0.3'/>
        </Shape>
      </Transform>
    </Transform>
    <TimeSensor DEF='SpinClock' cycleInterval='4' loop='true'/>
    <OrientationInterpolator DEF='SpinTurn' @1@/>
    <ROUTE fromNode='SpinClock' fromField='fraction_changed' toNode='SpinTurn' toField='set_fraction'/>
    <ROUTE fromNode='SpinTurn' fromField='value_changed' toNode='Globe' toField='set_rotation'/>
""",
{'1': "key='0 1' keyValue='0 1 0 0 0 1 0 6.2832'"},
{'1': "key='0 0.25 0.5 0.75 1' keyValue='0 1 0 0 0 1 0 1.5708 0 1 0 3.1416 0 1 0 4.7124 0 1 0 6.2832'"})

# ---------------------------------------------------------------- 07
pair(7, "Two lanterns, each on its own clock: the left one bobs up and down every two seconds, the right one every three seconds.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='LeftLantern' translation='-2 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='1 0.7 0.2'/>
        </Appearance>
        <Sphere radius='0.5'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='BobClock' cycleInterval='2' loop='true'/>
    <PositionInterpolator DEF='LeftBob' key='0 0.5 1' keyValue='-2 0 0 -2 1 0 -2 0 0'/>
    <Transform DEF='RightLantern' translation='2 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='1 0.7 0.2'/>
        </Appearance>
        <Sphere radius='0.5'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='@1@' cycleInterval='3' loop='true'/>
    <PositionInterpolator DEF='RightBob' key='0 0.5 1' keyValue='2 0 0 2 1 0 2 0 0'/>
    <ROUTE fromNode='BobClock' fromField='fraction_changed' toNode='LeftBob' toField='set_fraction'/>
    <ROUTE fromNode='LeftBob' fromField='value_changed' toNode='LeftLantern' toField='set_translation'/>
    <ROUTE fromNode='@1@' fromField='fraction_changed' toNode='RightBob' toField='set_fraction'/>
    <ROUTE fromNode='RightBob' fromField='value_changed' toNode='RightLantern' toField='set_translation'/>
""",
{'1': "BobClock"},
{'1': "RightBobClock"})

# ---------------------------------------------------------------- 08
pair(8, "A sliding door that opens two metres to the side and closes again, repeating every five seconds from the moment the scene starts.",
"""    <Viewpoint description='Front' position='0 1 10'/>
    <Transform DEF='Door' translation='0 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.4 0.25 0.1'/>
        </Appearance>
        <Box size='1.2 2 0.1'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='DoorClock' cycleInterval='5' loop='true'/>
    <PositionInterpolator DEF='DoorSlide' key='0 0.5 1' keyValue='0 1 0 2 1 0 0 1 0'/>
    <ROUTE fromNode='@1@' fromField='fraction_changed' toNode='DoorSlide' toField='set_fraction'/>
    <ROUTE fromNode='DoorSlide' fromField='value_changed' toNode='Door' toField='set_translation'/>
""",
{'1': "DoorTimer"},
{'1': "DoorClock"})

# ---------------------------------------------------------------- 09
pair(9, "A wall panel that starts blue and eases smoothly to orange during the first two seconds after the scene loads.",
"""    <Viewpoint description='Front' position='0 0 6'/>
    <Shape>
      <Appearance>
        <Material DEF='PanelMaterial' diffuseColor='0 0 1'/>
      </Appearance>
      <Box size='3 2 0.1'/>
    </Shape>
    <ColorChaser DEF='PanelEase' duration='2' initialValue='0 0 1' initialDestination='1 0.5 0'/>
    <ROUTE fromNode='PanelEase' fromField='value_changed' toNode='PanelMaterial' toField='set_diffuseColor'/>
""",
{}, {}, components=(('Followers', '1'),), fault_components=())

# ---------------------------------------------------------------- 10
pair(10, "A drawbridge that tilts up to sixty degrees and comes back down, once every six seconds.",
"""    <Viewpoint description='Side' position='2 1 12'/>
    <Transform DEF='BridgeDeck' center='-2 0 0' translation='2 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.5 0.5'/>
        </Appearance>
        <Box size='4 0.2 1.5'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='BridgeClock' cycleInterval='6' loop='true'/>
    <OrientationInterpolator DEF='BridgeTilt' key='0 0.5 1' keyValue='0 0 1 0 0 0 1 1.0472 0 0 1 0'/>
    <ROUTE fromNode='BridgeClock' fromField='@1@' toNode='BridgeTilt' toField='set_fraction'/>
    <ROUTE fromNode='BridgeTilt' fromField='value_changed' toNode='BridgeDeck' toField='set_rotation'/>
""",
{'1': "fraction"},
{'1': "fraction_changed"})

# ---------------------------------------------------------------- 11
pair(11, "A three-frame sign that shows a red cube, then a green ball, then a blue cone, one second each, over and over.",
"""    <Viewpoint description='Front' position='0 0 8'/>
    <Switch DEF='Frames' whichChoice='0'>
      <Shape DEF='RedCube'>
        <Appearance>
          <Material diffuseColor='1 0 0'/>
        </Appearance>
        <Box/>
      </Shape>
      <Shape DEF='GreenBall'>
        <Appearance>
          <Material diffuseColor='0 1 0'/>
        </Appearance>
        <Sphere/>
      </Shape>
      <Shape DEF='BlueCone'>
        <Appearance>
          <Material diffuseColor='0 0 1'/>
        </Appearance>
        <Cone/>
      </Shape>
    </Switch>
    <TimeSensor DEF='FrameClock' cycleInterval='3' loop='true'/>
    <IntegerSequencer DEF='FramePicker' key='0 0.3333 0.6667' keyValue='@1@'/>
    <ROUTE fromNode='FrameClock' fromField='fraction_changed' toNode='FramePicker' toField='set_fraction'/>
    <ROUTE fromNode='FramePicker' fromField='value_changed' toNode='Frames' toField='set_whichChoice'/>
""",
{'1': "1 2 3"},
{'1': "0 1 2"})

# ---------------------------------------------------------------- 12
pair(12, "Click the round red button in the middle to make the bulb above it glow yellow. Clicking the floor does nothing.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='Floor' translation='0 -3 0'>@1@
      <Shape>
        <Appearance>
          <Material diffuseColor='0.4 0.4 0.4'/>
        </Appearance>
        <Box size='8 0.2 4'/>
      </Shape>
    </Transform>
    <Transform DEF='RedButton'>@2@
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0 0'/>
        </Appearance>
        <Sphere radius='0.6'/>
      </Shape>
    </Transform>
    <Transform DEF='Bulb' translation='0 3 0'>
      <Shape>
        <Appearance>
          <Material DEF='BulbMaterial' diffuseColor='0.3 0.3 0.3' emissiveColor='0 0 0'/>
        </Appearance>
        <Sphere radius='0.4'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='GlowClock' cycleInterval='0.5'/>
    <ColorInterpolator DEF='GlowUp' key='0 1' keyValue='0 0 0 1 0.9 0.2'/>
    <ROUTE fromNode='ButtonTouch' fromField='touchTime' toNode='GlowClock' toField='set_startTime'/>
    <ROUTE fromNode='GlowClock' fromField='fraction_changed' toNode='GlowUp' toField='set_fraction'/>
    <ROUTE fromNode='GlowUp' fromField='value_changed' toNode='BulbMaterial' toField='set_emissiveColor'/>
""",
{'1': "\n      <TouchSensor DEF='ButtonTouch' description='switch the bulb on'/>", '2': ""},
{'1': "", '2': "\n      <TouchSensor DEF='ButtonTouch' description='switch the bulb on'/>"})

# ---------------------------------------------------------------- 13
pair(13, "Drag the green puck across the table: wherever you grab it, it moves by exactly as much as the pointer moves, without jumping.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Group>
      <PlaneSensor DEF='PuckDrag' description='drag the puck'/>
      <Transform DEF='Puck'>
        <Shape>
          <Appearance>
            <Material diffuseColor='0.1 0.7 0.2'/>
          </Appearance>
          <Box size='3 3 0.2'/>
        </Shape>
      </Transform>
    </Group>
    <ROUTE fromNode='PuckDrag' fromField='@1@' toNode='Puck' toField='set_translation'/>
""",
{'1': "trackPoint_changed"},
{'1': "translation_changed"})

# ---------------------------------------------------------------- 14
pair(14, "A gate that slides open when the visitor is within five metres of it. The visitor starts three metres away, so the gate opens straight away.",
"""    <Viewpoint description='Visitor' position='0 1.6 3'/>
    <Transform DEF='Gate' translation='0 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.3 0.3 0.35'/>
        </Appearance>
        <Box size='2 2 0.1'/>
      </Shape>
    </Transform>
    <ProximitySensor DEF='GateZone' center='0 1 0'@1@/>
    <TimeSensor DEF='GateClock' cycleInterval='2'/>
    <PositionInterpolator DEF='GateSlide' key='0 1' keyValue='0 1 0 2 1 0'/>
    <ROUTE fromNode='GateZone' fromField='enterTime' toNode='GateClock' toField='set_startTime'/>
    <ROUTE fromNode='GateClock' fromField='fraction_changed' toNode='GateSlide' toField='set_fraction'/>
    <ROUTE fromNode='GateSlide' fromField='value_changed' toNode='Gate' toField='set_translation'/>
""",
{'1': ""},
{'1': " size='10 4 10'"})

# ---------------------------------------------------------------- 15
pair(15, "Press the right-arrow key to nudge the cart one metre to the right, and the left-arrow key to nudge it one metre to the left.",
"""    <Viewpoint description='Front' position='0 0 12'/>
    <Transform DEF='Cart'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.7 0.2 0.7'/>
        </Appearance>
        <Box size='1 0.6 0.6'/>
      </Shape>
    </Transform>
    <KeySensor DEF='ArrowKeys'/>
    <Script DEF='Nudge'>
      <field name='set_arrow' type='SFInt32' accessType='inputOnly'/>
      <field name='x' type='SFFloat' accessType='initializeOnly' value='0'/>
      <field name='position_changed' type='SFVec3f' accessType='outputOnly'/>
<![CDATA[ecmascript:
function set_arrow (code)
{
   if (code == @1@) x += 1; // right arrow
   if (code == @2@) x -= 1; // left arrow

   position_changed = new SFVec3f (x, 0, 0);
}
]]>
    </Script>
    <ROUTE fromNode='ArrowKeys' fromField='actionKeyPress' toNode='Nudge' toField='set_arrow'/>
    <ROUTE fromNode='Nudge' fromField='position_changed' toNode='Cart' toField='set_translation'/>
""",
{'1': "39", '2': "37"},
{'1': "20", '2': "19"})

# ---------------------------------------------------------------- 16
pair(16, "Click the grey tile and it turns gold.",
"""    <Viewpoint description='Front' position='0 0 8'/>
    <Group>
      <TouchSensor DEF='TileTouch' description='turn the tile gold'/>
      <Shape>
        <Appearance>
          <Material DEF='TileMaterial' diffuseColor='0.5 0.5 0.5'/>
        </Appearance>
        <Box size='2 2 0.2'/>
      </Shape>
    </Group>
    <Script DEF='Gilder'>
      <field name='set_clicked' type='SFTime' accessType='inputOnly'/>
      <field name='colour_changed' type='SFColor' accessType='outputOnly'/>
<![CDATA[ecmascript:
function @1@ (time)
{
   colour_changed = new SFColor (1, 0.8, 0);
}
]]>
    </Script>
    <ROUTE fromNode='TileTouch' fromField='touchTime' toNode='Gilder' toField='set_clicked'/>
    <ROUTE fromNode='Gilder' fromField='colour_changed' toNode='TileMaterial' toField='set_diffuseColor'/>
""",
{'1': "clicked"},
{'1': "set_clicked"})

# ---------------------------------------------------------------- 17
pair(17, "A light switch: each click on the plate flips the lamp. The first click turns it on, the next click turns it off, and so on.",
"""    <NavigationInfo headlight='false'/>
    <Viewpoint description='Front' position='0 0 8'/>
    <DirectionalLight DEF='Lamp' on='false' direction='0 -0.3 -1'/>
    <Group>
      <TouchSensor DEF='PlateTouch' description='flip the lamp'/>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.8 0.8' emissiveColor='0.15 0.15 0.15'/>
        </Appearance>
        <Box size='1.5 2 0.2'/>
      </Shape>
    </Group>
    <Script DEF='Flipper'>
      <field name='set_pressed' type='SFBool' accessType='inputOnly'/>
      <field name='lit' type='SFBool' accessType='initializeOnly' value='false'/>
      <field name='lamp_changed' type='SFBool' accessType='outputOnly'/>
<![CDATA[ecmascript:
function set_pressed (value)
{
   @1@lit = !lit;
   lamp_changed = lit;
}
]]>
    </Script>
    <ROUTE fromNode='PlateTouch' fromField='isActive' toNode='Flipper' toField='set_pressed'/>
    <ROUTE fromNode='Flipper' fromField='lamp_changed' toNode='Lamp' toField='set_on'/>
""",
{'1': ""},
{'1': "if (value) "})

# ---------------------------------------------------------------- 18
pair(18, "A bee that flies from left to right across the view every four seconds and, at the same time, bobs up and down four times per crossing.",
"""    <Viewpoint description='Front' position='0 0 12'/>
    <Transform DEF='BeePath'>
      <Transform DEF='Bee'>
        <Shape>
          <Appearance>
            <Material diffuseColor='1 0.8 0'/>
          </Appearance>
          <Sphere radius='0.3'/>
        </Shape>
      </Transform>
    </Transform>
    <TimeSensor DEF='FlightClock' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='Crossing' key='0 1' keyValue='-4 0 0 4 0 0'/>
    <PositionInterpolator DEF='Bobbing' key='0 0.125 0.25 0.375 0.5 0.625 0.75 0.875 1' keyValue='0 0 0 0 0.5 0 0 0 0 0 0.5 0 0 0 0 0 0.5 0 0 0 0 0 0.5 0 0 0 0'/>
    <ROUTE fromNode='FlightClock' fromField='fraction_changed' toNode='Crossing' toField='set_fraction'/>
    <ROUTE fromNode='FlightClock' fromField='fraction_changed' toNode='Bobbing' toField='set_fraction'/>
    <ROUTE fromNode='Crossing' fromField='value_changed' toNode='@1@' toField='set_translation'/>
    <ROUTE fromNode='Bobbing' fromField='value_changed' toNode='Bee' toField='set_translation'/>
""",
{'1': "Bee"},
{'1': "BeePath"})

# ---------------------------------------------------------------- 19
pair(19, "A marker that glides smoothly, never jumping, to whichever of two posts is the current target. The target swaps between the left and the right post every two seconds.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='LeftPost' translation='-2 -1 0'>
      <Shape DEF='Post'>
        <Appearance>
          <Material diffuseColor='0.5 0.5 0.5'/>
        </Appearance>
        <Cylinder height='1' radius='0.1'/>
      </Shape>
    </Transform>
    <Transform DEF='RightPost' translation='2 -1 0'>
      <Shape USE='Post'/>
    </Transform>
    <Transform DEF='Marker' translation='-2 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.9 0.1 0.1'/>
        </Appearance>
        <Sphere radius='0.3'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='SwapClock' cycleInterval='4' loop='true'/>
    <PositionInterpolator DEF='Target' key='0 0.5 0.5 1' keyValue='-2 0 0 -2 0 0 2 0 0 2 0 0'/>
    <PositionDamper DEF='Glide' tau='0.15' initialValue='-2 0 0' initialDestination='-2 0 0'/>
    <ROUTE fromNode='SwapClock' fromField='fraction_changed' toNode='Target' toField='set_fraction'/>
    <ROUTE fromNode='Target' fromField='value_changed' toNode='Glide' toField='@1@'/>
    <ROUTE fromNode='Glide' fromField='value_changed' toNode='Marker' toField='set_translation'/>
""",
{'1': "set_value"},
{'1': "set_destination"}, components=(('Followers', '1'),))

# ---------------------------------------------------------------- 20
pair(20, "Click the statue to jump to the close-up view, and stay in the close-up view after the mouse button is released.",
"""    <Viewpoint DEF='Overview' description='Overview' position='0 0 12'/>
    <Viewpoint DEF='CloseUp' description='Close-up' position='0 0 4'/>
    <Group>
      <TouchSensor DEF='StatueTouch' description='go to the close-up view'/>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.8 0.75'/>
        </Appearance>
        <Cylinder height='2' radius='0.5'/>
      </Shape>
    </Group>@1@
    <ROUTE fromNode='StatueTouch' fromField='isActive' @2@ toNode='CloseUp' toField='set_bind'/>
""",
{'1': "", '2': "\b"},
{'1': "\n    <BooleanFilter DEF='PressOnly'/>",
 '2': "toNode='PressOnly' toField='set_boolean'/>\n    <ROUTE fromNode='PressOnly' fromField='inputTrue'"})

# ================================================================ decoys
DECOYS = {}

DECOYS[1] = ("A light switch: each click on the plate flips the lamp. The first click turns it on, the next click turns it off, and so on.",
"""    <NavigationInfo headlight='false'/>
    <Viewpoint description='Front' position='0 0 8'/>
    <DirectionalLight DEF='Lamp' on='false' direction='0 -0.3 -1'/>
    <Group>
      <TouchSensor DEF='PlateTouch' description='flip the lamp'/>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.8 0.8' emissiveColor='0.15 0.15 0.15'/>
        </Appearance>
        <Box size='1.5 2 0.2'/>
      </Shape>
    </Group>
    <BooleanToggle DEF='Flipper'/>
    <ROUTE fromNode='PlateTouch' fromField='isActive' toNode='Flipper' toField='set_boolean'/>
    <ROUTE fromNode='Flipper' fromField='toggle_changed' toNode='Lamp' toField='set_on'/>
""", 'Immersive', ())

DECOYS[2] = ("A globe that spins steadily about its vertical axis, one full turn every four seconds.",
"""    <Viewpoint description='Front' position='0 0 8'/>
    <Transform DEF='Globe'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.4 0.9'/>
        </Appearance>
        <Sphere radius='1.5'/>
      </Shape>
      <Transform DEF='Marker' translation='1.5 0 0'>
        <Shape>
          <Appearance>
            <Material diffuseColor='1 0.8 0'/>
          </Appearance>
          <Box size='0.3 0.3 0.3'/>
        </Shape>
      </Transform>
    </Transform>
    <TimeSensor DEF='SpinClock' cycleInterval='4' loop='true'/>
    <OrientationInterpolator DEF='SpinTurn' key='0 0.3333 0.6667 1' keyValue='0 1 0 0 0 1 0 2.0944 0 1 0 4.1888 0 1 0 6.2832'/>
    <ROUTE fromNode='SpinClock' fromField='fraction_changed' toNode='SpinTurn' toField='set_fraction'/>
    <ROUTE fromNode='SpinTurn' fromField='value_changed' toNode='Globe' toField='set_rotation'/>
""", 'Immersive', ())

DECOYS[3] = ("A buoy that bobs up and down every three seconds, from the moment the scene loads and for as long as it stays open.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='Buoy'>
      <Shape>
        <Appearance>
          <Material diffuseColor='1 0.4 0'/>
        </Appearance>
        <Cone bottomRadius='0.5' height='1.2'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='BobClock' cycleInterval='3' loop='true' startTime='1' stopTime='0'/>
    <PositionInterpolator DEF='BobPath' key='0 0.5 1' keyValue='0 0 0 0 1 0 0 0 0'/>
    <ROUTE fromNode='BobClock' fromField='fraction_changed' toNode='BobPath' toField='set_fraction'/>
    <ROUTE fromNode='BobPath' fromField='value_changed' toNode='Buoy' toField='set_translation'/>
""", 'Immersive', ())

DECOYS[4] = ("A slider block that swings left and right, two metres each way, once every four seconds, moved by a script that writes its position directly.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='Slider'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.7 0.7'/>
        </Appearance>
        <Box size='1 1 1'/>
      </Shape>
    </Transform>
    <TimeSensor DEF='SwingClock' cycleInterval='4' loop='true'/>
    <Script DEF='Swinger' directOutput='true'>
      <field name='set_fraction' type='SFFloat' accessType='inputOnly'/>
      <field name='target' type='SFNode' accessType='initializeOnly'>
        <Transform USE='Slider'/>
      </field>
<![CDATA[ecmascript:
function set_fraction (fraction)
{
   target.translation = new SFVec3f (2 * Math.sin (2 * Math.PI * fraction), 0, 0);
}
]]>
    </Script>
    <ROUTE fromNode='SwingClock' fromField='fraction_changed' toNode='Swinger' toField='set_fraction'/>
""", 'Immersive', ())

DECOYS[5] = ("A leader cube that hops between two spots every second, staying put between hops, and a ball that copies the leader's position exactly, one metre higher.",
"""    <Viewpoint description='Front' position='0 0 10'/>
    <Transform DEF='Stage'>
      <TimeSensor DEF='HopClock' cycleInterval='2' loop='true'/>
      <PositionInterpolator DEF='HopPath' key='0 0.5 0.5 1' keyValue='-1.5 0 0 -1.5 0 0 1.5 0 0 1.5 0 0'/>
      <Transform DEF='Leader' translation='-1.5 0 0'>
        <Shape>
          <Appearance>
            <Material diffuseColor='0.9 0.2 0.2'/>
          </Appearance>
          <Box size='0.8 0.8 0.8'/>
        </Shape>
      </Transform>
      <Transform DEF='CopyOffset' translation='0 1 0'>
        <Transform DEF='Copy' translation='-1.5 0 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0.2 0.2 0.9'/>
            </Appearance>
            <Sphere radius='0.4'/>
          </Shape>
        </Transform>
        <ROUTE fromNode='Leader' fromField='translation_changed' toNode='Copy' toField='set_translation'/>
      </Transform>
      <ROUTE fromNode='HopClock' fromField='fraction_changed' toNode='HopPath' toField='set_fraction'/>
      <ROUTE fromNode='HopPath' fromField='value_changed' toNode='Leader' toField='translation'/>
    </Transform>
""", 'Immersive', ())

def main():
    for n, (desc, body, fault, twin, profile, comps, fcomps) in sorted(PAIRS.items()):
        f = doc(desc, fill(body, fault), profile, comps if fcomps is None else fcomps)
        t = doc(desc, fill(body, twin), profile, comps)
        f = f.replace(" \b", "")
        assert f != t, n
        open(os.path.join(OUT, 'fault-%02d.x3d' % n), 'w').write(f)
        open(os.path.join(OUT, 'twin-%02d.x3d' % n), 'w').write(t)
    for n, (desc, body, profile, comps) in sorted(DECOYS.items()):
        open(os.path.join(OUT, 'decoy-%02d.x3d' % n), 'w').write(doc(desc, body, profile, comps))

if __name__ == '__main__':
    main()
