# Blind court 5: results (28 November 2026)

**The new kernel proved 20 of 56 new mistakes. So did the old one. Three passes of rule writing gained nothing on
the sealed sets.** The pre-registered expectation H1 (the new kernel proves more new mistakes and loses none)
failed: gained 0, lost 0. On the stranger set of real mistakes from public bug reports it is 4 of 13 for both.

The same court measured one thing that did work. Where the author had stated what the scene is for in a line a
machine can test, playing the scene in X_ITE caught 11 of the 12 new mistakes the kernel missed. Kernel or play
test together reach 31 of 56.

Everything here was fixed before any set was opened: [`PREREG.md`](PREREG.md), kernel x3d_mcp `4040fe1`, old
kernel `2943b78`, pushed in x3d.loom commit `617f8f9`. One run. No check, script or catch rule was changed after
opening. Catch rule: proven, meaning the blind reader says a finding names the planted mistake and the same check
fires more often on the fault than on its corrected twin (or the fault fails the X3D 4.0 XSD and its twin passes).

## Scoreboard

| Measure | Old kernel `2943b78` | New kernel `4040fe1` | Source |
|---|---|---|---|
| **Headline: arm F, new mistakes, proven** | **20 of 56** | **20 of 56** | `results/arm-f/results.json` |
| Arm F, all 60 faults | 24 | 24 | same |
| Arm F, the 4 the reader marked as loose repeats of earlier courts | 4 | 4 | same |
| Set a, behaviour (17 new) | 3 | 3 | same |
| Set b, structure and data (19 new) | 11 | 11 | same |
| Set c, look (20 new) | 6 | 6 | same |
| **Arm S, real mistakes from public reports, new** | **4 of 13** | **4 of 13** | `results/arm-s/results.json` |
| Arm S, all 16 | 5 | 5 | same |
| Exact two-sided sign test on the headline | | p = 1.0 (0 gained, 0 lost) | same |

"Named" (the rule of courts 2 to 4) and "proven" give the same counts everywhere in this court.

Instruments: x3d_mcp `validate_xml` (X3D 4.0 XSD) and `semantic_diagnostics_with_files`, each scene run with its
folder and with its intent lines removed; second readers were two fresh agents that saw the findings without
knowing which kernel made them, and judged all 76 faults real; play test `play/play.mjs`, X_ITE 16.8.0, headless
Chromium 158.0.8127.36, software GL.

## The intent arm (separate, never added to the headline)

| | Arm F | Arm S |
|---|---|---|
| New faults that carry a testable assertion | 18 of 56 | 4 of 13 |
| Play test catches (fault fails, twin holds) | 16 | 2 |
| Of the assertion-carrying faults the kernel missed | 12 | 3 |
| Play test catches of those | 11 | 2 |
| New faults caught by kernel or play test | 31 of 56 | 6 of 13 |
| Legal files that fail their own intent | 0 of 75 | 1 of 21 (`s/twin-09`) |
| Intent lines the play test could not read | 4 (two lines on `a/fault-08` and its twin) | 0 |

The one legal file that failed, `s/twin-09`, is a defect of the play test and not of the scene: the assertion
`Rope.point == 0 0 0 2 1 0` was compared as text with the engine's printout of the same six numbers, laid out on
three lines. The same defect is why `s/fault-09` shows as "fails" for the wrong reason, and it is counted as not
caught. The script was frozen, so it stands as run. The reader found one intent that gives its fault away
(`b/fault-20`, prose only, no assertion), and it is not among the play test's catches.

The arm speaks for behaviour: 14 of its 18 assertions are in set a. In set a alone the kernel proves 3 of 17 and
the play test adds 9.

## The pre-registered expectations

