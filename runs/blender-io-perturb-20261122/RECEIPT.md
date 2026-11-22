# Run record: Blender property perturbation probe and determinism test (22 Nov 2026)

Purpose: evidence for the review of the Blender I/O robustness plan (v2 to v3). Read-only against the add-on; nothing in
x3d-blender-io was changed. Lessons: `../../LEARNINGS-blender-io-robustness-v3.md`.

## Instruments

| Item | Value |
|---|---|
| Add-on | hagopjay/x3d-blender-io main at `47ed742` (manifest 2.6.5), source tree clean |
| Blender | 5.3.0, `bpy` pip wheel, headless |
| Python | 3.13.18 |
| x3d.py | 4.0.65.8 |
| Host | Linux x86_64 container, no GPU |
| Export options | `bpy.ops.export_scene.x3d(filepath=..., x3d_version="X3D40")`, every other option at its default |

## Files

| File | What it is |
|---|---|
| `perturb.py` | builds one cube with a Principled material, four lights, a camera and a world; changes one scalar property at a time; exports; compares the text with head `<meta>` removed; re-baselines when an undo does not restore the file |
| `perturb-result.json` | 370 rows: group, property, result (`carried`, `inert`, `skipped`, `unsettable`) |
| `det.py` | builds a UV sphere, Suzanne and a torus in the process, exports, prints a sha256 |
| `det2.py` | `make` saves a UV sphere to a .blend; `load` opens it and exports |

Rerun: `python perturb.py /path/to/x3d-blender-io/source out.json` (about 40 s), then
`for i in 1 2 3 4; do PYTHONHASHSEED=$i python det.py SOURCE out$i.x3d; done`.

## Result 1: 39 of 363 perturbed properties change the file

| Datablock | Changed | File changed (`carried`) | File identical (`inert`) |
|---|---|---|---|
| Principled BSDF inputs | 34 | 5 | 29 |
| Object | 83 | 8 | 75 |
| Mesh (scalar settings) | 23 | 0 | 23 |
| Material settings | 35 | 3 | 32 |
| Camera | 55 | 8 | 47 |
| World | 15 | 0 | 15 |
| Light, point | 27 | 4 | 23 |
| Light, sun | 30 | 3 | 27 |
| Light, spot | 31 | 5 | 26 |
| Light, area | 30 | 3 | 27 |
| **All** | **363** | **39** | **324** |

Carried Principled inputs: Base Color, Metallic, Roughness, Alpha, Emission Strength.
Carried light properties: type, color, use_shadow, plus cutoff_distance (point, spot) and spot_size (spot).
`energy` is inert on all four light types from the 10 W default (the exporter caps a Blender-made light at intensity 1).

Grade: the counts are **Confirmed** on the instruments above. Which inert properties are real losses is **Likely** (a reading
of the X3D 4.0 fields, not a measurement).

## Result 2: the writer is deterministic; the sphere operator is not

| Test | Processes | Distinct files |
|---|---|---|
| Build sphere, Suzanne, torus in process, export (`det.py`) | 4 | 4 |
| Open one saved .blend of the sphere, export (`det2.py load`) | 4 | 1 (sha256 `c41fa861ca155407`..., 10,080 bytes) |

In the first test only `ME_Sphere` differs: the same 151 points in a different order. Suzanne (555 points) and the torus
(637 points) are identical in all four. Grade: **Confirmed** for this scene; **Likely** in general.

## Result 3: test suite

`.github/scripts/run_tests_in_blender.py`: 918 tests, 0 failures, 35 skipped (23 for numpy, Pillow or flip-evaluator not
installed in this environment), 49.7 s.

## Limits

* One starting state. A property masked by another setting reads as inert (Emission Color while Emission Strength is 0;
  `ortho_scale` while the camera is perspective; `alpha_threshold` while the blend mode is not clip).
* Scalar RNA properties only. Collections (vertices, UV layers, modifiers, node links, animation data) are not perturbed.
* One perturbation size per property; a change below the six-decimal print precision would read as inert.
* Export side only. No import-side sweep was run.
* Software host: no render, no frame-rate claim.
