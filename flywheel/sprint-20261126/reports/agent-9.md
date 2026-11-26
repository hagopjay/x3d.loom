# Agent 9: inert-scene checks A

Files in .../scratchpad/agents/9/: inert_checks_a.py, test_inert_a.py, run_all.py, flagged.json.

Tests: 23 of 23 pass. Per check: sensor 9, clock 8, output 6. They cover the Script/ProtoInstance info downgrade, IS exemption, USE'd group resolved to its DEF, and set_x/x/x_changed aliasing.

Wave-1 (25 files): caught fault-05 (info), 12, 13, 14, 16. All 5 decoys stay silent. Nothing else is flagged.

Corpus: 2563 distinct .x3d, deduped by whitespace-stripped sha1. Scenes containing the relevant node types: sensors 450, TimeSensor 842, interpolator/trigger family 864.

## 1. check_sensor_senses_nothing
- Flagged: warning "senses nothing" 14 of 450; warning "disabled, never enabled" 2; info 1.
- By repo: x3d.ml 14 (plus 1 info), x3d.loom 3.
- Read all 16 warnings: 2 true defects, 14 deliberate, 0 false alarms.
  - True: x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/hanim-05.x3d (TouchSensor at Scene level, only a bare HAnimHumanoid beside it); the grounded variant is the same.
  - Deliberate: 11 jsval probe fixtures such as x3d.ml/demo/jsval/harness/probes/B field-route-typing .../dr_01_all_three_v40.x3d; the wave-1 faults; x3d.loom/x3d.threejs/bridge/fixtures/TouchSensor.x3d (enabled=false test).
- A first run falsely flagged hanim-04_a1.x3d. Cause: I tracked visited nodes by Python id() and lxml reuses ids after garbage collection, so shapes under HAnimHumanoid were missed. Fixed with an element set and a regression test; the false alarm is gone.
- Holes: geometry is any Shape, Inline, Text or primitive, so a Shape that is invisible or has no Appearance still counts. Anchor and LOD are not specially handled. A DEF'd sensor with a USE elsewhere skips the placement test.

## 2. check_clock_never_starts
- Flagged: warning 15 of 842; info 19 (disabled timer 18, stopTime ignored 1).
- By repo, warnings: x3d.ml 10, x3d.demo 4, x3d.castle 1. Info: x3d.demo 12, x3d.ml 7, x3d.loom 1.
- Read all 15 warnings: 8 true, 7 deliberate or unverified, 0 certain false alarms.
  - True: 8 anim-03 "door" runs from several models, e.g. x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/anim-03.x3d. Each has loop false, startTime 0, no start ROUTE, and an interpolator hanging off the timer.
  - Deliberate/unverified: the giza TourClock timers and the geotiling tour_t (probably started from page JavaScript, not confirmed); 2 probes; castle events-at.x3d.
- Tightening made: enabled='false' timers were 13 false-looking warnings (loomsong, stem demos: a deliberately parked clock that page script switches on). They are now info.
- Holes: whether page JavaScript starts the clock is unknowable from the file, so the 4 tour-style timers are the soft spot.

## 3. check_output_goes_nowhere
- Flagged: warning "output goes nowhere" 31 of 864 (2 info); warning "input from nowhere" 17 (2 info).
- By repo, output warnings: x3d.ml 25, x3d.loom 3, x3d-blender-io 3. Input warnings: x3d.ml 14, x3d.demo 3.
- Breakdown of the 48 warnings by location: 31 in probe fixtures, 6 in gobbler scenes, 2 in fault-court, 5 in LLM runs, 4 other fixtures.
- Read (all categories above): 7 true, 41 deliberate, 0 false alarms.
  - True: the 2 wave-1 faults; 5 LLM runs with an interpolator whose output goes nowhere (anim-05 x2, int-01 x2, hanim-05, e.g. x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/int-01.x3d).
  - Deliberate: BooleanFilter/trigger test fixtures in probes; x3d-blender-io/tests/behaviour/demos/gallery-03-rube-goldberg/gallery-03-rube-goldberg.x3d (end-of-chain sinks).
  - Likely deliberate: 6 gobbler3.x3d copies whose Glow ScalarInterpolator has no input (driven through the SAI by page code). These are the nearest thing to false alarms, though only if the page sets it.
- Holes: a route to a DEF that does not exist counts as an output.

## Not done
- SAI-driven scenes (gobbler, tours) cannot be told from true defects by the file alone.
- Overlap with other checks was not examined (the int-01 RotationInterpolator is also an unknown node).
