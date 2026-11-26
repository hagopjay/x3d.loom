# Learnings: flywheel turn 3, answering the USD rulebooks (26 Nov 2026)

Turn 2 matched the Khronos glTF-Validator. The owner asked for the same against USD: X3D validation should subsume every USD validation that applies to X3D, fully or partly, because the lab's road runs X3D → Blender 5.x → glTF and USD, and USD is where NVIDIA (Omniverse, Isaac Sim) judges assets. This is what was built and measured. Grades: C = run and counted here; L = likely; S = suspected.


**Numbering and merge status (added at integration, 26 Nov).** The ledger counts measured rows: this is ledger turn 3. The plan document's "turn 3" (the self-coding loop) and "turn 4" (the wild set) are separate work that wrote no ledger row, so the two numberings differ by design. The kit's failure modes were built as 357 to 364; main had taken 357 to 363 (loom #213), so they are renumbered **364 to 371**. The x3d_mcp patch this turn was measured on has since merged as x3d_mcp #32 (`92323ff`, merge `9e21c4c`).

Instruments:
- **Validator:** x3d_mcp `f0bde28` plus kit `x3d_mcp-usd-parity` (one patch, sha256 `561f06fa22ce…`). The ledger names both, because `git am` gives the merged commit a new hash.
- **The three USD rulebooks**, pinned in x3d_mcp `tests/usd_rules.json`:

  | Rulebook | Version | Rules |
  |---|---|---|
  | OpenUSD (Pixar), registered `UsdValidation` validators | usd-core 26.11 | 30 |
  | NVIDIA Omniverse Asset Validator | `omniverse-asset-validator` 1.18.0, PyPI; needs Python ≤ 3.12 | 40 |
  | NVIDIA SimReady Foundation requirements | `NVIDIA/simready-foundation` `c3bd1d8`, 23 Nov 2026 | 270 |

  SimReady is what Isaac Sim's asset validation reads.
- **Real-file corpus:** 1,548 X3D scenes at the commits recorded in x3d_mcp `docs/usd-checks-survey-20261126.json`, from x3d.loom, x3d.docs, x3d_mcp, x3d.demo, x3d.lab, x3d.wgpu and x3d-blender-io.

## Numbers

| Measure | Value | Grade |
|---|---|---|
| USD rules mapped | 340 of 340 | C |
| Rules X3D can state | 66 | C |
| ... reported, each with a failing and a passing scene | 66 of the 340 rules (the 66 the project judged X3D can state; the project classified the other 274) | C |
| ... how they are reported | XSD 13, checks that existed 20, new checks 28, X3D 4.1 GaussianSplats 5 | C |
| Rules X3D's standard makes impossible to break | 32 | C (reading; one row L) |
| Rules SimReady fixes differently, so the exporter converts (Z up) | 1 | C |
| Rules that are not a validator matter in X3D | 241: USD structure 45, packaging 5, features X3D 4.0 lacks 38, one simulator's schema 44, pipeline or profile policy 92, human judgement 17 | C |
| New checks shipped | 18 | C |
| Fault Court (seen set) | 52 of 53, unchanged; a fix confirmation by a rule writer who had seen the faults (held-out: Loom arm 17 to 20 of 25) | C |
| Decoys flagged | 1 of 10, unchanged (Z04) | C |
| glTF-Validator parity | 88 of the 170 Khronos codes, unchanged (the project classified the other 82) | C |
| x3d_mcp test suite | 1,847 before, 1,894 after (+47 new, 0 broken) | C |

By rulebook:

| Rulebook | X3D can state | Covered |
|---|---|---|
| OpenUSD | 7 of 30 | 7 |
| Omniverse Asset Validator | 18 of 40 | 18 |
| SimReady | 41 of 270 | 41 |

## Real files: what the survey found before shipping

Files with at least one finding, after the fixes below:

| Finding | Level | Files |
|---|---|---|
| colocated points | information | 246 |
| no geometry | information | 140 |
| transparent open mesh | information | 50 |
| zero-area face | warning | 38 |
| constant interpolator | information | 29 |
| unused point | information | 23 |
| non-manifold edge | warning | 18 |
| joint loop | information | 11 |
| unused value | information | 9 |
| coincident shapes | information | 4 |
| normals against winding | warning | 4 |
| collider overlap | information | 4 |
| coordinate precision | warning | 1 |

The warnings read as real:
- **Non-manifold edges and zero-area faces** are in the scanned Atlas meshes: a few out of 200,000 to 300,000 faces.
- **Constant interpolators:** orrery orbits with 240 identical keys, which animate nothing.
- **Coordinate precision:** a 9 m-scale ruler 9 km from the origin.
- **The Galton board's beads** start inside each other.

## What was learned

1. **Fixtures pass; real files find the bug (FM 364, C).** `physics-body-shared` reported a collidable shared by two bodies in 9 real files where every body had its own. The dictionaries were keyed by `id()` of lxml elements; lxml builds those proxies on demand and reuses the address of a freed one. 9 files → 0 after keying by the element itself. Three other checks had the same flaw without showing it yet. Every fixture had passed.
2. **A rule from a simulator's profile is not an X3D rule (FM 365, C).** SimReady requires one joint per pair of bodies and a collider on every enabled body. Those are articulation and contact requirements. In X3D, a trebuchet latch (a second joint on a pair), a soft "jelly" made of a loop of joints, and a pendulum bob with no collider are all legal, and x3d_mcp's own test "a clean physics scene passes" said so. The checks became information, naming the solvers that care. `physics-body-no-collider` fires only in a collection that has a CollisionCollection.
3. **An absolute threshold misfires across scales (FM 366, C).** "Neighbouring float values more than 1 mm apart" flagged the 40 km Giza terrains, where 5 mm is invisible. The rule is now relative to the mesh's own size (above 1 mm and above 1/10,000 of its extent), plus SimReady's absolute RTX line (2^38 units). 6 files → 1.
4. **Judge a face by all its normals, not their average (FM 367, C).** Smoothing at a thin fold legitimately tilts one vertex normal past 90°. 6 files → 4.
5. **Alternatives are not co-present (FM 368, C).** LOD and Switch children were reported as coincident shapes, but only one is ever drawn. Two idioms remained and are now named in the check's text:
   - a hidden palette of tiny Shapes whose only job is to DEF Appearances;
   - a mesh drawn twice on purpose.

   22 files → 4, now information.
6. **A box around a tilted body is not the body (FM 369, C).** World-aligned boxes around rotated dominoes "overlapped". Spheres are now tested exactly and boxes, cylinders and cones as oriented boxes (separating-axis test). Two fixed bodies may overlap, because static scenery does. 15 files → 4.
7. **Most USD rules are not about mistakes X3D can make (FM 370, C).** 66 of 340, and the 32 "fixed" rows are not gaps but the opposite: one root, +Y up, metres, seconds and computed normals are written into the standard. An X3D file cannot forget them. This extends FM 328 (count the honest denominator) to a format whose validators are mostly about its own composition machinery.
8. **The one convention row is the exporter's job, and the road already meets it (FM 371, C on Blender's side).** SimReady's UN.006 wants Z up; X3D is +Y up by definition. Blender's USD export writes `upAxis = "Z"` (measured 10 Nov, coordination doc), so X3D → Blender → USD satisfies it. A direct X3D → USD writer must rotate. `x3dnv.splats` does so for splats with a parent rotation.

