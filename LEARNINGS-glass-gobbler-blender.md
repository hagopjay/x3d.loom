# The glass Gobbler through Blender (24 Nov 2026)

Code, scene, stills and receipts: x3d.gobbler `mascot/glass/` and `mascot/loom_counts.py`.
His ask, 23 Nov: take the woven Gobbler forward, "most translucent best visuals", "of course the loom will grow
from 44 laws and 13+ theses", "go for viz quality, blenderize!". No model was called and nothing was spent.

Rig for every number here: Blender 5.3.0 (`bpy` wheel), x3d-blender-io 2.7.4 at `0eb4809`, Cycles on 4 CPU
cores with OpenImageDenoise, scene validated by the pinned x3d_mcp validator in x3d.gobbler. Counts come from the
three scripts named below, each of which writes a receipt. Grades: C Confirmed, L Likely, S Suspected.

## 1. A picture that wears the Loom's counts must read them

The first woven bird had 44 warp ribbons and 13 weft rings because someone typed 44 and 13. He pointed out the
Loom will grow. Now `loom_counts.py` counts the law rows (section 3) and failure-mode rows (section 8) of
`LOOM-v1.md`, counts the theses in the pinned Atlas, and writes them with the Loom commit and the file hash. The
bird's body and a new floor spiral (one bead per failure mode) are sized from that file. At Loom `139896f`:
44 laws, 228 failure modes; Atlas rev 28: 13 theses (C, the counter). A repeated row number is refused. A gap is
reported and not refused, because two lanes can land rows out of order.

The same counter found that this repo's README said 223 failure modes while the table held 228 (C). A count
typed into prose is the same failure as a count typed into a mesh.

## 2. What the Blender add-on carried, counted at the door

`import_count.py` parses the X3D for what should arrive and asks Blender what did (C, all rows).

| In the X3D | In Blender |
|---|---|
| 84 Shapes | 83 meshes + 1 curve |
| 8,928 IndexedFaceSet faces | 8,928 polygons |
| 7 Viewpoints at fieldOfView 0.72 | 7 cameras at 26.9 mm, 41.25 degrees tall at 16:9: the same angle |
| 4 lights, 7 animated targets | 4 lights, 7 actions |
| `transparency` 0.45 | Principled alpha 0.55 |
| colour per face | corner attribute `ColorPerCorner` on 10 of 10 face sets |
| 3 ROUTEs into light positions | lost, and named by the importer itself on its output |
| 81 Materials | 24: equal ones are merged, and the survivor keeps one shape's name |
| 3 PointSets | 3 meshes of loose vertices, which Cycles does not draw |
| shared vertices | none: 3 per triangle, 4 per quad |

Two things worth keeping. The importer's own "X3D import loss" lines are the right behaviour: a loss that names
itself costs a minute, a silent one costs a day. And a DEF on a Shape is what makes a Blender pass scriptable:
the first trial import of the unnamed scene gave "Shape", "Shape.001" and so on, so the builder now names every
part.

## 3. What Blender handed on to glTF and USD

`export_check.py` exports, reads the file back into an empty Blender and counts (C by that read-back; whether a
loss is in the writer or the reader is not tested, S).

| | In Blender | glTF 2.0 | OpenUSD |
|---|---|---|---|
| polygons | 28,897 | 51,478 (triangulated) | 28,897 |
| lights | 8 | 4: the four area lights are gone | 8 |
| star point clouds | 3 | 0 | present as extra meshes |
| glass materials | 10 | 10 | 10 |
| animation | 7 actions | 7 actions in 7 NLA tracks | 8 transform caches, 0 actions |

So the glass survives both doors, the area lighting survives only USD, and "animation survived" means two
different things: keyframes in glTF, a cached transform in USD. A receipt that says "7 of 7 animated" without
saying which kind would hide that.

## 4. Lessons from making it look good

- **Glass needs two surfaces and welded vertices.** The vanes are single sheets. A Solidify on the importer's
  unwelded mesh would wall in every triangle (L, not rendered); weld by distance first (the script does).
- **Light glass from behind.** Two large coloured area lights behind the fan are what make the vanes read as
  glass; the same material lit only from the front read as plastic (C by eye, test rounds 1 and 3).
- **A mirror floor prints every lamp.** The two back lights showed as two white discs on the floor until their
  glossy visibility was turned off (C by eye, rounds 2 and 3).
- **Status colour carried by glow washes out.** Under the AgX view the 64 frontier gems at emission strength 9
  were all white; at 2.4 they kept gold and blue (C by eye, two full frames). A colour that carries data must
  stay under the level where the view transform bleaches it.
- **A cage the camera sits just outside of.** The lattice is a sphere of radius 15 m and the seats are 16 to 23 m
  out, so the nearest bars crossed the first frame as thick blurred beams. The Blender material now lets camera
  rays through bars nearer than 9 m. That is a change to what is drawn, so it is listed in the receipt.
- **Say what the second tool added.** Every render receipt carries `added_in_blender`: materials, floor, lights,
  sky, bevel, star spheres, depth of field, view transform, and the glow is listed apart as post. Without that
  list a Cycles frame reads as a claim about the X3D scene.
- **One odd crash.** A helper script called `inspect.py` in the working directory shadows Python's own module and
  `import bpy` then aborts with "You called InitGoogleLogging() twice" (C, seen once; the cause is L).

## 5. Not done

The Blender light is not baked back into the X3D, so the browser bird still has its own look. The lost light
ROUTEs mean the Blender frame has still lights. Neither glTF nor USD file was opened in a second tool.
