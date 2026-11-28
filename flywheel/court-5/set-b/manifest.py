#!/usr/bin/env python3
import json, os
H = os.path.dirname(os.path.abspath(__file__))
xsd = json.load(open(os.path.join(H, 'xsd.json'))); wit = json.load(open(os.path.join(H, 'witness.json'))); shots = json.load(open(os.path.join(H, 'shots.json')))
L = 'legal, plays wrong'
F = {
 1: ('grouping and transforms', "The beacon's Transform is nested inside the Transform that scales the centimetre model by 0.01, so its 2 m offset and 15 cm radius are scaled a hundredfold down.", "No red ball above the bench; the beacon is a 3 mm speck 2 cm above the floor, hidden inside the bench.", L, 'P036: that is a zero scale on one axis; here a correct scale is inherited by a child that was authored in the outer units'),
 2: ('grouping and transforms', "The visible wall Shape carries containerField='proxy', so it becomes the Collision node's undrawn proxy geometry instead of one of its children.", "The wall is not drawn at all; only the floor is visible, yet the visitor still bumps into something invisible.", L, 'P053: there the shape sat outside the Collision; here it is inside but in the proxy slot, which is never rendered'),
 3: ('DEF and USE', "The Appearance USE='RedPaint' appears in the document before the node that carries DEF='RedPaint'.", "A conforming loader finds no node of that name when it reaches the USE, so the first post has no appearance (unlit white) or the file is rejected.", "error per the X3D standard (XML encoding 19776-1, 4.3.3 and abstract 4.4.3: a DEF name shall be defined before it is USEd, in document order)", 'P103: there the name never matches; here it matches but the USE comes first'),
 4: ('level of detail', "The LOD has no center, so viewer distance is measured to the origin although both versions of the statue are placed 100 m away at x=100.", "From the entry viewpoint 8 m in front of the statue the plain grey block is shown instead of the detailed statue.", L, 'P038/P060/P062: those are about the range list; here the range is fine and the centre is missing'),
 5: ('prototypes', "The prototype body refers with USE to an Appearance whose DEF is in the main scene, outside the prototype's own name scope.", "The bollards get no appearance (unlit white instead of yellow); a strict loader rejects the unresolved USE.", "error per the X3D standard (19775-1 4.4.4.3 prototype scoping rules: a prototype body is its own name scope, DEF names outside it are not visible)", 'P072/P103: those are misspelt names; here the name is spelt right but lives in another name scope'),
 6: ('prototypes', "The prototype body has two top-level Transforms; only the first node of a ProtoBody is the instance's rendered node, the rest are not part of the scene graph where the instance stands.", "Only the grey pole is drawn; the glowing globe on top is missing.", L, 'P066/P118: those are wrong field names on the instance; here the body structure itself drops half of the model'),
 7: ('polygon geometry', "The single four-vertex face is concave (a notched chevron) but convex is left at its default TRUE.", "The notch is filled in: a solid triangle is drawn instead of an arrow-head with a cut-out back.", L + " (the standard leaves the result undefined when a non-convex face is declared convex)", 'P068: that is a self-crossing extrusion outline; here a simple concave face is declared convex'),
 8: ('coordinate arrays', "The Coordinate point list is written as four x-z pairs (8 numbers) instead of four x-y-z triples.", "The floor is missing: the eight numbers are read as two 3D points plus leftovers, so the face indexes points that do not exist.", "error per the X3D standard (MFVec3f is a sequence of 3-tuples; 19776-1 5.x field encoding) and coordIndex then exceeds the coordinates", 'P061/P026: there one index is too large for a correct array; here the array itself has the wrong tuple size'),
 9: ('normals', "The four explicit normals point along -Z, away from the side the face is wound to show and away from the viewer.", "The board is drawn black: the headlight shines on a surface whose normals face away from it.", L, 'P064: that is a wrong number of normals; P105 is a winding error. Here count and winding are right and the vectors are inverted'),
 10: ('text', "FontStyle justify is written \"CENTER\", which is not one of the allowed values (the centring value is \"MIDDLE\").", "The text is not centred: it starts at the doorway axis and runs off to the right.", "error per the X3D standard (19775-1 15.4.1 FontStyle: justify values are BEGIN, END, FIRST, MIDDLE)", 'none: no listed mistake concerns text layout or an enumerated string value'),
 11: ('units and angles', "The rotation is given with a zero-length axis (0 0 0) and a quarter-turn angle.", "The lid lies closed on the chest instead of standing open; a zero axis gives no rotation.", L + " (a rotation needs a normalised axis; a zero axis is commonly treated as no rotation)", 'P035/P075/P109: those have a good axis and an angle in degrees; here the angle is right and the axis is null'),
 12: ('units and angles', "The table top's Box size is given in millimetres (2000 40 900) although X3D lengths are metres.", "A slab two kilometres wide engulfs the camera, which sits inside it; the table and its leg are not recognisable.", L, 'P084: milliseconds in a time field; P037: an object placed far away. Here a size is in the wrong length unit'),
 13: ('Inline and addresses', "The Inline url is an absolute file:/// path into one author's Windows home folder instead of an address relative to the scene.", "The bracket never appears; only the base plate is drawn.", L + " (the address is well formed but resolves nowhere except on the author's machine)", 'P116: a misspelt relative file name; here the name is right but the address is a machine-specific absolute path'),
 14: ('texture data', "The PixelTexture image declares 2 by 2 texels with 3 components but supplies only three pixel values.", "The checker is not shown: the tile is plain white (no texture) instead of four coloured texels.", "error per the X3D standard (19775-1 5.3.6 SFImage: width*height pixel values shall follow the header)", 'P028/P069: a short height array on an ElevationGrid; here the short array is the pixel list of an SFImage'),
 15: ('metadata', "Two metadata nodes are both placed in the Shape's single-valued metadata field.", "Nothing changes on screen, but only one of the two facts is attached: the alloy name is dropped and only the mass remains.", "error per the X3D standard (19775-1 7.2.4: metadata is an SFNode field and holds one node; several facts need a MetadataSet)", 'P119: a wrong containerField inside a MetadataSet; here there is no set and two nodes compete for one slot'),
 16: ('profile and component statements', "The component statement names 'Geometry2d'; component names are case sensitive and the component is 'Geometry2D'.", "A conforming loader does not know the named component, so the level-2 arc node is unsupported under the declared profile and the wedge may be refused.", "error per the X3D standard (19775-1 7.2.5.4 COMPONENT statement: the name shall be a defined component)", 'P071/P089/P117: the statement is absent there; here it is present but names a component that does not exist'),
 17: ('2D geometry', "The Rectangle2D is left in its native X-Y plane (no rotation on its Transform), so it stands upright instead of lying on the ground.", "From the top-down camera the mat is seen exactly edge-on and nothing is drawn.", L, 'P120/P114: a missing centre and a camera facing away; here a 2D node is assumed to lie in the ground plane'),
 18: ('NURBS', "The NurbsCurve has order 4 but only three control points; the order may not exceed the number of control points.", "No curve is drawn.", "error per the X3D standard (19775-1 27.4.4 NurbsCurve / 27.2: at least order control points are required)", 'P070: a knot vector of the wrong length; here the order itself is too high for the control points'),
 19: ('CAD geometry', "The IndexedQuadSet index list is written with -1 separators after each quad, as if it were an IndexedFaceSet coordIndex.", "Only the flat plate is drawn; the standing plate is missing or garbled, because every group of four indices after the first is shifted and contains -1.", "error per the X3D standard (19775-1 32.4.5 IndexedQuadSet: index holds groups of four non-negative indices with no separators)", 'P025: there the -1 terminators are missing where required; here they are present where forbidden, on a different node'),
 20: ('geospatial', "geoCoords is written longitude first (2.2945 48.8584) although the declared GD system reads latitude first.", "The camera looks down on empty ground; the marker is thousands of kilometres away near the equator.", L, 'P037: an absurd distance from the origin; here both numbers are plausible and only their order is wrong'),
}
INT = {}
D = {
 1: ('units and angles', "A hatch stands open a quarter turn; angles are written in degrees and a unit statement in the head declares it.", "A rotation angle of -90 looks like the classic degrees mistake, but the head carries a UNIT statement for angles, which makes degrees legal."),
 2: ('grouping and transforms', "A railing is drawn in detail while an undrawn plain slab is its collision proxy.", "A Shape with no Appearance sits in a Switch that shows nothing and is then USEd with containerField='proxy': it looks like a lost, invisible wall, but an undrawn proxy is exactly what is wanted."),
 3: ('DEF and USE', "A bolt defined in a hidden library is placed three times.", "Switch whichChoice='-1' hides its only child and a Transform is USEd by three parents; both look like mistakes and are the standard library idiom."),
 4: ('polygon geometry', "A two-triangle pinwheel coloured per face, visible from both sides.", "coordIndex has no final -1, five points serve two faces through a shared vertex, and two colours are given for five vertices; the last terminator is optional and colorPerVertex='false' makes two colours correct."),
 5: ('coordinate arrays', "A small survey terrain with a ridge.", "Numbers use commas, exponents, a leading plus sign and a bare leading dot, and xDimension differs from zDimension; all of it is legal and the 12 heights match 3 by 4."),
}
M = {}
def lines(f): return [i for i in wit[f]['intents']]
for n, (cat, fault, sees, spec, prior) in F.items():
    ff, tf = 'fault-%02d.x3d' % n, 'twin-%02d.x3d' % n
    wf, wt, sp = wit[ff], wit[tf], shots['pair-%02d' % n]
    cons_f = [c for c in wf['console'] if 'GL Driver' not in c]
    note = "screenshot pixels differing fault vs twin: %.2f%% (lit: fault %.2f%%, twin %.2f%%)" % (sp['differing_fraction']*100, sp['fault_lit']*100, sp['twin_lit']*100)
    if cons_f: note += "; fault console: " + ' / '.join(c.split('\n')[0][:140] for c in cons_f[:2])
    else: note += "; fault console silent"
    if wf['intents']: note += "; intent on fault: " + ', '.join('%s -> %s (read %s)' % (i['line'], 'holds' if i['holds'] else 'FAILS', i['value']) for i in wf['intents'])
    if wf['stats'].get('metadataProbe'): note += "; SAI metadata of the shape: fault %s, twin %s" % (wf['stats']['metadataProbe'], wt['stats']['metadataProbe'])
    disagrees = sp['differing_fraction'] == 0 and not cons_f and not any(not i['holds'] for i in wf['intents']) and wf['stats'].get('metadataProbe') == wt['stats'].get('metadataProbe')
    e = {'category': cat, 'fault': fault, 'viewer_sees': sees, 'spec': spec, 'xsd_valid': xsd[ff]['xsd_valid'], 'witness': 'x_ite-16.8.0', 'witness_note': note, 'twin': tf, 'nearest_prior': prior,
         'testable_intent': bool(wf['intents'])}
    if disagrees:
        e['engine_disagrees'] = True
        e['witness_note'] += "; X_ITE loads and draws the fault exactly like the twin and says nothing, so the fault rests on the standard, not on this engine"
    M[ff] = e
    assert xsd[tf]['xsd_valid'] and all(i['holds'] for i in wt['intents']) and wt['intent_lines'] == wt['intent_understood']
    tn = "loads, console: %s; lit %.2f%% of the frame" % (' / '.join(c[:100] for c in wt['console'] if 'GL Driver' not in c) or 'silent', sp['twin_lit']*100)
    if wt['intents']: tn += "; " + ', '.join('%s -> holds (read %s)' % (i['line'], i['value']) for i in wt['intents'])
    M[tf] = {'category': cat, 'intent': open(os.path.join(H, tf)).read().split('intent:prose" content="')[1].split('"')[0], 'xsd_valid': True, 'witness': 'x_ite-16.8.0', 'witness_note': tn}
