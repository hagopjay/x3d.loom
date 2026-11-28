# Blind court 4: results

28 November 2026. The plan this answers is `PREREG.md`, pushed at 03:15 UTC (x3d.loom `4a2a87e`) before the set was
opened. Nothing in that file was changed afterwards. Every number here is printed by `score/score.py` from files in
`score/`, except where a line says otherwise.

## The result in one table

| Measure | Old kernel `ca0e75c` | New kernel `c185673` | Change |
|---|---|---|---|
| **All 40 planted faults caught** | **19** | **23** | **+4, none lost** |
| Behaviour faults (set A, 20) | 12 | 13 | +1 |
| Structure faults (set B, 20) | 7 | 10 | +3 |
| Caught by the XSD alone | 3 (1 in set A, 2 in set B) | 3 | 0 |
| Strict count (XSD, or a warning or error) | 19 | 23 | same as above |
| The 19 faults that repeat a court 3 fault | 16 | 18 | +2 |
| **The 21 faults that do not repeat court 3** | **3** | **5** | **+2** |
| Warnings or errors on the 50 legal files | 0 | 0 | 0 |
| Findings of the 20 new checks on the 50 legal files, any level | not applicable | 0 | |

Instruments: x3d_mcp `validate_xml` (X3D 4.0 XSD) and `semantic_diagnostics`, run once per kernel by
`score/run_kernel.py`, Python 3.13.18, lxml 6.1.3. "Caught" is the rule courts 2, 2b and 3 used: the file fails the
XSD, or a diagnostic at any level names the planted mistake. Two readers decided "names" separately and agree on
all 40 faults for both kernels: a fresh agent that had not seen the kernel and was not told which kernel said what
(`score/reader-verdicts.json`), and the kernel editor (`score/editor-verdicts.json`, written first). The fresh
reader also judged all 40 faults real, and marked which ones repeat a court 3 fault.

## Against what we wrote down

| # | Expectation | Result | Verdict |
|---|---|---|---|
| H1 | New kernel catches at least 3 more than the old on this set | +4 (19 to 23) | **holds** |
| H2 | New kernel catches at least 30 of 40, the target told to the owner | 23 | **fails, by seven** |
| H3 | No wrong warning or error on the 10 decoys | no warning or error on any decoy | holds |
| H4 | At most 2 of 40 twins draw a wrong warning or error | none on any twin | holds |
| H5 | The 20 new checks make at most 2 wrong findings on the 50 legal files, any level | 0 findings | holds |
| Guess | Old: behaviour 10 to 13, structure 12 to 15. New: behaviour 12 to 16, structure 14 to 17 | 12, 7, 13, 10 | both behaviour guesses right, both structure guesses too high by 4 or more |

The editor's own guess for the new kernel was 27 to 31. It was 23. Four faults moved from missed to caught and none
moved the other way; an exact sign test on four changes in one direction gives p = 0.125 (two-sided, 2 x 0.5^4,
worked by hand), which is not evidence on its own. Court 3's turn was +6 on the same size of set.

## What it means

1. **The target was missed and the reason is measurable.** The second reader marked 19 of the 40 faults as
   repeating a court 3 fault (14 closely, 5 loosely). The kernel names 18 of those 19. It names 5 of the other 21.
   A kernel that scores 23 of 40 here is at 95% on mistakes it has met before and 24% on mistakes it has not. The
   headline number of every earlier court was a mix of the two and did not say so.
2. **Checks written from the last court's misses caught only the same mistakes again.** The 13 checks written from
   court 3's misses gained two faults, a Script function whose name matches no field and a ProtoInstance field the
   prototype does not declare. Both are close repeats of the court 3 faults those checks were written from. On the
   21 new mistakes those 13 checks gained nothing. That is what a regression test does. It is not generalisation.
3. **The checks written from no test set made the only gains on new mistakes.** The 7 checks from the editor's own
   list of what goes wrong caught a ball with transparency 1 and a first Viewpoint looking away from the scene.
   Two of 21 is small, and it is the whole of the turn's gain on unseen kinds of mistake.
