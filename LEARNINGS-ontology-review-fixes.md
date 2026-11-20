# Learnings: fixing the ontology review findings, in rank order

Source: the second ontology engineering review of 20 Nov 2026 (25 ranked findings, F1 to F25). This file records what each fix did when it was built, with the instrument behind every number. Grades: **Confirmed** (measured here), **Likely**, **Suspected**.

Instruments unless a row says otherwise: x3d_mcp fork PR #28 (merged as bbd773f) and PR #29 (commits fab568c and 935b72b), XSD 4.1 and X3DUOM 4.1 as bundled there, rdflib 7.6.0, pyshacl 0.40.2, Python 3.13.18; x3d.loom main a8cd55e, Node v22, sharp 0.35.5; a container with no GPU.

## F1. An SFNode field held two nodes and nothing said so

| Measurement | Result | Grade |
|---|---|---|
| Two `Material` in one `Appearance` before the fix | passes XSD 4.1, `validate_semantic`, `x3d-core` SHACL | Confirmed |
| Planted faults caught by the new `sfnode-multiple` check (12 hand-written scenes, the XSD accepts 8) | 12 of 12 in XML, 12 of 12 by the generated SHACL set `x3d-cardinality` | Confirmed |
| Legal controls flagged | 0 of 6 | Confirmed |
| 2,211 distinct `.x3d` files across the project repositories | 7 flagged, all 7 are hand-made adversarial probes | Confirmed |

Rule for the Loom: **the X3DUOM field type is a checkable fact the XSD does not enforce.** 481 (node, field) pairs are SFNode; the shape set is generated from the X3DUOM, and a test fails when generator and file part ways. A gate that leans on the XSD alone lets a browser silently drop a node.

## F2. Twin shapes passed everything they could not measure

The heritage twin's shapes caught its two shipped faults and passed 8 of 8 further planted faults (scaled Transform, Cylinder for Box, default-size Box, feet for metres, unrecorded object, attribution with no tier, DEF absent from the scene, wrapping Group). Cause: the measurement shape matched one exact scene pattern, and no match read as "conforms".

| Shape set | Clean twin | Shipped faults | 8 planted faults |
|---|---|---|---|
| generated `shapes.ttl` | 0 | 2 of 2 | 0 of 8 |
| hand-written `shapes-strict.ttl` | 0 | 2 of 2 | 8 of 8 |

Rule: **"cannot measure" is a result, never a pass.** A shape that compares a record with a scene needs a sibling shape that fires when the comparison cannot be made. Limit: the same review wrote the faults and the shapes, so 8 of 8 shows the shapes do what they state. The other eight twin cases have not been audited (Confirmed gap).

## F3. Receipts held only survivors

25 `loom.receipt/1` files, 123 witness entries, 123 `pass`: a receipt is written only after acceptance, so there was nothing to mine. New: `loom.rejection/1` (`kit/loomkit/rejection.py`, `loom rejection ...`, `loom verify-rejection`).

- Every required witness is judged, not only the first that refuses (`accept` still stops at the first).
- Each refusal carries `failure_class` (the stable gate code), the witness's status and reason, its instrument, and a `locus` when the witness recorded one (file, place, rule from `measurements.hits`).
- Refused for a candidate that would be accepted; never overwrites; sealed like a receipt.
- Kit self-test: 151 negative controls caught with the intended code in both modes (was 146), 5 of them new for the rejection.

Limit: only the trap witnesses record a place today. Grammar, sci, physics and play refusals carry a class and a reason but `locus: null`. No rejection has been written for a real project yet (0 on disk).

## F4. A render fail said nothing

10 `loom.render-receipt/1` files held 14 fails and 5 warns, each with `reason: null`. New: `formats/gltf/src/failure.mjs`. The harness writes a `failure` block into each new receipt; for the 10 receipts already on disk, `tools/failures.mjs` writes a sealed `failures.json` (`loom.failure/1`) beside each one from the pictures already committed. No receipt was rewritten (10 of 10 still verify).

Each record has: the floor it missed, an image-space locus (bounding box of differing pixels, worst tiles of an 8 x 8 grid, silhouette or interior), a measured class, and the SPEC rule that explains it if one does.

| Group (engine, class, rule) | Records | Subjects |
|---|---|---|
| Cycles, local-shading, R-GLTF-4 | 3 | AlphaBlendModeTest, DamagedHelmet, Duck |
| three.js, tone-shift, **unexplained** | 3 | MetalRoughSpheresNoTextures, NormalTangentMirrorTest, x3d-burruss-geo |
| Babylon.js, tone-shift, **unexplained** | 3 | same three |
| Cycles, silhouette, R-GLTF-4 | 2 | MetalRoughSpheresNoTextures, NormalTangentMirrorTest |
| any engine, tone-shift, R-GLTF-8 (reference suspect) | 4 | x3d-twin |
| other single records | 4 | |

19 records: 11 explained by an existing rule, 8 unexplained. What the grouping showed that the receipts did not:

1. Two groups already reach three members with no rule: three.js and Babylon.js both render **brighter** than the Khronos reference on the same three subjects. (Confirmed measurement; cause Suspected.)
2. On x3d-burruss-geo all four engines, Cycles included, are brighter than the reference in the same region. That is the reference-suspect pattern, but the consensus rule did not fire because the candidates did not all pass against each other. R-GLTF-8 may be too narrow. (Suspected.)

Limits: the locus is a picture region, not a glTF node (that needs an id pass per engine). The class cut-offs are v0 values set by hand. A class describes the difference and does not prove a cause.

## F8 and F9. Five dialects for one idea, no hash, 29 bad ids

