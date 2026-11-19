# Learnings: Demo 65 v4, the Sacred Geometry Atlas (19 Nov 2026)

The owner asked for the measurement Gizas to be pushed "as far as you can in multiple directions", at the highest visual quality, with the 50,000-star Gaussian-splat sky and "more star labels". He picked two end goals: a showpiece and an atlas. The Blender pipelines lane built x3d.demo `docs/demos/blender-giza-numbers/v4/`: a Cycles-baked plateau in two lights under 52,602 real stars with 3,547 labels, and 63 sacred-geometry claims, each graded twice and each with a 3D proof.

**Grades:**
- **C**, Confirmed: shown by a named tool here.
- **L**, Likely.
- **S**, Suspected.

**Rig:** Playwright headless Chromium with SwiftShader, running X_ITE 16.7.1, at 1366 px and 390 px.

**Validator:** x3d_mcp fork 39c6e94 (XSD and semantic checks), then `loom traps --host strict` and `loom pagetraps`.

**Sources:** Petrie 1883 through the Birdsall transcription; HYG v4.1 (David Nash, CC BY-SA 4.0); ERFA 2.0.1.5 long-term precession.

## 1. Rules for the next agent

### The sky

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 1 | **Keep a star field in its own layer, in its own units.** Layer 0 holds the stars in light-years with one viewpoint at the origin. `LayerSet activeLayer='1' order='0 1'` puts the scene (metres) in layer 1. Each frame the page copies `ProximitySensor.orientation_changed` from the scene layer to the sky viewpoint. The stars then stand at infinity behind everything with no depth trick and no giant sphere. | C | `v4/stage.mjs` frame loop; `v4/assets/giza.x3d` |
| 2 | **Do not scale a GaussianSplats node up to scene size.** Under a `Transform` with scale 300 or more the page crashed in X_ITE 16.7.1; scale 30 and scale 1 worked. Rule 1 removes the need. | C | rig, three tries (5000, 1500, 300) |
| 3 | **Every GaussianSplats node needs `bboxCenter` and `bboxSize`.** The Loom trap `splat-bbox` caught all four nodes of the first sky file. Compute the box from the positions and pad it for the splat radius. | C | `loom traps`, first run 4 errors, second run 0 |
| 4 | **Store stars at J2000 and turn the sky with one rotation.** R = Rx(latitude − 90°) · Ry(−LST) · P(year). P is ERFA `ltp` sampled every 50 years as quaternions and slerped in the page. A unit test holds the page's sky to the Python receipt: shaft stars agree, and Thuban agrees once named stars carry their own motion. | C | `v4/tests/atlas.test.mjs` 8 of 8 |
| 5 | **Proper motion matters over millennia, for a few stars.** Thuban was 0.056° off the receipt until it moved. Moving only named stars and fast ones (1,619 of 52,602) through the SAI is enough, and cheap. | C | failed test, then fixed |
| 6 | **Draw labels on a 2D canvas over the scene, not as X3D Text.** 3,547 names are ranked once (key stars, then names by brightness, then Bayer, Flamsteed, Gliese). A grid stops collisions. A key star is never dropped: it tries the left side, above and below. Hide a label when its ray is under the horizon or hits a pyramid (a convex solid, five half-spaces). | C | `stage.mjs draw()` and `hidden()` |
| 7 | **A viewpoint made through the SAI is not used until `set_bind = true`.** Binding a second viewpoint is also the clean way to move the camera: it clears the visitor's own orbit offsets. Alternate two. | C | rig |

