# What a differential chaos round teaches (22 Nov 2026)

Source: hagopjay/x3d-blender-io PR #75 (2.7.2), `tools/chaos/differential.py`, `docs/CHAOS.md`. Grades:
**C** = measured here with the named tool, **L** = read or reasoned, **S** = suspected.

The method takes one-edit mutants of 12 small frozen scenes, from 19 operators. Each mutant goes to six judges:
- the add-on's validator;
- Web3D's x3d.py;
- the Web3D XSD;
- the Web3D Schematron;
- the Blender importer;
- the re-export.

Every crash is kept, and every split verdict between judges.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **The cheapest judge found the most.** Of 68 crashing mutants on 2.7.1, 35 were one typo in a warning message (`f[1]` of a one-item list), a line Blender's own importer shares. No validator, golden file or sweep could have found it: it runs only on malformed input. | C | rows.json, rng 7 | Feed every reader inputs that are slightly wrong, not only right ones. |
| 2 | **A file every validator passes can still exhaust memory.** The XSD, the Schematron and x3d.py all accept `coordIndex='0 1 2 2147483647 -1'`. The importer padded its point list up to that index (MemoryError; 5,000,000 gave 5,000,001 vertices). | C | `tests/test_import_chaos_bpy.py` | Valid is not safe: a reader bounds what it allocates by what the file contains, not by a number the file states. |
| 3 | **Fixing the first crashes exposes the next ones.** After five fixes, three more signatures appeared (colour padding, fieldOfView INF, radius -1 re-export), all hidden behind the first five. | C | runs on rng 7 and 11 | Re-run the whole round after each fix wave and report the waves. |
| 4 | **Two tools' conventions can trap a round trip.** X_ITE reads radius -1 as unlimited, X3D's range is [0, inf), and the importer kept X_ITE's value, so the add-on's own export gate refused a file the add-on had just imported. | C | `test_x_ite_unlimited_radius_re_exports` | A round trip runs through the export gate too; a value kept for one reader must be legal for the next writer. |
| 5 | **A validator can be lenient by type coercion.** Our check read SFBool as `text.lower() == "true"`, so `TRUE`, `1` and `yes` passed as false; x3d.py's `assertValidSFVec3f` accepts any length while its `isValidSFVec3f` says no. | C | `test_validate_semantic`, x3d.py 4.0.65.8 | Test each validator with wrong values, not only with right ones: a lenient judge gives an agreement that means nothing. |
| 6 | **Each judge's scope explains most disagreements.** 560 to 593 of 960 mutants split the judges. Nearly all of these follow from scope: only the XSD and the Schematron know DEF/USE, only the XSD knows element order, and only the Schematron knows zero rotation axes. | C | summary.json | List disagreements, gate on crashes: a split verdict is a question, a crash is an answer. |
| 7 | **A judge has its own limits.** SaxonC's XML parser stops at 100 levels of nesting (`jdk.xml.maxElementDepth`), so the Schematron gives no verdict on a deep scene. | C | chaos log | Record "no verdict" as its own result, never as a pass. |

## Laws these confirm

- Law 19 and Law 44 (every judge fails a planted fault): the chaos judge has the plant `import-bool-crash`, caught in
  CI.
- Law 15 (one version per number): every count above names bpy 5.3.0 or the Blender binary it ran on.

## What this does not prove

- The seeds are 12 small scenes, so the round says nothing about large files, textures on disk, Inline, HAnim or
  splats.
- The operators edit one thing at a time, so interactions between two edits are untested.
- The Blender importer findings are graded L for upstream: we read the same lines on upstream main but did not run
  the upstream add-on.
