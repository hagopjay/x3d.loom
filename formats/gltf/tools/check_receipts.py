"""Check every receipt under a run folder: JSON Schema (loom.render-receipt/1) + sha256 seal over canonical JSON.
    python3 -I tools/check_receipts.py runs/<id> [...]        exit 1 on any failure (needs: pip install jsonschema)"""
import hashlib
from decimal import Decimal
import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "schema/loom.render-receipt-1.schema.json").read_text())


def canonical(v):
    # mirrors src/receipt.mjs: sorted keys, no spaces, JSON.stringify number/string forms
    if isinstance(v, list):
        return "[" + ",".join(canonical(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canonical(v[k]) for k in sorted(v)) + "}"
    if isinstance(v, bool) or v is None:
        return json.dumps(v)
    if isinstance(v, float):
        if v.is_integer() and abs(v) < 1e21:
            return str(int(v))
        r = repr(v)
        if "e" in r and 1e-7 <= abs(v) < 1e21:  # JavaScript prints these in fixed notation (0.000011, not 1.1e-05)
            r = format(Decimal(r), "f")
        return r
    return json.dumps(v, ensure_ascii=False)


bad = 0
n = 0
for d in sys.argv[1:]:
    for f in sorted(Path(d).rglob("receipt.json")):
        n += 1
        r = json.loads(f.read_text())
        errs = [e.message for e in jsonschema.Draft202012Validator(SCHEMA).iter_errors(r)]
        body = {k: v for k, v in r.items() if k != "sha256"}
        seal = hashlib.sha256(canonical(body).encode()).hexdigest() == r["sha256"]
        ok = not errs and seal
        bad += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {f.relative_to(ROOT) if f.is_relative_to(ROOT) else f}  schema {'ok' if not errs else errs[:2]}  seal {'ok' if seal else 'DRIFT'}")
print(f"{n - bad}/{n} receipts valid")
sys.exit(1 if bad else 0)
