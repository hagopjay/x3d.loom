# What building the X3D behaviour graph teaches (22 Nov 2026)

Source: the behaviour node editor proof of concept in hagopjay/x3d-blender-io (pull request 71, on main `47ed742`) and the
Wire Lab demo (x3d.demo pull request 150, `docs/demos/wire-lab/v1/`). Grades: **C** = a named tool ran in this work,
**L** = read or reasoned, **S** = suspected. Environment of every **C**: Linux x86_64, Blender 5.3.0 `bpy` wheel, Python
3.13.18, x3d.py 4.0.65.8, X_ITE 16.7.1 in headless Chromium with SwiftShader, no GPU.

## Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A converter with no place to put a thing drops it, however careful it is.** The add-on's default import rebuilds click presets and bakes interpolators to keyframes. Three script-written worlds (14 ROUTEs, 11 behaviour nodes) came back with 0 of 14 ROUTEs; the binary counter came back with no behaviour at all. With a graph to hold them: 14 of 14, and no node, field or ROUTE difference. | C | `tools/behaviour_roundtrip.py`, `behaviour_graph.difference`; table in x3d-blender-io `docs/BEHAVIOUR_GRAPH.md` | Before tuning a lossy path, ask whether the host has a container for the thing. Add the container first. |
| 2 | **Graph equality does not prove behaviour equality.** The counter's graph survived Blender exactly, and the scene still behaved differently: the importer does not read `visible` on a Transform, so two lamps that start hidden came back shown. Replaying the same five real clicks on both files showed it (lamp states 00 10 01 11 00 10 before; 11 11 01 11 00 10 after). | C | `tools/behaviour_replay.cjs` | A behaviour judge compares what the scene does under the same inputs, including its starting state, not only the wiring. |
| 3 | **Find the sensor by asking the sensor.** The replay moves the real pointer until the TouchSensor itself reports `isOver`, so no screen coordinate is written into a test. The same step found the button at the same pixel before and after the round trip, which is itself a geometry check. | C | same tool; Wire Lab `build/test_page.cjs` | Tests that click 3D content locate it through the scene's own events. |
| 4 | **The catalogue must come from the object model, not from a binding.** x3d.py's field declarations omit inputOnly and outputOnly events, so a catalogue built from them showed TouchSensor with no `touchTime`. The X3D Unified Object Model lists all 303 fields of the 45 behaviour node types with their access. | C | `tools/behaviour_catalogue_gen.py`, first attempt and second | Name the authority for any generated table, and check one fact a wrong authority would get wrong. |
| 5 | **Two implementations of one rule need shared cases, not shared code.** The ROUTE legality rule exists in Python (the add-on) and in JavaScript (the Wire Lab). One file of 55 cases is run by both; they agree on 55 of 55. | C | `tests/behaviour/route-cases.json`, `node build/test_core.mjs` | When a rule is ported, the cases travel with it and both sides run them in CI. |
| 6 | **Reserve the names that carry meaning before anything else takes one.** Graph nodes and ROUTE targets get their DEF before the exporter hands out its prefixed names, so `Door` stays `Door`. The first version let the exporter go first and a round trip turned `Door` into `OB_Door`, which changed 2 of the counter's 5 ROUTEs. | C | `test_the_three_wire_lab_worlds_round_trip`, before and after the fix | Identity is an allocation order problem. Law-shaped: the names that other things point at are allocated first. |
| 7 | **A type rule is a teaching device.** `TouchSensor.isOver` (SFBool) into `TimeSensor.startTime` (SFTime) is refused; the refusal names both types and the node that converts (TimeTrigger). The Wire Lab's first challenge is that refusal. | C for the refusal and message; L for the teaching value | Wire Lab page test, check "a wrong wire is refused with the reason and a way forward" | An error message for a typed graph states both types and one way forward. |
| 8 | **Three views that cannot disagree.** The Wire Lab derives the graph picture, a Python script and the X3D text from one data structure on every edit, and the page test asserts the script has one line per ROUTE and the X3D has the ROUTEs Python wrote. | C | `build/test_core.mjs` | A representation shown to people is generated from the checked one, never typed beside it. |
| 9 | **Headless Blender can test a node editor's data and none of its look.** Custom node trees, sockets and the tree's `update` (which removes a link between two types) all run in the `bpy` wheel. Menus, colours and sizes do not exist there. | C for what ran; the look is untested | `tests/test_behaviour_nodes_bpy.py`, 17 tests | A receipt for editor work says which half was checked. |

## Proposed additions (not applied here; each needs a run first, law 8)

* A `behaviour` witness for the Loom: the same recorded pointer and time inputs played on a file before and after any
  conversion, with sampled field values compared. Finding 2 is its first planted fault that is not planted.
