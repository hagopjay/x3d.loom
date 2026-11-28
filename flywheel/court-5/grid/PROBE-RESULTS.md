# The grid, probed: what the kernel turn for court 5 found

28 November 2026. Gate G1 of `../PLAN.md`, first and second pass. No test set was read to make anything on this page. Every
number comes from `probe.py` run against one x3d_mcp checkout and is in the two summary files beside this one.

## What was done

`probe.py` builds, for one grid cell at a time, a wrong X3D 4.0 file and its corrected twin that differ only in
the mistake, places the node through a chain of parents the X3D 4.0 XSD accepts, and asks the XSD and the kernel
about both. A cell is `caught` when some check fires more often on the wrong file than on the twin (the three
general notes left out), `xsd` when the schema refuses the wrong file and accepts the twin, and `missed` when both
treat the files alike. Fourteen of the 17 classes have a generator; 253 of the 260 nodes could be placed.

## Before and after

| | Old kernel `2943b78` | New kernel `d446f94` |
|---|---|---|
| Cells in the grid | 6,502 | 6,502 |
| Refused by the schema | 810 | 810 |
| Caught by a kernel check | 4,569 | 4,742 |
| Missed | 167 | 0 |
| Kernel crashed on the probe | 6 | 0 |
| Needs intent (ruled, see below) | 68 | 68 |
| Legal, not a mistake (ruled) | 16 | 16 |
| Twin fails the schema | 28 | 28 |
| No probe could be built | 678 | 678 |
| Not probed yet (three classes) | 160 | 160 |

Of the 5,552 cells where the file alone decides and a probe exists, the old kernel and the schema together closed
5,379 (96.9%). The new kernel closes all 5,552. The two halves of the grid tell different stories:

| Kind of class | Decidable cells | Closed before | Share |
|---|---|---|---|
| One field at a time (12 classes probed) | 5,505 | 5,360 | 97.4% |
| A relation between two fields, or the order inside one array (2 classes) | 47 | 19 | 40% |

**Read that number carefully.** It says the mistakes this grid can enumerate, one field at a time, were already
nearly all covered: every one of the 3,967 ROUTE cells was caught before this turn. Court 4's kernel still named
only 5 of 21 new mistakes. So most of what blind authors plant is not a single field against its declared type,
range or list. It is a relation between fields, between nodes, or between the scene and what it is for. The two
relation classes added in the second pass agree: there the kernel had closed 19 of 47, not 97 in 100. Forty-seven
is a small number, and those two classes are only the relations the object model's field names give away. Closing
173 cells is real, and it is not evidence that the next court will score higher. Relations stated only in the
standard's prose are where the rest of the gap is likely to be, and `PREREG.md` will carry this warning.

## The 173 open cells and what closed them

| Open on the old kernel | Cells | What closes it in x3d_mcp |
|---|---|---|
| A number in a vector or array outside its stated range (the schema only judges single numbers) | 48 | new check `field-out-of-range`, read from the object model |
| A string not in its closed list of values | 6 | new check `field-value-not-listed`, read from the object model |
| `enabled`, `on` or `load` written false with nothing routed to it | 81 | new note `switched-off-for-good` (the kernel had this for four pointing sensors and Inline only) |
| A sequencer with more keys than key values | 2 | `interpolator-key-length` widened to BooleanSequencer and IntegerSequencer |
| An emitter's coordIndex past its coordinates | 2 | `index-out-of-range` widened to PolylineEmitter and VolumeEmitter |
| A joint that is a USE of a DEF not in the file | 6 | a crash in two USD-parity checks, fixed; `use-undefined-def` already names the mistake |

| The low end of a range written above its high end (disk radii, sound regions, analyser decibels, point sizes, projector planes) | 8 | new check `low-above-high` |
| A Background's `skyAngle` or `groundAngle` that goes down | 4 | new check `background-angles-not-rising` |
| An interpolator `key` that goes down, on the three 2D interpolators and EaseInEaseOut | 4 | `interpolator-key-order` tested that the node name ends in "Interpolator", so it had skipped every name ending in 2D; fixed |
| A NURBS knot vector that goes down | 12 | `nurbs-knot-order` now judged without control points or dimensions |

All five new checks are labelled `grid` in `../score/provenance.json`.

Twenty-one relation cells were ruled out by hand, each with its reason in `grid.json`: a stopTime before its
startTime is legal and ignored (14), an arc may wrap (2), and a joint's stops, a motion's frames and an audio loop
can be written low above high on purpose (5, `needs-intent`).

## Two rules that were written and then thrown away

- **A sensor that no ROUTE leaves.** All 23 sensor nodes were `missed`, and a check for it closed them. On 1,685
  real scenes from x3d.loom and x3d.demo it fired about 2,300 times, 2,069 of them on TouchSensors that the
  hosting page listens to through the SAI. From the file alone that is not a mistake. The check is not in the
  kernel and the 23 cells are ruled `needs-intent`.
- **`visible='false'` with nothing routed to it.** 40 cells, ruled `needs-intent`: hiding a node for good is
  common and meant.

The switched-off note was first a warning. The same sweep showed pages switching clocks and physics on from
outside, so it is a note that says "unless a script outside this file switches it on". After these changes the
five new checks make 121 findings on the 1,685 scenes: 78 are one family of generated files whose Background
`groundAngle` is 2.4 where the standard's limit is 1.5708, 40 are switched-off notes, 2 are a sensor size of
`-1 -1 -1`, and 1 is `SLIP_1` where the standard lists `SLIP-1`. One false alarm was found and removed first: the
object model bounds all four numbers of `ClipPlane.plane` to -1..1, but the fourth is a distance.

## What the probe found about the standard's own files

- **28 cells where the corrected twin fails the X3D 4.0 XSD** although the object model allows it. Two are a
  disagreement on a lower bound (`FillProperties.hatchStyle` and `LineProperties.linetype`: the object model says
  at least 0, the schema refuses 0). Twenty-six are a child the object model lists and the schema refuses in that
  place, among them `ParticleSystem.physics`, `ComposedTexture3D.texture` and `NurbsSet.geometry`, which this
  project has already recorded as sequence errors in the schema. Graded Likely: each is one probe, not yet read by
  a person.
- **7 nodes could not be placed** in any scene the schema accepts by this generator: the three particle physics
  models and LayoutGroup (the same schema errors), ProtoInstance, Contact and CollidableOffset (they need more
  than a bare element).

## Not done

- Three classes have no generator: addresses (25 cells), time fields (128), bindables (7).
- The 678 `no-probe` cells are fields a file cannot write, statements that are not nodes, and node fields this
  generator does not fill.
- The nine court 4 misses that can be stated from the file are not written yet. They will be labelled `misses`.
- Relations that only the standard's prose states: counts that must match across nodes, values that must agree
  between a node and its child, wiring that is type-correct and means nothing. These need a table read from the
  standard, component by component.

## Rerun

```
python3 flywheel/court-5/grid/build_grid.py <x3d_mcp>/src/validation/schemas/X3dUnifiedObjectModel-4.0.xml
python3 flywheel/court-5/grid/probe.py <x3d_mcp checkout> --summary out.json
```

`probe-kernel-2943b78.json` and `probe-kernel-d446f94.json` are those summaries for the two kernels. `grid.json` holds the
state, the probe and the catching check of every cell for the new kernel.