| # | Expectation | Outcome |
|---|---|---|
| H1 | the new kernel proves more new mistakes than the old and loses none | **FAILED**: 0 gained, 0 lost |
| H2 | the difference is unlikely to be chance | **FAILED**: p = 1.0 |
| H3 | no decoy draws a wrong complaint from the new kernel | **FAILED**: 2 decoys (`c/decoy-04` `empty-group`, `c/decoy-05` `profile-component`); both checks are in the old kernel too |
| H4 | at most 2 twins draw one | **FAILED**: 3 in arm F (`b/twin-14`, `c/twin-03`, `c/twin-05`, all `profile-component`), 2 more in arm S |
| H5 | the new checks make at most 2 findings on legal files that the reader does not judge right | held: 0 findings of any new check on 96 legal files |
| H6 | checks labelled `grid` make at least half of the headline gains | **FAILED**: there were no gains |
| H7 | the play test catches at least half of the new assertion-carrying faults the kernel missed | held: 11 of 12 in arm F, 2 of 3 in arm S |
| H8 | no twin or decoy fails its own intent | held in arm F (0 of 75); **FAILED** in arm S (1, a play test defect) |

Forecast against outcome. The editor guessed the old kernel at 6 to 12 of about 55 and the new at 9 to 17; both
were 20 of 56. The old kernel was underrated and the gain overrated. For arm S the guess was 3 to 7 and 4 to 8;
it was 4 and 4. The grid predicted 100%; the kernel that closes every decidable grid cell proves 36% of new
mistakes.

## What the new checks did

The new kernel made four findings the old one did not, all on fault files, none on a legal file:

| File | New finding | Why it gained nothing |
|---|---|---|
| `b/fault-10`, `c/fault-11` | `field-value-not-listed`: FontStyle justify `CENTER` | the XSD already rejects both files |
| `b/fault-19` | `field-out-of-range`: an index of -1 in an IndexedQuadSet | already proven by another finding in both kernels |
| `a/fault-15` | `switched-off-for-good` (a note) | the reader counts the ROUTE finding of both kernels as the one that names it |

The six checks written from court 4's misses fired nowhere, as expected: authors were forbidden to repeat those
mistakes. One near miss in arm S: `s/fault-15` raises `pointSizeMinValue` to 5 and leaves `pointSizeMaxValue` at
its default 1. `low-above-high` covers that pair and stayed silent, because it compares the two only when both are
written. (The reader marked that fault a loose repeat, so it is outside the headline either way.)

## What the kernel catches and what it does not

By the arm F reader's count, 22 of the 60 faults break the standard outright and the kernel catches 18 of them;
about 38 are legal X3D that plays or looks wrong, and it catches 6. Of the 20 headline catches, 7 are the XSD
alone. The 36 misses are scenes whose every field is legal: keyframes written as offsets where the field is
absolute, a sequencer whose last state gets no share of the run, a LOD centre left at the origin, a light in the
wrong coordinate frame. No rule about a field, or about two fields, says those are wrong. The scene has to say
what it is for.

## Complaints on legal files

Seven warnings or errors on the 75 legal files of arm F and two on the 21 of arm S, every one from a check both
kernels have. The readers judged 2 right and 7 wrong. Five of the seven wrong ones are one message:
`profile-component` says TextureProperties (four times) or PhysicalMaterial (once) is outside the Immersive
profile and that X_ITE will refuse to load; the readers place both nodes inside Immersive and X_ITE loaded all
five files with an empty console (grade L: the readers inferred the levels from the object model; the load is
measured). The other two are `empty-group` on a Group that is the deliberate last child of a LOD, and on a Group a
Script fills at run time.

## What this result does and does not show

- It shows that the route tried here, rules read from the object model one field or one pair of fields at a time,
  does not reach mistakes that blind authors of this model family write when told to be new. Twenty-one checks and
  262 newly closed grid cells moved the sealed score by nothing.
- It does not show the checks are useless: they are quiet on 1,685 real scenes and on 96 legal test files, and
  each catches a real class. That class was not planted here.
- Sixty faults by three authors of one model family and sixteen rebuilt reports are small sets. The zero gain is a
  count, 0 of 56 and 0 of 13, and no rate is claimed.
- The intent arm's 11 of 12 is on assertions the fault's own author wrote, for the scene they had in mind. It
  shows the mechanism works when the intent is stated. It does not show that authors in the wild would state it.
- Court 5 is now seen. Its 36 and 9 misses may be used for rules, and any score on these sets from here on is a
  fix confirmation.

## Departures from the plan

1. `PLAN.md` gate G6 asks for the editor's own reading to be written before the second reader reports. It was not
   written. Every count here is the blind readers' alone, so there is no agreement figure between two readings.
