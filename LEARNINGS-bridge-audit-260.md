# Learnings: do the Babylon and three.js bridges codify all 260 nodes? (28 Nov 2026)

Source: `/mnt/project-files/bridge-audit/AUDIT-260.md` and `AUDIT-260-v2.md` (v2 joins receipts to pixels), `x3d.render-oracle/scenes-260/` (x3d.loom #246, #247, #255, #257), x3d.loom #258 (Babylon ImageTexture), the three.js thread's x3d.loom #254, the wgpu thread's x3d.wgpu #10 and the Blender node board (x3d-blender-io #117). Grades: **C** = measured with the named tool, **L** = read or reasoned, **S** = suspected. Failure modes 559 to 567 in `LOOM-v1.md`.

Rig for every pixel number: 128x128, scene's own Viewpoint, no tone mapping; Chromium 157 to 158 on SwiftShader; X_ITE 16.6.0 as the reference; three r187 bridge; Babylon 9.32.0; x3d-view (wgpu) on lavapipe. Judge: object-pixel MAE, AGREE <= 2, NEAR <= 8, FAR > 8 (pre-registered in `oracle.py`).

## What was found
| Claim | Grade | Evidence |
|---|---|---|
| Neither bridge exports engine to X3D: 0 of 260 both ways, against Blender 100 of 260 written | C | grep of both source trees; Blender node board |
| Receipt grades, Babylon / three.js: CODIFIED 144 / 155, SHALLOW 9 / 57, HELD 40 / 20, no node test 67 / 24, missing 0 / 4 | C for the receipts' recorded numbers; the HELD grade is a keyword match, S | AUDIT-260.md |
| three.js: 41 of 55 CODIFIED nodes AGREE with X_ITE on a scene the receipt author did not write; 42 of 50 SHALLOW nodes AGREE too | C | AUDIT-260-v2.md, batch 3 table |
| Babylon: 21 of 57 CODIFIED nodes AGREE and 23 are NEAR; 17 of 42 untested nodes are FAR | C | same |
| Babylon draws Arc2D, Circle2D, Polyline2D and Polypoint2D far from X_ITE (MAE 93 to 123) though their receipts pass; wgpu is far on them too | C for the numbers, cause S | batch 3 table |
| Half the first scenes were blank in X_ITE; after the rewrite 1 of 122 visible | C | tables batch 1 and 3 |
| Babylon ImageTexture: MAE 91 of 255 on a 4x4 image before, IoU 0.95 and mean diff 1.65 after the hard-texel fix | C | x3d.loom #258 receipt |
| The same image on a Box is upside down in the Babylon body; turning mesh UVs and geometryData uv did nothing | C for the picture, cause S | #258 spec gap |
| 5 of 260 spec-legal scenes are rejected by x3d-4.0.xsd | S | `index.json` `xsd_blocked` |

## Lessons
1. **Count checks, not receipts.** `drawn` meant a fixture passed; the number of checks behind it ranged from 2 to 93 for the same node in two engines.
2. **A blank agreement is not agreement.** Two engines drawing nothing scored AGREE; grade BLANK on its own.
3. **The rig is part of the result.** A toast, a missing PNG and a runner copy that drifted each moved a number more than any mapping did.
4. **Use an asymmetric image for a texture test.** Solid colours hid a flipped and a smeared texture for the life of the bridge.
5. **The corpus must ship what it names.**

## Open
Box texture flip in Babylon (cause), Cylinder, Cone and Sphere UV orientation, TextureCoordinateGenerator fails in the Babylon fixture on unchanged code in this rig (MAD 22.35, S), lines and points in Babylon, 3D and cube textures far on three.js and Babylon, MultiTexture far on all three engines, the engine to X3D exporters, and the 14 deferred and 5 XSD-blocked scenes.
