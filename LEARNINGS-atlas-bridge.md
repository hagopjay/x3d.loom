# Learnings: the X3D ⟷ World Labs Atlas bridge, with real calls (Demo 77, 23 November 2026)

The ask (HagopJay, 23 Nov): take the first Atlas call and "plan the full 5000-10K credit spend right now and creat the x3d <-> atlas bridge tier 1 3d world class". Demo 76 ([LEARNINGS-marble-atlas.md](LEARNINGS-marble-atlas.md)) bridged Atlas's documented shapes with zero spend and left the real outputs graded L or S. This round spent **8,986 of 10,000 credits** on 16 paid calls and measured them. Demo: x3d.demo `docs/demos/atlas-bridge/v1`.

Grades: C Confirmed (run here, receipt in the demo's `receipts/`), L Likely, S Suspected.

## What the bridge is

Out: an X3D blockout (boxes, cylinders, a sphere) → every `Viewpoint` as an Atlas pinhole camera, planar depth of the bridge's own meshes as a linear EXR → `atlasChisel` paints it. Back: pictures, `posedImages2Splats` (built on the **X3D** depth, so the geometry stays the X3D's), `splats2Mesh` mesh and collider boxes → one X3D 4.1 file: `Viewpoint`, `GaussianSplats`, `IndexedTriangleSet` + `ImageTexture`, `Collision`. The X3D → three.js bridge draws it with a new node, `x3d.threejs/bridge/src/nodes/GaussianSplats.js`.

## Measured

| What | Number | Witness | Grade |
|---|---|---|---|
| Camera, Viewpoint → Atlas → Viewpoint | 0 m, 0°, 36 of 36 | returned camera vs sent | C |
| Bridge depth vs an independent analytic ray cast of the same X3D | median 0.02 to 0.19 mm, p99 < 4.1 mm (tessellated curves) | `kit/x3dcast.py`, 36 views | C |
| Depth Atlas returns vs the X3D depth it was given | median 0.88% (King's Chamber), 1.03% and 1.98% (reading room rings), after one global scale 1.005 to 1.008; 85.7 to 95.5% of pixels within 5% | 8.3 to 8.8 M pixels per run | C |
| Splat frame | identity: an SPZ built from X3D cameras sits in the X3D world | centre-to-solid distance, and the bridge render lines up with the Atlas picture | C (was L in Demo 76) |
| Refined splats (2,000,000, 17 min, 5,000 credits) vs X3D surfaces | centres a median 37.8 mm away, 92.2% within 100 mm | exact point-to-solid distance, 120,000 splats | C |
| Splats on X3D depth vs on Atlas's returned depth, same 12 pictures | 39.8 mm vs 44.4 mm median | same witness | C |
| Collider boxes vs X3D solids | reading room: 99.5% of seen X3D surface within 50 mm of a box, 3.3% of open air wrongly blocked (400 boxes). King's Chamber: 89.6%, 0.9% (120 boxes) | 150,000 surface points, about 46,000 open-air points | C |
| Mesh vertices vs X3D surfaces | King's Chamber median 43.4 mm, 80.3% within 100 mm | 80,000 vertices | C |
| Edit addressed by node name (mask from the ray cast of the `Globe*` nodes) | 95.1 to 98.2% of kept pixels within 8/255 | 4 views, JPEG in and out | C |
| Bridge render of the splats vs the Atlas picture, same Viewpoint | 22.2 dB (draft, 524,288 splats); 13.3 dB before the colour fix | Chromium 157 SwiftShader, three r187, Spark 2.4.0 | C |

## Rules

| # | Rule | Evidence | Grade |
|---|---|---|---|
| 1 | Send the bridge's own depth, and check it against a second model of the scene before paying | float render target vs analytic ray cast, sub-millimetre | C |
| 2 | Build splats on the depth you own, not the depth that comes back | 39.8 vs 44.4 mm | C |
| 3 | Write the ledger before the request, price from the rate card, refuse locally at the cap, reuse the idempotency key, and make overlapping runs merge | 16 paid calls, 3 refused by the API at no cost, one overlap recovered from the journal copy | C |
| 4 | A real `colliderBoxes` GLB has 4×4 matrix nodes and permuted cube axes: compose, then relabel so the leftover rotation is a pure yaw | 520 boxes all upright after relabelling, corner sets equal to 0.0 mm | C (corrects Demo 76 rule 6) |
| 5 | A Collision proxy is not drawn: keep the boxes in a hidden Group and hand it to Collision by USE | ISO/IEC 19775-1 23.4.2; first render showed no boxes | C |
| 6 | Tell the splat renderer what colour space the host writes | Spark `encodeLinear` under the bridge | C |
| 7 | `GaussianSplats` inline arrays are the truth and the preview; a `MetadataString splatFile` names the dense file | 30,000 inline + 2,000,000 in SPZ, file stays valid 4.1 | C |
| 8 | Put the material first in the prompt and say what it is not | granite came back limestone, then granite | C on one case |

New failure modes 229 to 235 in [LOOM-v1.md](LOOM-v1.md).

## The Loom angle

This is the tether with a generative model on the far side. The model is free to paint; the X3D holds the camera, the depth, the node names and the solids, and every return is scored against them with an exact witness (a ray cast or a point-to-solid distance), not a perceptual score. "Held accountable" here has units: millimetres from the declared surface, percent of pixels outside a mask left alone, percent of open air wrongly blocked.

## Not proven

No real GPU (frame rate unmeasured; 2,000,000 splats in software GL take minutes a frame). Harmonics above degree 0 are not drawn; Atlas sent degree 0. The bridge's Inline does not read glTF, so the mesh is converted to X3D triangles. X_ITE was not run on the return worlds. Depth-conditioned Chisel stayed photographic when asked for ink wash: one prompt, one seed, S as a general claim. One photo → eight views (torii) disagrees between views.

## Rights

Outputs made on signup credits are owned by World Labs and licensed for personal non-commercial use (Terms §2.3(a)); HagopJay chose to show them publicly with credit (decision card, 23 Nov). The demo's DATA-ATTRIBUTION.md carries the credit and the takedown notice. The numbers are round-trip measurements of this bridge, not a benchmark of Atlas.
