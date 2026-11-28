# What OBrian v1 teaches: real NOAA ocean and wind data as accountable X3D (28 Nov 2026)

Source: `hagopjay/x3d.STEM` `studies/obrian/v1/` (builder, receipts, page) and Demo 86 in x3d.demo. Grades follow the Loom convention: **C** = a named tool ran in this build, **L** = read or reasoned, **S** = suspected. Rig for every **C**: CPython 3.13.18, numpy 2.5.3, xarray 2026.9.0, netCDF4 1.7.5, X_ITE 16.7.1 in headless Chromium (Playwright) on SwiftShader (software GL), x3d_mcp (`validation.validate.validate_xml`, `validation.semantic.semantic_diagnostics`) from the checkout the receipt names, bpy 5.3.0 with Cycles CPU and OpenImageDenoise, x3d-blender-io 2.9.0.

## 1. Findings

| # | Finding | Grade | Evidence |
|---|---|---|---|
| 1 | **The 4.0 XSD rejects what the object model and X_ITE need for volume transfer functions.** `containerField='transferFunction'` on the `PixelTexture` inside `OpacityMapVolumeStyle` is refused (one error per volume: 10 of 10 in the 2026 scene, 24 of 24 in each 24-month scene), while X3DUOM 4.0 gives `OpacityMapVolumeStyle` a `transferFunction` field accepting `X3DTexture2DNode\|X3DTexture3DNode`, and without the attribute X_ITE 16.7.1 prints "Unknown field 'texture' in node class OpacityMapVolumeStyle". Remove the volume and the scene has 0 schema errors | C | `receipts/validate.json`; X_ITE console in the receipt run |
| 2 | **A read-back witness must use the builder's mask.** The page recomputed the 20 °C depth over a box from the ElevationGrid it draws and disagreed with Python by 4.3 m (141.5 vs 145.8): land cells are drawn at 0 m and the builder's `nanmean` skipped them. Fixed by choosing a box with no land and excluding zero heights on both sides | C | page witness FAIL before, PASS after; same scene bytes |
| 3 | **Schema-valid is not semantic-valid.** `Background` with `groundAngle` of one value and `groundColor` of one colour passed the XSD and failed x3d_mcp's `array-count` (needs 2 colours); 9 empty `Group` placeholders and a marching-cubes mesh with 849 of 5,847 zero-area faces (14 %) also surfaced only in the semantic pass. After the fixes: 0 semantic errors in all 8 scenes, 4 to 6 residual zero-area warnings (rounding to 3 decimals) | C | `receipts/validate.json` before and after |
| 4 | **scikit-image `marching_cubes` defaults to `allow_degenerate=True`.** On a field stored at 0.125 °C steps it returned 14 % collinear triangles; `allow_degenerate=False` removed most | C | face counts 5,847 to 5,006 (warm 28 °C shell) |
| 5 | **A record claim names its measure.** Oct 2026 is the highest monthly Niño 3.4 anomaly in ERSST v5 (+3.02 °C, 1950 on) and CPC OISST (+3.25 °C, 1982 on), but CPC's smoothed 3-month ONI for Aug to Oct 2026 (+2.46) is below its own Dec 2015 maximum (+2.59). Both statements are true | C | argmax over the stored series |
| 6 | **Two products, one answer, different baselines.** ERSST (base 2001 to 2020) against CPC OISST: r 0.987, RMS 0.153 °C over 538 months; 3-month mean against CPC ONI (moving 30-year base): r 0.975, RMS 0.27 °C over 920 months. The Oct 2026 gap is 0.23 °C | C | `data/page-data.json` `xcheck` |
| 7 | **The thermocline tilt is a one-number witness that separates the states.** 20 °C depth west minus east (2°S to 2°N): 7.4 m in Oct 2026, -2.0 m in Dec 1997, 66.3 m in Dec 2015, 170.8 m in the Dec 2010 La Niña, against a 2001 to 2020 normal of about 133 m | C | GODAS via the builder; page read-back agrees to 0.6 m |
| 8 | **Feeds end on different dates.** GODAS and ERSST ran to Oct 2026 and the NCEP/NCAR monthly wind file to Feb 2026, so a scene has months with and months without wind arrows. The scene carries a `WorldInfo` saying so in those frames instead of an empty group | C | `page-data.json` `wind_note`, frames' `wind` flags |
| 9 | **netCDF4 over OPeNDAP hung with four concurrent requesters** (threads and a process pool both); two separate processes ran, at about 2 minutes per GODAS year, so a 20-year baseline cost about 20 minutes of wall time | C | fetch logs; the builder says one process per year |
| 10 | **Blender takes the data through the add-on without help.** x3d-blender-io 2.9.0 imported the mesh scenes (ElevationGrid, IndexedFaceSet with per-vertex colour as `ColorPerCorner`, IndexedLineSet as curves, Viewpoints as cameras, Switch flattened) and Cycles CPU rendered 1600x900 at 48 samples in about 110 to 120 s a still on 3 threads. VolumeData is not imported, so the Blender tier draws isotherm shells instead of the volume | C | `blender/render_obrian.py`, render log |

## 2. Lessons

1. **Run the semantic pass on generated scenes, always.** The XSD said yes to three real defects.
2. **A witness that has never failed has not been shown to test.** The page keeps one control that must fail (a baseline shifted by +0.5 °C), and its read-back witness found finding 2.
3. **Keep the XSD verdict and the viewer verdict side by side** when they disagree, and say which one is the gap; here the viewer is right and the XSD is behind the object model.
4. **Say the measure in every record claim** (monthly or smoothed, which product, which baseline).
5. **Per-frame layer presence is data**: write down which layers exist for which month.

## 3. What this does not prove

X_ITE was exercised on software GL only; no frame rate, no GPU memory or 3D-texture-limit result. One builder and one author: no independent oceanographer has reviewed the physics. The Blender stills come from mesh variants, not the volume. Upstream report on finding 1 is drafted and **held** (no outside posts before December). Dedication to James J. O'Brien (1935 to 2016, FSU, founder of COAPS) uses the published name and has not been cleared with COAPS or his family.
