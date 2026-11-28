#!/usr/bin/env python3
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen
H = gen.OUT
xsd = json.load(open(os.path.join(H, 'xsd.json')))
wit = json.load(open(os.path.join(H, 'witness.json')))['results']
diff = json.load(open(os.path.join(H, 'pixeldiff.json')))
F = {
 1: ('geometry-winding', "Two faces of the solid are listed clockwise as seen from outside while solid and ccw keep their defaults.", "Those two faces vanish when looked at from outside; the block looks open.", "legal, plays wrong", 'S01', "P105, same kind (a face wound the wrong way under default solid/ccw)"),
 2: ('scene-structure', "The Inline is placed inside a Shape, under an Appearance, as if it were the Shape's geometry.", "The inlined part never appears; only the marker post is shown.", "error per the X3D standard (Shape has only appearance and geometry fields; Inline is a child node and must sit in a grouping node)", 'S02', "P021/P022 are also misplaced nodes but concern Material/Appearance; different node and slot"),
 3: ('geometry-indexing', "The IndexedFaceSet has a Coordinate node but no coordIndex at all.", "Nothing is drawn.", "legal, plays wrong (no faces are defined)", 'S03', "P025 lacks only the -1 terminators; here the whole index list is missing"),
 4: ('geometry-indexing', "coordIndex lists only the first four of the eight outline points, and those four lie on one straight line.", "Nothing is drawn: the single face has zero area.", "legal, plays wrong", 'S04', "none; P061/P104 are out-of-range indices, this one is in range but degenerate"),
 5: ('texturing', "The TextureTransform rotates the picture without a center, so it turns about the texture origin (a corner) instead of the middle of the picture.", "The badge swings out of the panel; one colour smears over most of it.", "legal, plays wrong", 'S05', "P112 is a TextureTransform scale misunderstanding; P120 is a missing Transform center; neither is the texture pivot"),
 6: ('time-control', "The script freezes the animation by switching TimeSensor.enabled off and on instead of sending pauseTime and resumeTime.", "The planet freezes, but on the next press it does not carry on from where it stood (it jumps, or stays put, depending on the browser).", "legal, plays wrong", 'S06', "none; P013/P050 concern enabled on other sensors, not pausing"),
 7: ('time-control', "The TimeSensor has loop='true' although the motion is meant to play once and stop at the end.", "The ball keeps jumping back and gliding again for ever, and is already moving before it is touched.", "legal, plays wrong", 'S07', "inverse of P044/P083 (those lack loop where repetition was wanted)"),
 8: ('lighting', "The DirectionalLight sits in a Transform that holds no geometry and is left non-global (the default since X3D 3.2), so it lights nothing.", "The ball stays black; the sweeping lamp has no effect.", "legal, plays wrong", 'S08', "P077 (no light reaches the object) is the nearest; cause differs (light scope, not headlight)"),
 9: ('scripting', "The script builds the MFVec3f with a JavaScript array as its single argument, new MFVec3f([a, b]), instead of passing the values as arguments.", "The rope is not stretched to the hook; it disappears or stays as it was.", "error per the X3D ECMAScript binding (MFVec3f constructor takes SFVec3f arguments, not an array)", 'S09', "none"),
 10: ('scripting', "The script assigns addChildren twice in the same handler; the second assignment replaces the first before either is processed.", "Only the ball lands on the shelf; the crate is missing.", "legal, plays wrong (one event per field per timestamp)", 'S10', "P017/P098 are fan-in by ROUTE; this is two writes to one input from one script"),
 11: ('prototypes', "The prototype body has two root nodes; only the first node of a ProtoBody is rendered.", "Each instance shows only the red ball.", "legal, plays wrong (X3D 4.3.4.3: only the first body node is rendered)", 'S11', "none; P066/P118 are about proto field names"),
 12: ('coordinates', "The survey coordinates are used raw, hundreds of thousands and millions of units from the origin, where single precision cannot hold centimetres.", "The outline is visibly distorted: corners snap to a coarse grid and edges are no longer where they were measured.", "legal, plays wrong", 'S12', "P037 (object far from origin); same family, here the symptom is precision loss rather than being out of sight"),
 13: ('coordinates', "The hut's coordinates are written with Z as the height (a Z-up source), while the ElevationGrid ground lies in the XZ plane with Y up.", "The hut lies on its side, half above the ground at the wrong place.", "legal, plays wrong", 'S13', "none; P108/P113/P114 are other axis confusions"),
 14: ('def-use', "USE='Paint' appears in the file before the node that carries DEF='Paint'.", "In a strict browser the first post has no appearance (unlit white) or the file is rejected.", "error per the X3D standard (a USE shall refer to a DEF that occurs earlier in the file)", 'S14', "P072/P103 are case mismatches; here the name matches but the order is wrong"),
 15: ('point-rendering', "pointSizeMinValue is raised to 5 while pointSizeMaxValue is left at its default 1, so minimum exceeds maximum.", "The marks are drawn as barely visible single pixels.", "error per the X3D standard (pointSizeMinValue shall be less than or equal to pointSizeMaxValue)", 'S15', "P049 is the same shape of mistake (min above max) on another node"),
 16: ('lighting', "The Appearance holds only the texture and no Material, so the surface is unlit and ignores the dim light.", "The water glows at full brightness in the dark scene.", "legal, plays wrong", 'S16', "P021/P101 put the Material in the wrong place; here it is simply absent"),
}
DEC = {
 1: ('geometry-colour', 'S17', "Per-face colours through colorIndex with colorPerVertex false, an empty Material, a rotation by a zero angle and nested Transforms with off-centre pivots; the author saw nothing and suspected the colour lists."),
 2: ('geometry-colour', 'S18', "ColorRGBA with every alpha at 1 on non-convex, non-solid face sets with no Appearance; the author doubted the alpha and two-sided settings."),
 3: ('lighting', 'S19', "A very narrow SpotLight (beamWidth 0.2, cutOffAngle 0.4) with the headlight off; the author thought the squares were lit wrongly."),
 4: ('collision', 'S20', "A Collision node that is enabled and also carries a proxy shape that is never drawn; the author asked whether that combination was a mistake."),
 5: ('texturing', 'S21', "A 2x2 PixelTexture with no TextureProperties stretched over a whole crate; the author took the blurred result in some browsers for a defect."),
}
M = {}
for n, (cat, fault, sees, spec, src, prior) in F.items():
    f, t = 'fault-%02d.x3d' % n, 'twin-%02d.x3d' % n
    p = gen.P[n]
    wf, wt = wit[f], wit[t]
    testable = bool([i for i in p['intents'] if i.startswith('after')])
    caught = testable and not wf['allHold'] and wt['allHold']
    probe = ''
    if n == 10: probe = ' Shelf.children holds %d node(s) on the fault and %d on the twin.' % (wf['probes'].get('shelfChildren'), wt['probes'].get('shelfChildren'))
    if n == 2: probe = ' X_ITE console on the fault: ' + '; '.join(wf['console'])
    note = 'Rendered frames of fault and twin differ in %d of 120000 pixels.' % diff[str(n)] + probe
    if testable: note += ' Intent assertions: fault %s, twin %s.' % ('all hold' if wf['allHold'] else 'at least one fails', 'all hold' if wt['allHold'] else 'FAIL')
    disagrees = diff[str(n)] == 0 and not caught and not wf['console']
    if disagrees: note += ' X_ITE resolves the reference anyway and draws the fault exactly like the twin.'
    M[f] = {'category': cat, 'fault': fault, 'viewer_sees': sees, 'spec': spec, 'xsd_valid': xsd[f]['xsd_valid'],
            'witness': 'x_ite-16.8.0', 'witness_note': note, 'engine_disagrees': disagrees, 'twin': t, 'source': src, 'nearest_prior': prior}
    M[t] = {'category': cat, 'intent': p['prose'], 'xsd_valid': xsd[t]['xsd_valid'], 'witness': 'x_ite-16.8.0',
            'witness_note': 'Loads with %d console message(s); %s.' % (len(wt['console']), ('all %d intent assertions hold' % wt['assertions']) if testable else 'prose intent only, frame inspected by eye'), 'source': src}
