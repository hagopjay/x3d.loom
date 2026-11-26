# exact Gilbert recurrence in Decimal (prec 600) vs the bank's float64 values. usage: python -I er_exact.py bank.json
import json, sys, math
from decimal import Decimal, getcontext
getcontext().prec = 600
def pc_dec(n, p):
    q = 1 - Decimal(p); P = [Decimal(0), Decimal(1)]
    for m in range(2, n + 1):
        s = Decimal(0)
        for k in range(1, m):
            s += math.comb(m - 1, k - 1) * P[k] * q ** (k * (m - k))
        P.append(1 - s)
    return P[n]
b = json.load(open(sys.argv[1]))
out = {}
for m, curve in b["curves"].items():
    n = int(m); bad = []; worst = 0.0; first_ok = None
    for i, (pp, P) in enumerate(curve):
        ex = float(pc_dec(n, pp)); err = abs(P - ex); worst = max(worst, err)
        if err > 1e-6: bad.append(i)
    out[m] = {"points": len(curve), "wrong_gt_1e-6": len(bad), "last_wrong_index": max(bad) if bad else None,
              "last_wrong_p": curve[max(bad)][0] if bad else None, "max_abs_error": worst}
    print(m, out[m], flush=True)
for m, w in b["widths"].items():
    print("widths", m, {k: v for k, v in w.items()})
json.dump(out, open(sys.argv[2], "w"), indent=1)
