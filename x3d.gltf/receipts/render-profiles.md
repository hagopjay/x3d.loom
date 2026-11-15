### stilllife

| profile | KiB | gates | identity lost | draw calls | engine | loaded | triangles | mean abs delta (0-255) | px > 16 | PSNR dB | note |
|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---|
| lossless | 1644.9 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.000 | 0.000% | identical |  |
| lossless | 1644.9 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.000 | 0.000% | identical |  |
| lossless | 1644.9 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 1335.1 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.000 | 0.002% | 68.3 |  |
| meshopt-lossless | 1335.1 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 1335.1 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.001 | 0.002% | 63.2 |  |
| quantized | 1353.5 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| quantized | 1353.5 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| quantized | 1353.5 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.008 | 0.015% | 56.8 |  |
| web | 1072.7 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| web | 1072.7 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| web | 1072.7 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.008 | 0.015% | 56.8 |  |
| web-filter | 982.7 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.030 | 0.023% | 55.0 |  |
| web-filter | 982.7 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.028 | 0.032% | 54.4 |  |
| web-filter | 982.7 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.023 | 0.024% | 54.7 |  |
| draco | 808.2 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.010 | 0.006% | 61.4 |  |
| draco | 808.2 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.009 | 0.009% | 60.5 |  |
| draco | 808.2 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.007 | 0.006% | 61.6 |  |
| instanced | 1072.7 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| instanced | 1072.7 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| instanced | 1072.7 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.008 | 0.015% | 56.8 |  |
| web-ktx2 | 1246.2 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.010 | 0.014% | 57.6 |  |
| web-ktx2 | 1246.2 | pass | 0 of 27 | 5 -> 5 | babylon | - | - | - | - | - | not run: Babylon.js fetches its KTX2 transcoders from its CDN at run time and the oracle is offline |
| web-ktx2 | 1246.2 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.025 | 0.020% | 54.2 |  |
| web-ktx2-etc1s | 509.1 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.013 | 0.014% | 57.4 |  |
| web-ktx2-etc1s | 509.1 | pass | 0 of 27 | 5 -> 5 | babylon | - | - | - | - | - | not run: Babylon.js fetches its KTX2 transcoders from its CDN at run time and the oracle is offline |
| web-ktx2-etc1s | 509.1 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.025 | 0.020% | 54.1 |  |
| stock-instance | 1644.9 | pass | 0 of 27 | 5 -> 5 | three | yes | 27560 | 0.000 | 0.000% | identical |  |
| stock-instance | 1644.9 | pass | 0 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.000 | 0.000% | identical |  |
| stock-instance | 1644.9 | pass | 0 of 27 | 5 -> 5 | xite | yes | 27560 | 0.000 | 0.000% | identical |  |
| static-joined | 990.6 | pass | 1 of 27 | 5 -> 5 | three | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| static-joined | 990.6 | pass | 1 of 27 | 5 -> 5 | babylon | yes | 27560 | 0.008 | 0.014% | 57.6 |  |
| static-joined | 990.6 | pass | 1 of 27 | 5 -> 5 | xite | yes | 27560 | 0.008 | 0.015% | 56.8 |  |

### prismatica

| profile | KiB | gates | identity lost | draw calls | engine | loaded | triangles | mean abs delta (0-255) | px > 16 | PSNR dB | note |
|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---|
| lossless | 1204.4 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.000 | 0.000% | identical |  |
| lossless | 1204.4 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.000 | 0.000% | identical |  |
| lossless | 1204.4 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 913.9 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.000 | 0.000% | 90.7 |  |
| meshopt-lossless | 913.9 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.000 | 0.000% | 91.1 |  |
| meshopt-lossless | 913.9 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.000 | 0.000% | 96.3 |  |
| quantized | 877.9 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.054 | 0.018% | 54.5 |  |
| quantized | 877.9 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.074 | 0.017% | 50.7 |  |
| quantized | 877.9 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.013 | 0.012% | 62.1 |  |
| web | 638.0 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.054 | 0.018% | 54.5 |  |
| web | 638.0 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.074 | 0.017% | 50.7 |  |
| web | 638.0 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.013 | 0.012% | 62.1 |  |
| web-filter | 583.8 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.057 | 0.018% | 54.4 |  |
| web-filter | 583.8 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.081 | 0.017% | 50.5 |  |
| web-filter | 583.8 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.020 | 0.012% | 60.2 |  |
| draco | 507.1 | pass | 0 of 1251 | 1218 -> 1218 | three | yes | 600976 | 0.022 | 0.008% | 59.2 |  |
| draco | 507.1 | pass | 0 of 1251 | 1218 -> 1218 | babylon | yes | 600976 | 0.020 | 0.008% | 59.7 |  |
| draco | 507.1 | pass | 0 of 1251 | 1218 -> 1218 | xite | yes | 600976 | 0.009 | 0.008% | 64.3 |  |
| instanced | 445.4 | pass | 0 of 1251 | 1218 -> 10 | three | yes | 600976 | 0.054 | 0.018% | 54.5 |  |
| instanced | 445.4 | pass | 0 of 1251 | 1218 -> 10 | babylon | yes | 600976 | 0.074 | 0.017% | 50.7 |  |
| instanced | 445.4 | pass | 0 of 1251 | 1218 -> 10 | xite | yes | 600976 | 0.013 | 0.012% | 62.1 |  |
| stock-instance | 858.3 | pass | 1216 of 1251 | 1218 -> 10 | three | yes | 600976 | 0.000 | 0.000% | 101.1 |  |
| stock-instance | 858.3 | pass | 1216 of 1251 | 1218 -> 10 | babylon | yes | 600976 | 0.000 | 0.000% | identical |  |
| stock-instance | 858.3 | pass | 1216 of 1251 | 1218 -> 10 | xite | yes | 600976 | 0.000 | 0.000% | identical |  |
| static-joined | 1383.5 | FAIL | 1208 of 1251 | 1218 -> 10 | three | yes | 600976 | 0.059 | 0.029% | 53.4 |  |
| static-joined | 1383.5 | FAIL | 1208 of 1251 | 1218 -> 10 | babylon | yes | 600976 | 0.079 | 0.027% | 50.2 |  |
| static-joined | 1383.5 | FAIL | 1208 of 1251 | 1218 -> 10 | xite | NO | - | - | - | - | timeout after 25000 ms while rendering with xite |

