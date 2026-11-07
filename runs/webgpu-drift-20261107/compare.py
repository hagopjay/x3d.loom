#!/usr/bin/env python3 -I
"""compare.py BABYLON.png XITE.png [more pairs...]: PSNR in dB. 'masked' = over the pixels where either frame has a channel above 14 of 255 (the brain port's convention);
'full' = every pixel. Also prints the mean RGB of each frame over the masked pixels."""
import sys, math
from PIL import Image
import numpy as np
def one(a, b):
    A = np.asarray(Image.open(a).convert('RGB')).astype(float); B = np.asarray(Image.open(b).convert('RGB').resize(Image.open(a).size)).astype(float)
    def ps(x, y): m = ((x - y) ** 2).mean(); return 99.0 if m == 0 else 10 * math.log10(255 * 255 / m)
    mk = (A.max(2) > 14) | (B.max(2) > 14)
    return ps(A, B), ps(A[mk], B[mk]) if mk.any() else 99.0, A[mk].mean(0).round(1) if mk.any() else None, B[mk].mean(0).round(1) if mk.any() else None
if __name__ == '__main__':
    a = sys.argv[1:]
    for i in range(0, len(a), 2):
        full, masked, ma, mb = one(a[i], a[i + 1])
        print('%-28s full %.2f dB  masked %.2f dB  mean babylon %s  mean x_ite %s' % (a[i].split('/')[-1], full, masked, ma, mb))
