# What a nine-decade scale ladder teaches (23 Nov 2026)

Source: the Shroud Atlas v1 build (private pages; the source plates stay out of every public repo until 1 Jan 2027).
Tools: `build_atlas.py`, `export_x3d.py`, `web_finish.py`, `validate_all.py`, `xite_shots.cjs`, `register_enrie.py`,
kept in the project files under `shroud/atlas-v1/tools/`. Instruments for every number here: Blender 5.3.0 `bpy`
wheel, x3d-blender-io 2.7.2 at `903c1e5`, x3d_mcp fork validator at `4d433af`, X_ITE 16.7.0 in headless Chromium with
SwiftShader, Linux x86_64, 4 CPU cores, no GPU. Grades: **C** = measured here with the named tool, **L** = read or
reasoned, **S** = suspected.

The build is eleven rooms. Eight step from a 4.37 m cloth to a 3.2 nm cellulose fragment. Three are devotional scenes.
Each room is one X3D 4.0 file exported from one Blender collection, with a loss receipt.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **One room per decade, each built near 1 m.** A single scene spanning 4.37 m to 3.2 nm needs a depth range no renderer has. Building each rung at display size, and recording its magnification as data, kept every room inside ordinary near and far planes. | C | `stations.json`: window and magnification per room | Carry scale as a number on the room, never as geometry size. |
| 2 | **The link between rungs is geometry too.** Each room holds a gold frame the size of the next room's window. The reader can see how much smaller the next step is, and a camera can fly into it. | C | 8 rooms, 7 frames | A zoom ladder states its ratio inside the scene. |
| 3 | **An exported room can validate and still draw near black.** All 11 exports passed the validator with 0 errors and drew almost black in X_ITE. The add-on caps a Blender-made light at intensity 1, and X_ITE lights a PhysicalMaterial as albedo/π × intensity. Raising the lights to π restored Blender's brightness. | C | X_ITE stills before and after `web_finish.py` | Valid is not visible. This repeats finding 3 of `LEARNINGS-blender-four-demos.md`: set `x3d_intensity` and `x3d_energy_per_intensity` on the light in the generator. This build patched after export instead, which is the weaker place. |
| 4 | **Area lights lose their shape.** The receipt reports each area light as approximated: it leaves as a DirectionalLight. A flat cloth under one raking directional light gets almost no light, where the area light in Cycles lit it softly. Three rooms needed one added light pointing straight down. | C | 23 approximations in 11 receipts; stills | When a receipt says "approximated", look at a frame of that room before trusting it. |
| 5 | **The receipt found every loss we later saw.** 0 objects dropped, 23 lights approximated, 23 intensities clamped. Both visible defects in the browser trace to those two lines. Nothing went wrong that the receipt had not named. | C | `*.receipt.json`, 11 files | Read the receipt before the frame: it says where to look. |
| 6 | **Registration is a receipt.** A 1931 plate was placed on a 2002 photograph by band-pass normalised cross-correlation over size, position and mirror state. The result is one row: score 0.706, runner-up 0.541, window 32.0 × 40.2 cm, mirrored. Without it, "this relief belongs to this spot on the cloth" was a claim by eye. | C | `enrie_reg.json` | When two sources are overlaid, write the transform, the score and the runner-up beside the asset. |
| 7 | **A published count beat a remembered one.** The first weave turned its herringbone every 20 threads because the stripes "look about 5 mm". The evidence table has Vial 1989: 41 threads one way, 39 back. The generator now uses 40. | C | `build_atlas.py` REV; evidence row C4 | Every modelling constant names its row in the evidence table, or is labelled as our own choice. |
| 8 | **Software GL is slow enough to look like failure.** A 8 MB room took over 30 s to give a first frame, and a screenshot timed out at the default 30 s. With a 240 s limit every room drew. | C | `xite_web*.log` | A black or missing frame on software GL is retaken with a longer wait, never scored. |
| 9 | **Two registers need two labels in the data.** Every room carries `register`: FORENSIC or SACRED/ART. Every claim carries Confirmed, Likely, Suspected, Contested, our model, or ART. The page reads both from the same list the generator uses, so a devotional room cannot be shown with a forensic label by accident. | C | `stations.py`, 38 claims | Where science and art share a page, the label lives in the data. |

## Laws these confirm

- Valid is not visible (the bake-stage rule): rooms 1 to 11 passed every check and needed a frame to show the lighting
  loss.
- No loss is silent (blender-io robustness v3): the receipt named the approximated lights before anyone saw them.
- One version per number: every count above names the tool and commit it came from.

## What this does not prove

- No real GPU was used. No frame rate is quoted.
- The registration score says the two photographs agree at that placement. It does not say the plate size it implies
  is right; that was not compared with a published plate size.
- The relief turns image darkness into height. It is a display of the image, not a measurement of a body.
