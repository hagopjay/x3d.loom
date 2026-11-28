#!/usr/bin/env python3
"""Writes MANIFEST.json from the authored notes below plus measured xsd.json and witness.json."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
xsd = json.load(open(os.path.join(HERE, 'xsd.json')))
wit = json.load(open(os.path.join(HERE, 'witness.json')))
W = 'x_ite-16.8.0'
# (category, fault sentence, viewer_sees, spec, intent of twin)
N = {
 1: ("containment", "Material is placed directly inside Shape instead of inside an Appearance node.",
     "The ball is flat unlit white instead of shaded red; the material is dropped.",
     "error per the X3D standard (Shape has only appearance and geometry fields; Material belongs in Appearance.material; 19775-1 12.4.5 and XML content model)",
     "A shaded, shiny red ball."),
 2: ("def-use", "Two Transform USE elements carry their own translation attributes, as if USE made an editable copy; a USE is the same node and other attributes are ignored.",
     "Only one post is visible at x=-2 (three coincident instances) instead of a fence of three posts.",
     "error per the X3D standard (DEF/USE semantics 19775-1 4.4.3 and XML encoding 19776-1: a USE element has no other fields besides containerField); schema cannot express it",
     "Three posts at x=-2, 0, 2 sharing one Shape by USE inside separate Transforms."),
 3: ("def-use", "USE='brassLook' does not match the declared DEF='BrassLook' (names are case sensitive), so the reference dangles.",
     "The cone knob is flat unlit white while the ball knob is brass.",
     "error per the X3D standard (a USE name shall refer to a previously DEF-ed node, 19775-1 4.4.3; USE is xs:IDREF, though lxml/libxml2 schema validation did not flag it)",
     "Both knobs share the brass appearance."),
 4: ("geometry-indices", "coordIndex is written 1-based: every index is one too high, so index 6 is out of range for the six coordinates and every face uses the wrong corners.",
     "A broken shape: faces missing or connecting wrong corners instead of a closed tent.",
     "error per the X3D standard (index values shall be in range 0..N-1 of the Coordinate node, 19775-1 13.3.6 IndexedFaceSet)",
     "A closed ridge tent with five faces."),
 5: ("geometry-winding", "The lid face is listed clockwise (3 7 6 2) while all other faces are counter-clockwise, with ccw and solid at TRUE, so the lid is back-face culled and its normal points inward.",
     "The crate has no lid when seen from above: you look into an open box whose inside is also invisible.",
     "legal, renders wrong",
     "A closed crate with all six faces visible from outside."),
 6: ("geometry-per-face-data", "Five colours are meant one per face, but colorPerVertex is left at its default TRUE, so the five colours are applied to the five vertices and blended across faces.",
     "Faces show smooth rainbow gradients instead of flat red, green, blue, yellow and grey faces.",
     "legal, renders wrong",
     "Each pyramid face one flat colour."),
 7: ("parametric-geometry", "The Extrusion crossSection is not closed (the first point is not repeated at the end), so only three of the four side walls are generated.",
     "The beam is missing its front wall; you see through it.",
     "legal, renders wrong",
     "A closed four-sided capped beam."),
 8: ("parametric-geometry", "xDimension and zDimension are swapped (3 and 5 instead of 5 and 3) while the 15 heights are laid out as 3 rows of 5, so the heights are re-read as 5 rows of 3.",
     "A skewed zig-zag surface on a 2 m by 8 m footprint instead of a straight ridge on a 4 m by 4 m patch.",
     "legal, renders wrong",
     "A straight ridge along X on a 4 m by 4 m patch."),
 9: ("units-angles", "The rotation angle is given in degrees (-90) but SFRotation angles are radians; -90 rad is about a 117 degree turn the other way round.",
     "The arrow points down and to the right at an odd angle instead of horizontally along +X.",
     "legal, renders wrong",
     "Arrow lying horizontally, tip towards +X."),
 10: ("value-ranges", "diffuseColor is written on a 0-255 scale (255 128 0); colour components must be in 0..1.",
     "The box is saturated yellow (values clamp to 1 1 0) instead of orange.",
     "error per the X3D standard (SFColor components are in the range [0,1], 19775-1 5.3.2); schema pattern rejects it",
     "An orange box."),
 11: ("appearance-material", "transparency='1' was written where full opacity was meant (transparency is the inverse of opacity/alpha), making the ball completely invisible.",
     "Only the floor is visible; the ball is gone.",
     "legal, renders wrong",
     "An opaque blue ball on the floor."),
 12: ("appearance-texture", "TextureTransform scale='0.25 0.25' was used to repeat the tile four times; the transform acts on texture coordinates, so 0.25 magnifies the image fourfold and 4 is needed to repeat it.",
     "The panel shows a quarter of one checker square (a plain light panel) instead of an 8 by 8 checkerboard.",
     "legal, renders wrong",
     "8 by 8 checker squares across the panel."),
 13: ("lights", "DirectionalLight direction='0 1 0' was written as if it were the place the light comes from; direction is the way the light travels, so the sun shines upward from below.",
     "The ground top is black and the ball is lit only on its underside.",
     "legal, renders wrong",
     "Ground and top of the ball brightly lit from overhead."),
 14: ("viewpoint", "The camera is moved to z=-8 behind the statue but keeps the default orientation, which looks along -Z, away from the statue.",
     "An empty black view; the statue is behind the camera.",
     "legal, renders wrong",
     "The statue seen from behind with the blue back plate in the middle."),
 15: ("switch", "whichChoice='2' was used for the second child; choices are numbered from 0, so 2 is out of range for two children and nothing is chosen.",
     "Nothing is drawn instead of the green lamp.",
     "legal, renders wrong",
     "The green GO lamp is shown."),
 16: ("inline-url", "The Inline url says support_bracket.x3d (underscore) but the file is support-bracket.x3d (hyphen), so the reference cannot be resolved.",
     "The base plate is there but the red bracket is missing; a load error is logged.",
     "legal, renders wrong (well-formed and schema-valid; the url simply resolves to nothing)",
     "The red bracket stands on the plate."),
 17: ("profile-component", "The scene uses a NURBS surface node under profile Immersive without a <component name='NURBS' level='1'/> statement; Immersive does not include the NURBS component.",
     "Nothing is drawn; the browser reports an unknown node type.",
     "error per the X3D standard (a scene shall only use nodes of its declared profile and components, 19775-1 7.2.5.3-7.2.5.4 and component NURBS level 1)",
     "A smooth green hill patch."),
 18: ("proto", "The first ProtoInstance sets fieldValue name='color', but the prototype interface declares the field as 'pillarColor'; the value is discarded and the default grey is used.",
     "The left pillar is grey instead of red.",
     "error per the X3D standard (a ProtoInstance fieldValue shall name a field declared in the ProtoInterface, 19775-1 4.4.4.3 / 19776-1 ProtoInstance)",
     "Red pillar left, blue pillar right."),
 19: ("metadata", "The third entry of the MetadataSet has containerField='metadata' instead of 'value', so priceEUR becomes metadata about the set itself rather than one of its payload entries.",
     "No visible change; the catalog set holds two entries instead of three, so any reader of the set's value list misses the price.",
     "legal, renders wrong (loads with different data)",
     "The catalog set holds sku, finish and priceEUR as three value entries."),
 20: ("transform-hierarchy", "The door Transform rotates about its own origin (the middle of the leaf) because no center is given for the hinge edge.",
     "The door leaf stands edge-on in the middle of the opening, spun about its own middle, instead of swinging on the hinge post.",
     "legal, renders wrong",
     "The door leaf hangs on the x=0 post and stands open towards the viewer."),
}
DEC = {
 1: ("def-use", "Two bolts drawn from one shape defined in a hidden Switch library.",
     "The only DEF of the shape sits inside a Switch with whichChoice=-1, which a hasty reviewer reads as geometry that never renders; USE instances elsewhere are legal and render."),
 2: ("transform-hierarchy", "A bracket and its mirror image made with scale='-1 1 1'.",
     "A negative scale looks like a typo or a face-flipping bug; X3D 4.0 allows negative scale as reflection and the browser keeps faces outward."),
 3: ("geometry-winding", "A closed crate whose faces are all listed clockwise, with ccw='false'.",
     "Every face is wound clockwise with solid='true', which looks like an inside-out mesh; ccw='false' declares exactly that order. The coordIndex also has no trailing -1, which is legal."),
 4: ("viewpoint", "A telephoto view from 400 m with fieldOfView 0.02 rad.",
     "A camera 400 m away with a tiny field of view looks like a units slip or a lost scene; the numbers are consistent and the box spans about 37% of the frame width."),
 5: ("appearance-material", "A disc that glows orange by emission alone with all lights off.",
     "headlight='false', no light nodes and a black diffuse colour usually mean a black scene; emissiveColor needs no light, so the disc is evenly orange."),
}
M = {}
def tw(f): return bool(xsd[f]['xsd_valid'])
for i, (cat, fault, sees, spec, intent) in N.items():
    f, t = 'fault-%02d.x3d' % i, 'twin-%02d.x3d' % i
    p = wit['pairs']['%02d' % i]
    fe = [c for c in p['fault_console'] if not c.startswith('warning: [.WebGL')]
    te = [c for c in p['twin_console'] if not c.startswith('warning: [.WebGL')]
    note = "%.1f%% of pixels differ from twin (400x300); fault console: %d error(s), %d warning(s)%s" % (
        100 * p['pixels_differ_fraction'], sum(c.startswith(('error', 'pageerror')) for c in fe), sum(c.startswith('warning') for c in fe),
        ('; first message: ' + fe[0][:160]) if fe else '')
    if p['fault_probe'] is not None:
        note += "; SAI fault=%s twin=%s" % (json.dumps(p['fault_probe']), json.dumps(p['twin_probe']))
    assert p['pixels_differ_fraction'] > 0 or p['fault_probe'] != p['twin_probe'], i
    assert not te and tw(t), i
    M[f] = {"category": cat, "fault": fault, "viewer_sees": sees, "spec": spec, "xsd_valid": tw(f),
            "witness": W, "witness_note": note, "twin": t}
    if not tw(f): M[f]["xsd_error"] = xsd[f]['errors'][0]
    if p['pixels_differ_fraction'] == 0:
        M[f]["witness_note"] += "; the difference is in loaded data only, not in the picture (not an engine disagreement: the SAI read differs)"
    M[t] = {"category": cat, "intent": intent, "xsd_valid": True, "witness": W,
            "witness_note": "drawn pixels %.1f%% of frame; console: 0 errors, 0 warnings" % (100 * p['twin_drawn_fraction'])}
for i, (cat, intent, why) in DEC.items():
    d = 'decoy-%02d.x3d' % i
    q = wit['decoys']['%02d' % i]
    scene_msgs = [c for c in q['console'] if not c.startswith('warning: [.WebGL')]
    assert q['errors'] == 0 and not scene_msgs and q['drawn_fraction'] > 0.01 and tw(d), i
    note = "drawn pixels %.1f%% of frame; console: 0 errors, 0 scene warnings" % (100 * q['drawn_fraction'])
    if len(q['console']) != len(scene_msgs): note += " (%d GL driver performance message(s) about ReadPixels from the screenshot path, unrelated to the scene)" % (len(q['console']) - len(scene_msgs))
    if i == 2: note += "; picture is exactly left-right symmetric (0.0%% asymmetric pixels)" if q['mirror_asymmetry_fraction'] == 0 else "; asymmetry %.2f%%" % (100 * q['mirror_asymmetry_fraction'])
    if i == 3: note += "; %.1f%% of pixels differ from the counter-clockwise crate of twin-05 at the same viewpoint" % (100 * q['pixels_differ_from_twin_05_fraction'])
    if i == 5: note += "; centre pixel RGB %s" % (q['centre_pixel'],)
    M[d] = {"category": cat, "intent": intent, "xsd_valid": True, "witness": W, "witness_note": note, "why_suspicious": why}
M['support-bracket.x3d'] = {"category": "support", "intent": "Target file of the Inline in pair 16 (not a test case itself).", "xsd_valid": tw('support-bracket.x3d'), "witness": W, "witness_note": "loaded through twin-16"}
json.dump(M, open(os.path.join(HERE, 'MANIFEST.json'), 'w'), indent=1, sort_keys=True, ensure_ascii=False)
print(len(M), 'entries; faults xsd-invalid:', sum(1 for k, v in M.items() if k.startswith('fault') and not v['xsd_valid']))
