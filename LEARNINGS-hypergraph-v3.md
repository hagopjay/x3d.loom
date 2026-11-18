# What Hypergraph v3 (full ECO table, Babylon render) teaches (18 Nov 2026)

Source: `docs/demos/hypergraph/v3/` in x3d.demo. Follows [LEARNINGS-hypergraph.md](LEARNINGS-hypergraph.md) and [LEARNINGS-hypergraph-eco.md](LEARNINGS-hypergraph-eco.md). Grades: **C** = a named tool ran, **L** = read or reasoned. Rig: python-chess 1.10 / Python 3.13.18; headless Chromium (Playwright, SwiftShader software GL, WebGL2); Babylon.js 9.37.0; esbuild 0.28; X3D 4.0 XSD via x3d_mcp fa5dccf. No frame rates are claimed (CPU renderer).

| # | Finding | Grade | Evidence |
|---|---|---|---|
| 1 | **A prediction I made was wrong and the data corrected it.** I expected the Lichess table to contain lines that reach the same position. It contains none (0 duplicate end positions in 3,865 lines). Transpositions only appear by replaying each line and checking whether an intermediate position equals another line's end position by a different move order: 831 events, 148 positions joining 2 or more ECO codes, 54 joining 3 or more. | C | `tools/build.py`, `data.json` stats |
| 2 | The table is exactly 100 codes per volume (A00 to E99), but unevenly deep: named lines A 823, B 781, C 1,250, D 644, E 367; median shortest line 9 plies, max 28. | C | data.json stats |
| 3 | Importing Babylon through its barrel made a 7.1 MB bundle; deep imports of the ten modules used gave 1.4 MB. Missing side-effect imports (`thinInstanceMesh`, `spriteSceneComponent`) are the usual cause of silent failures. | C | esbuild output |
| 4 | Thin instances with a `ShaderMaterial` need the matrix attributes named `world0` to `world3` plus your own per-instance attribute (here `icol`); one mesh draws 548 points, one more draws the hubs, one `LineList` mesh draws every spoke. Draw calls stay in single digits. | C | page runs, 0 console errors |
| 5 | HTML overlay labels with greedy rectangle declutter (priority list, 64 slots) beat 3D text: crisp, and the page stays legible with 99 hyperedge names. | C | screenshots |
| 6 | Two bugs found only by screenshots: the camera fit read visibility targets that had not updated yet (fit used the old layer), and per-frame lerp factors made transitions depend on frame rate (use `1-exp(-dt*k)`). | C | screenshots before/after |
| 7 | Putting the DSA and engine concepts in their own region (not mixed into the chess clusters) turned the 5 bridges into long visible edges; mixed in, they were unreadable. | C | screenshots |

**Not proved.** No GPU run, no Firefox, Safari or phone; transpositions are within the named lines, not real games; no opening statistics; bridges and groupings are authored.