4. **The kernel catches rule breaks and mostly cannot see wrong intent.** Of the 14 faults the authors' manifests
   call a violation of the standard, 13 are named. Of the 26 that are legal X3D and wrong only against what the
   scene was meant to do, 10 are named (second reader's count, in the notes of `score/reader-verdicts.json`).
5. **The legal files are clean this time.** Court 3 drew 18 right complaints on 16 legal files, most of them
   caused by our own kit (no component files). With the whole X_ITE distribution in the kit and the same kernel
   family, the 50 legal files draw no warning and no error. The fix written down as failure mode 480 worked.
6. **Seen and unseen are further apart than before.** The new kernel adds a finding on 13 of the 15 court 3
   misses, so on that seen set it stands at 38 of 40 by the editor's reading (grade L, not judged by a second
   reader), against 23 of 40 here: 95% against 58%. Court 3 reported 92% against 62%.

## The 17 misses, sorted by what would catch them

Nine can be stated from the file alone and are rule candidates. They are now seen, so a check written from them is
a fix confirmation on this set.

| Fault | Mistake | A file-only check could say |
|---|---|---|
| a/13 | PlaneSensor `trackPoint_changed` routed to a translation | the pointer's hit point drives a position; `translation_changed` is the drag distance |
| a/15 | Script compares `actionKeyPress` with 37 and 39 | X3D action keys run 1 to 20; 37 to 40 are browser key codes |
| a/19 | a moving target routed to a damper's `set_value` | `set_value` jumps, `set_destination` glides |
| a/20 | TouchSensor `isActive` routed to `set_bind` | the FALSE on release unbinds the view again |
| b/02 | a `USE` element with attributes of its own | a USE is the same node; other attributes are ignored |
| b/05 | one face wound the other way on a closed mesh | neighbouring faces must run their shared edge in opposite directions |
| b/06 | five colours, five faces, `colorPerVertex` left TRUE | the colour count matches the faces and not the indices |
| b/16 | Inline url names a file that is not there | needs the folder: the runner hands the kernel text only |
| b/19 | a MetadataSet entry with `containerField='metadata'` | a second metadata child of a set is almost always a payload entry |

