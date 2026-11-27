# Blind court 3: results

27 November 2026. The plan this answers is `PREREG.md`, pushed at 22:00 UTC before the set was opened. Nothing in
that file was changed afterwards. Every number here is printed by `score/score.py` from files in `score/`.

## The result in one table

| Measure | Old kernel `ebe969b` | New kernel `d647a10` | Change |
|---|---|---|---|
| **All 40 planted faults caught** | **19** | **25** | **+6, none lost** |
| Behaviour faults (set A, 20) | 8 | 11 | +3 |
| Structure faults (set B, 20) | 11 | 14 | +3 |
| Caught by the XSD alone | 5 (all in set B) | 5 | 0 |
| Strict count (XSD, or a warning or error) | 19 | 25 | same as above |
| Without the two faults whose topic leaked (38) | 18 | 24 | +6 |
| Warnings or errors on the 50 legal files | 18 on 16 files | 18 on 16 files | 0 from the 11 new checks |
| Of those, wrong (second reader) | 0 | 0 | |

Instruments: x3d_mcp `validate_xml` (X3D 4.0 XSD) and `semantic_diagnostics`, run once per kernel by
`score/run_kernel.py`, Python 3.13.18, lxml 6.1.3. "Caught" is the rule courts 2 and 2b used: the file fails the
XSD, or a diagnostic at any level names the planted mistake. Two readers decided "names" separately and agree on
all 40 faults for both kernels: a fresh agent that had not seen the kernel (`score/reader-verdicts.json`) and
the kernel editor (`score/editor-verdicts.json`, written first).

## Against what we wrote down

| # | Expectation | Result | Verdict |
|---|---|---|---|
| H1 | New kernel catches at least 3 more than the old on this set | +6 (19 to 25) | **holds** |
| H2 | New kernel catches at least 26 of 40 | 25 | **fails, by one** |
| H3 | No wrong warning or error on the 10 decoys | 2 decoys flagged, both complaints right | holds |
| H4 | At most 2 of 40 twins draw a wrong warning or error | 14 twins flagged, 0 wrong | holds |
| Guess | Old: behaviour 10 to 12, structure 12 to 14. New: behaviour 12 to 15, structure 13 to 15 | 8, 11, 11, 14 | three of four guesses too high |

Six faults moved from missed to caught and none moved the other way. With six changes all in one direction, an exact
sign test gives p = 0.031 (two-sided, 2 x 0.5^6, worked by hand). That is thin: one author each, twenty faults each.

## What it means

1. **The checks written from the last blind test did carry over to a new one.** Five of the 11 new checks caught
   six faults in a set written by authors who had never seen them: a touch sensor with nothing to sense, a
   ProximitySensor of size 0 0 0, a sequencer driving a Switch past its children, a static `whichChoice` past its
   children, a rotation of 90, and a light with direction 0 0 0. They raised nothing on the 50 legal files.
2. **Seen and unseen are far apart, again.** The new kernel flags 37 of 40 on the sets its checks were written
   from and 25 of 40 here: 92% against 62%. The gap is the size of the over-fitting, and it is the number to
   watch from turn to turn.
3. **This set was harder for the old kernel than the last one.** The same code scored 24 of 40 on courts 2 and 2b
   and 19 of 40 here. A score on one set cannot be compared with a score on another; only the paired 19 to 25 on
   this set measures the turn.
4. **The 15 misses are mostly "legal, plays wrong".** They are the next rule candidates, and they are now seen:
   a clock with loop false that was meant to repeat, PlaneSensor limits swapped, a clock left running that should
   wait for a click, a damper with tau 0, the wrong StringSensor output, a Script handler whose name matches no
   field, Viewpoint order, a LoadSensor watching an Inline that never loads, an Anchor fragment in the wrong case,
   a LOD range as long as its children, `ccw` false on outward faces, a ProtoInstance field name that the prototype
   does not declare, a self-crossing cross-section, a NURBS knot vector one short, and a lit scene with the
   headlight off and no light. Several need the intent to be stated, which a file cannot do alone.

## Every fault