### The bake

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 8 | **Bake the ground as a lightmap, the buildings per face.** Ground: Cycles bake to 2048², upsample to 4096², multiply by a 4096² albedo bake, draw as an `ElevationGrid` with an `UnlitMaterial` emissive texture. Pyramids: vertex-colour bake at 256 samples. | C | `v4/build/build_plateau.py`, `receipts/bake-receipt.json` |
| 9 | **Weld the export and colour per face.** The add-on writes 4 vertices per quad with ColorRGBA per corner: 5.4 MB per light. Welding vertices and writing one `Color` per face (`colorPerVertex='false'`) gives 2.33 MB for both lights, because day and night share one `Coordinate` by USE. This also undoes the DEF/USE loss the bake skill warns about. | C | `build_stage.py`; 610 KB gzipped |
| 10 | **Warm sand under a mild blue tint is grey.** A night needs a strong tint (0.26, 0.48, 1.0), a higher exposure and a saturation step. Record the taste step in the receipt. | C | three preview bakes |
| 11 | **Place the Moon for the faces the camera sees.** With the Moon in the south-east, every face under Orion was black. Moved to the north-west it lights them. Say on the page that Sun and Moon are stage lights, not an ephemeris. | C | re-bake, 148 s |
| 12 | **Render the poster from the live camera.** A poster from another camera and view transform (AgX) looked washed out and jumped when the live stage faded in. Same position, same field of view, the X3D Background gradient as the visible sky and the Standard transform fixed it. | C | `build/hero_still.py` |
| 13 | **A camera facing due south is a half turn.** Axis-angle taken from the antisymmetric part of the matrix is zero there, so the file got a zero axis. Use the largest-diagonal quaternion branch. A unit test that rotates (0, 0, −1) by the file's orientation caught it. | C | `atlas.test.mjs` "lookAt reproduces the generator's viewpoint orientations" |

### The gates

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 14 | **Run the semantic check, not only the XSD.** Both files were XSD-valid and both failed `profile-component`: `UnlitMaterial` needs `<component name='Shape' level='1'/>` under Immersive and Interchange. X_ITE loaded them anyway, so only the validator showed it. | C | x3d_mcp 39c6e94 |
| 15 | **An empty group that the page fills later still warns.** Give it a `WorldInfo` child that says what will load there. | C | `empty-group` warning, then 0 |
| 16 | **`loomkit grammar` needs the fork's `src` folder on the path.** From 39c6e94 the fork imports its own packages as top-level `validation`. Fixed in `kit/loomkit/grammar.py` in this change. | C | the witness ran `error` before, `pass` after |

### The claims

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 17 | **Grade a claim twice.** The number (does the arithmetic hold inside the survey's error?) and the design (did the builders mean it?). Of 63 claims, 30 are Confirmed as numbers and only 11 are Designed. The gap is where the "magic" lives, and one grade cannot show it. | C | `receipts/atlas.json` |
| 18 | **Report every root.** The Thuban shaft matches in 2357 BC and in 3237 BC. Taking the first root gave the wrong date. List all, then say which is nearest the reign. | C | `verify_sacred.py`, first run |
| 19 | **Four star alignments are four dates.** Each shaft fits its star in a different year (2492, 2357, 2359, 2383 BC), 135 years apart and all after Khufu. Plot altitude against year with the shaft angle as a level line: the picture makes the point without words. | C | `claims-v4.json` `shaft_stars`; the shaft clock chart |
| 20 | **A correlation map has free parameters: count them.** Pinning two belt stars on two pyramids uses scale, rotation and offset. One number is left: Alnilam lands 28 m from Khafre's centre. The map's rotation misses by 36° in 2560 BC and 13° in 10,500 BC. | C | `orion_belt` |
| 21 | **Invent one claim and label it.** "Khafre is 411 cubits = 3 × 137.00" took minutes to find. Shown beside the famous ones with a MADE UP HERE stamp, it teaches the chance argument faster than a formula. | L | card `khafre_137`; owner reaction pending |
| 22 | **Show the proof, do not describe it.** Herschel's passage star became one cyan line from the entrance passage into the sky, with Thuban sitting on it in 2185 BC and 2.1° above it in 2560 BC. | C | claim `passage_thuban` |

## 2. What this does not prove

- No real GPU, real phone, Firefox or Safari was tried. No frame rate is quoted.
- The shaft angles are Gantenbrink's as commonly cited, not re-read here. Altitudes are geometric, with no refraction.
- Course heights, the queens' pyramids, the ground relief, the passage run and the chambers' east offset are illustrative.
- The splat-scale crash (rule 2) was seen in software GL only and its cause is not known.
- Design grades are judgements from the sources, not measurements.

## Links

- x3d.demo `docs/demos/blender-giza-numbers/v4/` (README, receipts, `build/`).
- Earlier notes: `LEARNINGS-giza-numbers.md` (v1), `LEARNINGS-giza-numbers-v3.md` (v2 and v3), `LEARNINGS-blender-four-demos.md` (the bake recipe's first use).
