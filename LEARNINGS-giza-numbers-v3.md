# Learnings: Demo 65 v2 and v3, outside review integrated (19 Nov 2026)

The owner's outside review agent audited Demo 65 v1 (Great Pyramid Numbers) and wrote 16 findings, in x3d.demo `docs/demos/blender-giza-numbers/v2/REVIEW.md`. It also built the Pyramid Observatory, shipped as v2 exactly as delivered. The Blender pipelines lane then built v3, "The Reveal": v2's instruments plus v1's theatre, a Coincidence Engine, an eclipse panel and a Blender round-trip witness.

**Grades:**
- **C**, Confirmed: shown by a named tool here.
- **L**, Likely.
- **S**, Suspected.

**Rig:** Playwright headless Chromium 157.0.8103.78 with SwiftShader, running X_ITE 16.7.1.

**Validator:** x3d_mcp 39c6e94.

## 1. Rules for the next agent

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 1 | **Count digits character for character, never by rounding.** 1,079.57 against 1,080 shares 2 literal digits, but 4 after rounding. 9.99 against 10.01 shares 0, but 2 after rounding. Colour only the literal prefix gold. Report rounding agreement, if at all, as a separate number. | C | review P1; `v3/tests/wonder.test.mjs` |
| 2 | **Put the chance count beside every "discovery".** A number built from arbitrary units has a near log-uniform mantissa, so it starts with d digits of a target t with probability log₁₀(1 + 10¹⁻ᵈ/t_d). Multiply by the number of tries. At 4 digits, 254 tries × 16 constants predicts 0.70 hits per pyramid. Khufu got 1, Khafre 2, Menkaure 3, Red 0 and the Louvre 1. | C | v3 Coincidence Engine; Monte Carlo test, 200,000 samples |
| 3 | **Drop identities before you count.** The base diagonal ÷ base side gives √2 to every digit for any square. It is a definition, not a find. Ratios fixed by one shape and powers of ten that only move the decimal point (km against m) must be excluded or merged. | C | first engine run counted √2 at 12 digits for every monument |
| 4 | **A 230 m site pays for the last digits of any latitude.** The base spans 29.97814° to 29.98021°, so every latitude starting 29.979 lands on stone. For c, the coincidence is 5 digits and the size supplies the other 4. Say which digits are luck and which are size. | C | v1 receipt `latitude` block |
| 5 | **π, τ and φ are one measurement.** All three follow from the face slope. The exact-π and exact-φ slopes differ by 0.0267°, which is less than the historical ±0.033° slope reading. Never count them as independent hits. | C | review; v3 act 3 |
| 6 | **Theatre and honesty can share a page** if the claim is told straight first (Wonder lens) and the test follows on the same card (Test lens) with a grade stamp. The owner asked for "act like that's a big deal". The review asked for no implied intent. Two lenses gave both. | L | v3 The Reveal; owner reaction pending |
| 7 | **A Blender round trip keeps geometry, not interactivity.** From v2's scene, these return: Shape 119/119, primitives, IndexedLineSet as curves, 8/8 Viewpoints, lights, ImageTextures and PhysicalMaterial. These are lost: 8 Switches, 6 Groups, WorldInfo and TextureTransform. Text comes back as 33 meshes, with no Billboard. DEF names return prefixed (`CA_Overview` becomes `OB_CA_Overview`), so every `getNamedNode` call misses. The returned file is XSD valid with 0 errors and 0 warnings, and 2.5 times larger. Keep the generated file as the live scene and use Blender as witness and renderer. | C | `v3/receipts/blender-roundtrip.json` |
| 8 | **The importer warned "indexed up to … padding" on correct per-face colours and indexed UVs.** `_index_need` also counted coordIndex. Fixed in x3d-blender-io #69 (`_attribute_need`, 3 tests, full suite 913 OK). | C | import_x3d.py lines 2301 and 2359 before the fix |
| 9 | **A reported startup race deserves a guard even when you can't reproduce it.** The review saw v1 fail with `loadURL` on undefined. Six live loads in the rig were fine. v2 and v3 wait for `customElements.whenDefined('x3d-canvas')` and `await X3D()` before `getBrowser`. v1, 63 and 64 still use the old pattern. | L | review; live check 19 Nov |
| 10 | **Drive another agent's page through its own buttons.** v3's theatre opens instruments by clicking `[data-mode]`, `[data-preset]` and `[data-camera]`. v2's module stays untouched except for one path, and its 32 tests still pass against v3. | C | node 38/38 |

## 2. What this does not prove

* The chance model is a yardstick, not a p-value. The tries are correlated, because one slope feeds many ratios.
* The control monuments use commonly cited, rounded sizes, not surveys.
* The eclipse time axis extrapolates today's recession rate of 3.8 cm/yr linearly; the result is about 617 Myr to the last total eclipse.
* No real GPU, phone, Firefox or Safari was tried.

## Links

- x3d.demo #133 (v2 and v3), x3d-blender-io #69 (importer fix).
- Earlier notes: `LEARNINGS-giza-numbers.md` (v1) and `LEARNINGS-blender-giza-demos.md` (Demos 63 and 64).
