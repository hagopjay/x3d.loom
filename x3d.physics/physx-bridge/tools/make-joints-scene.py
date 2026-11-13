#!/usr/bin/env python3
"""Generate scenes/joints-and-sensors.x3d: every X3D 4.0 joint type, a kinematic elevator (ROUTE-driven fixed body),
a CollisionSensor whose isActive switches a lamp. Standard X3D only. usage: python3 tools/make-joints-scene.py > scenes/joints-and-sensors.x3d"""

MAT = {
    'wood': '<PhysicalMaterial baseColor="0.62 0.42 0.24" metallic="0" roughness="0.6"/>',
    'brass': '<PhysicalMaterial baseColor="0.85 0.66 0.3" metallic="1" roughness="0.35"/>',
    'glass': '<PhysicalMaterial baseColor="0.55 0.75 1" metallic="0.3" roughness="0.15"/>',
    'steel': '<PhysicalMaterial baseColor="0.7 0.72 0.75" metallic="1" roughness="0.3"/>',
    'floor': '<PhysicalMaterial baseColor="0.16 0.17 0.2" metallic="0" roughness="0.9"/>',
    'red': '<PhysicalMaterial baseColor="0.8 0.2 0.15" metallic="0" roughness="0.5"/>',
}

visual, bodies, joints, colliders, routes = [], [], [], [], []
used_mat = set()


def appearance(m):
    if m in used_mat:
        return f'<Appearance USE="Mat_{m}"/>'
    used_mat.add(m)
    return f'<Appearance DEF="Mat_{m}">{MAT[m]}</Appearance>'


def geom(kind, dims):
    if kind == 'box':
        return f'<Box size="{dims[0]} {dims[1]} {dims[2]}"/>'
    if kind == 'sphere':
        return f'<Sphere radius="{dims}"/>'
    raise ValueError(kind)


def piece(name, pos, shapes, fixed=False, mass=None, extra='', rot=None):
    """shapes: list of (kind, dims, material, local offset or None)"""
    v = [f'  <Transform DEF="{name}T" translation="{pos[0]} {pos[1]} {pos[2]}"' + (f' rotation="{rot}"' if rot else '') + '>']
    cols = []
    for i, (kind, dims, m, off) in enumerate(shapes):
        sdef = f'{name}Shape{i if len(shapes) > 1 else ""}'
        shape = f'<Shape DEF="{sdef}">{appearance(m)}{geom(kind, dims)}</Shape>'
        if off:
            v.append(f'   <Transform translation="{off[0]} {off[1]} {off[2]}">{shape}</Transform>')
        else:
            v.append(f'   {shape}')
        cdef = f'{name}Collider{i if len(shapes) > 1 else ""}'
        if len(shapes) == 1 and not off:
            cols.append(f'<CollidableShape DEF="{cdef}" containerField="geometry"><Shape USE="{sdef}" containerField="shape"/></CollidableShape>')
            colliders.append(f'    <CollidableShape USE="{cdef}" containerField="collidables"/>')
        else:
            o = off or (0, 0, 0)
            cols.append(f'<CollidableOffset DEF="{cdef}Offset" containerField="geometry"><CollidableShape DEF="{cdef}" containerField="collidable" translation="{o[0]} {o[1]} {o[2]}"><Shape USE="{sdef}" containerField="shape"/></CollidableShape></CollidableOffset>')
            colliders.append(f'    <CollidableOffset USE="{cdef}Offset" containerField="collidables"/>')
    v.append('  </Transform>')
    visual.append('\n'.join(v))
    attrs = f'DEF="{name}Body" containerField="bodies" position="{pos[0]} {pos[1]} {pos[2]}"'
    if rot:
        attrs += f' orientation="{rot}"'
    attrs += ' fixed="true"' if fixed else f' mass="{mass}"'
    attrs += ' ' + extra if extra else ''
    bodies.append(f'   <RigidBody {attrs}>\n    ' + '\n    '.join(cols) + '\n   </RigidBody>')
    if not fixed:
        routes.append(f'  <ROUTE fromNode="{name}Body" fromField="position" toNode="{name}T" toField="set_translation"/>')
        routes.append(f'  <ROUTE fromNode="{name}Body" fromField="orientation" toNode="{name}T" toField="set_rotation"/>')


