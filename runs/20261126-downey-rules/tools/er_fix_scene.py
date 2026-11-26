# writes er-fixed.x3d: the n=100 curve recomputed exactly (Decimal, prec 600), same writer spelling (4 decimals)
import json, math, re, sys
from decimal import Decimal, getcontext
getcontext().prec = 600
def pc(n, p):
    q = 1 - Decimal(p); P = [Decimal(0), Decimal(1)]
    for m in range(2, n + 1):
        s = Decimal(0)
        for k in range(1, m):
            s += math.comb(m - 1, k - 1) * P[k] * q ** (k * (m - k))
        P.append(1 - s)
    return float(P[n])
def num(x, nd=4):
    s = f"{float(x):.{nd}f}".rstrip("0").rstrip("."); return "0" if s in ("-0", "", "-") else s
src, bank, out = sys.argv[1:4]
b = json.load(open(bank)); t = open(src).read()
curve = b["curves"]["100"]
pts = ", ".join(" ".join(num(v) for v in (-9 + 6 * (math.log10(pp) + 3), 12 * pc(100, pp), -10)) for pp, _ in curve)
m = re.search(r'<Coordinate point="(-9 5561196073059931322843136[^"]*)"', t)
t2 = t[:m.start(1)] + pts + t[m.end(1):]
open(out, "w").write(t2); print("replaced", len(curve), "points; max |y| now", max(abs(12 * pc(100, pp)) for pp, _ in curve[:3]))