Before: four grade predicates and three scales, 0 of 144 claims hashed, 20 `@id` values with a space and 9 relative. New: `kit/loomcore/` (context, SHACL shapes, `normalize.py`, normalized copies of five demo files from x3d.demo @ 7a8c0ba).

| Measurement | Result | Grade |
|---|---|---|
| Claims read through one shape | 369 in 5 dialects (the review counted 144 in 3; Gobbler adds 162, the Giza atlas 63) | Confirmed |
| Conform to `claims.shacl.ttl` (rdflib 7.6.0, pyshacl 0.40.2) | 369 of 369 | Confirmed |
| Carry a sha256 of their source object | 369 of 369 (was 0) | Confirmed |
| One query, grades across every dialect | C 167, L 72, S 124; 5 refuted and 1 untested carry no grade | Confirmed |
| Id repairs, all listed in `REPORT.json` | 19: 9 relative (medical), 10 with a space (math claims) | Confirmed |

Rule: **a grade scale has one axis.** The Giza atlas mixed evidence strength (Confirmed, Likely, Suspected) with outcome (False, Untested); a refuted claim is a verdict, not a low grade. A value on no known scale stops the run instead of being guessed.

Limit: the demo files are unchanged, because a demo version is never overwritten. Each demo should write through this shape in its next version. The other 10 space-holding ids sit on lesson nodes, not claims.

## F5 to F7. The SPARQL tools: memory, and what "stable" means (x3d_mcp #29)

| Measurement | Before | After | Grade |
|---|---|---|---|
| 872-character query, 26 string doublings | passes the guard, builds 1 GiB in 3.3 s | stopped in 0.82 s by a cap on the worker's address space (default 1024 MB above the server's size at the fork) | Confirmed, Linux |
| ORDER BY inside a subquery | outer rows unsorted, labelled `order: "query"`; 3 hash seeds gave 3 row orders | only the outermost modifiers are read; same hash on 3 seeds | Confirmed |
| LIMIT 5 with no ORDER BY | 3 seeds gave 3 different row sets behind a hash that looked reproducible | answered with `stable: false` and a warning | Confirmed |

Rule: **a sorted page is not a repeatable page.** Sorting fixes the order of the rows that came back, not which rows came back. Any tool that hashes a page must know whether membership was cut before the sort. Limit: the cap needs `/proc` and `RLIMIT_AS`; on the owner's Windows PC the deadline is still the only bound, and concurrent workers are not capped.

## F15. The gate that answered from one source (x3d_mcp #29)

`where_can_place` read the X3DUOM alone. Of its 6,509 rows for X3D 4.1 the XSD accepts 4,879, rejects 740 (11.4%) and 890 are inconclusive (`verified-containment.json`, built from the XSD by `evaluation/build_verified_containment.py`). Each row now carries the verdict, and `verified_only` keeps the accepted ones. Rule: **when two normative sources disagree, show both verdicts on the row; do not pick one silently.**

## F23. Latitude 137 (x3d_mcp #29)

New check `geo-coordinate-range`: 5 of 5 planted faults caught, 5 of 5 legal controls quiet, 0 flagged in 2,214 distinct `.x3d` files from the project repositories. Limit: a swap where both numbers are under 90 cannot be seen by a range test, and the corpus holds no real out-of-range value, so there is no field catch yet (Confirmed for the counts).

## F18. The glTF semantic spec said "any host"

Measured on `formats/gltf/semantic/fixtures/metadata-host-probe.x3d`: Metadata on Material, WorldInfo and TimeSensor does not travel (3 of 5 trees, 3 of 6 nodes), because those hosts are not glTF nodes. S1 and S2 fail, so the loss is reported. SPEC section 5 now lists the hosts that travel, and the probe is a test. Not built: carrying Metadata for non-node hosts (it would need material-level and asset-level packets).

## F20. Witness runs that named no version

78 of 116 witness runs named a tool with no version. `write_witness` now stamps every record with `kit_sha256` (sha256 over loomkit's own source files), `kit_commit` and `kit_dirty`; receipts and rejections copy them. Existing receipts are not rewritten, so the 78 stay as they are and the figure only improves with new runs.

## Closed without a build, and why

| Finding | Decision | Reason |
|---|---|---|
| F16 ontology IRIs change with every release (0 of 2,469 subject IRIs shared between 4.0 and 4.1) | no new code | x3d_mcp already writes its shapes against 4.1 only and maps versions in one place; the stable-IRI question belongs to the ontology's publisher |
| F17 no Turtle to X3D converter | do not build | XML stays the master and RDF a derived view; a general reverse converter would make two sources of truth |
| F19 Blender round-trip audit skips Metadata | deferred | graded Likely from a code read; Blender is not on this machine, so a fix could not be verified. It belongs to the Blender lane |
| F21 render-and-score ran on 2 of 25 artifact receipts | deferred | large; the glTF harness is the model to port to X3D subjects |

## What carries over

| Rule | From |
|---|---|
| Generate cardinality checks from the object model; do not trust the schema to count | F1 |
| Give every comparison shape a "could not compare" sibling | F2 |
| Write the refusal down with the same care as the acceptance | F3 |
| A fail without a class, a place and a rule link is not data | F4 |
| One grade axis, one verdict axis; refuse a value on no known scale | F8 |
| Hash the claim where it is written, and list every id repair | F9 |
| A sorted page is not a repeatable page: know whether membership was cut | F6 |
| Two normative sources that disagree both go on the row | F15 |
| A spec line about coverage needs a fixture that measures it | F18 |
| Stamp the instrument's own content hash into every record | F20 |
