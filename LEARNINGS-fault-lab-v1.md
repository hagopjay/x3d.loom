# Learnings: the Fault Lab (x3d.demo fault-lab/v1, 20 Nov 2026)

Ten faults planted in one heritage twin, one edit each, checked before and after the ontology review fixes
(LEARNINGS-ontology-review-fixes.md), then carried to glTF, USD and Blender. Every number names its instrument.
All rows are Confirmed on the rig named; the faults are our own, so rates describe these kinds of mistake only.

## Numbers

| Measured | Result | Instrument |
|---|---|---|
| Faults caught before | 1 of 10 | x3d_mcp 39c6e94, pyshacl 0.40.2, rdflib 7.6.0 |
| Faults caught after | 9 of 10; clean twin 0 findings on both | x3d_mcp 8205047, strict twin shapes |
| Faulty scenes flagged after conversion | 0 of 7 in glTF, 0 of 7 in USD | Khronos glTF-Validator 2.0.0-dev.3.10; pxr.UsdValidation, 30 validators, usd-core 26.11 |
| Faults erased by conversion | glTF 4 of 7, USD 3 of 7 | loom-gltf x3dsem 0.1.0; fault-lab x3d_usd 0.1 |
| Faults that change no pixel | 5 of 10 | X_ITE 16.7.1, headless Chromium 157, SwiftShader, 640x400, two views; control 0 px |
| Metadata arriving of 3 trees / 6 nodes | glTF 1 / 4; USD 3 / 6; Blender 0 / 0 | x3dsem S1, S2; x3d_usd read-back; Blender 5.3.0 + x3d-blender-io 1040830 |

## What carries over

1. **Check at the source format, before conversion.** A converter that maps a single-node field keeps one child and drops
   the rest. The output is then byte-identical to the clean file's (provenance hash aside), and no downstream validator
   can ever object. "Erased" is worse than "carried": 4 of 7 faults left no trace in glTF.
2. **A downstream validator passing says nothing about the source.** Both format validators returned 0 errors on all 7
   faulty files. They validate the container, not the claim.
3. **Two engines disagree on the same invalid file.** With two materials in one Appearance, X_ITE 16.7.1 draws the second;
   x3dsem and the USD converter keep the first. An invalid file has no single appearance, so a render cannot be its witness.
4. **Half the faults are invisible.** 2 scene faults (coordinate swaps on unbound viewpoints) and all 3 record faults change
   0 pixels. A visual review, or a pixel-score receipt, has no chance on these; only a join of scene and record does.
5. **The glTF node is the only semantic host.** KHR_xmp_json_ld packets ride on nodes, so Metadata on WorldInfo and on a
   material does not travel (S1 1 of 3, S2 4 of 6, both failing out loud as designed). USD customData takes any prim,
   including Material and Scope: 3 of 3, 6 of 6. A Loom-for-glTF profile that needs material or scene-level meaning has to
   move it onto a node or into the asset packet and say so.
6. **Blender is the weakest carrier today.** The add-on importer keeps Metadata only on Shape hosts
   (`import_x3d.py`, the single `METADATA_PROPERTY` write), so Transform, WorldInfo and material trees are dropped:
   0 of 3. DEF names survive as `x3d_def` custom properties and reach glTF extras and USD userProperties. This turns
   review finding F19 from Likely to Confirmed. Not fixed here.
7. **The range check has a stated blind spot and the lab shows it.** Angkor (longitude 103.867) is caught when swapped;
   Giza (29.98, 31.13) is not, because both numbers are legal latitudes. The catch needs a second source for the site.

## Rig traps

- gfx-guard-v3 turns the browser notice "ResizeObserver loop completed with undelivered notifications" into a start-up
  failure. X_ITE's canvas inside a fluid grid raises it. Stop that message in a listener registered before `require()`,
  or teach a v4 guard to ignore it.
- `drawImage` from an X_ITE canvas (no preserved buffer, `update="auto"`) leaves the canvas black until the next change.
  A test that reads pixels this way blanks the view it is testing. Count colours from a screenshot.
- usd-core 26.11 has no `UsdUtils.ComplianceChecker`; use `UsdValidation.ValidationRegistry().GetOrLoadAllValidators()`.
  A customData key with a colon nests; read it back with `GetCustomDataByKey`.
- Metadata children need `containerField='metadata'`. The lab's own first clean scene omitted it and the new checks
  caught it (3 semantic errors, 3 SHACL results) before any fault was planted.

## Open

- Add-on: keep Metadata on Transform, WorldInfo and material hosts (F19).
- A second-source check for coordinates (gazetteer or the twin's own record) to close the Giza swap.
- Run the same ten faults through other X3D to glTF and X3D to USD converters; the erased/carried split is a property of
  the converter, and only x3dsem 0.1.0 and the lab's own USD writer were measured.

## Update, same day: the Blender gap is closed (Fault Lab v2, x3d-blender-io #70)

| Blender row (3 trees, 6 Metadata nodes) | add-on 1040830 | add-on f68adbd |
|---|---|---|
| Held after Import | 0 trees | 3 trees |
| Blender to X3D 4.0 | 0 of 6 | 6 of 6, value for value (x3dsem); XSD valid, 0 semantic errors (x3d_mcp 8205047) |
| Blender to glTF, extras on | 0 of 6 | 6 of 6 as plain extras (node, material, scene) |
| Blender to USD | 0 of 6 | 0 of 6 |

Rig: Blender 5.3.0 bpy wheel. Add-on suite 918 tests, 0 failures. Item 6 above is now history.

What carries over:

8. **Give meaning a home on the thing that stands for its host, and a ledger for the rest.** A Transform's tree rides on
   the object that owns that Transform, a material's on the material. A host with no counterpart (a Group, a Viewpoint)
   goes on a scene-level list and the export names each one it could not write. "Kept but not written, and said so" is
   a different grade from "dropped".
9. **Carried is not the same as findable.** Blender's glTF exporter now carries all 6 nodes, but as extras in the
   importer's own nested shape. A JSON-LD tool sees nothing. The Loom glTF profile should accept such extras as input
   and lift them into KHR_xmp_json_ld packets.
10. **Blender's USD exporter writes only simple custom properties.** Nested trees vanish. A USD leg from Blender needs
    the tree flattened to a string property or an export hook.

Two more rig traps, both found because a screenshot looked wrong:

- A test server that sends `x_ite.css` as `application/octet-stream` makes X_ITE draw nothing, with no console error.
  Serve `text/css`.
- "The canvas has more than N colours" passed on a black canvas because a caption with anti-aliased text sat over it.
  Count colours only where the scene is drawn, and look at one screenshot by eye before trusting the count.
