#!/usr/bin/env python3
"""Print the fields of the 14 X3D 4.0 RigidBodyPhysics nodes from the official X3DUOM as JSON (used to check the mapping table covers every field)."""
import json, sys, xml.etree.ElementTree as ET
UOM = sys.argv[1] if len(sys.argv) > 1 else 'X3dUnifiedObjectModel-4.0.xml'
NODES = "BallJoint CollidableOffset CollidableShape CollisionCollection CollisionSensor CollisionSpace Contact DoubleAxisHingeJoint MotorJoint RigidBody RigidBodyCollection SingleAxisHingeJoint SliderJoint UniversalJoint".split()
out = {}
for cn in ET.parse(UOM).getroot().iter('ConcreteNode'):
    if cn.get('name') in NODES:
        out[cn.get('name')] = {f.get('name'): {'access': f.get('accessType'), 'type': f.get('type'), 'default': f.get('default')}
                               for f in cn.iter('field') if f.get('name') not in ('IS',)}
json.dump(out, sys.stdout, indent=1, sort_keys=True)
