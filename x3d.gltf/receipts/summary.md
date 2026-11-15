## Profile totals over the corpus (every file the profile ran on)

| profile | files | gates pass | KiB before | KiB after | % of before | gzip % | brotli % | identity tokens lost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| lossless | 12 | 12/12 | 17180.6 | 17702.4 | 103.0% | 106.5% | 102.6% | 0 |
| meshopt-lossless | 12 | 12/12 | 17180.6 | 11652.3 | 67.8% | 88.8% | 106.4% | 0 |
| quantized | 12 | 12/12 | 17180.6 | 9965.3 | 58.0% | 74.4% | 73.2% | 0 |
| web | 12 | 12/12 | 17180.6 | 6154.1 | 35.8% | 50.2% | 60.6% | 0 |
| web-filter | 12 | 12/12 | 17180.6 | 5646.1 | 32.9% | 44.7% | 54.3% | 0 |
| draco | 12 | 12/12 | 17180.6 | 7690.4 | 44.8% | 57.5% | 69.7% | 0 |
| web-ktx2 | 12 | 12/12 | 17180.6 | 6327.5 | 36.8% | 52.6% | 63.9% | 0 |
| web-ktx2-etc1s | 12 | 12/12 | 17180.6 | 5590.4 | 32.5% | 42.5% | 50.3% | 0 |
| instanced | 12 | 12/12 | 17180.6 | 5515.1 | 32.1% | 49.2% | 58.8% | 0 |
| static-joined | 12 | 8/12 | 17180.6 | 10696.8 | 62.3% | 40.8% | 43.8% | 5945 |
| stock-instance | 12 | 12/12 | 17180.6 | 16768.7 | 97.6% | 104.7% | 100.9% | 4150 |

## Per file: source, and the smallest profile that passed every gate

| glb | KiB source | gzip KiB | brotli KiB | smallest passing (raw) | KiB | % | smallest passing (brotli) | brotli KiB | % | draw calls source -> instanced | identity tokens |
|---|---:|---:|---:|---|---:|---:|---|---:|---:|---|---:|
| asterion.glb | 4404.4 | 624.0 | 359.9 | web-filter | 420.9 | 9.6% | draco | 112.2 | 31.2% | 284 -> 284 | 587 |
| lumen.glb | 2689.1 | 1252.2 | 550.8 | draco | 231.3 | 8.6% | web-filter | 106.3 | 19.3% | 34 -> 34 | 86 |
| prismatica-aurora-cathedral.glb | 1190.8 | 525.5 | 384.8 | instanced | 445.4 | 37.4% | draco | 125.3 | 32.6% | 1218 -> 10 | 1251 |
| stilllife-addon.glb | 1645.4 | 1098.8 | 908.5 | web-ktx2-etc1s | 509.1 | 30.9% | web-ktx2-etc1s | 368.3 | 40.5% | 5 -> 5 | 27 |
| stars-view.glb | 40.7 | 25.7 | 22.5 | web | 20.6 | 50.7% | web | 12.5 | 55.6% | 1 -> 1 | 8 |
| prismatica-aurora-cathedral-animated.glb | 4630.0 | 2557.1 | 2289.0 | web-filter | 1857.8 | 40.1% | quantized | 1261.0 | 55.1% | 1218 -> 1218 | 1251 |
| prismatica-aurora-cathedral-static.glb | 1072.1 | 521.3 | 390.8 | instanced | 341.0 | 31.8% | draco | 123.0 | 31.5% | 1218 -> 10 | 1251 |
| prismatica-aurora-cathedral-static-instanced.glb | 844.0 | 487.8 | 366.4 | draco | 159.9 | 19.0% | draco | 101.4 | 27.7% | 10 -> 10 | 43 |
| thalassa-exhibition.glb | 480.3 | 96.4 | 75.6 | instanced | 175.2 | 36.5% | instanced | 37.4 | 49.4% | 1719 -> 8 | 1737 |
| thalassa-exhibition-instanced.glb | 122.3 | 38.8 | 33.3 | draco | 85.8 | 70.1% | draco | 31.9 | 95.9% | 8 -> 8 | 26 |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | 37.7 | 16.3 | 9.9 | draco | 11.0 | 29.1% | web-filter | 4.7 | 47.6% | 5 -> 5 | 16 |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | 23.7 | 12.4 | 8.3 | draco | 6.6 | 27.6% | draco | 3.7 | 45.0% | 3 -> 3 | 13 |

## The traps: what the two identity-destroying profiles cost

