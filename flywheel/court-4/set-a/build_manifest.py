#!/usr/bin/env python3
"""Builds MANIFEST.json from the hand-written entries below plus xsd.json and witness.json."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
xsd = json.load(open(os.path.join(HERE, 'xsd.json')))
wit = json.load(open(os.path.join(HERE, 'witness.json')))['results']

def desc(name):
    return re.search(r"name='description' content=\"([^\"]*)\"", open(os.path.join(HERE, name)).read()).group(1)

# n: (family, fault sentence, viewer_sees, spec)
F = {
 1: ("route-type",
     "The size animation uses a ScalarInterpolator, so an SFFloat value_changed is routed to Transform.set_scale, which is SFVec3f.",
     "The ball never changes size.",
     "error per the X3D standard (ISO/IEC 19775-1 4.4.8.1 Routes: source and destination fields of a ROUTE shall have the same type)"),
 2: ("route-access",
     "The grow animation is routed to Box.size, an initializeOnly field that cannot receive events, instead of to the enclosing Transform's scale.",
     "The crate stays a small cube.",
     "error per the X3D standard (ISO/IEC 19775-1 4.4.2.2 and 4.4.8.1: a ROUTE destination shall be an inputOnly or inputOutput field; Box.size is initializeOnly)"),
 3: ("timesensor",
     "The TimeSensor that should run forever has no loop='true'; with the default startTime of 0 and loop FALSE it never becomes active.",
     "The blades never turn.",
     "legal, plays wrong"),
 4: ("timesensor",
     "cycleInterval is written in milliseconds (500) although the field is in seconds, so one flash takes 500 s instead of 0.5 s.",
     "The beacon looks frozen at whatever brightness it had on load; it drifts imperceptibly.",
     "legal, plays wrong"),
 5: ("interpolator-keys",
     "The PositionInterpolator has four keys but only three keyValues; the second 'top' position that makes the platform wait is missing.",
     "The platform does not wait at the top (in X_ITE it starts sinking the moment it arrives and then sits at the bottom); other players may do something else, since the result is undefined.",
     "error per the X3D standard (ISO/IEC 19775-1 19.4.6 PositionInterpolator / 19.3.1 X3DInterpolatorNode: keyValue shall contain exactly as many values as key)"),
 6: ("orientation-interpolation",
     "The full turn is given as two keys, angle 0 and angle 6.2832 about the same axis; these are the same orientation, and an OrientationInterpolator takes the shortest path between them, which is no motion.",
     "The globe does not spin at all.",
     "legal, plays wrong"),
 7: ("def-names",
     "Both TimeSensors carry the same DEF name (copy-paste); the ROUTEs at the end both resolve to one of them, so both lanterns share one clock.",
     "Both lanterns bob in perfect step on one shared clock; the left lantern's two-second rhythm is gone.",
     "error per the X3D standard (ISO/IEC 19775-1 4.4.3 DEF/USE semantics and 19776-1 XML encoding: DEF is of type ID and shall be unique in the document)"),
 8: ("route-endpoint",
     "The first ROUTE names fromNode='DoorTimer', but no node has that DEF; the clock is called DoorClock.",
     "The door never moves.",
     "error per the X3D standard (ISO/IEC 19775-1 4.4.8.1 Routes and the 19776-1 XML encoding ROUTE statement: fromNode shall be the DEF name of a node defined earlier in the scene)"),
 9: ("profile-component",
     "The scene declares profile Immersive only, but uses a ColorChaser, which belongs to the Followers component that Immersive does not include; the component statement is missing.",
     "A strictly conforming Immersive player may refuse the node, leaving the panel blue for ever; X_ITE only warns and plays it.",
     "error per the X3D standard (ISO/IEC 19775-1 7.2.5.3-7.2.5.4 PROFILE and COMPONENT statements, and Annex on Immersive profile: a scene shall use only nodes supported by its declared profile and components; Followers level 1 is not in Immersive)"),
 10: ("route-endpoint",
     "The first ROUTE uses fromField='fraction'; TimeSensor has no such field, the output is fraction_changed.",
     "The drawbridge never tilts.",
     "error per the X3D standard (ISO/IEC 19775-1 4.4.8.1 Routes: the ROUTE shall name an existing output field of the source node; 8.4.1 TimeSensor has fraction_changed)"),
 11: ("switch-index",
     "The IntegerSequencer counts 1, 2, 3 while the Switch children are numbered 0, 1, 2.",
     "The red cube is only visible before the first sequencer event (in X_ITE never again); the sign shows ball, cone, then nothing for a second.",
     "legal, plays wrong"),
 12: ("pointing-sensor-scope",
     "The TouchSensor sits among the floor's children instead of beside the button's geometry, so it senses the floor and not the button.",
     "Clicking the red button does nothing; clicking the floor lights the bulb.",
     "legal, plays wrong"),
 13: ("drag-sensor",
     "The PlaneSensor's trackPoint_changed is routed to the puck instead of translation_changed, so the puck's centre is put at the pointer's hit point instead of moving by the drag distance.",
     "On grabbing the puck anywhere but its centre it jumps so that its centre is under the pointer, and it jumps again on every new grab.",
     "legal, plays wrong"),
 14: ("environment-sensor",
     "The ProximitySensor has no size, and the default size 0 0 0 disables the sensor.",
     "The gate never opens, however close the visitor is.",
     "legal, plays wrong"),
 15: ("key-sensor",
     "The script compares actionKeyPress against browser DOM key codes (39 and 37); the X3D action-key codes for right and left arrow are 20 and 19.",
     "The arrow keys do nothing.",
     "legal, plays wrong"),
 16: ("script",
     "The script's function is named clicked, but the input field is named set_clicked; a Script handler must have exactly the field's name, so it is never called.",
     "Clicking the tile does nothing; it stays grey.",
     "legal, plays wrong"),
 17: ("script",
     "TouchSensor.isActive sends TRUE on press and FALSE on release, and the script flips its state on every event without looking at the value, so each click flips the lamp twice.",
     "The lamp flashes on only while the mouse button is held down and is off again after every click.",
     "legal, plays wrong"),
 18: ("route-fan-in",
     "Both PositionInterpolators are routed to the same inner Transform's translation in the same timestamp, so one overwrites the other; the crossing should drive the outer BeePath Transform.",
     "The bee only does one of the two motions (in X_ITE it bobs in place at the centre and never crosses).",
     "legal, plays wrong"),
 19: ("follower",
     "The target position is routed to the damper's set_value, which sets the output immediately, instead of to set_destination, which it would glide towards.",
     "The marker teleports from post to post every two seconds with no glide.",
     "legal, plays wrong"),
 20: ("viewpoint-binding",
     "TouchSensor.isActive is routed straight to Viewpoint.set_bind, so the FALSE sent on release unbinds the close-up viewpoint again.",
     "The view moves to the close-up only while the mouse button is held, then snaps back to the overview.",
     "legal, plays wrong"),
}

D = {
 1: ("event-utilities",
     "TouchSensor.isActive (TRUE on press, FALSE on release) is routed straight into a toggle, which looks like a double flip per click; and the ROUTE reads 'toggle_changed' although the field is called 'toggle'. Both are fine: BooleanToggle ignores FALSE inputs, and toggle is inputOutput so the _changed form is allowed."),
 2: ("orientation-interpolation",
     "The keyValue runs from angle 0 to angle 6.2832 about one axis, the classic 'does not rotate' trap; but there are four keys 120 degrees apart, so every segment is less than half a turn and the shortest path is the intended direction."),
 3: ("timesensor",
     "startTime='1' and stopTime='0' look like a clock that is stopped before it starts, and like times that are long past. A stopTime not later than startTime is ignored, and a looping sensor whose startTime is in the past simply runs."),
 4: ("script",
     "Nothing is routed out of the Script and nothing is routed into the Transform, so it looks unconnected. The Script holds the Transform in an SFNode field (USE) and writes its translation directly, which is allowed because directOutput='true'."),
 5: ("routes",
     "ROUTE statements sit inside Transform nodes instead of at the end of the Scene; a key value is repeated (0.5 0.5), a Transform is routed straight to another Transform with no interpolator, one ROUTE writes 'translation' without set_, and sensors and interpolators are children of a Transform. All legal: ROUTE may appear wherever a child node may, keys need only be non-decreasing (a repeated key makes a step), and inputOutput fields can be routed from and to under either name."),
}

def note(name, role):
    r = wit[name]
    extra = ''
    warns = [m['text'] for m in r['console'] if m['type'] == 'warning' and 'GL Driver Message' not in m['text']]
    gl = [m for m in r['console'] if 'GL Driver Message' in m['text']]
    if warns:
        extra += ' X_ITE console warning: ' + re.sub(r"http://127\.0\.0\.1:\d+/a/", '', warns[0])
    if role == 'decoy':
        extra += ' Console errors: %d.' % r['console_errors']
        if gl:
            extra += ' (One software-GL driver performance warning about ReadPixels was logged; it is not about the scene.)'
    return (r['note'] + '.' + extra).strip()

M = {}
disagree = []
for n in range(1, 21):
    f, t = 'fault-%02d.x3d' % n, 'twin-%02d.x3d' % n
    fam, fault, sees, spec = F[n]
    assert wit[t]['intended'] is True, t
    e = {"category": fam, "fault": fault, "viewer_sees": sees, "spec": spec,
         "xsd_valid": xsd[f]['xsd_valid'], "witness": "x_ite-16.8.0",
         "witness_note": note(f, 'fault') + ' Twin: ' + wit[t]['note'] + '.', "twin": t}
    if wit[f]['intended'] is True:
        e["engine_disagrees"] = True
        disagree.append(f)
    M[f] = e
    assert xsd[t]['xsd_valid']
    M[t] = {"category": fam, "intent": desc(t), "xsd_valid": True, "witness": "x_ite-16.8.0", "witness_note": note(t, 'twin')}
for n in range(1, 6):
    d = 'decoy-%02d.x3d' % n
    fam, why = D[n]
    assert wit[d]['intended'] is True and wit[d]['console_errors'] == 0 and xsd[d]['xsd_valid'], d
    M[d] = {"category": fam, "intent": desc(d), "xsd_valid": True, "witness": "x_ite-16.8.0",
            "witness_note": note(d, 'decoy'), "why_suspicious": why}

json.dump(M, open(os.path.join(HERE, 'MANIFEST.json'), 'w'), indent=1, sort_keys=True, ensure_ascii=False)
fam_count = {}
for n in F: fam_count[F[n][0]] = fam_count.get(F[n][0], 0) + 1
print('families', fam_count)
print('faults xsd invalid', sum(1 for n in range(1, 21) if not xsd['fault-%02d.x3d' % n]['xsd_valid']))
print('legal', sum(1 for n in F if F[n][3].startswith('legal')))
print('engine disagrees', disagree)
print('decoys zero errors', sum(1 for n in range(1, 6) if wit['decoy-%02d.x3d' % n]['console_errors'] == 0))
print('entries', len(M))
