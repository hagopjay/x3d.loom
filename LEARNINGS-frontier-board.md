# Learnings: the frontier board and the bred mascot (23 Nov 2026)

Where should the Loom go next? x3d.gobbler `frontier/` holds the Assayer's answer: 64 candidate frontiers put through
the thirteen theses of the AI Engineering Atlas (rev 28), with no model call and nothing spent. x3d.gobbler `mascot/`
holds two new Gobbler drafts whose tail fan is that board, one of them bred by a small evolutionary search.
Source PR: x3d.gobbler #6. Every rank below is one model's opinion and is graded Suspected; the counts are computed.

Instruments: `frontier/assay_frontiers.py` on Python 3.13.18 (2,000 perturbation draws, seed 7, held-out seed 23);
x3d_mcp at b5c9956 (the copy pinned in x3d.gobbler `vendor/`), XSD 4.0 plus semantic checks; X_ITE 16.7.0 in headless
Chromium 157.0.8103.78 on SwiftShader; `mascot/evolve.py` (MAP-Elites, 120 generations of 16, seed 11).

## Numbers

| Measure | Value | Grade |
|---|--:|:-:|
| Frontiers assayed (25 domain, 15 AI engineering, 11 algorithmic, 10 generative art, 3 adversarial) | 64 | C |
| By state: unexplored, touched, explored, deep | 22, 23, 15, 4 | S (declared) |
| Prior-work paths cited, missing on disk (9 checkouts; this repo at 358575f) | 101, 0 | C |
| Worst check per frontier: clean, warn, note, gated, stop | 30, 18, 2, 11, 3 | C as computed |
| First steps that need no model call | 54 of 64 | S (declared) |
| Mean width of the 5th-to-95th percentile rank range, top 20 | 31 places | C as computed |
| Frontiers whose 5th-percentile rank is 3 or better | 15 | C as computed |
| Top-10 set on the held-out seed | 10 of 10 the same | C |
| Breeding run 1: kept birds that flattened the data | 9 of 9 | C |
| Breeding run 2 (data gene frozen): kept birds with the honest length share 0.752 | 9 of 9 | C |
| Birds evaluated per run; entered the archive; refused by the validator | 1,920; 135 and 120; 0 and 0 | C |

## The first tier (balanced weighting)

xray, cross-render, bim-ifc, openusd, qd-evolve, stem-maths, x3d-injection, x3d-bench, hostile-all, physics.
Five picks to start: cross-engine differential rendering as the oracle, BIM through IfcOpenShell, quality-diversity
evolution of scenes, prompt injection through 3D files, the OpenUSD conformance bridge. Full board, gates and first
steps: x3d.gobbler `frontier/runs/frontier-2026-11-23/BOARD.md`.

## Rules

1. **A ranked list without its range reads as an order (C as computed).** Moving each judged score by one point and
   each weight by up to 30 percent moves a top-20 frontier across 31 places on average. No frontier stays in the top
   10 in more than 81 percent of draws. Print the range beside the rank, and speak of tiers.
2. **The weighting is part of the answer (C as computed).** Five weightings give five different top threes. Only
   cross-render, bim-ifc, openusd and qd-evolve are in the top 8 of three or more. Publish the weights with the list,
   the way a score is published with its instrument.
3. **A search may shape the picture; it may not touch a number the picture carries (C).** The mascot's feather length
   is score raised to an exponent. Left open to the search, the exponent went below 1 in 9 of 9 kept birds (to its
   lower limit in 7): the median feather grew from 75.2 to between 81.2 and 86.1 percent of the longest, because
   longer feathers cover more area and area was the fitness. Order survived, contrast did not. Freeze every
   data-binding parameter before a search starts, and test that it stayed frozen. Compare failure mode 216.
4. **One fix moves the cheat; it does not end it (L).** With the exponent frozen, 5 of 9 kept birds turned their
   feathers more than 0.9 radians edge-on, which hides overlap from a front-view measure. Not isolated with a
   control. Keep one judge the search never sees (here the render and a person's eye) and expect the next move.
5. **A look-at helper loses its axis at exactly a half turn (C).** The camera behind the fan was written as
   `orientation='0 0 0 3.142'`. The antisymmetric part of the rotation matrix vanishes at 180 degrees. The x3d_mcp
   check `rotation-zero-axis` refused the file; the fix takes the axis from the diagonal, with a test.
6. **Gates rank frontiers by how startable they are, not by how much they matter (S).** The AI-engineering frontiers
   that need a judge or a paid first step (picture judge, memory trial, prompt optimisation, fine-tuning) rank 49 to
   57 because the lens gates them. The ones with a code grader (public scoreboard, retrieval over the Loom, the Loom
   as an MCP server, token economy) rank 8 to 22. A judge needs about 30 of his own labels first (Atlas thesis T5);
   a breeding page that records his picks is the cheapest way to get them.

## For the Loom

- New failure modes 220 to 223 in [LOOM-v1.md](LOOM-v1.md) section 8.
- Three frontiers on the board are Loom organs, not domains, and each first step is one session with no model call:
  retrieval over the laws and failure modes at kickoff (`rag-loom`), the Loom as an MCP server (`mcp-loom`), and
  mutation-testing every witness (`mutate-graders`).
- The registry format (`gobbler.frontier-registry/1`) takes a second scorer without change. A second set of judged
  scores is the control this board lacks.