for n, (cat, intent, why) in D.items():
    f = 'decoy-%02d.x3d' % n; w = wit[f]
    errs = [c for c in w['console'] if c.startswith(('error', 'pageerror', 'requestfailed'))]
    other = [c for c in w['console'] if c not in errs]
    assert xsd[f]['xsd_valid'] and not errs and all(i['holds'] for i in w['intents']) and w['intent_lines'] == w['intent_understood'], f
    tn = "loads with zero console errors%s; lit %.2f%% of the frame" % (" (%d GPU driver performance warnings from the screenshot read-back, none from X_ITE)" % len(other) if other else " and zero warnings", shots[f.replace('.x3d', '.png')]['lit_fraction']*100)
    if w['intents']: tn += "; " + ', '.join('%s -> holds (read %s)' % (i['line'], i['value']) for i in w['intents'])
    M[f] = {'category': cat, 'intent': intent, 'xsd_valid': True, 'witness': 'x_ite-16.8.0', 'witness_note': tn, 'why_suspicious': why}
M['helper-bracket.x3d'] = {'category': 'helper', 'intent': 'the part that scene 13 brings in', 'xsd_valid': xsd['helper-bracket.x3d']['xsd_valid'], 'witness': 'x_ite-16.8.0', 'witness_note': 'loaded through twin-13'}
json.dump(M, open(os.path.join(H, 'MANIFEST.json'), 'w'), indent=1, ensure_ascii=False)
fs = [v for k, v in M.items() if k.startswith('fault')]
print('faults', len(fs), 'xsd invalid', sum(not v['xsd_valid'] for v in fs), 'disagree', [k for k, v in M.items() if v.get('engine_disagrees')],
      'testable', sum(v['testable_intent'] for v in fs), 'legal', sum(v['spec'].startswith('legal') for v in fs))
print(wit['__tools'])
