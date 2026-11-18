# What the Hypergraph proof of concept teaches (18 Nov 2026)

Source: `docs/demos/hypergraph/v1/` in https://github.com/hagopjay/x3d.demo (40 concepts as 4D points, 15 hyperedges as hubs and bounds). Grades: **C** = a named tool ran, **L** = read or reasoned. Environment: Linux x86_64, CPython 3.13.18, Node 22.23.5, headless Chromium (Playwright, SwiftShader software GL), X_ITE 16.6.0, X3D 4.0 XSD via x3d_mcp main fa5dccf (lxml 6.1.3).

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | A hyperedge needs no new X3D node: a hub Transform, an IndexedLineSet of spokes (`0 j -1` per member) and a transparent Sphere scaled to the member spread. 15 hyperedges, 73 incidences drew with 15 Switch nodes. | C | `hypergraph.x3d` passes XSD 4.0; browser receipt 15 of 15 switches resolved | Model n-ary relations as hub plus spokes; Switch gives per-relation visibility. |
| 2 | `Switch whichChoice="0"` shows only child 0. With a Transform and a Shape as two children, the spokes silently never drew; the file still validated. Wrapping both in a Group fixed it. | C | screenshots before and after | A valid scene can hide content; add a pixel witness, not only a schema check. |
| 3 | The Interchange profile has no Text; X_ITE logged "Unknown node type 'Text'" for each label and the XSD-valid file still lost its labels. Immersive works. | C | X_ITE console, 40 repeats | Check the browser console for parser warnings, not just validity. |
| 4 | SAI: assigning a plain JS array of SFVec3f to an MFVec3f field gave a 2-element field with NaN values. `new X3D.MFVec3f(...vectors)` is correct. | C | field readback, before 2 and NaN, after 8 points | Read a field back after the first write path you use. |
| 5 | Plain 4D perspective `1/(d - w)` explodes when a rotation brings w near d (nodes flew off screen at XW 1.1, YW 0.5, ZW 0.3). `0.85 * exp(-0.12 w)` stays bounded. | C | screenshots | Use a bounded depth map for interactive 4D rotation. |
| 6 | Clique expansion of the 15 hyperedges gives 138 distinct pairs (147 before dedup) against 73 incidences: 1.89 pair edges per incidence, and the group identity of a hyperedge is lost. | C | computed in `tools/build.py` from the authored data | Show the pairwise view beside the hub view when arguing for hypergraphs. |

**What this does not prove.** The concepts and memberships are authored for the proof of concept, not the DSA Tutor database. Software GL only (13.3 frames/s, not a GPU figure); no mouse-driven click test; bounds are spheres, not hulls.

Next: replace `tools/data.py` with a real export (concept_nodes plus a hyperedge table), then add the RFC learning-path and progress layers as node colours.
