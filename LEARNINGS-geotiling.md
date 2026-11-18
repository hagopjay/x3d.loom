# Learnings: geotiling (X3D Geospatial tile pyramid, 3D Tiles bridge)

Fold-back from x3d.demo `docs/demos/geotiling/v1/` (candidate Demo 47). Validator behind every scene claim: x3d_mcp `fa5dccf` `validate_xml` (XSD 4.0), 266 files plus 177 converted, 0 invalid. Viewer: X_ITE 16.6.0, headless Chromium, SwiftShader (no GPU), 1000 x 640, build container. Grades: **C** run here, **L** published or inferred, **S** suspected or untested. Local IDs `GT-n`; renumber on promotion to LOOM-v1.md.

## Lessons

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| GT-1 | **Nest GeoLOD by file, not by inline children.** The bundled XSD demands a `GeoOrigin` whenever a GeoLOD has inline `rootNode` children (validator hint), though ISO 19775-1 makes it optional. `rootUrl` + `child1..4Url` pointing at separate files validates clean and streams. | 132 tiles, 266 files, 0 invalid | C |
| GT-2 | **X_ITE streams GeoLOD by frames.** About 5 s per level at 4 to 5 fps (z7 to z14 in about 25 s at 4.5 km); about 100 s per level at 0.5 fps once the Drillfield DSM with shadows was in view. Put heavy content behind its own GeoLOD (the Drillfield loads only inside 2.5 km). Real-GPU speed not measured. | polling run, tile files per level | C (two runs), S for GPU |
| GT-3 | **The 3D Tiles SSE rule gives the GeoLOD range.** `range = geometricError x screenHeight / (2 tan(fov/2) x maxSSE)` = geometricError x 81.48 at 1080 px, 45 degrees, 16 px. Setting geometricError = tile width / 51 refines at about 1.6 widths in both pipelines, so native and converted trees match. | same per-level tile counts in both tabs | C |
| GT-4 | **3D Tiles child transforms are parent-relative.** Writing absolute ones made the converter's ENU check fail on 112 of 132 tiles; relative transforms (child = inverse(parent) x absolute) gave 0. | `tiles3d_to_x3d.py` stats | C |
| GT-5 | **GeoLOD has four child slots; 3D Tiles nodes have any number.** The converter chunks extra children into extra GeoLOD levels and treats refine ADD as REPLACE (warned). | 5 chunked nodes | L |
| GT-6 | **X_ITE has no native 3D Tiles loader; a tileset.json to GeoLOD converter plus `Inline` of GLB works.** The converted tree rendered the same pyramid (same tile counts per level, glb via Inline in X_ITE 16.6.0). Google's ECEF-baked GLB path is untested: only a 64 KB root.json (125 nodes, 120 contents, box volumes) was available for a dry run. | `converted/`, dry run | C for local ENU GLB, S for Google tiles |
| GT-7 | **GeoElevationGrid wants Mercator-aware texCoords.** Tiles are regular in latitude but the imagery is Web Mercator; give `TextureCoordinate` v from the Mercator row of each latitude or the tile smears. | rendered tiles line up across levels | C |
| GT-8 | **Heights are ellipsoidal in GD.** The build adds -32.6 m (geoid undulation near Blacksburg, from the planet-scale build) to terrarium ASL heights; a camera height must add the same offset (584.4 m on the Drillfield) or a 700 m view sits 115 m above ground. | first low shot was inside blur | C |
| GT-9 | **No skirts means cracks.** Neighbouring tiles at different levels leave hairline gaps (one black seam in the converted render). Skirts or edge stitching are the next engineering step. | render | S |
| GT-10 | **Archive hygiene: the "paid Google data" was small.** 68 Google 2D satellite tiles (1.99 MB), two Solar API tiles, 180 free AWS terrain tiles; the Photorealistic 3D Tiles were streamed live and never stored (terms forbid caching). The owner recalls about $50 in API fees; no log opened here shows it. | `INVENTORY.md` | C counts, S for the $50 |
| GT-11 | **`--open-textures` makes the whole pyramid licence-clean.** A hillshaded hypsometric tint from the open terrain heights replaces every Google image, so the same builder can publish beyond the academic PoC. | `build.py` flag (builds; not published) | C |

## Next builds (proposed)
1. Campus level from `earth-twin` v4 (open lidar buildings, 919, plus 8,078 trees) under the same GeoLOD root.
2. Skirts and a z16+ level; GPU timing on his machine.
3. Giza and Doha on the same globe with `--open-textures`; Google photoreal tiles only by live streaming in the visitor's browser, which needs his yes and a key.
4. Test X3DOM GeoTileset (Plesch, Havele, McCann, Aug 2026) against the converter's output.
