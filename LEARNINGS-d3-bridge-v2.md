# What the D3 to X3D Bridge v2 teaches (18 Nov 2026)

Source: x3d.demo `docs/demos/d3-bridge/v2/` (PR #91), following [LEARNINGS-d3-bridge.md](LEARNINGS-d3-bridge.md). Rig: headless Chromium (Playwright, SwiftShader), X_ITE 16.6.0; XSD via x3d_mcp `validate_xml` fa5dccf.

| # | Finding | Grade | Evidence |
|---|---|---|---|
| 1 | **A ClipPlane can be animated without script.** Put it in a Transform that rides the slab, and put the clipped content in a child Transform that moves the opposite way. Two PositionInterpolators on one clock do it. Lit-past and ghost-future copies use opposite plane normals. | C | spacetime.x3d, previews/spacetime-slab.jpg |
| 2 | **Build-time label declutter works without a runtime layout engine.** Projecting labels through VP0 and sending the overlaps to an LOD cut overlapping pairs from 73 to 0 (type sphere), 19 to 0 (sankey) and 16 to 0 (ridgeline). | C | manifest.json labels |
| 3 | **Phase-shifted beads on one TimeSensor.** Rotate the interpolator keys by the phase and add a duplicate key at the wrap, so the bead jumps from end to start instead of streaking back across the path. 75 beads on 47 sankey ribbons use 47 clocks. | C | sankey.x3d |
| 4 | **A graph growing through time is a d3-force-3d `nodes()` and `links()` reset on each arrival**, at alpha 0.5, with new nodes seeded near their parent. The X3D side scales unarrived nodes to 0.001 and collapses their edges to a point. Checks: 144 of 144 nodes and 757 edges at the end; 41 and 65 at demo 5. | C | receipt-browser.json |
| 5 | **Setting an X_ITE material to exactly transparency 0 from a transparent state rendered dark** in one run; 0.05 looked right. | C (seen once) | previews/chord-isolate.jpg |
| 6 | **Vertex-coloured terrain under PhysicalMaterial loses saturation**: green came out 30% high and blue 57% high against the photo, even with warm white lights. The fix to try is an unlit colour layer. | C | NOTICE.md |
| 7 | Animated scenes drew 11 to 25 page frames per 5 s on software GL; static scenes idle near 300 because X_ITE redraws only on change. That figure measures correctness only, not GPU speed. | C | receipt-browser.json |