Eight need the intent to be written somewhere the checker can read it, because the file is legal and plausible as
it stands: a `cycleInterval` of 500 (a/04), a TouchSensor grouped with the floor (a/12), a Script that flips on
press and on release (a/17), an open cross-section (b/07), `xDimension` and `zDimension` swapped over a grid of 15
heights (b/08), a TextureTransform scale of 0.25 meant as four repeats (b/12), a light direction written as a
position (b/13), and a door that turns about its middle (b/20). No amount of pattern rules reaches these. A scene
would have to carry its own expectations (the door's hinge edge, the flash period, the tile count) for a kernel to
hold it to them.

## Every fault

| File | Family | Planted mistake | Witness | Repeats court 3 | Old kernel | New kernel |
|---|---|---|---|---|---|---|
| a/fault-01 | route-type | The size animation uses a ScalarInterpolator, so an SFFloat value_changed is routed to Transform.set_scale, which is SFVec3f. | X_ITE | a/fault-02.x3d | caught (`route-type-mismatch`) | caught (`route-type-mismatch`) |
| a/fault-02 | route-access | The grow animation is routed to Box.size, an initializeOnly field that cannot receive events, instead of to the enclosing Transform's scale. | X_ITE |  | caught (`route-wrong-access-type`) | caught (`route-wrong-access-type`) |
| a/fault-03 | timesensor | The TimeSensor that should run forever has no loop='true'; with the default startTime of 0 and loop FALSE it never becomes active. | X_ITE | a/fault-04.x3d | caught (`timesensor-never-starts`) | caught (`timesensor-never-starts`) |
| a/fault-04 | timesensor | cycleInterval is written in milliseconds (500) although the field is in seconds, so one flash takes 500 s instead of 0.5 s. | X_ITE |  | missed | missed |
| a/fault-05 | interpolator-keys | The PositionInterpolator has four keys but only three keyValues; the second 'top' position that makes the platform wait is missing. | X_ITE | a/fault-06.x3d | caught (`interpolator-key-length`) | caught (`interpolator-key-length`) |
| a/fault-06 | orientation-interpolation | The full turn is given as two keys, angle 0 and angle 6.2832 about the same axis; these are the same orientation, and an OrientationInterpolator takes the shortest path between them, which is no motion. | X_ITE |  | caught (`orientation-never-turns`) | caught (`orientation-never-turns`) |
| a/fault-07 | def-names | Both TimeSensors carry the same DEF name (copy-paste); the ROUTEs at the end both resolve to one of them, so both lanterns share one clock. | X_ITE | b/fault-13.x3d | caught (`xsd`) | caught (`xsd`) |
| a/fault-08 | route-endpoint | The first ROUTE names fromNode='DoorTimer', but no node has that DEF; the clock is called DoorClock. | X_ITE | a/fault-05.x3d | caught (`route-missing-from-node`) | caught (`route-missing-from-node`) |
| a/fault-09 | profile-component | The scene declares profile Immersive only, but uses a ColorChaser, which belongs to the Followers component that Immersive does not include; the component statement is missing. | X_ITE | b/fault-11.x3d | caught (`profile-component`) | caught (`profile-component`) |
| a/fault-10 | route-endpoint | The first ROUTE uses fromField='fraction'; TimeSensor has no such field, the output is fraction_changed. | X_ITE | a/fault-01.x3d | caught (`route-invalid-from-field`) | caught (`route-invalid-from-field`) |
| a/fault-11 | switch-index | The IntegerSequencer counts 1, 2, 3 while the Switch children are numbered 0, 1, 2. | X_ITE | a/fault-15.x3d | caught (`switch-index-past-children`) | caught (`switch-index-past-children`) |
| a/fault-12 | pointing-sensor-scope | The TouchSensor sits among the floor's children instead of beside the button's geometry, so it senses the floor and not the button. | X_ITE | a/fault-08.x3d | missed | missed |
| a/fault-13 | drag-sensor | The PlaneSensor's trackPoint_changed is routed to the puck instead of translation_changed, so the puck's centre is put at the pointer's hit point instead of moving by the drag distance. | X_ITE |  | missed | missed |
| a/fault-14 | environment-sensor | The ProximitySensor has no size, and the default size 0 0 0 disables the sensor. | X_ITE | a/fault-12.x3d | caught (`sensor-zero-size`) | caught (`sensor-zero-size`) |
| a/fault-15 | key-sensor | The script compares actionKeyPress against browser DOM key codes (39 and 37); the X3D action-key codes for right and left arrow are 20 and 19. | X_ITE |  | missed | missed |
| a/fault-16 | script | The script's function is named clicked, but the input field is named set_clicked; a Script handler must have exactly the field's name, so it is never called. | X_ITE | a/fault-16.x3d | missed | caught (`script-handler-missing`) |
| a/fault-17 | script | TouchSensor.isActive sends TRUE on press and FALSE on release, and the script flips its state on every event without looking at the value, so each click flips the lamp twice. | X_ITE |  | missed | missed |
| a/fault-18 | route-fan-in | Both PositionInterpolators are routed to the same inner Transform's translation in the same timestamp, so one overwrites the other; the crossing should drive the outer BeePath Transform. | X_ITE |  | caught (`route-fan-in`) | caught (`route-fan-in`) |
| a/fault-19 | follower | The target position is routed to the damper's set_value, which sets the output immediately, instead of to set_destination, which it would glide towards. | X_ITE |  | missed | missed |
| a/fault-20 | viewpoint-binding | TouchSensor.isActive is routed straight to Viewpoint.set_bind, so the FALSE sent on release unbinds the close-up viewpoint again. | X_ITE |  | missed | missed |
| b/fault-01 | containment | Material is placed directly inside Shape instead of inside an Appearance node. | X_ITE | b/fault-14.x3d | caught (`xsd`) | caught (`xsd`) |
| b/fault-02 | def-use | Two Transform USE elements carry their own translation attributes, as if USE made an editable copy; a USE is the same node and other attributes are ignored. | X_ITE |  | missed | missed |
| b/fault-03 | def-use | USE='brassLook' does not match the declared DEF='BrassLook' (names are case sensitive), so the reference dangles. | X_ITE | b/fault-12.x3d | caught (`use-undefined-def`) | caught (`use-undefined-def`) |
| b/fault-04 | geometry-indices | coordIndex is written 1-based: every index is one too high, so index 6 is out of range for the six coordinates and every face uses the wrong corners. | X_ITE | b/fault-01.x3d | caught (`index-out-of-range`) | caught (`index-out-of-range`) |
| b/fault-05 | geometry-winding | The lid face is listed clockwise (3 7 6 2) while all other faces are counter-clockwise, with ccw and solid at TRUE, so the lid is back-face culled and its normal points inward. | X_ITE |  | missed | missed |
| b/fault-06 | geometry-per-face-data | Five colours are meant one per face, but colorPerVertex is left at its default TRUE, so the five colours are applied to the five vertices and blended across faces. | X_ITE |  | missed | missed |
| b/fault-07 | parametric-geometry | The Extrusion crossSection is not closed (the first point is not repeated at the end), so only three of the four side walls are generated. | X_ITE |  | missed | missed |
| b/fault-08 | parametric-geometry | xDimension and zDimension are swapped (3 and 5 instead of 5 and 3) while the 15 heights are laid out as 3 rows of 5, so the heights are re-read as 5 rows of 3. | X_ITE |  | missed | missed |
| b/fault-09 | units-angles | The rotation angle is given in degrees (-90) but SFRotation angles are radians; -90 rad is about a 117 degree turn the other way round. | X_ITE | b/fault-15.x3d | caught (`angle-looks-like-degrees`) | caught (`angle-looks-like-degrees`) |
| b/fault-10 | value-ranges | diffuseColor is written on a 0-255 scale (255 128 0); colour components must be in 0..1. | X_ITE | b/fault-05.x3d | caught (`xsd`) | caught (`xsd`) |
| b/fault-11 | appearance-material | transparency='1' was written where full opacity was meant (transparency is the inverse of opacity/alpha), making the ball completely invisible. | X_ITE |  | missed | caught (`shape-fully-transparent`) |
| b/fault-12 | appearance-texture | TextureTransform scale='0.25 0.25' was used to repeat the tile four times; the transform acts on texture coordinates, so 0.25 magnifies the image fourfold and 4 is needed to repeat it. | X_ITE |  | missed | missed |
| b/fault-13 | lights | DirectionalLight direction='0 1 0' was written as if it were the place the light comes from; direction is the way the light travels, so the sun shines upward from below. | X_ITE |  | missed | missed |
| b/fault-14 | viewpoint | The camera is moved to z=-8 behind the statue but keeps the default orientation, which looks along -Z, away from the statue. | X_ITE |  | missed | caught (`viewpoint-sees-nothing`) |
| b/fault-15 | switch | whichChoice='2' was used for the second child; choices are numbered from 0, so 2 is out of range for two children and nothing is chosen. | X_ITE | b/fault-18.x3d | caught (`switch-index-past-children`) | caught (`switch-index-past-children`) |
| b/fault-16 | inline-url | The Inline url says support_bracket.x3d (underscore) but the file is support-bracket.x3d (hyphen), so the reference cannot be resolved. | X_ITE |  | missed | missed |
| b/fault-17 | profile-component | The scene uses a NURBS surface node under profile Immersive without a <component name='NURBS' level='1'/> statement; Immersive does not include the NURBS component. | X_ITE | b/fault-11.x3d | caught (`profile-component`) | caught (`profile-component`) |
| b/fault-18 | proto | The first ProtoInstance sets fieldValue name='color', but the prototype interface declares the field as 'pillarColor'; the value is discarded and the default grey is used. | X_ITE | b/fault-06.x3d | missed | caught (`proto-field-unknown`) |
| b/fault-19 | metadata | The third entry of the MetadataSet has containerField='metadata' instead of 'value', so priceEUR becomes metadata about the set itself rather than one of its payload entries. | X_ITE |  | missed | missed |
| b/fault-20 | transform-hierarchy | The door Transform rotates about its own origin (the middle of the leaf) because no center is given for the hinge edge. | X_ITE |  | missed | missed |

Witness: every one of the 40 pairs was run in X_ITE 16.8.0 by its author (`set-a/witness.json`,
`set-b/witness.json`; headless Chromium 158.0.8127.36, ANGLE on SwiftShader, Playwright 1.63.0; the authors' runs,
not repeated, grade L). For a/09 the browser showed no difference between fault and twin, and the second reader
says the same of b/19; both stay in the count as the plan said.

## The 50 legal files

No warning and no error from either kernel on any of the 40 twins and 10 decoys. The only findings are 110 notes
that a DEF name is never used, from a check both kernels share; the second reader was told to leave that note and
two other general notes aside, and found nothing else to judge. The 20 new checks made no finding at any level on
the legal files, so H5's limit was not approached.

## What was done differently from the plan

Three things, all disclosed here and none changing a count.

1. **One script was edited after the seal was opened.** Set B holds a 46th scene, `support-bracket.x3d`, a helper
   that an Inline in one fault and its twin points at. The brief allowed helper files; `score/build_packet.py` as
   pushed assumed every scene was a fault, a twin or a decoy and stopped on it. Three lines were added to leave
   helper files out of the second reader's packet. The kernels still ran on it (it is in both results files) and it
   draws no finding. The pre-registration says 90 files; 91 were run and 90 were scored.
2. **The unused-DEF note.** The second reader did not count the note "DEF is defined but never used" as naming a
   mistake, even on the five faults where it appears only because of the mistake. The editor made the same call
   first. If it were counted, one more fault (b/02) would be caught by both kernels: 20 to 24.
3. **Paths.** `brief-reader.txt` and `set-a/xsd.json` held the scratch folder's full path; in the copies here it is
   shortened to `WORK`. The sealed archives are byte for byte as hashed.

Hashes again. Archives: `author-a.tar` `f774cbf9287078a6da7131c41066e2ee7195bc8cab782f8f469bdeacff1afd92`,
`author-b.tar` `25615daec2450fbaec693a36b93579eca2eb171de7c2117182a4d3f2570af174`. New kernel sources at the scoring
run, unchanged from the freeze: `plays_checks.py` `5c724333ff8a…5adeeb4`, `inert_checks.py` `e1a568f0e75e…d790814`,
`data_checks.py` `ad36e2c3e560…0c0ca4c8`, `semantic.py` `93d55e598fc7…3ecc1302` (full values in
`score/results-new.json`, which also records that the checkout was clean).

## What this does not show

Both authors, the second reader and the rule writer are agents of the same model family in the same project. That
is exactly why 19 of 40 faults repeat the last court: same kind of author, same brief, same favourite mistakes. A
set by a stranger would likely repeat less and score lower. The repeat marking is one reader's judgement; with the
5 loose repeats moved to the other side, the kernel names 13 of 14 close repeats and 10 of the other 26. One
browser engine is the witness. Forty faults is a small sample and +4 is within what a different author would
move. The set is now seen: any later score on it is a fix confirmation, and it joins courts 2, 2b and 3 as a
regression set.

## What the next court should change

- Give each author the one-line list of every earlier court's planted mistakes, with the instruction not to plant
  any of them again. It tells the kernel side nothing and it removes the repeats that made up half of this score.
- Print the score on new mistakes as the headline and the score on repeats beside it.
- Set the target on new mistakes only. On this set that number is 5 of 21.
- Dry-run every scoring script on a dummy set that uses everything the brief allows, helper files included,
  before the seal.

## Files

| Path | What |
|---|---|
| `PREREG.md` | the plan, pushed before the set was opened |
| `brief-author-a.txt`, `brief-author-b.txt`, `brief-reader.txt` | what the two authors and the second reader were told |
| `author-a.tar`, `author-b.tar` | the sealed archives; `sha256sum` must print the two hashes in `PREREG.md` |
| `set-a/`, `set-b/` | the 91 scenes, each author's `MANIFEST.json` (the answer key), `witness.json` and helper scripts |
| `score/run_kernel.py` | runs one x3d_mcp checkout over the sets |
| `score/results-old.json`, `score/results-new.json` | every diagnostic of each kernel, with the commit and source hashes |
| `score/build_packet.py`, `score/packet.json`, `score/emit.json` | what the second reader was given, and which kernel produced each finding (not given to the reader) |
| `score/court3-faults.json` | the 40 planted mistakes of court 3, one line each, given to the reader for the repeat marking |
| `score/reader-verdicts.json`, `score/editor-verdicts.json` | the two readings |
| `score/score.py`, `score/results.json` | the count, and the script that prints it |

To rerun: check out x3d_mcp at `ca0e75c` and at `c185673`, then
`python3 flywheel/court-4/score/run_kernel.py <x3d_mcp> flywheel/court-4 out.json` for each, and
`python3 flywheel/court-4/score/score.py`.