def joint(kind, name, b1, b2, fields):
    attrs = ' '.join(f'{k}="{v}"' for k, v in fields.items())
    joints.append(f'   <{kind} DEF="{name}" containerField="joints" {attrs} forceOutput=\'"ALL"\'>'
                  + (f'<RigidBody USE="{b1}Body" containerField="body1"/>' if b1 else '')
                  + (f'<RigidBody USE="{b2}Body" containerField="body2"/>' if b2 else '')
                  + f'</{kind}>')


R = 0.012  # marble radius
piece('Floor', (0.1, -0.01, 0), [('box', (2.6, 0.02, 0.5), 'floor', None)], fixed=True)
# 1 elevator: a fixed body moved by a ROUTE (kinematic), carrying a cube
piece('Elevator', (-0.9, 0.05, 0), [('box', (0.14, 0.012, 0.14), 'steel', None)], fixed=True)
piece('Cube', (-0.9, 0.077, 0), [('box', (0.04, 0.04, 0.04), 'red', None)], mass=0.05)
# 2 pendulum (BallJoint)
piece('PendulumPivot', (-0.55, 0.45, 0), [('box', (0.03, 0.03, 0.03), 'steel', None)], fixed=True)
piece('PendulumBob', (-0.4, 0.3, 0.05), [('sphere', 0.03, 'brass', None)], mass=0.3)
joint('BallJoint', 'Pendulum', 'PendulumBob', 'PendulumPivot', {'anchorPoint': '-0.55 0.45 0'})
# 3 seesaw (free hinge with limits) and a marble falling on one end
piece('SeesawBase', (-0.15, 0.04, 0), [('box', (0.03, 0.08, 0.06), 'wood', None)], fixed=True)
piece('Seesaw', (-0.15, 0.086, 0), [('box', (0.34, 0.012, 0.07), 'wood', None)], mass=0.08)
joint('SingleAxisHingeJoint', 'SeesawHinge', 'Seesaw', 'SeesawBase', {'anchorPoint': '-0.15 0.08 0', 'axis': '0 0 1', 'minAngle': '-0.3', 'maxAngle': '0.3'})
piece('MarbleA', (-0.28, 0.3, 0), [('sphere', R, 'glass', None)], mass=0.02)
# 4 flipper: hinge with limits [0, 0.8], held down by a MotorJoint torque; reversing the torque flips the marble
piece('FlipperBase', (0.15, 0.06, 0), [('box', (0.02, 0.12, 0.05), 'steel', None)], fixed=True)
piece('Flipper', (0.21, 0.12, 0), [('box', (0.12, 0.016, 0.05), 'red', None)], mass=0.05)
joint('SingleAxisHingeJoint', 'FlipperHinge', 'Flipper', 'FlipperBase', {'anchorPoint': '0.15 0.12 0', 'axis': '0 0 1', 'minAngle': '0', 'maxAngle': '0.8', 'stopBounce': '0.2'})
joint('MotorJoint', 'FlipperMotor', 'Flipper', 'FlipperBase', {'enabledAxes': '1', 'motor1Axis': '0 0 1', 'axis1Torque': '-0.02', 'autoCalc': 'true'})
piece('MarbleB', (0.235, 0.141, 0), [('sphere', R, 'glass', None)], mass=0.02)
# 5 paddle wheel: DoubleAxisHingeJoint axle motor (velocity drive with a torque limit), steering locked
piece('WheelHub', (0.48, 0.18, -0.03), [('box', (0.03, 0.03, 0.02), 'steel', None)], fixed=True)
piece('Wheel', (0.48, 0.18, 0), [('box', (0.2, 0.02, 0.04), 'wood', (0, 0, 0)), ('box', (0.02, 0.2, 0.04), 'wood', (0, 0, 0))], mass=0.1)
joint('DoubleAxisHingeJoint', 'WheelAxle', 'WheelHub', 'Wheel', {'anchorPoint': '0.48 0.18 0', 'axis1': '0 1 0', 'axis2': '0 0 1', 'minAngle1': '0', 'maxAngle1': '0', 'desiredAngularVelocity2': '-2', 'maxTorque2': '0.2'})
# 6 spring launcher: SliderJoint with a force (the test fires it) and a marble on the plunger
piece('LauncherRail', (0.78, 0.02, -0.04), [('box', (0.05, 0.04, 0.02), 'steel', None)], fixed=True)
piece('Plunger', (0.78, 0.04, 0), [('box', (0.05, 0.02, 0.05), 'red', None)], mass=0.05)
joint('SliderJoint', 'Launcher', 'Plunger', 'LauncherRail', {'axis': '0 1 0', 'minSeparation': '0', 'maxSeparation': '0.08', 'sliderForce': '0'})
piece('MarbleC', (0.78, 0.0625, 0), [('sphere', R, 'glass', None)], mass=0.02)
# 7 universal joint: a rod hanging from a support, set swinging about both axes
piece('UniversalSupport', (1.08, 0.46, 0), [('box', (0.04, 0.02, 0.04), 'steel', None)], fixed=True)
piece('Rod', (1.08, 0.34, 0), [('box', (0.02, 0.22, 0.02), 'brass', None)], mass=0.1, extra='angularVelocity="2 0 1.5"')
joint('UniversalJoint', 'Cardan', 'UniversalSupport', 'Rod', {'anchorPoint': '1.08 0.45 0', 'axis1': '1 0 0', 'axis2': '0 0 1'})