* The comparator `behaviour_graph.difference` (nodes, set fields, sensor placement, ROUTEs with spelling variants folded)
  as the identity invariant for ROUTEs in the add-on's round-trip gate.
* A profile of the graph schema `x3d-blender-io.behaviour-graph/v0` for glTF's interactivity draft, so one graph can be
  judged in two formats (Loom-for-glTF lane).

## What this does not prove

* Nobody has looked at the node editor on a real screen.
* Four files only; none has a Script, a PROTO or a behaviour node with child nodes.
* One browser (X_ITE), software rendering; no frame-rate claim.
* The `visible` loss is reported, not fixed.

## Version 2 (22 Nov 2026, later the same day): play, typed editors, the `visible` fix

Code: x3d-blender-io pull request "Behaviour graph version 2". Instruments: Blender 5.3.0 `bpy` wheel, Python 3.13.18,
X_ITE 16.7.1 in headless Chromium with software GL, real mouse clicks.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 10 | **A second runtime is a claim until it is replayed against the first.** The add-on now runs the event graph itself (a plain-Python simulator, and a player that moves Blender objects). X_ITE's events were recorded with its own time stamps while a real mouse clicked, and the simulator was given the same pointer events at the same times. 36 of 36 event streams agree on four files: door 2, counter 3, follower 6, a probe of every simulated kind 25. | Confirmed | `tools/behaviour_sim_judge.cjs` + `.py`; traces in `tests/behaviour/x_ite_traces/`, replayed by `tests/test_behaviour_sim.py` | Judge a re-implementation by event stream, per ROUTE source, with the reference's own clock. |
| 11 | **The first comparison found five places where a careful reading of the standard was not what the browser does.** TimeTrigger and IntegerTrigger answer `true` only (the simulator answered every event: 4 events against X_ITE's 2). A looping TimeSensor counts cycles from `startTime`, so its phase is the wall clock's, not the load time's. A damper chases where its destination was one frame ago (fitted on 235 recorded frames: the one-frame-late model matched to 0.0000, the same-frame model to 0.064). Colour dampers mix through HSV (gap 0.27 before, 0.064 after). A chaser's answer to a jump is eased, not a straight ramp (gap 0.137 before, 0.052 after). | Confirmed for X_ITE 16.7.1; Suspected as a reading of ISO/IEC 19775-1, which leaves each of these open | the judge's per-stream table before and after each change | Where the standard leaves room, name the browser whose answer you took, beside the number. |
| 12 | **Tolerance is part of the claim.** Exact nodes are held to 0.002 (worst 0.000001). Followers are held to 0.08 (worst 0.0645) because X_ITE steps them by its frame rate and the simulator by the clock. Discrete streams must also have the same number of events. Reporting "agrees" without the three numbers would hide which kind of agreement it is. | Confirmed | judge constants `EXACT`, `FOLLOWER` | Publish the tolerance class with every agreement count. |
| 13 | **The fix for finding 2 was small and the proof was a replay.** The importer now hides and marks objects under `visible="false"`; the exporter writes it back. Five real clicks on the counter give the same lamp states before and after a Blender trip (they differed in version 1). The graph comparator never saw this loss, because `visible` is not a behaviour field. | Confirmed | `tools/behaviour_replay.cjs`, counter, 5 clicks, 7 samples each | A behaviour witness catches scene-state losses a graph witness cannot. |
| 14 | **A child's values are already in the host's axes; a root's are not.** The exporter writes a parentless object's Transform as the axis conversion times its world matrix, and a child's as its matrix in its parent's space. So a PositionInterpolator that moves a parentless object holds Y-up numbers, and one that moves a child holds numbers that are Blender's as they stand. A single "convert axes" switch would be wrong for half the nodes; the editor turns the display only for nodes whose values reach parentless objects. | Confirmed | `tests/test_behaviour_play_bpy.py`: child at (0, 0, 2) local with no turn; door at Z 3.7 for X3D Y 3.7 | Axis conversion belongs to the edge between a value and what it drives, not to the document. |
| 15 | **Widgets over the file's text, never a second copy.** Each typed widget reads and writes the X3D text the exporter will emit, and a value equal to the standard's default is not stored. Setting a field to the value it had leaves the graph difference empty. | Confirmed | `test_editing_leaves_the_round_trip_exact` | An editor that keeps its own typed copy has to prove the two never drift; one that has no copy has nothing to prove. |
| 16 | **A host API that counts callback arguments turns a closure idiom into a registration failure.** Blender checks the argument count of property `get` / `set` functions, defaults included, so `lambda self, name=name:` is refused at class registration. Each callback is now made by a small factory with exactly its own arguments. | Confirmed | Blender 5.3.0 error "expected a function taking 1 arguments, not 2" | Not a Loom rule; kept as a trap for the next port. |

Still not proven: the Play button, pointer handling and node glow on a real screen (the modal operator needs a window);
any browser but X_ITE; sensors that need a viewer's position; ColorChaser and the 2D followers, which share code with a
judged kind but were not themselves judged.

Proposed addition (not applied; needs a run first, law 8): the event-stream judge as a Loom witness for any
re-implementation of a runtime (a converter's baked animation, a glTF interactivity export), with the reference trace
committed beside the file it was recorded from.

## Version 2.1 (25 Nov 2026): looked at on a real screen

Code: x3d-blender-io pull request "Behaviour graph: the import shows its result; the editor looked at on a real screen".
Instrument: `tools/behaviour_eyetest.py` in Blender 5.3.0 with a window (`--factory-startup --enable-event-simulate`,
1600 x 1000), macOS 26 on arm64; the same rig run on add-on `main` 0eb4809 and on the new version, five worlds (door,
counter, snake, probe, route-demo). Screenshots and `eyetest.json` were looked at by the agent that ran it; the owner
saw the door open by hand earlier the same day.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 17 | **Most of "nobody has looked" was a missing rig, not a missing person.** Blender's `--enable-event-simulate` lets a script send mouse and key events through the window's own queue while the real mouse is ignored. The modal Play operator, its ray cast, the node glow and Esc all ran as for a person, in five worlds, with screenshots of each step. What it cannot judge is taste. | Confirmed | `eyetest.json`: Play started 5 of 5; a real click on the sensed object moved or lit its target in door, counter, probe and route-demo; Esc restored 5 of 5 | Editor work gets a scripted real-window run with screenshots before anyone is asked to look; the person is asked about taste, not about whether it works. |
| 18 | **The import's result was invisible, so the add-on looked uninstalled.** With "Behaviour as node graph" ticked, main built the tree and showed it nowhere, even with a node editor open (0 of 5 worlds). The fix shows it in an open node editor and says in the import's last line where it went; it never turns another editor into a node editor. | Confirmed | same rig: 0 of 5 on main, 5 of 5 after | A feature that makes something the person cannot see must say where it is in the same breath. |
| 19 | **A layout that spaces rows evenly breaks the moment nodes show their data.** Target nodes list every field and interpolators drew one row per key (48 on route-demo), so 70 pairs of nodes overlapped (counter 1, probe 31, route-demo 38). Only the editor knows a node's height, and only after drawing it: the fix waits for the first draw, pushes overlapping nodes down their column, waits for the next draw and frames. The node body now shows six key rows; the sidebar shows all. | Confirmed | rig `overlaps`: 70 on main, 0 after; `test_unstack_*` | Lay out with measured sizes, or measure after the first draw; never assume a row height for nodes that grow with data. |
| 20 | **Check a restore on the data, not on what is derived from it.** The rig first reported that Esc left route-demo's Door at z 3.4 instead of 1.1. The object's own `matrix_basis` was back at once; `matrix_world` is only recomputed at the next redraw, which under event simulation came later than the check. A headless replay of the same events restored exactly. | Confirmed (the false alarm and its cause) | rig log runs 2 and 3; `bpy` replay | Compare the datablock's own fields; read caches only after forcing the host to update them, and say which you read. |
| 21 | **A typed widget needs the format's sentinels.** `startTime="1e+30"`, a file's way of saying "not until an event", was drawn as a seconds field: thirty digits, cut off. It is now shown as its X3D text, labelled "never". | Confirmed (screenshot) | `route-demo-2-editor.png`, before and after | When a field type gets a widget, list the values that mean something other than their number and give each a display. |
| 22 | **Two drivers for one object.** On route-demo the importer still bakes the looping interpolators into actions (`Door_x3d`, `Spinner_x3d`) when the graph is built, so the graph and an action both drive Door and Spinner. Export ignores the keyframes (rule 5), the player restores correctly, but the timeline's Play showed the baked copy. 7 actions in 4 of 5 worlds, every one on a graph-driven object. Fixed after the owner chose it: the import removes an action only when this import made it (the operator lists actions before and after), a ROUTE drives its object, and nothing else uses it, and reports it. | Confirmed (bpy probe; `test_the_graph_takes_over_the_keyframes_the_import_baked`, `test_without_the_graph_the_baked_keyframes_stay`) | keyframes listed on import; same file through Play and Esc | When a new container takes over a thing (finding 1), the old container's copy is removed in the same step, or kept and named. |
| 23 | **Blender draws a node's unlinked inputs again after its sidebar panel.** Fields with a key table showed `key` and `keyValue` once more as bare labels. Cosmetic; not changed. | Confirmed (screenshot) | `door-2-editor.png` | Look at the sidebar with a socket unlinked, not only the node body. |
| 24 | **A highlight that never lets go hides what it highlights.** The glow tinted a node fully orange for 0.35 s after each event; a running timer sends one every frame, so Timer, Slide and Door stayed solid orange and their fields could not be read for the whole run. Now a run of events flashes at 85% for its first 0.35 s and then holds 35% while it continues. | Confirmed (screenshots before and after; `test_a_running_timer_settles_to_a_readable_tint`) | `glow-keyframes-before-after.png` in the run's evidence | Give a highlight a strength for "just happened" and a weaker one for "still happening". |

Still not proven: taste (whether 85% and 35% are the right strengths; how dense the probe graph should be); other UI scales and Retina pixel sizes; Blender 4.5 to 5.2 with a window; a PlaneSensor drag
(no test world has one); events from the operating system rather than Blender's queue.

Proposed addition (not applied; needs a run first, law 8): a **Host-eyes** witness for add-ons, the real-window rig
above writing a `loom.witness/1` record (worlds, screenshots by sha256, overlap count, restore check), run beside the
headless tests so a receipt for editor work names both halves (finding 9).

## Version 2.2 (25 Nov 2026): splines, easing and Squad, judged against X_ITE

Code: x3d-blender-io pull request "Behaviour simulator: EaseInEaseOut, the Spline interpolators and Squad, judged
against X_ITE". Instruments: X_ITE 16.7.1 (the copy vendored in x3d.demo) in headless Chromium with SwiftShader, driven
by Playwright 1.63 with two real clicks (`tools/behaviour_sim_judge.cjs`); the simulator replayed by
`tools/behaviour_sim_judge.py`; Blender 5.3.0 with a window for Play (`tools/behaviour_eyetest.py`); macOS 26 arm64.
X_ITE 16.7.0's unminified source was read for the algorithms.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 25 | **Port the reference's code, then judge against the reference's runtime.** EaseInEaseOut, the three Spline interpolators and SquadOrientationInterpolator were written from X_ITE's own source (its segment rule, Catmull-Rom tangents, Shoemake inner points) and agreed with X_ITE on the first replay: 12 of 12 streams, exact nodes within 0.000001, the PositionDamper2D within 0.0202 of its 0.08. | Confirmed | `tests/behaviour/x_ite_traces/probe-spline.json`, `test_splines_easing_and_squad` | When a runtime is the reference, read its code for the edge rules before reading the standard's prose. |
| 26 | **A judge is only as strong as its probe's values.** Five deliberately wrong versions were run through the judge. With the first probe, two passed: a scalar spline whose second velocity was 0 cannot tell "pad with zeros" from "first and last", and one whose last velocity was 0 cannot tell whether the last is normalised. With values chosen so the readings differ, the judge rejects 5 of 5. | Confirmed | mutant runs before and after the probe change (easing 2% off, last velocity normalised, two velocities read as first and last, Squad as plain slerp, closed treated as open) | Mutation-check every new judge, and pick probe values where the competing readings give different numbers. |
| 27 | **Where X_ITE and a plain reading of the standard part.** EaseInEaseOut sends the eased weight within the current segment (0 to 1), not a fraction mapped back onto the keys. Velocities fewer than the keys are padded with zeros. `normalizeVelocity` leaves the last velocity as it is. An open spline's end tangents are zero. | Confirmed (code read, then judged) | X_ITE 16.7.0 source; the judge on 16.7.1 | Record each divergence beside the code that copies it, so a later change to either side is caught by the trace. |
| 28 | **The reference has bugs too.** X_ITE 16.7.1 cannot load a world with a vector Spline interpolator (2D or 3D) whose `keyVelocity` is set and `normalizeVelocity` is true: "e.norm is not a function" (X3D field values have `length()`, the spline code calls `norm()`). The scalar one loads. The probe avoids the case; the simulator runs it as X_ITE's code intends, unjudged. A report for X_ITE is drafted and held until the owner types "send". | Confirmed | two one-node worlds, one loads and one does not; X_ITE console | A reference's crash is a finding about the reference, not a reason to copy it; say which cases are judged and which are not. |
| 29 | **A node that sends nowhere is present, not judged.** The 2D damper first fed nothing, so the trace had no stream for it and a coverage test that counted node types present would have called it judged. It now drives a TextureTransform, and the coverage test counts only node types that send on a ROUTE in a recorded world. | Confirmed | `test_the_probe_covers_what_the_simulator_runs` | Coverage is measured on what the judge compared, not on what the file contains. |

Still not proven: CoordinateInterpolator and NormalInterpolator; the vector `normalizeVelocity` case (X_ITE cannot load
it); Squad's `closed`, which X_ITE accepts but X3D 4.0 does not define; any browser but X_ITE.