## Where this leaves the claim

- **Where X3D can state a mistake, its validator now reports what OpenUSD, the Omniverse Asset Validator and SimReady report.** Every row is backed by an executed pair.
- **Where X3D cannot state it, the table says why**, row by row.
- **92 policy rows are the opening.** They are SimReady pipeline conventions: names, folders, thumbnails, required metadata, label vocabularies, gripper and mate annotations. An **X3D SimReady profile** (metadata conventions, checked here) would move most of them into the covered column and let an X3D scene be judged "SimReady before export". That profile does not exist yet.

## Not done

- **No USD file was written from these X3D scenes and run through the three rulebooks.** That would make it an end-to-end check that a clean X3D scene exports to a clean USD (Blender 5.x leg). It is the Foundry's lane; the request is in the coordination doc.
- **No sealed fault list.** Turn 3's checks were written with the rules in view; the real-file survey is the only independent evidence of false-alarm rates.
- **The new checks run through `semantic_diagnostics`** and therefore through the `validate_semantic` MCP tool. The file check (`texture-too-large`) runs only through `semantic_diagnostics_with_files`, like turn 2's file checks.
- **Rules by:** an agent, not yet reviewed by a person. Model calls by the loop: 0.

## Rebuild

```
cd ../x3d_mcp && python tests/usd_parity.py --md && pytest tests/test_usd_parity.py
python tests/usd_checks_survey.py ../x3d.loom ../x3d.demo ... --json survey.json
cd ../x3d.loom && python3 flywheel/turn.py measure --x3d-mcp ../x3d_mcp --what "..."
```

## Addendum, 26 Nov: the first Blender leg (Q12), x3d_mcp #33
84 parity scenes through Blender 5.3.0 (`import_scene.x3d`, add-on 2.7.6, then `wm.usd_export`), then usd-core 26.11 and Omniverse Asset Validator 1.18.0 (Python 3.12.3), joined per rule. 70 rules executed, 27 mapped to an X3D check; 70 of 84 scenes agree on every mapped rule, but that is 1,748 quiet-quiet pairs, 8 both firing, **17 X3D only** (Blender repaired the fault: Likely), 1 export-made and 2 to review. All 30 usd-core validators fired on 0 of 84 exports. `IndexedPrimvarChecker` fails on 37 of 84 exports (Blender writes unindexed primvars). Not shown: real files, SimReady requirements (not executable), up-axis rules. Failure modes **372** (the importer launders faults) and **373** (an agreement score dominated by quiet pairs).