### asterion

| profile | KiB | gates | identity lost | draw calls | engine | loaded | triangles | mean abs delta (0-255) | px > 16 | PSNR dB | note |
|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---|
| lossless | 4851.9 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | identical |  |
| lossless | 4851.9 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| lossless | 4851.9 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 2898.5 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 2898.5 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 2898.5 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | identical |  |
| quantized | 824.7 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | 78.3 |  |
| quantized | 824.7 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| quantized | 824.7 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | 85.5 |  |
| web | 497.0 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | 78.3 |  |
| web | 497.0 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| web | 497.0 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | 85.5 |  |
| web-filter | 420.9 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | 78.3 |  |
| web-filter | 420.9 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | 92.6 |  |
| web-filter | 420.9 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | 85.0 |  |
| draco | 585.0 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | 95.0 |  |
| draco | 585.0 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | 101.1 |  |
| draco | 585.0 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | identical |  |
| instanced | 497.0 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | 78.3 |  |
| instanced | 497.0 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| instanced | 497.0 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | 85.5 |  |
| stock-instance | 4851.9 | pass | 0 of 587 | 284 -> 284 | three | yes | 93682 | 0.000 | 0.000% | identical |  |
| stock-instance | 4851.9 | pass | 0 of 587 | 284 -> 284 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| stock-instance | 4851.9 | pass | 0 of 587 | 284 -> 284 | xite | yes | 93682 | 0.000 | 0.000% | identical |  |
| static-joined | 1026.9 | pass | 548 of 587 | 284 -> 10 | three | yes | 93682 | 0.000 | 0.000% | 78.3 |  |
| static-joined | 1026.9 | pass | 548 of 587 | 284 -> 10 | babylon | yes | 93682 | 0.000 | 0.000% | identical |  |
| static-joined | 1026.9 | pass | 548 of 587 | 284 -> 10 | xite | yes | 93682 | 0.000 | 0.000% | 85.5 |  |

### lumen

| profile | KiB | gates | identity lost | draw calls | engine | loaded | triangles | mean abs delta (0-255) | px > 16 | PSNR dB | note |
|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---|
| lossless | 2697.2 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | identical |  |
| lossless | 2697.2 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | identical |  |
| lossless | 2697.2 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 1372.7 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 1372.7 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | identical |  |
| meshopt-lossless | 1372.7 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | identical |  |
| quantized | 1692.0 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | 82.8 |  |
| quantized | 1692.0 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | 82.0 |  |
| quantized | 1692.0 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | 80.8 |  |
| web | 644.1 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | 82.8 |  |
| web | 644.1 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | 82.0 |  |
| web | 644.1 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | 80.8 |  |
| web-filter | 490.7 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.001 | 0.000% | 73.1 |  |
| web-filter | 490.7 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.001 | 0.000% | 71.1 |  |
| web-filter | 490.7 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.002 | 0.006% | 62.2 |  |
| draco | 231.3 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | 76.4 |  |
| draco | 231.3 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | 77.1 |  |
| draco | 231.3 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.001 | 0.000% | 72.0 |  |
| instanced | 644.1 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | 82.8 |  |
| instanced | 644.1 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | 82.0 |  |
| instanced | 644.1 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | 80.8 |  |
| stock-instance | 2697.2 | pass | 0 of 86 | 34 -> 34 | three | yes | 89568 | 0.000 | 0.000% | identical |  |
| stock-instance | 2697.2 | pass | 0 of 86 | 34 -> 34 | babylon | yes | 89568 | 0.000 | 0.000% | identical |  |
| stock-instance | 2697.2 | pass | 0 of 86 | 34 -> 34 | xite | yes | 89568 | 0.000 | 0.000% | identical |  |
| static-joined | 553.2 | pass | 54 of 86 | 34 -> 7 | three | yes | 89568 | 0.000 | 0.000% | 82.8 |  |
| static-joined | 553.2 | pass | 54 of 86 | 34 -> 7 | babylon | yes | 89568 | 0.000 | 0.000% | 82.0 |  |
| static-joined | 553.2 | pass | 54 of 86 | 34 -> 7 | xite | yes | 89568 | 0.000 | 0.000% | 80.8 |  |