| glb | profile | draw calls | nodes | triangles (non-degenerate delta in notes) | identity tokens lost of source | KiB source -> out | gates |
|---|---|---|---|---|---:|---|---|
| asterion.glb | stock-instance | 284 -> 284 | 288 -> 288 | 93682 -> 93682 | 0 of 587 | 4404.4 -> 4851.9 | pass (loss is allowed and counted) |
| asterion.glb | static-joined | 284 -> 10 | 288 -> 14 | 93682 -> 93682 | 548 of 587 | 4404.4 -> 1026.9 | pass (loss is allowed and counted) |
| lumen.glb | stock-instance | 34 -> 34 | 39 -> 39 | 89568 -> 89568 | 0 of 86 | 2689.1 -> 2697.2 | pass (loss is allowed and counted) |
| lumen.glb | static-joined | 34 -> 7 | 39 -> 12 | 89568 -> 89568 | 54 of 86 | 2689.1 -> 553.2 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral.glb | stock-instance | 1218 -> 10 | 1224 -> 16 | 600976 -> 600976 | 1216 of 1251 | 1190.8 -> 858.3 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral.glb | static-joined | 1218 -> 10 | 1224 -> 16 | 600976 -> 600976 | 1208 of 1251 | 1190.8 -> 1383.5 | FAIL: 18994 triangles collapsed (more than 0.1% of 600; normals p99 1.412 degrees exceeds 1 |
| stilllife-addon.glb | stock-instance | 5 -> 5 | 11 -> 11 | 27560 -> 27560 | 0 of 27 | 1645.4 -> 1644.9 | pass (loss is allowed and counted) |
| stilllife-addon.glb | static-joined | 5 -> 5 | 11 -> 10 | 27560 -> 27560 | 1 of 27 | 1645.4 -> 990.6 | pass (loss is allowed and counted) |
| stars-view.glb | stock-instance | 1 -> 1 | 4 -> 4 | 0 -> 0 | 0 of 8 | 40.7 -> 40.7 | pass (loss is allowed and counted) |
| stars-view.glb | static-joined | 1 -> 1 | 4 -> 3 | 0 -> 0 | 1 of 8 | 40.7 -> 22.6 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral-animated.glb | stock-instance | 1218 -> 1218 | 1224 -> 1224 | 584592 -> 584592 | 0 of 1251 | 4630.0 -> 4643.0 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral-animated.glb | static-joined | 1218 -> 10 | 1224 -> 16 | 584592 -> 584592 | 1208 of 1251 | 4630.0 -> 1821.2 | FAIL: 18994 triangles collapsed (more than 0.1% of 584; normals p99 1.412 degrees exceeds 1 |
| prismatica-aurora-cathedral-static.glb | stock-instance | 1218 -> 10 | 1224 -> 16 | 600976 -> 600976 | 1216 of 1251 | 1072.1 -> 856.9 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral-static.glb | static-joined | 1218 -> 10 | 1224 -> 16 | 600976 -> 600976 | 1208 of 1251 | 1072.1 -> 1381.7 | FAIL: 18994 triangles collapsed (more than 0.1% of 600; normals p99 1.412 degrees exceeds 1 |
| prismatica-aurora-cathedral-static-instanced.glb | stock-instance | 10 -> 10 | 16 -> 16 | 600976 -> 600976 | 0 of 43 | 844.0 -> 857.2 | pass (loss is allowed and counted) |
| prismatica-aurora-cathedral-static-instanced.glb | static-joined | 10 -> 10 | 16 -> 16 | 600976 -> 600976 | 0 of 43 | 844.0 -> 182.4 | pass (loss is allowed and counted) |
| thalassa-exhibition.glb | stock-instance | 1719 -> 8 | 1721 -> 10 | 686712 -> 686712 | 1718 of 1737 | 480.3 -> 130.4 | pass (loss is allowed and counted) |
| thalassa-exhibition.glb | static-joined | 1719 -> 5 | 1721 -> 7 | 686712 -> 686712 | 1717 of 1737 | 480.3 -> 3204.0 | FAIL: 401116 triangles collapsed (more than 0.1% of 68; centroid deviation 3.69e-2 of the diagonal excee; normals p99 68.173 degrees exceeds 1 |
| thalassa-exhibition-instanced.glb | stock-instance | 8 -> 8 | 10 -> 10 | 686712 -> 686712 | 0 of 26 | 122.3 -> 130.7 | pass (loss is allowed and counted) |
| thalassa-exhibition-instanced.glb | static-joined | 8 -> 8 | 10 -> 10 | 686712 -> 686712 | 0 of 26 | 122.3 -> 101.9 | pass (loss is allowed and counted) |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | stock-instance | 5 -> 5 | 10 -> 10 | 1404 -> 1404 | 0 of 16 | 37.7 -> 34.8 | pass (loss is allowed and counted) |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | static-joined | 5 -> 5 | 10 -> 10 | 1404 -> 1404 | 0 of 16 | 37.7 -> 16.0 | pass (loss is allowed and counted) |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | stock-instance | 3 -> 3 | 6 -> 6 | 974 -> 974 | 0 of 13 | 23.7 -> 22.8 | pass (loss is allowed and counted) |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | static-joined | 3 -> 3 | 6 -> 6 | 974 -> 974 | 0 of 13 | 23.7 -> 12.8 | pass (loss is allowed and counted) |

## Totals

- cells: 132; shipping-profile cells: 108, passing 108; identity tokens lost by a shipping profile in the whole corpus: 0
- trap cells: 24; identity tokens lost by the traps: 10095
