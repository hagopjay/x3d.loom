# Learnings: Atlas bridge v2, Blender in the loop (24 Nov 2026)

Source: x3d.demo `docs/demos/atlas-bridge/v2/` (scripts in `blender/`, receipts in `receipts/`). Follows [LEARNINGS-atlas-bridge.md](LEARNINGS-atlas-bridge.md). Grades: C confirmed by measurement, L likely, S suspected.

Rig behind every number: Blender 5.3.0 `bpy` wheel on Python 3.13 (Cycles CPU); X3D Blender I/O add-on v2.7.4 (x3d-blender-io `0eb4809`); X3D to three.js bridge, three r187, headless Chromium 157 on SwiftShader; validator hagopjay/x3d_mcp `4d433af`.

## What changed from v1

v1 sent boxes. v2 sends a Blender scene (374 mesh objects, a vaulted scriptorium) through the add-on, and Blender does five jobs: build the input, clean the result, match colour, judge, and test colliders.

## Measured

| Step | Number | Grade | Receipt |
|---|---|---|---|
| Blender camera against exported X3D Viewpoint, 24 cameras | at most 0.0007 mm, 0.012 degrees | C | `prepare-scriptorium24.json` |
| Cycles Depth pass against the bridge's depth of the exported X3D | planar z; median at most 0.09 mm, 99th percentile 1.1 mm | C | same |
| Atlas depth returned against Cycles depth sent | median 0.73%, scale 1.0059, 97.3% of pixels within 5% | C | `scriptorium-chisel-scriptorium.json` |
| Draft splats (524,288) against Blender surfaces | median 26.9 mm, 90.8% within 100 mm | C | `scriptorium-atlas-return.json` |
| Atlas mesh (300,000 faces) against Blender surfaces | median 24.0 mm, 92.0% within 100 mm | C | `scriptorium-mesh-scriptorium-draft.json` |
| Clean X3D (24 Atlas pictures baked on Blender geometry) against those pictures | 22.9 dB, SSIM 0.76; 448 of 948 m2 seen by a view | C | `scriptorium-clean24.json` |
| Second ring of views adds | 355 to 448 m2 seen; 1,856 to 2,345 faces | C | `scriptorium-clean.json`, `scriptorium-clean24.json` |
| Cycles as judge: object outlines Atlas keeps | 84.1% (Cycles' own picture 96.6%); hue median 8.2 degrees off | C | `scriptorium-cycles-judge.json` |
| Rigid-body probes on 399 Atlas collider boxes against the X3D room | median rest height 47.5 mm off, 79.6% within 100 mm, 61 of 323 land 100 mm+ high, none fell out | C | `physics-scriptorium.json` |
| Ring 2 against ring 1 on shared surface points, v1 reading room | 13.1 dB before, 14.1 dB after a fitted CDL; ring 1 against itself 12.4 dB | C | `reading-room-ring2-colour-match.json` |
| Same, scriptorium | 19.0 dB before, 19.4 after; ring 1 against itself 16.3 dB | C | `scriptorium-ring2-colour-match.json` |
| Blender Color Balance node (Offset/Power/Slope) against the numpy fit | within 1/255 (scriptorium) | C | same |

## Rules

1. **Paint on known geometry beats repairing generated geometry.** The Atlas mesh is 24 mm off and wavy; the bake puts the same paint on exact faces and exports a valid X3D with one texture. The scene graph already had the geometry, so only the paint needed to come home.
2. **A texel takes colour only from a view that really sees it.** Project the texel into each view and test its depth against the depth that was sent; without the test, paint lands on surfaces behind the one the view saw.
3. **Count what no view saw.** Unseen faces keep their flat source colour and the receipt carries the area. A second ring aimed at the vault, the floor and under the table moved seen area from 355 to 448 m2.
4. **Compare generated views on shared surface points.** Whole-picture means compare different content. The exposure story from v1 did not survive this test (failure mode 253).
5. **Measure the floor first.** Two views from the same call already disagree about a surface point (12.4 dB in the reading room, 16.3 dB in the scriptorium). No colour match can beat that floor.
6. **A physics drop is a better collider test than coverage.** Coverage said the boxes hold the surfaces; the drop said one probe in five rests 100 mm high (failure mode 257).
7. **A path tracer is a judge of structure, not of looks.** Cycles and Atlas are 15.9 dB apart as pictures by design. The object-index pass gives outlines and per-object regions, which is what the judge should score.
8. **Size features for the depth map the model sees.** Steps of 0.12 m rise vanished into ramps; 0.40 m steps survived. One single-frame probe costs 40 credits and settles it (failure mode 258).
9. **One spender, one ledger, named reservations.** Three studies shared one account in one evening; each sent a kit, one client ran every call, and the ledger carried the hard stop and the reservations.

## Blender 5.3 notes (all C on this rig)

- The multilayer EXR format needs `image_settings.media_type = "MULTI_LAYER_IMAGE"` first; channels are `ViewLayer.Depth.Z` and `ViewLayer.Object Index.X`.
- `mathutils` imports only after `import bpy` with the pip wheel; the 5.3.0 wheel needs Python 3.13.
- A Boolean EXACT cut removed a whole wall; arches were built from quads instead.
- The UV island packer stalls on 374 objects; `smart_project` in multi-object edit mode already packs across objects. Baking a joined copy takes seconds where per-object baking took 339 s a pass.
- The compositor needs `render.compositor_device = "CPU"` on a machine with no GPU; the node tree goes on `scene.compositing_node_group`, and the Color Balance node's settings are input sockets (`Type`, `Color Slope`, `Color Offset`, `Color Power`).

## Bridge fix in this change

`UnlitMaterial.emissiveTexture` is now read by the shared reader and drawn by the three.js body (failure mode 254). Bridge tooling tests: 14 of 14.

## Not proven

No refined splat of the Blender scene. The Atlas mesh was not repaired. No real GPU. The clean bake shows ghosting on book edges where views disagree; no per-texel view selection or seam blending was tried. The Babylon bridge was not run after the reader change. The Penrose threshold in rule 8 is one scene.

## Rights

Atlas outputs are shown with World Labs credit, for personal non-commercial use, with a takedown notice (the demo's DATA-ATTRIBUTION.md). The numbers measure this bridge's round trip, not Atlas.

New failure modes 253 to 258 in [LOOM-v1.md](LOOM-v1.md).
