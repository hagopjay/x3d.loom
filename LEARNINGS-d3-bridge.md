# What the D3 to X3D Bridge teaches (18 Nov 2026)

Source: x3d.demo `docs/demos/d3-bridge/v1/` (PR #85). Reusable emitter: [kit/d3-x3d/](kit/d3-x3d/). Grades: **C** = a named tool ran, **L** = read or reasoned. Rig: headless Chromium (Playwright, SwiftShader software GL), X_ITE 16.6.0; XSD = x3d_mcp `validate_xml`, lxml 6.1.3, fa5dccf.

| # | Finding | Grade | Evidence |
|---|---|---|---|
| 1 | **D3 is a layout engine first.** Every D3Blocks chart reduces to numbers (x, y, r, angles, depth, colour) that map straight onto Transform, primitive sizes and PhysicalMaterial. No D3 code runs in the page except the one live graph. | C | build.mjs, 16 scenes |
| 2 | **Keep the 2D chart as a viewpoint.** Each 3D scene binds a top or front Viewpoint that reproduces the flat D3 layout, so the 3D version strictly adds information. | C | VP1/VP2 in heatmap, chord, treemap, sankey, pack, globe |
| 3 | **Spend the third axis on what 2D hides**: crossings (chord arches by sqrt(flow), sankey depth lanes), overplotting (ridgeline rows), time (space-time cube), breadth (cone tree), a real third variable (scatter, with the three 2D projections cast on walls), and sphere surface area (263 X3D type leaves on a Fibonacci sphere instead of one circle). | C/L | NOTICE.md table |
| 4 | **d3-force-3d drives X3D live through the SAI** at 129 to 135 ticks in 8 s on software GL, 137 nodes, 3 ticks per animation frame, positions verified equal to simulation x scene scale. | C | receipt-browser.json |
| 5 | XSD traps avoided by the emitter: zero-size Box/Sphere/Cylinder (clamp to 0.001), Extrusion scale of 0 (clamp to 0.004), MFString quoting inside attributes, and d3-scale-chromatic's `rgb()` strings (parsed to 0..1). 16 of 16 scenes valid on the first validation run. | C | receipt-xsd.json |
| 6 | **d3.geoContains builds a texture in the build step**: a 512 x 256 equirectangular land mask (43,502 land texels) written as PNG with node:zlib, mapped on a custom IndexedFaceSet sphere whose texture coordinates are ours (so outlines, spikes and texture use one lon/lat mapping and cannot drift). | C | globe.x3d, globe-land.png |
| 7 | Animated scenes need a **phase-aware screenshot**: wait on `TimeSensor.fraction_changed` inside a window before capturing (particles, relief), or the preview catches the cloud instead of the word. | C | shoot.js |
| 8 | Real repo data beats sample data for honesty: commits, X3D element counts and file trees of the x3d.* repos themselves, counts and timestamps only, no names. | L | harvest.py |
| 9 | PBR plus vertex Color reads darker than the source photo (relief); colour fidelity of vertex-coloured terrain needs an UnlitMaterial or emissive mix. | C (seen) / L (fix) | previews/relief.jpg |

**Not proved.** No GPU, Firefox, phone or headset run; no frame rates; label overlap in dense charts is not solved; profile conformance (Immersive + Shape 5 + Lighting 3) is not checked by the XSD.

**Next.** Port the emitter into x3d_mcp as a tool (`d3_layout_to_x3d`), add EnvironmentLight image-based lighting, and try d3-delaunay (Voronoi cells as extruded prisms) and d3-contour (isosurfaces as stacked terraces).
