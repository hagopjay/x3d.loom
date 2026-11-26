# Learnings: flywheel turn 2, matching the glTF-Validator (26 Nov 2026)

The Fault Court (turn 1) found that X3D's validator caught 29 of 43 shared faults where the Khronos glTF-Validator caught 41. The owner asked for everything glTF-Validator can do, equivalent or better, and for the flywheel to keep turning. This is what was built and measured. Grades: C = run and counted here; L = likely; S = suspected.

Instruments: x3d_mcp fork at `0b941c9` (X3D 4.0 XSD, `semantic_diagnostics`, new `data_checks.py`); baseline `4d433af`; glTF-Validator code list from `ISSUES.md` of KhronosGroup/glTF-Validator (170 codes; the validator used in turn 1 was 2.0.0-dev.3.10).

## Numbers

| Measure | Turn 1 (`4d433af`) | Turn 2 (`0b941c9`) | Grade |
|---|---|---|---|
| glTF-Validator codes X3D can state, with a failing and a passing scene each | 40 of 88 reported | 88 of 88 | C |
| Fault Court, X3D arm | 39 of 53 | 52 of 53 | C (seen set, see 4) |
| Fault Court, on the 43 faults glTF can also state | X3D 29, glTF 41 | X3D 42, glTF 41 | C (seen set) |
| Decoys flagged | 0 of 10 | 1 of 10 | C |
| Clean control findings | 0 | 0 | C |
| x3d_mcp test suite | 1,764 pass | 1,847 pass | C |

Of the 170 codes: 21 the XSD rejects, 18 an existing semantic check reported, 48 need a new check, 1 is a parse failure, 3 wait for the Tangent node (X3D 4.1), 46 are byte layout, 21 have no place in X3D's design, 12 are glTF features X3D 4.0 lacks.

## What was learned

1. **Parity has to be executed, not read (FM 323, C).** Mapping codes by reading both validators put Tangent checks in the "covered" column; running the scenes showed the X3D 4.0 schema rejects the Tangent node outright. It also showed five checks credited to the semantic layer are caught first by the XSD. The parity table is now generated from the run.
2. **Fixtures do not find false alarms; real files do (FM 324, C).** The 26 new checks were run over 1,496 X3D scenes from these repositories before shipping. Three were wrong on real content and were fixed: the bounding-box check flagged shapes whose vertex shader moves the points and counted Collision proxy geometry; the USE-type check matched a DEF in the document head. Files with at least one finding, after the fixes: unused component 71 (information), rotation axis not unit 29, zero scale 15, degenerate face 12, index list with no node 12 (information), interpolators fighting over a field 12, normal not unit 10, declared box too small 7, material names a texture mapping the geometry lacks 3, unquoted MFString 2.
3. **The survey found real defects in our own demos (C).** `Collision.x3d` in the WebGPU bridge fixtures declares a box from -1 to 3 around a cone that spans 2.1 to 3.9. The Material Odyssey scene names texture mapping `uv` on three material slots while its texture coordinates carry no mapping name. These are not fixed here.
4. **A rerun on a set you have seen is a fix confirmation (FM 325).** Turn 2's 52 of 53 was reached by an author who knew all 60 faults. It shows the misses are closed; it does not show the validator generalises. The glTF code list is the more independent evidence, because it was written by Khronos for another format, and 48 of its 88 stateable codes were not reported before.
5. **A decoy is per-format (FM 326, C).** Decoy Z04 (key times 0, 5, 10) is legal in glTF, where keys are seconds. In X3D the same numbers stall the animation, and the new check reports it. It is counted as a false alarm because the pre-registration fixed the decoy list before the run.
6. **Check the contract tests before touching a public signature (FM 327, C).** x3d_mcp pins the signatures of `semantic_diagnostics` and of the `validate_semantic` tool for its playground. Adding a folder parameter broke six tests. The file checks went into a sibling function, `semantic_diagnostics_with_files`, and the MCP tool is unchanged, so file checks are not yet reachable from the tool.
7. **Do not count what cannot be written as a win (FM 328, C).** 67 of the 170 codes guard byte layout or structures X3D has no way to spell. Reporting "170 of 170" would be false. The honest denominator is 88, and 12 codes point at glTF material features X3D 4.0 cannot state at all.
8. **Where X3D is now ahead of glTF-Validator (C on these scenes).** Zero scale and degenerate faces as warnings (glTF-Validator passes scale 0 and reports degenerate triangles only as information), declared boxes checked through static transforms, PixelTexture pixel counts, missing Inline files, HAnimDisplacer arrays, and the ROUTE checks (access type, scope, order, type), which have no glTF counterpart.

## Not done

- File checks are a library call, not an MCP tool parameter.
- The X3D binary and compressed encodings are not checked at the byte level at all; the "byte layout" rows are about the XML encoding.
- No new sealed fault set, so no new held-out number.
- The rule writer is still a person and an agent in a session; the loop made no model calls.

## Rebuild

```
python3 flywheel/turn.py measure --x3d-mcp ../x3d_mcp --what "..."
cd ../x3d_mcp && python tests/gltf_parity.py --md && pytest tests/test_gltf_parity.py
```
