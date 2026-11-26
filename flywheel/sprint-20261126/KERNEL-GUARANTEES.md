# What a pass of the x3d_mcp kernel proves (draft)

Scope: `semantic_diagnostics` (semantic.py, data_checks.py, usd_checks.py, splat_arrays.py, profile.py) plus the XSD step in validate.py. "Pass" means: well-formed XML, XSD valid for the declared version (3.x is checked against 4.0), and zero diagnostics at level `error`. Warnings and infos do not fail a pass, so nothing below that is only warned is guaranteed. Counts are by distinct check name, read from the source (about 116 names: about 57 able to emit an error, about 38 warning-only, 21 info-only). Judged from reading the code; the suite was not run.

## 1. Guarantees

**A. Well-formedness and schema**
- **G1 (schema).** The file parses and every element, attribute name and attribute value type satisfies the bundled XSD (4.0 or 4.1). Check: XSD (validate_xml). Holes: 3.x files are checked against the 4.0 schema, not their own; the XSD passed all 25 of agent 8's files, including 20 faulty ones, because it checks form not meaning.
- **G2 (profile closure).** Every node tag in the Scene is covered by the declared profile or a `component` statement. Check: `profile-component` (error, semantic.py `_check_profile_components`, profile.py `check_profile`). Holes: tags not in X3DUOM go to `report.unknown`, which `ProfileReport.ok` ignores, so an unknown tag passes this check (the XSD is then the only guard); profile test only checks node-level, not field-level, so a field newer than the declared version is not checked.

**B. Names and references**
- **G3 (reference closure, weak form).** Every USE names a DEF that exists somewhere in the Scene, occurs earlier in document order, has the same element name, and the USE is not inside its own DEF. Checks: `use-undefined-def` (`_check_def_use_consistency`), `use-before-def` (`_check_use_before_def`), `use-type-mismatch`, `use-cycle` (data_checks.py). Holes: the first two use one scene-wide set of names, ignoring ProtoBody scopes (route checks do scope, `_name_scope`; USE checks do not), so a USE in one proto naming a DEF in another passes; "legal at the place of use" is not part of G3 (see G6).
- **G4 (DEF uniqueness).** No DEF name is repeated: `duplicate-def` (error). Hole: `_check_duplicate_defs` iterates the whole scene, so it is not scope-aware and may false-alarm on legal repeats in separate ProtoBodies (not tested here).
- **G5 (ROUTE endpoints).** Every ROUTE names an existing node and field, in the right scope, after its nodes, with the right access type and a matching field type. Checks: `route-missing-from-node`, `route-missing-to-node`, `route-invalid-from-field`, `route-invalid-to-field`, `route-wrong-access-type`, `route-type-mismatch`, `route-out-of-scope`, `route-before-def` (all error; `_check_route_validity`, `_check_route_order`). Holes: ROUTEs touching IMPORTed names are skipped (`imported` set in `_check_route_validity`); agent 8 found the bare `fraction` alias for an inputOnly field is flagged, which is correct.
- **G6 (child placement).** Each child node sits in a container field that exists on its parent and accepts its type; SFNode fields hold one child. Checks: `containerfield-unknown`, `-not-node`, `-type-mismatch`, `sfnode-multiple` (error). Hole: coverage of USE children and ProtoInstance fieldValues not read out of the code.
- **G7 (names).** DEF/USE strings contain no whitespace and do not start with a digit: `naming-convention` (error for those, warning for others). `proto-undeclared` (error): a ProtoInstance names a declared PROTO.

**C. Event types**
- **G8 (type-correct events).** Within the checked list of G5, source and destination field types agree. See G5. Not covered: Script-defined fields, routes through IMPORT, event cascades and loops (agent 8 fault 18: a ROUTE cycle is missed).

**D. Data consistency**
- **G9 (counts).** key/keyValue lengths agree (`interpolator-key-length`), keys ascend (`interpolator-key-order`), tuple multiples (`tuple-count`), attribute counts per vertex (`attribute-count-mismatch`), pixel texture header (`pixel-texture-count`), interpolator and its target field sizes (`interpolator-target-count`), HAnim skin/displacer counts (`hanim-*-count`, `hanim-skin-weight-negative`). Hole: `_INTERP_ARITY` lists known interpolators only; a node not in it is skipped.
- **G10 (indices).** Index arrays point inside their coordinate arrays and faces have 3+ vertices: `index-out-of-range`, `face-too-few-vertices`, `hanim-skin-index-out-of-range`. Hole: `index-without-node` is only info.
- **G11 (ranges).** Colours in 0..1 (`colour-out-of-range`), clip distances (`clip-distance`, `ortho-extent`), spec-positive fields and enum values (`value-out-of-range`, `enum-invalid`, tables `_POSITIVE`, `_ENUMS` in `_check_field_values`: a hand-written finite list, not all fields), `bbox-too-small`, latitude in -90..90 (error; longitude only warns), tangent sign.

