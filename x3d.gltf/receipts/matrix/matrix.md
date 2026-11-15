| glb | profile | KiB before | KiB after | % | gzip KiB | brotli KiB | draw calls | nodes | identity lost | centroid max (of diagonal) | normal p99 deg | gates |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| asterion.glb | lossless | 4404.4 | 4851.9 | 110.2% | 637.1 | 381.9 | 284 -> 284 | 288 -> 288 | 0 | 0.0e+0 | 0.00 | PASS |
| asterion.glb | meshopt-lossless | 4404.4 | 2898.5 | 65.8% | 442.5 | 347.6 | 284 -> 284 | 288 -> 288 | 0 | 6.3e-18 | 0.00 | PASS |
| asterion.glb | quantized | 4404.4 | 824.7 | 18.7% | 361.4 | 259.7 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.07 | PASS |
| asterion.glb | web | 4404.4 | 497.0 | 11.3% | 189.0 | 156.2 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.07 | PASS |
| asterion.glb | web-filter | 4404.4 | 420.9 | 9.6% | 140.8 | 118.6 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.76 | PASS |
| asterion.glb | draco | 4404.4 | 585.0 | 13.3% | 124.3 | 112.2 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.14 | PASS |
| asterion.glb | web-ktx2 | 4404.4 | 497.0 | 11.3% | 189.0 | 156.2 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.07 | PASS |
| asterion.glb | web-ktx2-etc1s | 4404.4 | 497.0 | 11.3% | 189.0 | 156.2 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.07 | PASS |
| asterion.glb | instanced | 4404.4 | 497.0 | 11.3% | 189.0 | 156.2 | 284 -> 284 | 288 -> 288 | 0 | 1.0e-6 | 0.07 | PASS |
| asterion.glb | static-joined | 4404.4 | 1026.9 | 23.3% | 208.0 | 167.1 | 284 -> 10 | 288 -> 14 | 548 | 1.7e-6 | 0.07 | PASS |
| lumen.glb | lossless | 2689.1 | 2697.2 | 100.3% | 1350.4 | 573.2 | 34 -> 34 | 39 -> 39 | 0 | 0.0e+0 | 0.00 | PASS |
| lumen.glb | meshopt-lossless | 2689.1 | 1372.7 | 51.0% | 790.9 | 461.7 | 34 -> 34 | 39 -> 39 | 0 | 0.0e+0 | 0.00 | PASS |
| lumen.glb | quantized | 2689.1 | 1692.0 | 62.9% | 1042.3 | 476.2 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.05 | PASS |
| lumen.glb | web | 2689.1 | 644.1 | 24.0% | 236.7 | 179.0 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.05 | PASS |
| lumen.glb | web-filter | 2689.1 | 490.7 | 18.2% | 140.3 | 106.3 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.64 | PASS |
| lumen.glb | draco | 2689.1 | 231.3 | 8.6% | 165.7 | 161.8 | 34 -> 34 | 39 -> 39 | 0 | 1.8e-6 | 0.13 | PASS |
| lumen.glb | web-ktx2 | 2689.1 | 644.1 | 24.0% | 236.7 | 179.0 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.05 | PASS |
| lumen.glb | web-ktx2-etc1s | 2689.1 | 644.1 | 24.0% | 236.7 | 179.0 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.05 | PASS |
| lumen.glb | instanced | 2689.1 | 644.1 | 24.0% | 236.7 | 179.0 | 34 -> 34 | 39 -> 39 | 0 | 6.9e-6 | 0.05 | PASS |
| lumen.glb | static-joined | 2689.1 | 553.2 | 20.6% | 225.0 | 171.0 | 34 -> 7 | 39 -> 12 | 54 | 5.6e-6 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | lossless | 1190.8 | 1204.4 | 101.1% | 583.1 | 418.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral.glb | meshopt-lossless | 1190.8 | 913.9 | 76.8% | 455.3 | 422.8 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.8e-16 | 0.00 | PASS |
| prismatica-aurora-cathedral.glb | quantized | 1190.8 | 877.9 | 73.7% | 403.5 | 321.9 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | web | 1190.8 | 638.0 | 53.6% | 228.8 | 199.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | web-filter | 1190.8 | 583.8 | 49.0% | 175.0 | 146.8 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.73 | PASS |
| prismatica-aurora-cathedral.glb | draco | 1190.8 | 507.1 | 42.6% | 142.0 | 125.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.7e-5 | 0.12 | PASS |
| prismatica-aurora-cathedral.glb | web-ktx2 | 1190.8 | 638.0 | 53.6% | 228.8 | 199.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | web-ktx2-etc1s | 1190.8 | 638.0 | 53.6% | 228.8 | 199.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | instanced | 1190.8 | 445.4 | 37.4% | 209.1 | 172.6 | 1218 -> 10 | 1224 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral.glb | static-joined | 1190.8 | 1383.5 | 116.2% | 270.1 | 182.5 | 1218 -> 10 | 1224 -> 16 | 1208 | 2.8e-4 | 1.41 | FAIL (expected): geometry: 18994 triangles collapsed (more than 0.1% of 600976); geometry: normals p99 1.412 degrees exceeds 1 |
| stilllife-addon.glb | lossless | 1645.4 | 1644.9 | 100.0% | 1183.7 | 924.9 | 5 -> 5 | 11 -> 11 | 0 | 0.0e+0 | 0.00 | PASS |
| stilllife-addon.glb | meshopt-lossless | 1645.4 | 1335.1 | 81.1% | 1187.3 | 1138.7 | 5 -> 5 | 11 -> 11 | 0 | 0.0e+0 | 0.00 | PASS |
| stilllife-addon.glb | quantized | 1645.4 | 1353.5 | 82.3% | 1041.5 | 885.7 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.05 | PASS |
| stilllife-addon.glb | web | 1645.4 | 1072.7 | 65.2% | 967.1 | 925.0 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.05 | PASS |
| stilllife-addon.glb | web-filter | 1645.4 | 982.7 | 59.7% | 900.0 | 875.2 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.52 | PASS |
| stilllife-addon.glb | draco | 1645.4 | 808.2 | 49.1% | 790.9 | 785.4 | 5 -> 5 | 11 -> 11 | 0 | 2.2e-5 | 0.13 | PASS |
| stilllife-addon.glb | web-ktx2 | 1645.4 | 1246.2 | 75.7% | 1145.4 | 1105.1 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.05 | PASS |
| stilllife-addon.glb | web-ktx2-etc1s | 1645.4 | 509.1 | 30.9% | 408.2 | 368.3 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.05 | PASS |
| stilllife-addon.glb | instanced | 1645.4 | 1072.7 | 65.2% | 967.1 | 925.0 | 5 -> 5 | 11 -> 11 | 0 | 1.6e-5 | 0.05 | PASS |
| stilllife-addon.glb | static-joined | 1645.4 | 990.6 | 60.2% | 911.9 | 880.4 | 5 -> 5 | 11 -> 10 | 1 | 1.6e-5 | 0.05 | PASS |
| stars-view.glb | lossless | 40.7 | 40.7 | 99.9% | 28.4 | 24.6 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | meshopt-lossless | 40.7 | 35.4 | 86.9% | 24.5 | 23.1 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | quantized | 40.7 | 25.5 | 62.7% | 16.5 | 12.7 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | web | 40.7 | 20.6 | 50.7% | 13.2 | 12.5 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | web-filter | 40.7 | 20.6 | 50.7% | 13.2 | 12.5 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | draco | 40.7 | 40.7 | 99.9% | 28.4 | 24.6 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | web-ktx2 | 40.7 | 20.6 | 50.7% | 13.2 | 12.5 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | web-ktx2-etc1s | 40.7 | 20.6 | 50.7% | 13.2 | 12.5 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | instanced | 40.7 | 20.6 | 50.7% | 13.2 | 12.5 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| stars-view.glb | static-joined | 40.7 | 22.6 | 55.6% | 13.2 | 12.5 | 1 -> 1 | 4 -> 3 | 1 |  |  | PASS |
| prismatica-aurora-cathedral-animated.glb | lossless | 4630.0 | 4643.0 | 100.3% | 2652.5 | 2294.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral-animated.glb | meshopt-lossless | 4630.0 | 3148.3 | 68.0% | 2523.2 | 2405.4 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.8e-16 | 0.00 | PASS |
| prismatica-aurora-cathedral-animated.glb | quantized | 4630.0 | 3207.6 | 69.3% | 1552.7 | 1261.0 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-animated.glb | web | 4630.0 | 1877.6 | 40.6% | 1397.3 | 1304.1 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-animated.glb | web-filter | 4630.0 | 1857.8 | 40.1% | 1377.7 | 1282.6 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.73 | PASS |
| prismatica-aurora-cathedral-animated.glb | draco | 4630.0 | 4422.2 | 95.5% | 2540.1 | 2214.1 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.6e-5 | 0.12 | PASS |
| prismatica-aurora-cathedral-animated.glb | web-ktx2 | 4630.0 | 1877.6 | 40.6% | 1397.3 | 1304.1 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-animated.glb | web-ktx2-etc1s | 4630.0 | 1877.6 | 40.6% | 1397.3 | 1304.1 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-animated.glb | instanced | 4630.0 | 1877.6 | 40.6% | 1397.3 | 1304.1 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-animated.glb | static-joined | 4630.0 | 1821.2 | 39.3% | 510.0 | 387.6 | 1218 -> 10 | 1224 -> 16 | 1208 | 2.8e-4 | 1.41 | FAIL (expected): geometry: 18994 triangles collapsed (more than 0.1% of 584592); geometry: normals p99 1.412 degrees exceeds 1 |
| prismatica-aurora-cathedral-static.glb | lossless | 1072.1 | 1085.8 | 101.3% | 580.3 | 411.4 | 1218 -> 1218 | 1224 -> 1224 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral-static.glb | meshopt-lossless | 1072.1 | 795.3 | 74.2% | 452.6 | 420.8 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.8e-16 | 0.00 | PASS |
| prismatica-aurora-cathedral-static.glb | quantized | 1072.1 | 759.3 | 70.8% | 400.9 | 308.8 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static.glb | web | 1072.1 | 519.4 | 48.4% | 227.6 | 197.0 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static.glb | web-filter | 1072.1 | 465.2 | 43.4% | 173.4 | 144.6 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.73 | PASS |
| prismatica-aurora-cathedral-static.glb | draco | 1072.1 | 388.5 | 36.2% | 139.2 | 123.0 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.7e-5 | 0.12 | PASS |
| prismatica-aurora-cathedral-static.glb | web-ktx2 | 1072.1 | 519.4 | 48.4% | 227.6 | 197.0 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static.glb | web-ktx2-etc1s | 1072.1 | 519.4 | 48.4% | 227.6 | 197.0 | 1218 -> 1218 | 1224 -> 1224 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static.glb | instanced | 1072.1 | 341.0 | 31.8% | 208.0 | 170.7 | 1218 -> 10 | 1224 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static.glb | static-joined | 1072.1 | 1381.7 | 128.9% | 269.5 | 182.0 | 1218 -> 10 | 1224 -> 16 | 1208 | 2.8e-4 | 1.41 | FAIL (expected): geometry: 18994 triangles collapsed (more than 0.1% of 600976); geometry: normals p99 1.412 degrees exceeds 1 |
| prismatica-aurora-cathedral-static-instanced.glb | lossless | 844.0 | 857.2 | 101.6% | 545.9 | 388.2 | 10 -> 10 | 16 -> 16 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | meshopt-lossless | 844.0 | 551.3 | 65.3% | 417.4 | 397.4 | 10 -> 10 | 16 -> 16 | 0 | 1.8e-16 | 0.00 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | quantized | 844.0 | 579.4 | 68.7% | 378.5 | 285.7 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | web | 844.0 | 307.7 | 36.5% | 202.2 | 169.7 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | web-filter | 844.0 | 253.5 | 30.0% | 148.3 | 117.5 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.73 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | draco | 844.0 | 159.9 | 19.0% | 104.7 | 101.4 | 10 -> 10 | 16 -> 16 | 0 | 1.7e-5 | 0.12 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | web-ktx2 | 844.0 | 307.7 | 36.5% | 202.2 | 169.7 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | web-ktx2-etc1s | 844.0 | 307.7 | 36.5% | 202.2 | 169.7 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | instanced | 844.0 | 307.7 | 36.5% | 202.2 | 169.7 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.05 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | static-joined | 844.0 | 182.4 | 21.6% | 99.0 | 74.1 | 10 -> 10 | 16 -> 16 | 0 | 1.9e-5 | 0.06 | PASS |
| thalassa-exhibition.glb | lossless | 480.3 | 489.0 | 101.8% | 96.1 | 75.4 | 1719 -> 1719 | 1721 -> 1721 | 0 | 0.0e+0 | 0.00 | PASS |
| thalassa-exhibition.glb | meshopt-lossless | 480.3 | 472.4 | 98.3% | 95.5 | 76.5 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.5e-16 | 0.00 | PASS |
| thalassa-exhibition.glb | quantized | 480.3 | 446.0 | 92.9% | 107.5 | 84.7 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition.glb | web | 480.3 | 443.0 | 92.2% | 104.9 | 84.2 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition.glb | web-filter | 480.3 | 441.9 | 92.0% | 104.4 | 84.0 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.3e-5 | 0.73 | PASS |
| thalassa-exhibition.glb | draco | 480.3 | 444.1 | 92.5% | 92.7 | 74.4 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.5e-5 | 0.12 | PASS |
| thalassa-exhibition.glb | web-ktx2 | 480.3 | 443.0 | 92.2% | 104.9 | 84.2 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition.glb | web-ktx2-etc1s | 480.3 | 443.0 | 92.2% | 104.9 | 84.2 | 1719 -> 1719 | 1721 -> 1721 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition.glb | instanced | 480.3 | 175.2 | 36.5% | 70.7 | 37.4 | 1719 -> 8 | 1721 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition.glb | static-joined | 480.3 | 3204.0 | 667.1% | 376.9 | 262.0 | 1719 -> 5 | 1721 -> 7 | 1717 | 3.7e-2 | 68.17 | FAIL (expected): geometry: 401116 triangles collapsed (more than 0.1% of 686712); geometry: centroid deviation 3.69e-2 of the diagonal exceeds 4.88e-4; geometry: normals p99 68.173 degrees exceeds 1 |
| thalassa-exhibition-instanced.glb | lossless | 122.3 | 130.7 | 106.9% | 38.6 | 33.0 | 8 -> 8 | 10 -> 10 | 0 | 0.0e+0 | 0.00 | PASS |
| thalassa-exhibition-instanced.glb | meshopt-lossless | 122.3 | 90.5 | 74.0% | 36.0 | 33.7 | 8 -> 8 | 10 -> 10 | 0 | 1.5e-16 | 0.00 | PASS |
| thalassa-exhibition-instanced.glb | quantized | 122.3 | 154.9 | 126.7% | 70.9 | 41.2 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition-instanced.glb | web | 122.3 | 105.0 | 85.8% | 64.0 | 36.3 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition-instanced.glb | web-filter | 122.3 | 103.9 | 84.9% | 63.5 | 35.8 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.73 | PASS |
| thalassa-exhibition-instanced.glb | draco | 122.3 | 85.8 | 70.1% | 35.0 | 31.9 | 8 -> 8 | 10 -> 10 | 0 | 1.5e-5 | 0.12 | PASS |
| thalassa-exhibition-instanced.glb | web-ktx2 | 122.3 | 105.0 | 85.8% | 64.0 | 36.3 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition-instanced.glb | web-ktx2-etc1s | 122.3 | 105.0 | 85.8% | 64.0 | 36.3 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition-instanced.glb | instanced | 122.3 | 105.0 | 85.8% | 64.0 | 36.3 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| thalassa-exhibition-instanced.glb | static-joined | 122.3 | 101.9 | 83.3% | 62.7 | 35.1 | 8 -> 8 | 10 -> 10 | 0 | 1.3e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | lossless | 37.7 | 34.8 | 92.2% | 16.4 | 9.9 | 5 -> 5 | 10 -> 10 | 0 | 2.2e-9 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | meshopt-lossless | 37.7 | 21.6 | 57.4% | 9.3 | 8.3 | 5 -> 5 | 10 -> 10 | 0 | 2.2e-9 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | quantized | 37.7 | 26.0 | 69.0% | 13.4 | 7.5 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | web | 37.7 | 16.0 | 42.5% | 5.8 | 4.9 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | web-filter | 37.7 | 14.3 | 38.0% | 5.4 | 4.7 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.42 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | draco | 37.7 | 11.0 | 29.1% | 5.9 | 5.2 | 5 -> 5 | 10 -> 10 | 0 | 2.5e-5 | 0.11 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | web-ktx2 | 37.7 | 16.0 | 42.5% | 5.8 | 4.9 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | web-ktx2-etc1s | 37.7 | 16.0 | 42.5% | 5.8 | 4.9 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | instanced | 37.7 | 16.0 | 42.5% | 5.8 | 4.9 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | static-joined | 37.7 | 16.0 | 42.5% | 5.8 | 4.9 | 5 -> 5 | 10 -> 10 | 0 | 2.6e-5 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | lossless | 23.7 | 22.8 | 96.0% | 12.3 | 7.4 | 3 -> 3 | 6 -> 6 | 0 | 5.7e-15 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | meshopt-lossless | 23.7 | 17.3 | 73.0% | 8.0 | 7.1 | 3 -> 3 | 6 -> 6 | 0 | 5.7e-15 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | quantized | 23.7 | 18.4 | 77.8% | 10.0 | 6.0 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | web | 23.7 | 12.8 | 53.9% | 5.2 | 4.6 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | web-filter | 23.7 | 10.7 | 45.1% | 4.5 | 4.0 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.54 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | draco | 23.7 | 6.6 | 27.6% | 4.1 | 3.7 | 3 -> 3 | 6 -> 6 | 0 | 7.6e-6 | 0.15 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | web-ktx2 | 23.7 | 12.8 | 53.9% | 5.2 | 4.6 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | web-ktx2-etc1s | 23.7 | 12.8 | 53.9% | 5.2 | 4.6 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | instanced | 23.7 | 12.8 | 53.9% | 5.2 | 4.6 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | static-joined | 23.7 | 12.8 | 53.9% | 5.2 | 4.6 | 3 -> 3 | 6 -> 6 | 0 | 8.0e-6 | 0.05 | PASS |
| asterion.glb | stock-instance | 4404.4 | 4851.9 | 110.2% | 637.1 | 381.9 | 284 -> 284 | 288 -> 288 | 0 | 0.0e+0 | 0.00 | PASS |
| lumen.glb | stock-instance | 2689.1 | 2697.2 | 100.3% | 1350.4 | 573.2 | 34 -> 34 | 39 -> 39 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral.glb | stock-instance | 1190.8 | 858.3 | 72.1% | 547.7 | 388.3 | 1218 -> 10 | 1224 -> 16 | 1216 | 2.6e-8 | 0.00 | PASS |
| stilllife-addon.glb | stock-instance | 1645.4 | 1644.9 | 100.0% | 1183.7 | 924.9 | 5 -> 5 | 11 -> 11 | 0 | 0.0e+0 | 0.00 | PASS |
| stars-view.glb | stock-instance | 40.7 | 40.7 | 99.9% | 28.4 | 24.6 | 1 -> 1 | 4 -> 4 | 0 |  |  | PASS |
| prismatica-aurora-cathedral-animated.glb | stock-instance | 4630.0 | 4643.0 | 100.3% | 2652.5 | 2294.3 | 1218 -> 1218 | 1224 -> 1224 | 0 | 0.0e+0 | 0.00 | PASS |
| prismatica-aurora-cathedral-static.glb | stock-instance | 1072.1 | 856.9 | 79.9% | 547.3 | 389.7 | 1218 -> 10 | 1224 -> 16 | 1216 | 2.6e-8 | 0.00 | PASS |
| prismatica-aurora-cathedral-static-instanced.glb | stock-instance | 844.0 | 857.2 | 101.6% | 545.9 | 388.2 | 10 -> 10 | 16 -> 16 | 0 | 0.0e+0 | 0.00 | PASS |
| thalassa-exhibition.glb | stock-instance | 480.3 | 130.4 | 27.1% | 40.3 | 34.0 | 1719 -> 8 | 1721 -> 10 | 1718 | 3.0e-8 | 0.00 | PASS |
| thalassa-exhibition-instanced.glb | stock-instance | 122.3 | 130.7 | 106.9% | 38.6 | 33.0 | 8 -> 8 | 10 -> 10 | 0 | 0.0e+0 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | stock-instance | 37.7 | 34.8 | 92.2% | 16.4 | 9.9 | 5 -> 5 | 10 -> 10 | 0 | 2.2e-9 | 0.00 | PASS |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | stock-instance | 23.7 | 22.8 | 96.0% | 12.3 | 7.4 | 3 -> 3 | 6 -> 6 | 0 | 5.7e-15 | 0.00 | PASS |