nl = '\n'
print(f'''<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Interchange" version="4.0">
 <head>
  <component name="Shape" level="2"/>
  <component name="Lighting" level="2"/>
  <component name="RigidBodyPhysics" level="2"/>
  <component name="Navigation" level="2"/>
  <meta name="title" content="Joints and sensors: every X3D 4.0 joint type, a kinematic elevator, a CollisionSensor"/>
  <meta name="description" content="Standard X3D 4.0 RigidBodyPhysics. Bench for the x3d-physx bridge, phase 2: BallJoint pendulum, SingleAxisHingeJoint seesaw, flipper (hinge with limits + MotorJoint torque), paddle wheel (DoubleAxisHingeJoint axle motor), launcher (SliderJoint force), UniversalJoint rod, elevator (fixed RigidBody driven by a ROUTE), CollisionSensor.isActive switching a lamp."/>
  <meta name="generator" content="tools/make-joints-scene.py, x3d-physx-bridge 0.0.1"/>
 </head>
 <Scene>
  <WorldInfo title="Joints and sensors" info='"Units: metres, kilograms, seconds, radians. Y up."'/>
  <NavigationInfo type='"EXAMINE" "ANY"' headlight="false"/>
  <Viewpoint description="Bench" position="0.08 0.55 2.45" orientation="1 0 0 -0.16" centerOfRotation="0.08 0.15 0"/>
  <DirectionalLight direction="-0.4 -1 -0.5" intensity="2.5" shadows="true"/>
  <DirectionalLight direction="0.5 -0.3 -1" intensity="0.8"/>
  <PointLight DEF="ContactLamp" location="0.1 0.7 0.3" color="1 0.75 0.3" intensity="1.5" radius="3" on="false"/>
  <Background skyColor="0.04 0.05 0.07"/>
{nl.join(visual)}
  <TimeSensor DEF="ElevatorClock" cycleInterval="4" loop="true"/>
  <PositionInterpolator DEF="ElevatorPath" key="0 0.5 1" keyValue="-0.9 0.05 0 -0.9 0.3 0 -0.9 0.05 0"/>

  <RigidBodyCollection DEF="Bench" gravity="0 -9.81 0" iterations="10" preferAccuracy="true">
{nl.join(bodies)}
{nl.join(joints)}
   <CollisionCollection DEF="BenchContacts" containerField="collider" appliedParameters='"BOUNCE" "FRICTION_COEFFICIENT-2"' bounce="0.3" minBounceSpeed="0.1" frictionCoefficients="0.4 0.4">
{nl.join(colliders)}
   </CollisionCollection>
  </RigidBodyCollection>
  <CollisionSensor DEF="BenchSensor"><CollisionCollection USE="BenchContacts" containerField="collider"/></CollisionSensor>

  <ROUTE fromNode="ElevatorClock" fromField="fraction_changed" toNode="ElevatorPath" toField="set_fraction"/>
  <ROUTE fromNode="ElevatorPath" fromField="value_changed" toNode="ElevatorBody" toField="set_position"/>
  <ROUTE fromNode="ElevatorPath" fromField="value_changed" toNode="ElevatorT" toField="set_translation"/>
  <ROUTE fromNode="BenchSensor" fromField="isActive" toNode="ContactLamp" toField="set_on"/>
  <ROUTE fromNode="BenchSensor" fromField="contacts" toNode="Bench" toField="set_contacts"/>
{nl.join(routes)}
 </Scene>
</X3D>''')
