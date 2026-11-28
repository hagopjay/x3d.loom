# Render matrix, four engines (28 Nov 2026)

three.js 0.187.0, Babylon.js 9.32.0, X_ITE 16.7.1, PlayCanvas 2.24.1; Chromium 158.0.8127.36 headless (Playwright), ANGLE on SwiftShader, 256 px. Made by `node render/matrix.mjs --size 256 --json ... --md ...`.

### stilllife

| variant | bytes | engine | loaded | meshes | triangles | non-bg px | mean delta vs original | px>16 | errors |
|---|---:|---|---|---:|---:|---:|---:|---:|---|
| original | 1684916 | three | yes | 5 | 27560 | 35.3% | - | - |  |
| meshopt | 1006264 | three | yes | 5 | 27560 | 35.4% | 0.031 | 0.024% |  |
| meshoptMedium | 1098492 | three | yes | 5 | 27560 | 35.4% | 0.008 | 0.014% |  |
| draco | 827640 | three | yes | 5 | 27560 | 35.4% | 0.010 | 0.006% |  |
| quantize | 1385940 | three | yes | 5 | 27560 | 35.4% | 0.008 | 0.014% |  |
| dracoCoarse | 757236 | three | yes | 5 | 27560 | 35.8% | 0.652 | 1.575% |  |
| ktx2 | 1107284 | three | yes | 5 | 27560 | 35.3% | 0.005 | 0.000% |  |
| ktx2Uastc | 1861988 | three | yes | 5 | 27560 | 35.3% | 0.002 | 0.000% |  |
| all | 349292 | three | yes | 5 | 27560 | 35.4% | 0.035 | 0.024% |  |
| nolights | 1683544 | three | yes | 5 | 27560 | 25.7% | - | - |  |
| original | 1684916 | babylon | yes | 5 | 27560 | 35.2% | - | - |  |
| meshopt | 1006264 | babylon | yes | 5 | 27560 | 35.2% | 0.028 | 0.031% |  |
| meshoptMedium | 1098492 | babylon | yes | 5 | 27560 | 35.2% | 0.008 | 0.014% |  |
| draco | 827640 | babylon | yes | 5 | 27560 | 35.2% | 0.009 | 0.009% |  |
| quantize | 1385940 | babylon | yes | 5 | 27560 | 35.2% | 0.008 | 0.014% |  |
| dracoCoarse | 757236 | babylon | yes | 5 | 27560 | 35.7% | 0.581 | 1.283% |  |
| ktx2 | 1107284 | babylon | NO | - | - | - | - | - | timeout after 20000 ms while rendering with babylon |
| ktx2Uastc | 1861988 | babylon | NO | - | - | - | - | - | timeout after 20000 ms while rendering with babylon |
| all | 349292 | babylon | NO | - | - | - | - | - | timeout after 20000 ms while rendering with babylon |
| nolights | 1683544 | babylon | yes | 5 | 27560 | 35.2% | - | - |  |
| original | 1684916 | xite | yes | 5 | 27560 | 35.2% | - | - |  |
| meshopt | 1006264 | xite | yes | 5 | 27560 | 35.2% | 0.024 | 0.026% |  |
| meshoptMedium | 1098492 | xite | yes | 5 | 27560 | 35.2% | 0.008 | 0.015% |  |
| draco | 827640 | xite | yes | 5 | 27560 | 35.2% | 0.007 | 0.006% |  |
| quantize | 1385940 | xite | yes | 5 | 27560 | 35.2% | 0.008 | 0.015% |  |
| dracoCoarse | 757236 | xite | yes | 5 | 27560 | 35.7% | 0.517 | 1.022% |  |
| ktx2 | 1107284 | xite | yes | 5 | 27560 | 35.2% | 0.017 | 0.003% |  |
| ktx2Uastc | 1861988 | xite | yes | 5 | 27560 | 35.2% | 0.017 | 0.005% |  |
| all | 349292 | xite | yes | 5 | 27560 | 35.2% | 0.041 | 0.031% |  |
| nolights | 1683544 | xite | yes | 5 | 27560 | 35.2% | - | - |  |
| original | 1684916 | playcanvas | yes | 5 | 27560 | 35.3% | - | - |  |
| meshopt | 1006264 | playcanvas | yes | 5 | 27560 | 35.3% | 0.022 | 0.017% |  |
| meshoptMedium | 1098492 | playcanvas | yes | 5 | 27560 | 35.3% | 0.005 | 0.006% |  |
| draco | 827640 | playcanvas | yes | 5 | 27560 | 35.3% | 0.010 | 0.008% |  |
| quantize | 1385940 | playcanvas | yes | 5 | 27560 | 35.3% | 0.005 | 0.006% |  |
| dracoCoarse | 757236 | playcanvas | yes | 5 | 27560 | 35.8% | 0.592 | 1.640% |  |
| ktx2 | 1107284 | playcanvas | NO | - | - | - | - | - | page.evaluate: Error: Basis module not found. Asset [marble-0](marble-0) basis t |
| ktx2Uastc | 1861988 | playcanvas | NO | - | - | - | - | - | page.evaluate: Error: Basis module not found. Asset [marble-0](marble-0) basis t |
| all | 349292 | playcanvas | NO | - | - | - | - | - | page.evaluate: Error: Basis module not found. Asset [marble-0](marble-0) basis t |
| nolights | 1683544 | playcanvas | yes | 5 | 27560 | 35.1% | - | - |  |

