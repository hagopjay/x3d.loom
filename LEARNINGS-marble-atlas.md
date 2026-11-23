# Learnings: Marble's successor Atlas, bridged into X3D (Demo 76, 23 November 2026)

The ask (HagopJay, 23 Nov): "we have more integration to do with the new version of marble3d worlds." The scout of 13 Nov ([docs/MARBLE-SPLATS.md](docs/MARBLE-SPLATS.md)) covered Marble 1.x splats. This round found that the new thing is a different product, **Atlas** (opened to all developers 12 Nov 2026), and bridged it. The demo is x3d.demo `docs/demos/marble-atlas/v1`. Zero API spend: the real 10-camera rig from `worldlabsai/skills` 6cdb6b9 (Apache-2.0) looks at a CC0 procedural room.

Grades: C Confirmed (run here), L Likely (read in primary docs), S Suspected.

## What changed since the Marble scout

| Item | Marble 1.x (13 Nov) | Atlas (23 Nov) | Grade |
|---|---|---|---|
| Docs | docs.worldlabs.ai, openapi sha 4a3ed614 | docs.atlas.worldlabs.ai, 61 pages, llms.txt sha af08fdd9. Marble docs byte-identical 13 → 23 Nov | C |
| API | `/marble/v1`, worlds:generate → world with splats + mesh | `api.atlas.worldlabs.ai/api/v2`, tasks: images2PosedRGBD, atlasGenerate, atlasChisel, atlasTextToImage, posedImages2Splats, splats2Mesh | L |
| Core unit | a world (splat file) | a **posed frame**: pinhole camera + RGB + linear-depth EXR + confidence | L |
| Frame | raw API splats OpenCV y-DOWN, need Rx(π) wrapper | everything in Three.js coordinates (+Y up, −Z forward) = X3D. Identity wrapper | C for cameras (label test), L for SPZ (none measured) |
| Credits | $1 = 1,250 | $1 = 1,000; splats draft 500, refined 5,000; Frameboy 500 a session | L |
| Spend paths | API key | API key, CLI login, **and an MCP server with OAuth sign-in, no key**. All three bill the same credits | L |
| Rights | Free output: no publishing | Free/Standard ("Low-Tier"): World Labs owns output, personal non-commercial licence, training with no opt-out (ToS §2.3(a), §2.6) | L |
| Corporate | | World Labs signed to join AMD (28 Sep 2026, close by end 2026) | L |

## Rules

| # | Rule | Evidence | Grade |
|---|---|---|---|
| 1 | An Atlas camera maps to a Viewpoint with no frame change: `position` as is, the XYZW quaternion → axis-angle `orientation` (rub is X3D's camera basis), `fieldOfView` = the angle across the smaller image side | 99.942% label agreement in X_ITE 16.7.1 over 10 cameras × 921,600 px (worst 99.686%) | C |
| 2 | rdf → rub is q·Rx(π) on the right (local axes), never a string change | rub-as-rdf: 6.37 m mean point error, 0.00% label agreement | C |
| 3 | Unproject planar depth with pixel centres: ((u+½−cx)/fx·z, −(v+½−cy)/fy·z, −z), then camera-to-world | max 0.0005 mm over 573,375 points (float32 EXR, OpenEXR 3.5.5); pixel corners cost 2.9 mm mean | C |
| 4 | NaN, 0, negatives and ±∞ are "no surface" | 41,169 NaN window pixels skipped, confidence 0 there | C |
| 5 | Name the EXR decoder's row order | bottom-up rows not flipped: 2.12 m mean error | C |
| 6 | splats2Mesh collider boxes: read the shared cube's size from its accessor min/max, not an assumed unit cube | 19 boxes, 0 m error on our GLB | C on our GLB, S on real Atlas GLBs |
| 7 | Camera-match tests set NavigationInfo transitionType TELEPORT | 63.0% without, 99.94% with | C |
| 8 | Frameboy streams frames, not geometry: no X3D path today | blog 5 Nov | L |

New failure modes 224 to 228 in [LOOM-v1.md](LOOM-v1.md).

## The Loom angle

Atlas makes the camera, not the world, the unit of exchange. That suits X3D: a posed frame is exactly a `Viewpoint` + an image + a depth field, and the Eyes witness can be a pixel-exact label test instead of a perceptual score. Receipt: `loom.receipt/1` in the demo's `receipts/loom-receipt.json`, verified by `loomkit.receipt.verify`; `not_run` lists Truth (no real Atlas output), Host (no real GPU), Blender.

## Not proven

The frame and SH content of a real Atlas SPZ; real splats2Mesh textures and sizes; the Atlas Blender extension; principal points off centre (every rig camera is centred); any real GPU. The first paid call (quickstart images2PosedRGBD) was approved by him on 23 Nov and waits on `WLT_API_KEY` in the environment.
