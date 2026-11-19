# What the NEXUS X3D Hub brag page teaches (19 Nov 2026)

Source: the NEXUS X3D Hub Observatory release (8 synthetic chapters built with x3d-blender-io 2.6.4 @ cc4864c, Blender 5.1.2), published as x3d.demo Demo 56 (`docs/demos/blenderizer-nexus/v1/`). Grades: **C** = a named tool ran in this fold-back, **L** = strong evidence or the release's own receipt, **S** = suspected. Environment of every **C** row: Linux x86_64 cloud container, CPython 3.13, bpy 5.3.0 pip wheel, Playwright headless Chromium 157.0.8103.78 (SwiftShader, no GPU), X_ITE 16.7.1 as vendored.

## 1. Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **One validator is not enough.** The release reported 20 X3D files, 0 errors with the Web3D x3d.py 4.0.65.8 field adapter. The X3D 4.0 XSD rejects `hanim/scene.x3d`: `HAnimHumanoid name="Articulation study"` is not an xs:NMTOKEN. | C | x3d_mcp 39c6e94 `validate_xml` (lxml + XSD) on all 20 files: 19 valid | Run the XSD (x3d_mcp) as well as the field adapter before quoting "0 errors". Name the validator and its commit with the number. |
| 2 | **The round trip hid a first-trip bug.** `roundtrip.x3d` already wrote `Articulation_study` (the importer sanitizes), so only the first export was invalid. | C | grep of both files | Validate the first trip, not only the fixed point. |
| 3 | **Fix: HAnim names are NMTOKENs.** `emit_x3d40._nmtoken()` turns whitespace and other illegal characters into `_` on HAnimHumanoid and HAnimJoint `name`; DEF names unchanged. New test fails before, passes after; suite 910 OK, 48 skipped. | C | x3d-blender-io PR #68, `python -m unittest discover`, bpy 5.3.0 | Any user text written into an NMTOKEN or ID field goes through a sanitizer. |
| 4 | **"Tilted" chapters were a camera roll, not lost geometry.** Chapters 04 and 05 render sideways after Blender. With X_ITE `StraightenHorizon` off, the authored `source.x3d` is tilted too: its Viewpoint orientations carry a roll that StraightenHorizon hides. After Blender the camera sits under a rotated Transform, so the roll shows. Transforms and Blender bounds are preserved. | L | X_ITE probe, StraightenHorizon on vs off, 3 files side by side | Compare renders with StraightenHorizon off before blaming an exporter. Fixture cameras should be built with a roll-free look-at. |
| 5 | **DEF/USE pays in bytes.** 144 linked modules: 407,712 vs 2,867,747 bytes (7.034x), gzip 44,413 vs 67,461. | L | release `instancing-evidence.json` (measure_instancing.py, Blender 5.1.2) | Report gzip next to raw: the gap shrinks from 7x to 1.5x once compressed. |
| 6 | **Blend files leak paths only when decompressed.** Blender 5 saves zstd multi-frame; a plain `strings` sweep sees nothing. Decompressed, the files held the build temp dir `/home/agent` (generic). | C | `zstandard` stream_reader with `read_across_frames=True` | Leak sweeps must decompress .blend (all frames) before grepping. |

## 2. What this does not prove

* Motion error 3.25e-5, HAnim 0.586 mm, 36/36 IFC GUIDs, Khronos glTF and OpenUSD checks are the release's own receipts, not re-run here.
* No real GPU, Castle or X3DOM run; Unreal and Bonsai editors were prepared, not executed.