### prismatica

| variant | bytes | engine | loaded | meshes | triangles | non-bg px | mean delta vs original | px>16 | errors |
|---|---:|---|---|---:|---:|---:|---:|---:|---|
| original | 1219372 | three | yes | 1218 | 600976 | 14.5% | - | - |  |
| meshopt | 597820 | three | yes | 1218 | 600976 | 14.5% | 0.055 | 0.018% |  |
| meshoptMedium | 653336 | three | yes | 1218 | 600976 | 14.5% | 0.054 | 0.018% |  |
| draco | 519312 | three | yes | 1218 | 600976 | 14.5% | 0.022 | 0.008% |  |
| quantize | 899012 | three | yes | 1218 | 600976 | 14.5% | 0.054 | 0.018% |  |
| dracoCoarse | 457112 | three | yes | 1218 | 600976 | 14.7% | 0.946 | 2.565% |  |
| instance | 540292 | three | yes | 10 | 600976 | 14.5% | 0.000 | 0.000% |  |
| all | 188848 | three | yes | 10 | 600976 | 14.5% | 0.055 | 0.018% |  |
| nolights | 1216756 | three | yes | 1218 | 600976 | 14.4% | - | - |  |
| original | 1219372 | babylon | yes | 1218 | 600976 | 14.4% | - | - |  |
| meshopt | 597820 | babylon | yes | 1218 | 600976 | 14.4% | 0.078 | 0.017% |  |
| meshoptMedium | 653336 | babylon | yes | 1218 | 600976 | 14.4% | 0.074 | 0.017% |  |
| draco | 519312 | babylon | yes | 1218 | 600976 | 14.4% | 0.020 | 0.008% |  |
| quantize | 899012 | babylon | yes | 1218 | 600976 | 14.4% | 0.074 | 0.017% |  |
| dracoCoarse | 457112 | babylon | yes | 1218 | 600976 | 14.6% | 0.919 | 2.475% |  |
| instance | 540292 | babylon | yes | 10 | 600976 | 14.4% | 0.000 | 0.000% |  |
| all | 188848 | babylon | yes | 10 | 600976 | 14.4% | 0.078 | 0.017% |  |
| nolights | 1216756 | babylon | yes | 1218 | 600976 | 9.8% | - | - |  |
| original | 1219372 | xite | yes | 1218 | 600976 | 14.4% | - | - |  |
| meshopt | 597820 | xite | yes | 1218 | 600976 | 14.4% | 0.017 | 0.012% |  |
| meshoptMedium | 653336 | xite | yes | 1218 | 600976 | 14.4% | 0.013 | 0.012% |  |
| draco | 519312 | xite | yes | 1218 | 600976 | 14.4% | 0.009 | 0.008% |  |
| quantize | 899012 | xite | yes | 1218 | 600976 | 14.4% | 0.013 | 0.012% |  |
| dracoCoarse | 457112 | xite | yes | 1218 | 600976 | 14.6% | 0.566 | 2.090% |  |
| instance | 540292 | xite | yes | 10 | 600976 | 14.4% | 0.000 | 0.000% |  |
| all | 188848 | xite | yes | 10 | 600976 | 14.4% | 0.017 | 0.012% |  |
| nolights | 1216756 | xite | yes | 1218 | 600976 | 13.6% | - | - |  |
| original | 1219372 | playcanvas | yes | 1218 | 600976 | 14.4% | - | - |  |
| meshopt | 597820 | playcanvas | yes | 1218 | 600976 | 14.4% | 0.056 | 0.018% |  |
| meshoptMedium | 653336 | playcanvas | yes | 1218 | 600976 | 14.4% | 0.054 | 0.018% |  |
| draco | 519312 | playcanvas | yes | 1218 | 600976 | 14.4% | 0.022 | 0.008% |  |
| quantize | 899012 | playcanvas | yes | 1218 | 600976 | 14.4% | 0.054 | 0.018% |  |
| dracoCoarse | 457112 | playcanvas | yes | 1218 | 600976 | 14.6% | 0.938 | 2.505% |  |
| instance | 540292 | playcanvas | yes | 10 | 600976 | 14.4% | 0.000 | 0.000% |  |
| all | 188848 | playcanvas | yes | 10 | 600976 | 14.4% | 0.054 | 0.018% |  |
| nolights | 1216756 | playcanvas | yes | 1218 | 600976 | 13.8% | - | - |  |