for n, (cat, src, why) in DEC.items():
    d = 'decoy-%02d.x3d' % n
    M[d] = {'category': cat, 'intent': gen.D[n]['prose'], 'xsd_valid': xsd[d]['xsd_valid'], 'witness': 'x_ite-16.8.0',
            'witness_note': 'Loads with %d console message(s) and draws the described picture; prose intent only.' % len(wit[d]['console']), 'source': src, 'why_suspicious': why}
M['helper-bracket.x3d'] = {'category': 'helper', 'intent': 'Scene loaded by the Inline of pair 02.', 'xsd_valid': xsd['helper-bracket.x3d']['xsd_valid'], 'witness': 'x_ite-16.8.0', 'witness_note': 'Shown through twin-02.', 'source': 'S02'}
json.dump(M, open(os.path.join(H, 'MANIFEST.json'), 'w'), indent=1, ensure_ascii=False)
pairs = len(F)
print('faults', pairs, 'xsd invalid', sum(1 for n in F if not xsd['fault-%02d.x3d' % n]['xsd_valid']),
      'testable', sum(1 for n in F if [i for i in gen.P[n]['intents'] if i.startswith('after')]),
      'disagree', sum(1 for k, v in M.items() if v.get('engine_disagrees')),
      'decoys zero console', sum(1 for n in DEC if not wit['decoy-%02d.x3d' % n]['console']),
      'twins all hold', all(wit['twin-%02d.x3d' % n]['allHold'] for n in F), 'all valid', all(v['xsd_valid'] for k, v in M.items() if not k.startswith('fault')))
