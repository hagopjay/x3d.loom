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
| 10 | **A second runtime is a claim until it is replayed against the first.** The add-on now runs the event graph itself (a plain-Python simulator, and a player that moves Blender objects). X_ITE's events were recorded with its own time stamps while a real mouse clicked, and the simulator was given the same pointer events at the same times. 36 of 36 event streams agree on four files: door 2, counter 3, follower 6, a probe of every simulated kind 25. | Confirmed | `tools/behaviour_sim_judge.cjs` + `.py`; traces in `tests/behaviour/x_ite_traces/`, replayed by `tests/test_behaviour_sim.py` | Judge a re-implementation by event stream, per ROUTE source, with the reference's own clock. Sampled end states would have passed three of the five faults below. |
| 11 | **The first comparison found five places where a careful reading of the standard was not what the browser does.** TimeTrigger and IntegerTrigger answer `true` only (the simulator answered every event: 4 events against X_ITE's 2). A looping TimeSensor counts cycles from `startTime`, so its phase is the wall clock's, not the load time's. A damper chases where its destination was one frame ago (fitted on 275 frames: the one-frame-late model matched to 0.0000, the same-frame model to 0.064). Colour dampers mix through HSV (gap 0.27 before, 0.064 after). A chaser's answer to a jump is eased, not a straight ramp (gap 0.137 before, 0.052 after). | Confirmed for X_ITE 16.7.1; Suspected as a reading of ISO/IEC 19775-1, which leaves each of these open | the judge's per-stream table before and after each change | Where the standard leaves room, name the browser whose answer you took, beside the number. |
| 12 | **Tolerance is part of the claim.** Exact nodes are held to 0.002 (worst 0.000001). Followers are held to 0.08 (worst 0.0645) because X_ITE steps them by its frame rate and the simulator by the clock. Discrete streams must also have the same number of events. Reporting "agrees" without the three numbers would hide which kind of agreement it is. | Confirmed | judge constants `EXACT`, `FOLLOWER` | Publish the tolerance class with every agreement count. |
| 13 | **The fix for finding 2 was four lines and the proof was a replay.** The importer now hides and marks objects under `visible="false"`; the exporter writes it back. Five real clicks on the counter give the same lamp states before and after a Blender trip (they differed in version 1). The graph comparator never saw this loss, because `visible` is not a behaviour field. | Confirmed | `tools/behaviour_replay.cjs`, counter, 5 clicks, 7 samples each | A behaviour witness catches scene-state losses a graph witness cannot. |
| 14 | **A child's values are already in the host's axes; a root's are not.** The exporter writes a parentless object's Transform as the axis conversion times its world matrix, and a child's as its matrix in its parent's space. So a PositionInterpolator that moves a parentless object holds Y-up numbers, and one that moves a child holds numbers that are Blender's as they stand. A single "convert axes" switch would be wrong for half the nodes; the editor turns the display only for nodes whose values reach parentless objects. | Confirmed | `tests/test_behaviour_play_bpy.py`: child at (0, 0, 2) local with no turn; door at Z 3.7 for X3D Y 3.7 | Axis conversion belongs to the edge between a value and what it drives, not to the document. |
| 15 | **Widgets over the file's text, never a second copy.** Each typed widget reads and writes the X3D text the exporter will emit, and a value equal to the standard's default is not stored. Setting a field to the value it had leaves the graph difference empty. | Confirmed | `test_editing_leaves_the_round_trip_exact` | An editor that keeps its own typed copy has to prove the two never drift; one that has no copy has nothing to prove. |
| 16 | **A host API that counts callback arguments turns a closure idiom into a registration failure.** Blender checks the argument count of property `get` / `set` functions, defaults included, so `lambda self, name=name:` is refused at class registration. Each callback is now made by a small factory with exactly its own arguments. | Confirmed | Blender 5.3.0 error "expected a function taking 1 arguments, not 2" | Not a Loom rule; kept as a trap for the next port. |

Still not proven: the Play button, pointer handling and node glow on a real screen (the modal operator needs a window);
any browser but X_ITE; sensors that need a viewer's position; ColorChaser and the 2D followers, which share code with a
judged kind but were not themselves judged.

Proposed addition (not applied; needs a run first, law 8): the event-stream judge as a Loom witness for any
re-implementation of a runtime (a converter's baked animation, a glTF interactivity export), with the reference trace
committed beside the file it was recorded from.

