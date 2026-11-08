import sys, glob, os, json
from PIL import Image
import numpy as np
res = {}
rows = []
for x in sorted(glob.glob('shots/xit_*.png')):
    k = os.path.basename(x)[4:]; b = 'shots/bab_' + k
    if not os.path.exists(b): continue
    X = np.asarray(Image.open(x).convert('RGB'), float); B = np.asarray(Image.open(b).convert('RGB'), float)
    if X.shape != B.shape: B = np.asarray(Image.open(b).convert('RGB').resize((X.shape[1], X.shape[0])), float)
    mse = ((X - B) ** 2).mean(); psnr = 99 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
    res[k[:-4]] = {'psnr_db': round(float(psnr), 1), 'mean_xite': [round(float(v), 1) for v in X.mean((0, 1))], 'mean_babylon': [round(float(v), 1) for v in B.mean((0, 1))], 'luma_ratio_b_over_x': round(float(B.mean() / max(X.mean(), 1e-6)), 3)}
    rows.append(np.hstack([X, B]).astype(np.uint8))
json.dump(res, open('compare.json', 'w'), indent=1); print(json.dumps(res, indent=1))
if rows: Image.fromarray(np.vstack(rows)).save('compare-hall.jpg', quality=86)
