#!/usr/bin/env python3
"""Builds MANIFEST.json from the notes below plus xsd.json and witness.json."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
xsd = json.load(open(os.path.join(HERE, "xsd.json")))
wit = json.load(open(os.path.join(HERE, "witness.json")))["results"]

LEGAL = "legal, plays wrong"
F = {
 1: ("interpolators", "The PositionInterpolator keyValues are written as offsets from the platform's resting place (0 0 0 to 0 2 0), but they are routed to Transform.translation, which is absolute, so the animation overwrites the 5 m placement.",
     "The platform leaves its shaft and rides up and down at the origin, five metres to the left of where it belongs.", LEGAL,
     "none: closest is P120 (a rotation that ignores where the hinge is); here an animated translation discards the object's static placement"),
 2: ("event types", "TouchSensor.isActive (SFBool) is routed to TimeSensor.startTime (SFTime); the time-valued output touchTime was needed.",
     "Clicking the pad does nothing; the flag stays at the foot of the pole.", "error per the X3D standard (ISO/IEC 19775-1 4.4.8.2 Routes: source and destination fields shall have the same type)",
     "P001: that is a float routed into a vector on an interpolator-to-Transform ROUTE; this is a boolean routed into a time on a sensor-to-clock ROUTE"),
 3: ("sequencers", "The IntegerSequencer keys are 0 0.5 1 for three states; a sequencer holds each value until the next key, so the last state is only reached at fraction 1 and gets no share of the run.",
     "Red and amber each show for a second and a half; green appears only at the very end instead of for the last second.", LEGAL,
     "P009: there the last key can never be reached; here it is reached but, with step semantics, lasts no time"),
 4: ("environment sensors", "The ProximitySensor sits outside the Transform that places the gatehouse at x=20, so its box is centred on the world origin and not on the doorway.",
     "Arriving at the gate does nothing: the door stays shut (it would open only if the visitor walked to the empty origin).", LEGAL,
     "P052: there the sensor box has zero size; here the size is right but the sensor is in the wrong coordinate frame"),
 5: ("scripts", "The Script computes the start time from Date.now(), which is wall-clock milliseconds, instead of the event timestamp in seconds; the SFTime it sends is a thousand times too large.",
     "By the standard the rocket never lifts off (start time is tens of thousands of years ahead).", LEGAL,
     "P084: that is a TimeSensor duration typed in milliseconds; this is a Script mixing the JavaScript wall clock (ms) into an SFTime event"),
 6: ("clocks and timing", "stopTime='20' was written as if it meant 'run for twenty seconds'; times are absolute seconds since 1970, so stopTime is later than startTime (0) and long past, and the looping clock never becomes active.",
     "The beacon head never turns.", LEGAL,
     "P005: there stopTime is earlier than startTime; here it is later than startTime but both lie in the distant past, a relative-versus-absolute confusion"),
 7: ("routes", "A ROUTE statement appears before the node it names as its destination has been defined (the interpolator's DEF comes two lines later).",
     "The buoy sits still; the browser reports an unknown node for the ROUTE and drops it.", "error per the X3D standard (ISO/IEC 19776-1 XML encoding, ROUTE statement: both nodes shall already have been DEF-named before the ROUTE)",
     "P088: there the name does not exist anywhere; here the name exists but is defined after the ROUTE that uses it"),
 8: ("followers", "The ScalarChaser is left with its default initialValue/initialDestination of 0 although the lamp it drives starts at intensity 1, so the first fade starts from 0 instead of from the lamp's present level.",
     "On pressing the plate the lamp snaps to black and then brightens up to a fifth, instead of fading down from full.", LEGAL,
     "P099: there the destination is fed to the wrong input; here the inputs are right but the follower's starting value does not match the field it drives"),
 9: ("pointing sensors", "The drawer front has its own TouchSensor deeper in the hierarchy; a pointing sensor nearer the geometry takes the pointer and the ancestor's sensor is ignored, but only the cabinet's sensor is routed to the lamp.",
     "Pressing on the drawer front does not light the lamp, although pressing anywhere else on the cabinet does.", LEGAL,
     "P092: there one sensor is grouped with the wrong geometry; here both sensors are grouped correctly and the deeper one masks the outer one"),
 10: ("triggers", "The 'off' button is wired through a BooleanTrigger straight to the lamp; BooleanTrigger.triggerTrue always sends TRUE, so the off button switches the lamp on.",
      "The red button never puts the lamp out.", LEGAL,
      "P014: there an output is never routed; here it is routed but the node can only ever emit TRUE"),
 11: ("inline name scope", "A ROUTE in the parent scene names a node that is DEF-named inside the Inline's file; without an IMPORT statement that name is not visible in the parent scene.",
      "The fan blades stay still; the browser reports an unknown node for the ROUTE.", "error per the X3D standard (ISO/IEC 19775-1 4.4.6 Run-time name scope and 4.4.6.2 IMPORT: nodes in an Inline are only reachable through IMPORT/EXPORT)",
      "P088: there the ROUTE names a node that exists nowhere; here the node exists and is exported, but in another file's name scope and it is never imported"),
 12: ("interpolators", "The looping path is not closed: the last keyValue is the fourth corner, not the first corner again, so at each wrap of the clock the value jumps from the end of the path back to its start.",
      "The marker runs along three sides of the square and then teleports four metres back to the start corner instead of gliding along the fourth side.", LEGAL,
      "P085: there a keyValue is missing so counts disagree; here keys and keyValues agree in number but the loop has a seam"),
 13: ("prototypes", "The prototype declares a period field and the instance sets it, but the body has no IS connection from that field to the clock's cycleInterval, so the value is never used.",
      "The barrier arm snaps up in one second (the clock's default) instead of rising slowly over three.", LEGAL,
      "P118: there the instance uses a field name the interface lacks; here the name is right but the interface field is not connected to anything in the body"),
 14: ("clocks and timing", "The 'carry on' button is routed to the clock's startTime; a paused TimeSensor is still active and ignores startTime, so nothing resumes (resumeTime was needed).",
      "After the red button the shuttle stays frozen for good and the warning lamp stays lit; the green button does nothing.", LEGAL,
      "P050: that clock runs when it should wait; this one cannot be restarted after a pause because the wrong time field is driven"),
 15: ("routes", "The ROUTE's destination is TimeSensor.isActive, an outputOnly field; the author meant to gate the clock through enabled.",
      "Holding the lever does nothing; the wheel never turns.", "error per the X3D standard (ISO/IEC 19775-1 4.4.8.2 Routes: the destination shall be an inputOnly or inputOutput field)",
      "P002: there the destination is an initializeOnly field of a geometry node; here it is an outputOnly field of a clock"),
 16: ("viewpoint binding", "The close-up Viewpoint has jump='false', so binding it does not move the viewer to it.",
      "Clicking the plaque appears to do nothing: the camera stays at the overview and the reading light never comes on.", LEGAL,
      "P100: there the viewpoint is unbound again on release; here it is bound and stays bound but, with jump off, the viewer is not moved"),
 17: ("triggers", "The first clock's isActive is routed straight to the TimeTrigger, which fires when isActive becomes TRUE, that is when the gate starts to rise, not when it has finished (the falling edge had to be turned into a TRUE first).",
      "The cart sets off at the same moment as the gate and drives into it while it is still down.", LEGAL,
      "P097: there a script reacts to both edges of isActive; here a trigger node reacts to the rising edge where the falling edge was wanted"),
 18: ("scripts", "The Script's SFNode field is given as value='Crate', a name in an attribute, instead of a contained node (USE); the field stays NULL.",
      "Pressing the button does nothing; the script throws on the null node each time.", "error per the X3D standard (ISO/IEC 19776-1 XML encoding, field statement: SFNode/MFNode values are contained elements, the value attribute does not apply)",
      "P020: there the script has no code; here the code is fine but its node reference is written as a string attribute and is null"),
 19: ("drag sensors", "The PlaneSensor has autoOffset='false', so every drag starts again from zero offset instead of from where the last drag ended.",
      "At the start of each new drag the magnet snaps back to the middle of the board.", LEGAL,
      "P093: there the wrong output field is routed; here the right output is routed but the sensor forgets its offset between drags"),
 20: ("load sensing", "The LoadSensor has nothing in its watch list (the Inline is not referenced inside it), so it never reports a load.",
      "The part loads but the turntable never moves.", LEGAL,
      "P058: there the watched Inline is told not to load; here the Inline loads but the sensor is not watching it"),
}
ENGINE_DISAGREES = {5: "X_ITE does not hold the clock back: with the huge start time its internal start timer misfires and the rocket still lifts off, at an arbitrary moment between about 0.6 s and 1.6 s after the press (three runs: 4.8, 8.0 and 7.9 m climbed at 3.0 s, twin 7.1 m every time). The intent assertions therefore hold on the fault in X_ITE."}
D = {
 1: ("routes", "ROUTE statements nested inside a Transform in mid-scene, set_ and _changed spellings of inputOutput fields, one clock fanned out to two interpolators, and a Transform-to-Transform ROUTE that looks like the start of a loop.",
     "ROUTEs may appear wherever a child node may once both nodes are named; set_xxx / xxx_changed are the standard alternate names of inputOutput fields; fan-out is legal; the copy ROUTE is one-way."),
 2: ("clocks and timing", "A full turn written as four keys ending at 6.2832, a clock and its ROUTEs nested inside the Transform they animate, negative startTime and stopTime, and a very short cycleInterval.",
     "Each step is 120 degrees so the turn direction is unambiguous; sensors may sit anywhere in the graph; stopTime not later than startTime is ignored and a looping clock with a past startTime runs."),
 3: ("toggles", "TouchSensor.isActive, which fires on press and on release, is routed straight into a BooleanToggle.",
     "BooleanToggle only flips when it receives TRUE, so the FALSE on release is ignored and one click is one flip."),
 4: ("sequencers", "Switch starts at whichChoice -1, the sequencer has a repeated final value at key 1, values go up and back down, and ROUTEs use set_startTime and set_whichChoice.",
     "-1 legitimately shows nothing until started; repeating the last value at key 1 is the standard way to give the last step its share; set_ names are the legal alternates."),
 5: ("scripts", "Script input named set_level with a handler of the same name, an output named level_changed that is routed nowhere, an SFNode field holding a USE, directOutput writing a field of another node, and a clock that never starts.",
     "The handler name equals the field name; unrouted outputs are harmless; directOutput='true' permits writing through the node reference; the scene is driven from outside by design."),
}

def lines(file):
    txt = open(os.path.join(HERE, file), encoding="utf-8").read()
    m = re.search(r'<meta name="intent:prose" content="([^"]*)"', txt)
    return m.group(1), len(re.findall(r'<meta name="intent" content=', txt))

def note(file):
    r = wit[file]
    parts = []
    for a in r["asserts"]:
        parts.append("%s -> %s (%s)" % (a["line"], json.dumps(a["value"]), "holds" if a["holds"] else "fails"))
    if r.get("probe"):
        parts.append("probe (real pointer / frame tracking): " + json.dumps(r["probe"]))
    msgs = [m for m in r["consoleErrors"]] + [m for m in r["consoleWarnings"] if "WebGL" not in m]
    parts.append("console errors: %d" % len(r["consoleErrors"]) + ("; messages: " + " | ".join(x.split("\n")[0][:160] for x in msgs[:2]) if msgs else ""))
    return "; ".join(parts)

M = {}
for n, (cat, fault, sees, spec, prior) in F.items():
    f, t = "fault-%02d.x3d" % n, "twin-%02d.x3d" % n
    prose, k = lines(t)
    e = {"category": cat, "fault": fault, "viewer_sees": sees, "spec": spec, "xsd_valid": xsd[f]["xsd_valid"],
         "witness": "x_ite-16.8.0", "witness_note": note(f), "twin": t, "nearest_prior": prior,
         "testable_intent_lines": k}
    if n in ENGINE_DISAGREES:
        e["engine_disagrees"] = True
        e["witness_note"] = ENGINE_DISAGREES[n] + " " + e["witness_note"]
    M[f] = e
    assert xsd[t]["xsd_valid"]
    M[t] = {"category": cat, "intent": prose, "xsd_valid": True, "witness": "x_ite-16.8.0", "witness_note": note(t)}
for n, (cat, sus, why_ok) in D.items():
    d = "decoy-%02d.x3d" % n
    prose, k = lines(d)
    assert xsd[d]["xsd_valid"] and wit[d]["all_intent_hold"] and not wit[d]["consoleErrors"], d
    M[d] = {"category": cat, "intent": prose, "xsd_valid": True, "witness": "x_ite-16.8.0", "witness_note": note(d),
            "why_suspicious": sus, "why_correct": why_ok}
for h in ("helper-fan.x3d", "helper-part.x3d"):
    M[h] = {"category": "helper", "intent": lines(h)[0], "xsd_valid": xsd[h]["xsd_valid"], "witness": "x_ite-16.8.0",
            "witness_note": "loaded through the pair that uses it"}
json.dump(M, open(os.path.join(HERE, "MANIFEST.json"), "w"), indent=1, ensure_ascii=False)

# summary for the report form
pairs = sorted(F)
ok = 0
for n in pairs:
    f, t = wit["fault-%02d.x3d" % n], wit["twin-%02d.x3d" % n]
    caught = (t["all_intent_hold"] is True and f["all_intent_hold"] is False)
    probe_diff = f.get("probe") is not None and json.dumps(f["probe"]) != json.dumps(t["probe"])
    print(n, "intent catches" if caught else "", "probe differs" if probe_diff else "", "twin intent:", t["all_intent_hold"], "ENGINE DISAGREES" if n in ENGINE_DISAGREES else "")
    if not (caught or probe_diff or n in ENGINE_DISAGREES): print("   !! no difference witnessed")
print("faults xsd invalid:", sum(1 for n in pairs if not xsd["fault-%02d.x3d" % n]["xsd_valid"]))
print("pairs with testable intent:", sum(1 for n in pairs if lines("twin-%02d.x3d" % n)[1] > 0))
print("decoys zero console errors:", sum(1 for n in D if not wit["decoy-%02d.x3d" % n]["consoleErrors"]))
print("gl:", wit["decoy-01.x3d"]["gl"], "| engine:", wit["decoy-01.x3d"]["engine"])
