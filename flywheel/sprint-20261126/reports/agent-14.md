# Agent 14: blind non-behaviour fault test

Honesty note: the 20 faults and 5 decoys were written by an AI agent in the same project, before reading any check, so they are independent of the checks. Correction: fault-11 first used wrong attribute names (XSD rejected it for the wrong reason); I fixed them (baseColor, roughness) and re-ran. The row below is the corrected scene.

## Score
- Caught at any level: 13 of 20
- Caught as error (XSD-invalid or error level): 11 of 20
- Caught by XSD: 6 of 20 (01, 02, 04, 11, 12, 13)
- Decoys flagged: 0 of 5
- No plant judged a non-fault, so the score is the same both ways. Four plants are valid but unwise (07, 10, 15, 17); the other three misses are real spec errors.

## Per file
| # | Fault | Result |
|---|---|---|
| 01 | Material directly under Shape | XSD + error containerfield-unknown |
| 02 | Appearance outside Shape | XSD invalid |
| 03 | USE of a Sphere as Appearance | error use-type-mismatch |
| 04 | Duplicate DEF | XSD ID + error duplicate-def |
| 05 | coordIndex without -1 | MISSED |
| 06 | coordIndex one past end | error index-out-of-range |
| 07 | creaseAngle 30 | MISSED |
| 08 | ElevationGrid 3x3, 8 heights | error array-count |
| 09 | Extrusion one spine point | MISSED |
| 10 | transparency 1, only object | MISSED |
| 11 | PhysicalMaterial roughness 2 | XSD maxInclusive |
| 12 | colour 255 0 0 | XSD + error colour-out-of-range |
| 13 | fieldOfView 45 | XSD maxExclusive |
| 14 | SpotLight cutOff < beamWidth | warning spot-beam-wider-than-cutoff |
| 15 | rotation angle 90 | MISSED |
| 16 | scale 1 0 1 | warning scale-zero |
| 17 | object at x = 1e7 | MISSED |
| 18 | LOD range 50 20 5 | error lod-range-order |
| 19 | skyAngle 3 vs skyColor 2 | error array-count |
| 20 | DirectionalLight direction 0 0 0 | MISSED |

## Missed faults and proposed rules (all re-read and confirmed faulty as intended)
- 05 (spec error): error if an IndexedFaceSet/IndexedLineSet coordIndex has no -1, warning if only the final -1 is absent. False alarms: negligible.
- 07 (unwise): warn if creaseAngle exceeds pi. Rare false alarms (authors who use a large value to force smoothing).
- 09 (spec error): error if an Extrusion spine has fewer than 2 points. No false alarms.
- 10 (unwise): warn if every Material has transparency 1 and no opaque shape exists. Risk: intentional invisible proxies, hence the opaque-shape condition.
- 15 (unwise): warn if a rotation angle magnitude exceeds 2 pi. Rare false alarms for deliberate multi-turn values.
- 17 (unwise): warn if a translation magnitude is about 1e5 or more relative to the scene bbox. False alarms for geospatial or astronomical scenes, so skip those.
- 20 (spec error): error if a DirectionalLight or SpotLight direction is exactly 0 0 0. No false alarms (a zero Billboard axis is legal and must be excluded).

## Decoys
None raised a warning or error. decoy-03 (Shape with geometry but no Appearance) got info shape-no-appearance ("will render with a default white material"), which is defensible and not counted as a flag. The other decoys were Switch whichChoice -1, scale -1 1 1, rotation 0 0 1 0 and solid false on an open surface.

## Unrelated checks that fired
- fault-11: error profile-component (PhysicalMaterial needs Shape level 2, outside the declared Immersive profile). A legitimate finding about my header.
- Info noise: shape-no-appearance (01, 02), unused-def (04, 14), mesh-unused-point (06).

## Observation
Coverage is strong for XSD-expressible ranges, DEF/USE, counts and ordering, and weak for index structure and unit plausibility (angles, distances, zero light vectors).

Files: fault-01..20.x3d, decoy-01..05.x3d, MANIFEST.json, results.json, REPORT.md in agents/14/