2. Two readers were used, one per arm, each a fresh agent given the same brief.
3. The arm F reader states that it judged each fault from the manifest, the intent lines and the difference
   between fault and twin, and did not read every scene in full.
4. The play test defect on array assertions (see the intent arm) was left as run.
5. The reader marked 4 faults of arm F and 3 of arm S as repeats of earlier planted mistakes, all but one "loose".
   They are out of the headline as the plan requires; with them in, the counts are 24 of 60 and 5 of 16, again the
   same for both kernels.

## Files

| Path | What |
|---|---|
| `sealed/author-{a,b,c,s}.tar` | the archives as sealed; sha256 in `PREREG.md` |
| `set-a/`, `set-b/`, `set-c/`, `set-s/` | the archives opened, with each author's manifest, witness harness and output; `set-s/SOURCES.md` has the link, licence and takedown notice for every public report |
| `results/arm-f/`, `results/arm-s/` | both kernel runs, the packet the reader saw, `emit.json` (which kernel said what), the reader's verdicts and brief, `play.json`, `results.json`, `score-out.txt` |
| `score/provenance.json` | the label of each new or widened check |

## Every fault, arm F

| File | Family | Planted mistake | Repeats | Old kernel | New kernel | Play test |
|---|---|---|---|---|---|---|
| a/fault-01 | interpolators | The PositionInterpolator keyValues are written as offsets from the platform's resting place (0 0 0 to 0 2 0), but they are routed to Transform.translation, which is absolute, so the animation overwrites the 5 m placement. |  | missed | missed | fails |
| a/fault-02 | event types | TouchSensor.isActive (SFBool) is routed to TimeSensor.startTime (SFTime); the time-valued output touchTime was needed. | P001 | proven (`route-type-mismatch`) | proven (`route-type-mismatch`) | no assertion |
| a/fault-03 | sequencers | The IntegerSequencer keys are 0 0.5 1 for three states; a sequencer holds each value until the next key, so the last state is only reached at fraction 1 and gets no share of the run. |  | missed | missed | fails |
| a/fault-04 | environment sensors | The ProximitySensor sits outside the Transform that places the gatehouse at x=20, so its box is centred on the world origin and not on the doorway. |  | missed | missed | fails |
| a/fault-05 | scripts | The Script computes the start time from Date.now(), which is wall-clock milliseconds, instead of the event timestamp in seconds; the SFTime it sends is a thousand times too large. |  | missed | missed | all hold |
| a/fault-06 | clocks and timing | stopTime='20' was written as if it meant 'run for twenty seconds'; times are absolute seconds since 1970, so stopTime is later than startTime (0) and long past, and the looping clock never becomes active. |  | proven (`timesensor-stopped-in-past`) | proven (`timesensor-stopped-in-past`) | fails |
| a/fault-07 | routes | A ROUTE statement appears before the node it names as its destination has been defined (the interpolator's DEF comes two lines later). |  | proven (`route-before-def`) | proven (`route-before-def`) | fails |
| a/fault-08 | followers | The ScalarChaser is left with its default initialValue/initialDestination of 0 although the lamp it drives starts at intensity 1, so the first fade starts from 0 instead of from the lamp's present level. |  | missed | missed | no assertion |
| a/fault-09 | pointing sensors | The drawer front has its own TouchSensor deeper in the hierarchy; a pointing sensor nearer the geometry takes the pointer and the ancestor's sensor is ignored, but only the cabinet's sensor is routed to the lamp. |  | missed | missed | no assertion |
| a/fault-10 | triggers | The 'off' button is wired through a BooleanTrigger straight to the lamp; BooleanTrigger.triggerTrue always sends TRUE, so the off button switches the lamp on. |  | missed | missed | fails |
| a/fault-11 | inline name scope | A ROUTE in the parent scene names a node that is DEF-named inside the Inline's file; without an IMPORT statement that name is not visible in the parent scene. | P088 | proven (`route-missing-to-node`) | proven (`route-missing-to-node`) | no assertion |
| a/fault-12 | interpolators | The looping path is not closed: the last keyValue is the fourth corner, not the first corner again, so at each wrap of the clock the value jumps from the end of the path back to its start. |  | missed | missed | no assertion |
| a/fault-13 | prototypes | The prototype declares a period field and the instance sets it, but the body has no IS connection from that field to the clock's cycleInterval, so the value is never used. |  | missed | missed | fails |
| a/fault-14 | clocks and timing | The 'carry on' button is routed to the clock's startTime; a paused TimeSensor is still active and ignores startTime, so nothing resumes (resumeTime was needed). |  | missed | missed | fails |
| a/fault-15 | routes | The ROUTE's destination is TimeSensor.isActive, an outputOnly field; the author meant to gate the clock through enabled. | P002 | proven (`route-wrong-access-type`) | proven (`route-wrong-access-type`) | no assertion |
| a/fault-16 | viewpoint binding | The close-up Viewpoint has jump='false', so binding it does not move the viewer to it. |  | missed | missed | fails |
| a/fault-17 | triggers | The first clock's isActive is routed straight to the TimeTrigger, which fires when isActive becomes TRUE, that is when the gate starts to rise, not when it has finished (the falling edge had to be turned into a TRUE first). |  | missed | missed | fails |
| a/fault-18 | scripts | The Script's SFNode field is given as value='Crate', a name in an attribute, instead of a contained node (USE); the field stays NULL. |  | missed | missed | fails |
| a/fault-19 | drag sensors | The PlaneSensor has autoOffset='false', so every drag starts again from zero offset instead of from where the last drag ended. |  | missed | missed | no assertion |
| a/fault-20 | load sensing | The LoadSensor has nothing in its watch list (the Inline is not referenced inside it), so it never reports a load. |  | proven (`loadsensor-watches-nothing`) | proven (`loadsensor-watches-nothing`) | fails |
| b/fault-01 | grouping and transforms | The beacon's Transform is nested inside the Transform that scales the centimetre model by 0.01, so its 2 m offset and 15 cm radius are scaled a hundredfold down. |  | missed | missed | no assertion |
| b/fault-02 | grouping and transforms | The visible wall Shape carries containerField='proxy', so it becomes the Collision node's undrawn proxy geometry instead of one of its children. |  | missed | missed | no assertion |
| b/fault-03 | DEF and USE | The Appearance USE='RedPaint' appears in the document before the node that carries DEF='RedPaint'. |  | proven (`use-before-def`) | proven (`use-before-def`) | no assertion |
| b/fault-04 | level of detail | The LOD has no center, so viewer distance is measured to the origin although both versions of the statue are placed 100 m away at x=100. |  | missed | missed | fails |
| b/fault-05 | prototypes | The prototype body refers with USE to an Appearance whose DEF is in the main scene, outside the prototype's own name scope. |  | missed | missed | no assertion |
| b/fault-06 | prototypes | The prototype body has two top-level Transforms; only the first node of a ProtoBody is the instance's rendered node, the rest are not part of the scene graph where the instance stands. |  | missed | missed | no assertion |
| b/fault-07 | polygon geometry | The single four-vertex face is concave (a notched chevron) but convex is left at its default TRUE. |  | proven (`face-concave`) | proven (`face-concave`) | no assertion |
| b/fault-08 | coordinate arrays | The Coordinate point list is written as four x-z pairs (8 numbers) instead of four x-y-z triples. |  | proven (`xsd`) | proven (`xsd`) | no assertion |
| b/fault-09 | normals | The four explicit normals point along -Z, away from the side the face is wound to show and away from the viewer. |  | proven (`mesh-normal-against-winding`) | proven (`mesh-normal-against-winding`) | no assertion |
| b/fault-10 | text | FontStyle justify is written "CENTER", which is not one of the allowed values (the centring value is "MIDDLE"). |  | proven (`xsd`) | proven (`xsd`) | fails |
| b/fault-11 | units and angles | The rotation is given with a zero-length axis (0 0 0) and a quarter-turn angle. |  | proven (`rotation-zero-axis`) | proven (`rotation-zero-axis`) | no assertion |
| b/fault-12 | units and angles | The table top's Box size is given in millimetres (2000 40 900) although X3D lengths are metres. |  | missed | missed | no assertion |
| b/fault-13 | Inline and addresses | The Inline url is an absolute file:/// path into one author's Windows home folder instead of an address relative to the scene. |  | proven (`url-absolute-path`) | proven (`url-absolute-path`) | no assertion |
| b/fault-14 | texture data | The PixelTexture image declares 2 by 2 texels with 3 components but supplies only three pixel values. |  | proven (`pixel-texture-count`) | proven (`pixel-texture-count`) | no assertion |
| b/fault-15 | metadata | Two metadata nodes are both placed in the Shape's single-valued metadata field. |  | proven (`xsd`) | proven (`xsd`) | no assertion |
| b/fault-16 | profile and component statements | The component statement names 'Geometry2d'; component names are case sensitive and the component is 'Geometry2D'. | P117 | proven (`xsd`) | proven (`xsd`) | no assertion |
| b/fault-17 | 2D geometry | The Rectangle2D is left in its native X-Y plane (no rotation on its Transform), so it stands upright instead of lying on the ground. |  | missed | missed | no assertion |
| b/fault-18 | NURBS | The NurbsCurve has order 4 but only three control points; the order may not exceed the number of control points. |  | proven (`nurbs-too-few-control-points`) | proven (`nurbs-too-few-control-points`) | no assertion |
| b/fault-19 | CAD geometry | The IndexedQuadSet index list is written with -1 separators after each quad, as if it were an IndexedFaceSet coordIndex. |  | proven (`face-too-few-vertices`) | proven (`face-too-few-vertices`) | no assertion |
| b/fault-20 | geospatial | geoCoords is written longitude first (2.2945 48.8584) although the declared GD system reads latitude first. |  | missed | missed | no assertion |
| c/fault-01 | light scope | The DirectionalLight sits inside the lamp fixture's Transform with the default global='false', so it lights only the fixture's own children and not the table or floor. |  | missed | missed | no assertion |
| c/fault-02 | light radius | The PointLight radius is 3, less than the distance to any pillar, so the light reaches none of them. |  | missed | missed | no assertion |
| c/fault-03 | physical material | PhysicalMaterial is given a diffuseColor attribute; it has no such field (its colour field is baseColor), so the colour is dropped. |  | proven (`xsd`) | proven (`xsd`) | no assertion |
| c/fault-04 | material on lines | The curve's colour is put in diffuseColor; lines are not lit and take their colour from emissiveColor, which is left black. |  | missed | missed | no assertion |
| c/fault-05 | texture pixels | The PixelTexture image declares 2 x 2 pixels but lists only three pixel values. |  | proven (`pixel-texture-count`) | proven (`pixel-texture-count`) | no assertion |
| c/fault-06 | texture repeat | repeatS and repeatT are false, so texture coordinates beyond 0..1 are clamped and the picture cannot tile. |  | missed | missed | no assertion |
| c/fault-07 | texture coordinates | The texture coordinates assume the image origin is at the top left; X3D puts t=0 at the bottom, so the picture is mapped upside down. |  | missed | missed | no assertion |
| c/fault-08 | colour per vertex | Four-component RGBA values are written into a Color node, which holds three-component colours, so the 16 numbers are regrouped as five and a third wrong colours. |  | proven (`xsd`) | proven (`xsd`) | no assertion |
| c/fault-09 | transparency and blending | The pane's Appearance uses alphaMode MASK; with the default alphaCutoff 0.5 its alpha of 0.3 is below the cutoff, so the whole pane is discarded. |  | missed | missed | no assertion |
| c/fault-10 | text string | The Text string is written as bare words; it is an MFString and each string must be enclosed in double quotes. |  | proven (`mfstring-unquoted`) | proven (`mfstring-unquoted`) | all hold |
| c/fault-11 | font style | FontStyle justify is "CENTER", which is not one of the allowed values (BEGIN, FIRST, MIDDLE, END). |  | proven (`xsd`) | proven (`xsd`) | fails |
| c/fault-12 | fog | The Fog has a colour and type but no visibilityRange; the default 0 means no fog at all. |  | missed | missed | no assertion |
| c/fault-13 | background | The sky colours are listed from the horizon upward; skyColor starts at the zenith, so the gradient is upside down. |  | missed | missed | no assertion |
| c/fault-14 | shadows | The light sets shadowIntensity but leaves shadows at its default false, so no shadow is cast. |  | missed | missed | no assertion |
| c/fault-15 | viewpoint | The Viewpoint keeps the default centerOfRotation 0 0 0 although the vase is at 30 1 0, so examining orbits around empty space thirty metres away. |  | missed | missed | no assertion |
| c/fault-16 | orthographic viewpoint | The OrthoViewpoint fieldOfView is written as left right bottom top; the field order is minX minY maxX maxY, so the box is read as x from -4 to -3 and y from 4 to 3. |  | proven (`ortho-extent`) | proven (`ortho-extent`) | no assertion |
| c/fault-17 | navigation settings | visibilityLimit is 25, so the far clipping plane lies in front of the towers at 60 metres. |  | missed | missed | no assertion |
| c/fault-18 | level of detail | The LOD children are listed coarsest first; the first child is the one shown nearest, so the versions are used in reverse. |  | missed | missed | no assertion |
| c/fault-19 | level of detail | The LOD keeps its default center 0 0 0 although every level is drawn a hundred metres away, so the distance is measured to the origin and never falls inside the first range. |  | missed | missed | fails |
| c/fault-20 | sound placement | The Sound is a sibling of the radio's Transform and has no location, so it is emitted at the origin with a ten-metre reach, forty metres from the radio and the visitor. |  | missed | missed | no assertion |

## Every fault, arm S

| File | Family | Planted mistake | Repeats | Old kernel | New kernel | Play test |
|---|---|---|---|---|---|---|
| s/fault-01 | geometry-winding | Two faces of the solid are listed clockwise as seen from outside while solid and ccw keep their defaults. | P105 | missed | missed | no assertion |
| s/fault-02 | scene-structure | The Inline is placed inside a Shape, under an Appearance, as if it were the Shape's geometry. |  | proven (`xsd`) | proven (`xsd`) | no assertion |
| s/fault-03 | geometry-indexing | The IndexedFaceSet has a Coordinate node but no coordIndex at all. |  | missed | missed | no assertion |
| s/fault-04 | geometry-indexing | coordIndex lists only the first four of the eight outline points, and those four lie on one straight line. |  | proven (`mesh-unused-point`) | proven (`mesh-unused-point`) | no assertion |
| s/fault-05 | texturing | The TextureTransform rotates the picture without a center, so it turns about the texture origin (a corner) instead of the middle of the picture. |  | missed | missed | no assertion |
| s/fault-06 | time-control | The script freezes the animation by switching TimeSensor.enabled off and on instead of sending pauseTime and resumeTime. |  | missed | missed | fails |
| s/fault-07 | time-control | The TimeSensor has loop='true' although the motion is meant to play once and stop at the end. |  | missed | missed | fails |
| s/fault-08 | lighting | The DirectionalLight sits in a Transform that holds no geometry and is left non-global (the default since X3D 3.2), so it lights nothing. |  | proven (`light-scope-empty`) | proven (`light-scope-empty`) | all hold |
| s/fault-09 | scripting | The script builds the MFVec3f with a JavaScript array as its single argument, new MFVec3f([a, b]), instead of passing the values as arguments. |  | missed | missed | fails |
| s/fault-10 | scripting | The script assigns addChildren twice in the same handler; the second assignment replaces the first before either is processed. |  | missed | missed | no assertion |
| s/fault-11 | prototypes | The prototype body has two root nodes; only the first node of a ProtoBody is rendered. |  | missed | missed | no assertion |
| s/fault-12 | coordinates | The survey coordinates are used raw, hundreds of thousands and millions of units from the origin, where single precision cannot hold centimetres. | P037 | proven (`coordinate-precision`) | proven (`coordinate-precision`) | no assertion |
| s/fault-13 | coordinates | The hut's coordinates are written with Z as the height (a Z-up source), while the ElevationGrid ground lies in the XZ plane with Y up. |  | missed | missed | no assertion |
| s/fault-14 | def-use | USE='Paint' appears in the file before the node that carries DEF='Paint'. |  | proven (`use-before-def`) | proven (`use-before-def`) | no assertion |
| s/fault-15 | point-rendering | pointSizeMinValue is raised to 5 while pointSizeMaxValue is left at its default 1, so minimum exceeds maximum. | P049 | missed | missed | no assertion |
| s/fault-16 | lighting | The Appearance holds only the texture and no Material, so the surface is unlit and ignores the dim light. |  | missed | missed | no assertion |
