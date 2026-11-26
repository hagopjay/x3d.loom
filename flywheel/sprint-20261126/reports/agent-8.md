# Agent 8: blind behaviour/wiring fault test of x3d_mcp

Provenance (grade C, from my run): the 20 faults and 5 decoys were written by an AI agent in the same project, from X3D knowledge, BEFORE reading any validator or fault-court file. Validators run: `semantic_diagnostics` and `validate_xml` (XSD). XSD passed all 25 files and caught nothing; all hits below are semantic.

**Score: caught at any level 11/20; caught as error 6/20; decoys flagged 2/5, but both flags are defensible (my decoy errors, see below).**

| File | Fault | Result |
|---|---|---|
| 01 | SFFloat to SFVec3f | route-type-mismatch (error) |
| 02 | ROUTE to Cylinder.radius (initializeOnly) | route-wrong-access-type (error) |
| 03 | ROUTE from inputOnly set_fraction | route-wrong-access-type + type-mismatch (error) |
| 04 | fraction_change typo | route-invalid-from-field (error) |
| 05 | stopTime 2 < startTime 5, loop false | MISSED |
| 06 | cycleInterval 0 | cycle-interval-zero (warning) |
| 07 | 3 keys, 2 keyValues | interpolator-key-length (error) |
| 08 | keys not ascending | interpolator-key-order (error) |
| 09 | keys to 2, fraction max 1 | interpolator-key-unreachable (warning) |
| 10 | orientation step 4 rad | orientation-step-long-way (warning) |
| 11 | 0 to 2pi in one step | orientation-never-turns (warning) |
| 12 | TouchSensor alone in its Group | MISSED |
| 13 | TouchSensor enabled=false, sole trigger | MISSED |
| 14 | BooleanToggle output unrouted | MISSED |
| 15 | IntegerSequencer 3 into 2-child Switch | MISSED |
| 16 | Sequencer with no ROUTE out | MISSED |
| 17 | two interpolators on one field | route-fan-in (warning) |
| 18 | A<->B translation ROUTE cycle | MISSED |
| 19 | ProximitySensor size 0 0 0 | MISSED |
| 20 | Script without url, outputs routed | MISSED |

Unrelated checks fired: none (no missing-Viewpoint noise; I included a Viewpoint).

## Missed faults and proposed rules
- 05: warn when a TimeSensor has stopTime>0 and stopTime<=startTime and nothing routes to its start/stop fields (spec ignores the stop).
- 12: warn when a pointing/drag sensor's parent grouping node has no sibling geometry (the sensor senses nothing).
- 13: warn when a sensor has enabled="false" and no ROUTE into its set_enabled/enabled.
- 14: info when a Boolean/Integer trigger or toggle output field has no outgoing ROUTE.
- 15: when an IntegerSequencer/Trigger routes to Switch.whichChoice, warn if max keyValue >= child count.
- 16: warn when a sequencer or interpolator has an incoming ROUTE but no outgoing value_changed ROUTE.
- 18: detect cycles in the ROUTE graph (fromNode->toNode) and warn.
- 19: warn on ProximitySensor/VisibilitySensor/TransformSensor size "0 0 0" that has outgoing ROUTEs.
- 20: error/warn on a Script with no url and no inline CDATA body.

## Decoys
- decoy-05 flagged (error route-type-mismatch: Touch.isOver SFBool to Sw.whichChoice SFInt32). This is a real error I made; the decoy was not valid. The sensor is also a root sibling of nothing, which makes it a genuine dead sensor.
- decoy-04 flagged (error route-invalid-to-field: toField='fraction' not on PositionInterpolator). I wrote the bare name `fraction`, expecting an alias; for an inputOnly set_fraction the bare name is not legal, so I think the flag is right and my decoy was wrong. The legal alias form is only for inputOutput fields (translation/set_translation/translation_changed).
- decoy-01, 02, 03: not flagged (correct: deliberate jump, pi/2-step full spin, USE of sensor).

## My own plants of doubtful status
- 05: spec ignores stopTime<=startTime, so it is unwise rather than an error.
- 09, 10, 11, 18, 19: legal per spec; fault is behavioural only.
- 14: a dead end is a weak fault (no wrong behaviour, just no effect).
- 15 also routes to whichChoice (inputOutput), legal; the fault is the out-of-range value 3.
- 12 and 13: scene is truly inert as intended.

Files: (sprint scratch)  (fault-*.x3d, decoy-*.x3d, MANIFEST.json, results.json, REPORT.md).