| File | Family | Planted mistake | Witness | Old kernel | New kernel |
|---|---|---|---|---|---|
| a/fault-01 | route-wiring | TimeSensor ROUTE source field is misspelt fraction_change instead of fraction_changed | X_ITE | caught (`route-invalid-from-field`) | caught (`route-invalid-from-field`) |
| a/fault-02 | route-type | The interpolator SFVec3f output is routed to Lamp set_rotation (SFRotation) instead of set_translation | X_ITE | caught (`route-type-mismatch`) | caught (`route-type-mismatch`) |
| a/fault-03 | route-access | ROUTE fromField is Leader set_translation (an inputOnly event) instead of translation_changed | X_ITE | caught (`route-invalid-from-field`) | caught (`route-invalid-from-field`) |
| a/fault-04 | timing-loop | TimeSensor has loop=false with a startTime long in the past, though the pulse is meant to repeat forever | X_ITE | missed | missed |
| a/fault-05 | route-wiring | ROUTE toNode is door but the node is DEF Door (case mismatch) | X_ITE | caught (`route-missing-to-node`) | caught (`route-missing-to-node`) |
| a/fault-06 | interpolator-keys | PositionInterpolator has three keys but only two keyValue triples | X_ITE | caught (`interpolator-key-length`) | caught (`interpolator-key-length`) |
| a/fault-07 | interpolator-keys | ScalarInterpolator key list 0 0.8 0.5 is not non-decreasing (should be 0 0.5 1) | X_ITE | caught (`interpolator-key-order`) | caught (`interpolator-key-order`) |
| a/fault-08 | pointing-sensor | TouchSensor sits in a different Group from the sphere, so it is not a sibling of the geometry it should sense | X_ITE | missed | caught (`sensor-senses-nothing`) |
| a/fault-09 | drag-sensor | PlaneSensor minPosition 2 0 and maxPosition 0 0 are swapped (min greater than max leaves x unconstrained) | X_ITE | missed | missed |
| a/fault-10 | trigger-toggle | The clock is left enabled (default) so the spinner runs from load, though it should wait for the first click | reasoned | missed | missed |
| a/fault-11 | follower | PositionDamper tau is 0 (no smoothing) instead of 0.5 | X_ITE | missed | missed |
| a/fault-12 | environment-sensor | ProximitySensor size is 0 0 0 (disabled) instead of 30 30 30 | X_ITE | missed | caught (`sensor-zero-size`) |
| a/fault-13 | environment-sensor | The Wall Shape is a sibling of the Collision node instead of its child | reasoned | caught (`empty-group`) | caught (`empty-group`) |
| a/fault-14 | key-sensor | StringSensor enteredText is routed to the label instead of finalText | reasoned | missed | missed |
| a/fault-15 | switch-sequencer | IntegerSequencer last keyValue is 3 but the Switch has only choices 0..2 | reasoned | missed | caught (`switch-index-past-children`) |
| a/fault-16 | script | Script handler function is named onTick but the inputOnly field is named tick, so it is never called | reasoned | missed | missed |
| a/fault-17 | viewpoint-binding | The Closeup Viewpoint is listed before Overview, so Closeup is bound at load | X_ITE | missed | missed |
| a/fault-18 | load-sensor | The watched Inline has load=false so it never loads and LoadSensor never reports isLoaded | X_ITE | missed | missed |
| a/fault-19 | anchor-navigation | Anchor url fragment is #Closeup but the Viewpoint is DEF CloseUp (case mismatch) | X_ITE | missed | missed |
| a/fault-20 | lod | LOD range is 20 5 (decreasing) instead of 5 20 | X_ITE | caught (`lod-range-order`) | caught (`lod-range-order`) |
| b/fault-01 | geometry-indices | One face of the indexed face set references vertex index 8 but only vertices 0 to 7 exist. | X_ITE | caught (`index-out-of-range`) | caught (`index-out-of-range`) |
| b/fault-02 | lod-switch | LOD range has three entries for three children; it must have one fewer entry than children. | X_ITE | missed | missed |
| b/fault-03 | winding | ccw is set to false although the faces are wound counter-clockwise seen from outside. | X_ITE | missed | missed |
| b/fault-04 | normals | Six per-face normals are supplied while normalPerVertex is true and there are eight vertices. | X_ITE | caught (`attribute-count-mismatch`) | caught (`attribute-count-mismatch`) |
| b/fault-05 | colour | Colour components are written on a 0 to 255 scale instead of 0 to 1. | X_ITE | caught (`xsd`) | caught (`xsd`) |
| b/fault-06 | proto | The ProtoInstance sets a field called towerColour but the prototype declares towerColor. | X_ITE | missed | missed |
| b/fault-07 | texture-coordinates | The TextureCoordinate holds three points for a four-vertex face. | X_ITE | caught (`attribute-count-mismatch`) | caught (`attribute-count-mismatch`) |
| b/fault-08 | extrusion | The cross-section points are ordered so the outline crosses itself (a bow-tie) instead of tracing the square. | X_ITE | missed | missed |
| b/fault-09 | elevationgrid | height lists 11 values but xDimension times zDimension is 12. | X_ITE | caught (`array-count`) | caught (`array-count`) |
| b/fault-10 | nurbs | The uKnot vector has six values but uDimension plus uOrder needs seven. | reasoned | missed | missed |
| b/fault-11 | profile-component | The scene uses a NURBS node but neither the profile nor a component statement provides the NURBS component. | X_ITE | caught (`profile-component`) | caught (`profile-component`) |
| b/fault-12 | def-use | USE refers to wheel but the node was defined as Wheel; names are case sensitive. | X_ITE | caught (`use-undefined-def`) | caught (`use-undefined-def`) |
| b/fault-13 | def-use | The blue ball reuses the DEF name RedPost, so the later USE resolves to the ball. | X_ITE | caught (`xsd`) | caught (`xsd`) |
| b/fault-14 | containment | Material is placed directly in Shape instead of inside Appearance. | X_ITE | caught (`xsd`) | caught (`xsd`) |
| b/fault-15 | angle-units | The rotation angle is written as 90, which X3D reads as ninety radians. | X_ITE | missed | caught (`angle-looks-like-degrees`) |
| b/fault-16 | angle-units | fieldOfView is given as 60 (degrees) but is in radians and must be in (0, pi). | X_ITE | caught (`xsd`) | caught (`xsd`) |
| b/fault-17 | navigation-lighting | The headlight is switched off and the scene has no other light, so the lit sphere is unlit. | X_ITE | missed | missed |
| b/fault-18 | lod-switch | whichChoice is 3, counted from one, but choices are indexed from zero so index 3 selects nothing. | X_ITE | missed | caught (`switch-index-past-children`) |
| b/fault-19 | material-range | shininess is 50 where the legal range is 0 to 1. | X_ITE | caught (`xsd`) | caught (`xsd`) |
| b/fault-20 | lights | The DirectionalLight direction is the zero vector. | X_ITE | missed | caught (`light-direction-zero`) |

