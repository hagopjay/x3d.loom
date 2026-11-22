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