**E. Numeric sanity**
- **G12.** Zero-axis rotations (`rotation-zero-axis`), non-finite physics values and masses, zero joint axes, inertia (`physics-*` error), splat scale/opacity space and all-zero quaternions (error). Not guaranteed (warn only): non-unit normals, zero scale, non-unit rotation axis, `cycle-interval-zero` (spec says >0), orientation steps, unreachable keys.

**F. Resources**
- **G13.** When validated with a base directory (`semantic_diagnostics_with_files`; without one these checks do not run), every local url resolves inside that folder (`url-unresolved`), and an image's header is recognisable and not truncated (`image-unrecognized`, `image-truncated`). Holes: remote urls and outside-folder alternatives are skipped (`continue` in `check_files`); contents of Inline, scripts and meshes are not read; the default entry point `semantic_diagnostics` passes base_dir=None.

**G. Physics, HAnim, geo**
- **G14.** Joints name bodies in the same collection; a body is not shared (`physics-body-shared`); HAnim joint/skin consistency (`hanim-joint-outside-skeleton`, `hanim-binding-count`). Name conventions, collider overlap, joint loops, bodies without colliders are info or warning only, so not guaranteed.

## 2. Binding or advisory
Error means binding. Everything on 4 lines above flagged warn or info (about 59 names) is advisory. Examples: `shape-no-geometry`, `route-never-fires`, `route-fan-in`, `degenerate-face`, `mesh-non-manifold-edge`, `texture-too-large`, `url-absolute-path`.

## 3. Non-guarantees (a pass does not prove)
| Not proved | What addresses it |
|---|---|
| The scene looks as intended | browser court, pair judge (soft, not kernel) |
| The scene does anything: a sensor with nothing to sense, a disabled sensor as sole trigger, Script without url, ProximitySensor size 0, a ROUTE cycle, stopTime before startTime (agent 8: 9 of 20 faults missed) | nothing yet; agent 8 proposes 9 rules |
| Behaviour over time, physics outcome | simulator / physics witness |
| Performance, size, frame rate | `oversize` limits and nothing for frame time |
| External files' contents, remote urls | nothing yet (only header probes) |
| Browsers agree | browser replay, one engine (X_ITE) so far |
| The check list is complete (decoy Z04 flagged, 52 of 53 faults are the author's own, scored after rules were written) | sealed replication, receipts (unsigned) |

## 4. Soundness status (from tests/ names, not run)
- Tested by fixtures only: G3 to G11, G14 (test_semantic.py 113 tests, test_validation.py, test_profile.py, test_orientation_steps.py, test_scene_semantics_fixtures.py).
- Tested on a corpus with false-alarm reading: partly. test_downey_findings.py ran the parity checks on 20 downey scenes and fixed false alarms (mesh-colocated-points, coordinate-precision); test_gltf_parity.py and test_usd_parity.py are one failing and one passing fixture per rule, and the ledger records one flagged decoy in ten. The false-alarm rate on real X3D at large is unknown.
- Untested for soundness (completeness not claimed): G13 across file formats; G2 unknown tags; G4 inside protos; any claim about checks never fed a counterexample.
- Note that a test shows a check fires, not that the guarantee holds without it.

## 5. Comparison with Lean
| | Lean | x3d_mcp kernel |
|---|---|---|
| Trusted base | small kernel, one type theory | lxml, bundled XSD, X3DUOM tables, about 6,400 lines of Python checks, written by the project |
| What is checked | a proof term against a stated theorem | a file against a list of rules |
| Soundness | proved metatheory; kernel accepts only valid proofs | each rule is falsifiable but unproved; decoy flagged 1 of 10 |
| Completeness | none (undecidable) but every claim checkable | none, and not claimed; 9 of 20 blind behaviour faults missed |
| A pass certifies | the stated theorem | G1 to G14 above, nothing about intent |
| Who writes the proof | author or tactics, adversarial to the kernel | the scene's author; rules are written by the project, with failures read |
| Versioning | pinned kernel and library | git commit of x3d_mcp, no certificate yet |

Strongest true sentence: "The x3d_mcp validator is a deterministic, versioned, rerunnable checker that certifies a stated list of structural guarantees about an X3D file and publishes a ledger of what it misses; it does not certify that the scene is what was meant, which is judged by separate, softer instruments."

## 6. Smallest additions
1. A machine-readable `guarantees.json`: id, proposition, check names, level, tests, known holes; a test that fails when a check name in code is missing from it.
2. A pass certificate (JSON): file SHA-256, validator commit, guarantees.json hash, XSD version, base_dir used, list of binding checks run, warnings count.
3. Signing the certificate (detached signature) so it cannot be edited.
4. A counterexample fixture for each guarantee, in tests, named by its G number.
5. Fix the holes: scope-aware USE and DEF checks, unknown tags as an error, the nine agent 8 rules.