## The 50 legal files

Sixteen of the 50 twins and decoys draw a warning or an error, 18 complaints in all, from checks that were already
in the old kernel. The second reader judged all 18 right under the standard. They are the authors' own slips,
present in the fault and in its twin alike:

| Complaint | Count | Files | Why it is there |
|---|---|---|---|
| `profile-component` | 10 | 8 twins, 1 decoy | Anchor, LOD, Switch, Extrusion, ElevationGrid or CoordinateDouble used under `profile='Interchange'` without the component level the X3D object model requires |
| `rotation-axis-not-unit` | 5 | 4 twins, 1 decoy | axis written 1 1 0 |
| `route-type-mismatch` | 2 | 2 twins | an SFString routed to `Text.string`, which is MFString |
| `containerfield-unknown` | 1 | 1 twin | CoordinateDouble under NurbsCurve without `containerField='controlPoint'` |

One disagreement between the readers: the kernel editor first marked the two CoordinateDouble complaints doubtful,
because the object model lists that node under Rendering level 1 and Interchange includes Rendering. The second
reader marked them right, and is: the object model's list of nodes allowed in Interchange does not contain
CoordinateDouble. The editor's file is left as written.

Most of the component complaints trace to our own kit. The copy of X_ITE handed to the authors had no component
files, so scenes declaring `Immersive` would not load, and both authors fell back to `Interchange`. The witness
files then show X_ITE 16.8.0 loading Switch, LOD, Extrusion and ElevationGrid under a bare `Interchange` header
with no console message (`set-b/witness.json`, grade L: the authors' run, not repeated). The kernel's message says
that X_ITE refuses such files. For those four nodes it does not.

## Two leaks and one confound, as they turned out

- The structure author's closing report named NURBS for faults 10 and 11. Neither was affected: fault 10 (knot
  vector) is missed by both kernels and fault 11 (undeclared NURBS component) is caught by both, by a check that
  was already on main. Dropping the pair gives 18 to 24 of 38.
- The behaviour author's report named five node types. No check was changed after it.
- The component confound did what `PREREG.md` said it might: seven fault files carry a component error that is not
  the planted mistake. Neither reader counted any of them as a catch.

## What this does not show

One browser engine is the witness, and 6 of the 40 pairs were reasoned and not run. Both authors, the second reader
and the rule writer are agents of the same family in the same project. Forty faults is a small sample. The set
is now seen: from here on any score on it is a fix confirmation, and it joins courts 2 and 2b as a regression set.

## Files

| Path | What |
|---|---|
| `PREREG.md` | the plan, pushed before the set was opened |
| `author-a.tar`, `author-b.tar` | the sealed archives; `sha256sum` must print the two hashes in `PREREG.md` |
| `set-a/`, `set-b/` | the 90 scenes, each author's `MANIFEST.json` (the answer key) and `witness.json` |
| `score/run_kernel.py` | runs one x3d_mcp checkout over the sets |
| `score/results-old.json`, `score/results-new.json` | every diagnostic of each kernel, with the commit and source hashes |
| `score/packet.json`, `score/emit.json` | what the second reader was given, and which kernel produced each finding (not given to the reader) |
| `score/reader-verdicts.json`, `score/editor-verdicts.json` | the two readings |
| `score/score.py`, `score/results.json` | the count, and the script that prints it |

To rerun: check out x3d_mcp at `ebe969b` and at `d647a10`, then
`python3 flywheel/court-3/score/run_kernel.py <x3d_mcp> flywheel/court-3 out.json` for each, and
`python3 flywheel/court-3/score/score.py`.
