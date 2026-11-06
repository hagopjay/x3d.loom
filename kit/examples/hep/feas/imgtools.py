#!/usr/bin/env python3
"""Image analysis helpers (PIL + numpy; analysis only, the generators stay stdlib).
  imgtools.py stats  a.png [b.png ...]          luminance/saturation/clipping/hue statistics
  imgtools.py diff   a.png b.png                mean/max abs difference, fraction of pixels differing > 8/255
  imgtools.py lw     lw.png x0                  vertical run lengths of bright pixels at column x0 (line thickness ladder)
  imgtools.py sbs    left.png right.png out.png [labelL labelR]   side-by-side, resized to the same height
"""
import sys
import numpy as np
from PIL import Image, ImageDraw


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def stats(p):
    a = load(p) / 255.0
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0.08, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # hue bins on pixels bright enough to carry colour
    sel = mx > 0.25
    hue = np.zeros(a.shape[:2])
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    names = ['red/orange', 'amber/yellow', 'green', 'cyan', 'blue', 'violet/magenta']
    edges = [(345, 360), (0, 15), (15, 70), (70, 160), (160, 200), (200, 260), (260, 345)]
    hist = {}
    tot = max(1, int(sel.sum()))
    hist['red/orange'] = float(((h < 15) | (h >= 345))[sel].sum()) / tot
    hist['amber/yellow'] = float(((h >= 15) & (h < 70))[sel].sum()) / tot
    hist['green'] = float(((h >= 70) & (h < 160))[sel].sum()) / tot
    hist['cyan'] = float(((h >= 160) & (h < 200))[sel].sum()) / tot
    hist['blue'] = float(((h >= 200) & (h < 260))[sel].sum()) / tot
    hist['violet/magenta'] = float(((h >= 260) & (h < 345))[sel].sum()) / tot
    return dict(file=p, size=list(a.shape[1::-1]), mean_luma=round(float(lum.mean()), 4), p50=round(float(np.percentile(lum, 50)), 4), p99=round(float(np.percentile(lum, 99)), 4),
                frac_luma_gt_0_9=round(float((lum > 0.9).mean()), 5), frac_any_channel_255=round(float((a.max(-1) >= 0.999).mean()), 5),
                frac_luma_gt_0_05=round(float((lum > 0.05).mean()), 4), mean_sat_bright=round(float(sat[sel].mean()) if sel.any() else 0, 3),
                hue_share={k: round(v, 3) for k, v in hist.items()}, bright_px_frac=round(float(sel.mean()), 4))


def diff(a, b):
    x, y = load(a), load(b)
    d = np.abs(x - y)
    return dict(a=a, b=b, mean_abs=round(float(d.mean()), 4), max_abs=float(d.max()), frac_gt8=round(float((d.max(-1) > 8).mean()), 5))


def lw(p, x0):
    a = load(p)[..., :].max(-1)
    col = a[:, int(x0)]
    runs, cur = [], 0
    for v in col:
        if v > 128:
            cur += 1
        elif cur:
            runs.append(cur); cur = 0
    if cur:
        runs.append(cur)
    return runs


def sbs(l, r, out, ll='', lr=''):
    A, B = Image.open(l).convert('RGB'), Image.open(r).convert('RGB')
    h = 540
    A = A.resize((int(A.width * h / A.height), h)); B = B.resize((int(B.width * h / B.height), h))
    im = Image.new('RGB', (A.width + B.width + 6, h + 22), (24, 24, 24))
    im.paste(A, (0, 22)); im.paste(B, (A.width + 6, 22))
    dr = ImageDraw.Draw(im); dr.text((6, 5), ll, fill=(255, 255, 255)); dr.text((A.width + 12, 5), lr, fill=(255, 255, 255))
    im.save(out)


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'stats':
        for p in sys.argv[2:]:
            print(stats(p))
    elif c == 'diff':
        print(diff(sys.argv[2], sys.argv[3]))
    elif c == 'lw':
        print(lw(sys.argv[2], sys.argv[3]))
    elif c == 'sbs':
        sbs(*sys.argv[2:])
