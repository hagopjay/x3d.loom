# What the Hypergraph v2 (Chess ECO overlay) teaches (18 Nov 2026)

Source: `docs/demos/hypergraph/v2/` in x3d.demo. Follows [LEARNINGS-hypergraph.md](LEARNINGS-hypergraph.md). Grades: **C** = a named tool ran, **L** = read or reasoned. Rig: headless Chromium (Playwright, SwiftShader), X_ITE 16.6.0, X3D 4.0 XSD via x3d_mcp fa5dccf.

| # | Finding | Grade | Evidence |
|---|---|---|---|
| 1 | Hyperedges can join **different kinds of node**. Five bridge hyperedges mix chess-engine concepts with DSA concepts (for example transposition-table, zobrist-hash, memoization, hash-map, string-hashing, dp). A plain graph would need 69 pair edges for those 5 bridges (28 incidences). | C | data.json stats, build.py |
| 2 | One 4D axis can carry **two meanings by layer** (tier S to D for DSA, ECO volume A to E for openings) because both have five levels; the page says so in the caption. | L | caption, NOTICE.md |
| 3 | Layer switching is a Switch per layer plus a per-hyperedge Switch; whichChoice 0 over a Group. 36 of 36 hyperedges visible with both layers, 15 with DSA, 16 with Chess. | C | receipt-browser.json |
| 4 | 96 nodes with labels drew at 3.9 frames/s on software GL, against 12.5 for 40 nodes in v1: labels (Text) dominate cost. A GPU run is not done. | C | smoke.js, receipt-browser.json |
| 5 | Clique expansion grows faster for large hyperedges: chess layer 360 pairs from 132 incidences (2.73 per incidence) against 1.89 for the DSA layer, because the ECO volumes have 8 to 13 members. | C | build.py stats |
| 6 | x3d.chess carries no ECO table, so the overlay is standalone; ECO ranges are from the standard classification, majors cross-checked against a public list, minors graded Likely. | C/L | grep of x3d.chess, NOTICE.md |

**Not proved.** The thematic groupings and bridges are authored judgement; no real game statistics; software GL only; no mouse-driven click test.
